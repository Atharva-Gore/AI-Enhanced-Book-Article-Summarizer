// script.js
// Simple summarizer + optional OpenAI integration (client-side). For production, use a server proxy.

const sourceType = document.getElementById('sourceType');
const textInput = document.getElementById('textInput');
const urlInput = document.getElementById('urlInput');
const fileInput = document.getElementById('fileInput');
const summarizeBtn = document.getElementById('summarizeBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const apiKeyInput = document.getElementById('apiKey');
const useAiSelect = document.getElementById('useAi');

const summaryEl = document.getElementById('summary');
const keywordsEl = document.getElementById('keywords');
const highlightsEl = document.getElementById('highlights');

sourceType.addEventListener('change', ()=>{
  const v = sourceType.value;
  urlInput.style.display = v==='url' ? 'inline-block' : 'none';
  fileInput.style.display = v==='file' ? 'inline-block' : 'none';
  textInput.style.display = v==='paste' ? 'block' : 'none';
});

fileInput.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  if(f.name.endsWith('.txt')){
    const t = await f.text();
    textInput.value = t;
  } else if(f.name.endsWith('.pdf')){
    // Minimal client-side PDF text extraction using pdf.js would be ideal; for demo we'll alert user
    alert('PDF uploaded. This demo does not extract PDF text in-browser. For full support, use a server-side extractor or integrate pdf.js.');
  } else {
    alert('Unsupported file type. Use .txt or .pdf');
  }
});

clearBtn.addEventListener('click', ()=>{
  textInput.value = '';
  summaryEl.textContent = 'No summary yet — click Summarize.';
  keywordsEl.textContent = '';
  highlightsEl.textContent = '';
});

downloadBtn.addEventListener('click', ()=>{
  const text = `Summary:\n\n${summaryEl.textContent}\n\nKeywords:\n${keywordsEl.textContent}\n\nHighlights:\n${highlightsEl.textContent}`;
  const blob = new Blob([text], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'summary.txt'; a.click();
  URL.revokeObjectURL(url);
});

async function fetchURLText(url){
  try{
    // Basic fetch: many sites block CORS — in production use server-side fetch.
    const res = await fetch(url);
    const html = await res.text();
    // rudimentary extraction of main text
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    // remove scripts/styles
    tmp.querySelectorAll('script,style,iframe,nav').forEach(n=>n.remove());
    const paragraphs = Array.from(tmp.querySelectorAll('p')).map(p=>p.innerText).filter(Boolean);
    return paragraphs.join('\n\n');
  }catch(err){
    console.error(err);
    throw new Error('Failed to fetch URL (CORS or network issue). Use server-side proxy for reliable URL fetching.');
  }
}

// Simple extractive summarizer: picks top sentences by word overlap with top terms
function extractiveSummarize(text, mode='standard'){
  const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];
  const words = text.toLowerCase().match(/\b[a-z0-9']{3,}\b/g) || [];
  const freq = {};
  const stop = ['the','and','for','with','that','this','have','from','were','which','when','what','where','are','but','not','you','your','all','their','they'];
  words.forEach(w=>{ if(!stop.includes(w)){ freq[w]=(freq[w]||0)+1 } });
  const topWords = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,20).map(x=>x[0]);
  const scoreSentence = s=>{
    const sw = s.toLowerCase().match(/\b[a-z0-9']{3,}\b/g)||[];
    let sc=0; sw.forEach(w=>{ if(topWords.includes(w)) sc+=1; });
    sc += Math.min(2, sw.length/20); // small boost for longer sentences
    return sc;
  }
  const scored = sentences.map(s=>({s,sc:scoreSentence(s)})).sort((a,b)=>b.sc-a.sc);
  let pickCount = mode==='concise'? Math.max(1,Math.round(sentences.length*0.03)) : mode==='detailed'? Math.max(3,Math.round(sentences.length*0.2)) : Math.max(2,Math.round(sentences.length*0.08));
  pickCount = Math.min(pickCount, Math.max(1, sentences.length));
  const picked = scored.slice(0,pickCount).sort((a,b)=>text.indexOf(a.s)-text.indexOf(b.s)).map(x=>x.s.trim());
  return {summary:picked.join(' '), keywords:topWords.slice(0,12), highlights:picked};
}

async function callOpenAISummarize(text, options={mode:'standard',apiKey:''}){
  // This function calls OpenAI's completion API directly from browser for demo only.
  // WARNING: Embedding API keys in client-side code is insecure. Prefer server-side proxy.
  const prompt = `You are a helpful summarizer. Produce a ${options.mode} summary of the text below. Also return keywords (comma-separated) and 3 important highlights. Format as JSON with fields: summary, keywords, highlights.\n\nTEXT:\n${text}`;
  const key = options.apiKey;
  if(!key) throw new Error('No API key supplied for OpenAI request');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Bearer ${key}`
    },
    body: JSON.stringify({
      model:'gpt-4o-mini',
      messages:[{role:'user',content:prompt}],
      max_tokens:600,
      temperature:0.2
    })
  });
  if(!resp.ok){
    const txt = await resp.text();
    throw new Error('OpenAI error: '+txt);
  }
  const j = await resp.json();
  const content = j.choices?.[0]?.message?.content || j.choices?.[0]?.text;
  // Attempt to parse JSON from content
  try{
    const parsed = JSON.parse(content);
    return parsed;
  }catch(e){
    // fallback: naive split
    const summary = content;
    return {summary, keywords:[], highlights:[]};
  }
}

summarizeBtn.addEventListener('click', async ()=>{
  summarizeBtn.disabled = true; summarizeBtn.textContent = 'Summarizing...';
  try{
    let text = '';
    const mode = document.getElementById('mode').value;
    const extras = document.getElementById('extras').value;
    const useAi = useAiSelect.value;

    if(sourceType.value==='url'){
      const url = urlInput.value.trim();
      if(!url) throw new Error('Please provide a URL');
      text = await fetchURLText(url);
    } else if(sourceType.value==='file'){
      if(!fileInput.files[0]) throw new Error('Please select a file');
      // We already loaded .txt into text area on file select; use it if present
      text = textInput.value.trim();
      if(!text) throw new Error('File text not loaded; open the file as .txt and try again.');
    } else {
      text = textInput.value.trim();
      if(!text) throw new Error('Please paste or enter text to summarize.');
    }

    let result;
    if(useAi==='local'){
      result = extractiveSummarize(text, mode);
    } else {
      // attempt AI
      const apiKey = apiKeyInput.value.trim();
      if(!apiKey){
        // fallback to local if no key
        result = extractiveSummarize(text, mode);
      } else {
        try{
          result = await callOpenAISummarize(text,{mode,apiKey});
        }catch(err){
          console.error('AI call failed',err);
          // fallback to extractive
          result = extractiveSummarize(text, mode);
        }
      }
    }

    // display
    summaryEl.textContent = result.summary || '—';
    keywordsEl.textContent = (result.keywords || []).join(', ');
    highlightsEl.textContent = (result.highlights || []).join('\n');
  }catch(err){
    alert(err.message || 'An error occurred');
  }finally{
    summarizeBtn.disabled = false; summarizeBtn.textContent = 'Summarize';
  }
});

// End of script
