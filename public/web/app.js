document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('status');
  const list = document.getElementById('list');
  const search = document.getElementById('search');
  let allWords = [];
  try {
    const res = await fetch('/api/words');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    allWords = data.words || [];
    status.textContent = allWords.length + ' words published';
    render(allWords);
  } catch (e) {
    status.textContent = 'API Error: ' + e.message;
  }
  function render(words) {
    list.innerHTML = words.map(w => `<div class=card><h2>${w.word || w.id}</h2><p>${w.meaning || w.definition || ''}</p><small>Status: ${w.status}</small></div>`).join('');
  }
  if (search) {
    search.addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      render(allWords.filter(w => (w.word||'').toLowerCase().includes(q)));
    });
  }
});
