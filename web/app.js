document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const search = document.getElementById('search');
  let allWords = [];
  try {
    const res = await fetch('/api/words');
    const data = await res.json();
    allWords = data.words || [];
    status.textContent = `${allWords.length} words published`;
    render(allWords);
  } catch (e) {
    status.textContent = 'Failed: ' + e;
  }
  function render(words) {
    list.innerHTML = words.map(w => {
      const c = w.word_content?.[0] || {};
      return `<div class=card><h2>${w.word}</h2><p>${c.simple_meaning||''}</p><div>${(c.synonyms||[]).slice(0,5).map(s=>`<span class=badge>${s}</span>`).join('')}</div><small>${(c.examples||[])[0]||''}</small></div>`;
    }).join('');
  }
  search.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    render(allWords.filter(w => w.word.toLowerCase().includes(q)));
  });
});
