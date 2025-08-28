// Summarization function (demo version)
function summarizeText() {
  let input = document.getElementById("inputText").value.trim();
  let resultDiv = document.getElementById("result");

  if (input.length === 0) {
    resultDiv.innerHTML = "⚠️ Please paste some text first!";
    return;
  }

  // ✨ For now, fake summarization (first 3 sentences)
  let sentences = input.split(/[.?!]/).filter(s => s.trim().length > 0);
  let summary = sentences.slice(0, 3).join(". ") + ".";
  
  resultDiv.innerHTML = summary || "⚠️ Could not generate summary.";
}

// Dark Mode Toggle
document.getElementById("toggleTheme").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  let btn = document.getElementById("toggleTheme");
  btn.textContent = document.body.classList.contains("dark") ? "☀️ Light Mode" : "🌙 Dark Mode";
});
