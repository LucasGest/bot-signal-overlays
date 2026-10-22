// Page « Chat StreamElements » : copie le code du widget (fichiers de streamelements/) dans le presse-papiers.
// Les fichiers sont chargés dès l'ouverture : au clic, la copie part tout de suite (certains navigateurs
// refusent une copie qui arrive après un téléchargement). Méthode de secours si l'API est refusée.
'use strict';

(() => {
  const status = document.getElementById('status');
  const show = (text, kind) => {
    status.textContent = text;
    status.className = `status ${kind}`;
    status.hidden = false;
  };

  const texts = new Map();
  const load = (file) => fetch(file, { cache: 'no-store' })
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
    .then((t) => texts.set(file, t));

  /** Secours : texte sélectionné dans un champ caché, puis copie « classique ». */
  const fallbackCopy = (text) => {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'offscreen';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('copie refusée par le navigateur');
  };

  for (const btn of document.querySelectorAll('button.copy')) {
    const label = btn.textContent;
    const file = btn.dataset.file;
    const ready = load(file).catch((err) => show(`Chargement de ${file} impossible (${err.message}). Recharge la page.`, 'err'));
    btn.addEventListener('click', async () => {
      try {
        if (!texts.has(file)) await ready;
        const text = texts.get(file);
        if (text == null) throw new Error('fichier non chargé');
        try { await navigator.clipboard.writeText(text); } catch { fallbackCopy(text); }
        btn.textContent = 'Copié ✓';
        btn.classList.add('done');
        show(`${label.replace('Copier', 'Copié :')} — colle-le dans l'onglet du même nom.`, 'ok');
        setTimeout(() => { btn.textContent = label; }, 2500);
      } catch (err) {
        show(`Copie impossible (${err.message}). Recharge la page et réessaie.`, 'err');
      }
    });
  }
})();
