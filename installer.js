// Page « Installer dans OBS » : connexion au serveur WebSocket d'OBS, choix des scènes, installation.
// Adresse : https://<site>/installer.html#cle=…  (envoyée par /overlay lien sur Discord)
'use strict';

(() => {
  const { ObsClient, install, NAMES } = window.ObsInstaller;
  const SITE = location.origin;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.hash.slice(1));
  // La clé ne reste pas visible dans l'adresse (captures d'écran, partage d'écran) ; elle est gardée
  // pour cet onglet seulement, pour qu'un rechargement (F5, Ctrl+F5) ne casse pas la page.
  const memo = {
    get() { try { return sessionStorage.getItem('cle') || ''; } catch { return ''; } },
    set(v) { try { sessionStorage.setItem('cle', v); } catch { /* stockage bloqué : tant pis */ } },
  };
  const key = params.get('cle') || memo.get();
  if (params.get('cle')) memo.set(key);
  if (key && history.replaceState) history.replaceState(null, '', location.pathname);

  const ERRORS = {
    connexion: 'Impossible de joindre OBS. Vérifie qu\'OBS est ouvert, que le serveur WebSocket est activé (étape 1) et que le port est le bon. Si ton navigateur demande l\'accès au réseau local, accepte.',
    'mot-de-passe': 'Mot de passe OBS incorrect. Recopie-le depuis « Afficher les informations de connexion ».',
    'mot-de-passe-requis': 'OBS demande un mot de passe : colle-le dans le champ ci-dessus.',
    'source-navigateur': 'Ton OBS n\'a pas la source « Navigateur ». Installe la version complète d\'OBS (obsproject.com).',
  };

  const status = (text, kind = 'info') => {
    const el = $('status');
    el.textContent = text;
    el.className = `status ${kind}`;
    el.hidden = false;
  };
  const log = (text) => {
    const li = document.createElement('li');
    li.textContent = text;
    $('log').append(li);
  };

  if (!/^[A-Za-z0-9_-]{43}$/.test(key)) {
    $('no-key').hidden = false;
    $('step-connect').hidden = true;
    return;
  }

  let obs = null;
  const separate = () => document.querySelector('input[name="mode"]:checked').value === 'separe';
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.addEventListener('change', () => { $('current-options').hidden = separate(); });
  }

  $('connect').addEventListener('click', async () => {
    const btn = $('connect');
    btn.disabled = true;
    status('Connexion à OBS…');
    obs?.close();
    obs = new ObsClient(`ws://127.0.0.1:${Number($('port').value) || 4455}`);
    try {
      await obs.connect($('password').value);
      const { scenes } = await obs.request('GetSceneList');
      const ours = new Set(Object.values(NAMES.scenes).map(([s]) => s));
      // OBS liste les scènes de bas en haut : on les remet dans l'ordre du panneau Scènes.
      const list = scenes.map((s) => s.sceneName).filter((n) => !ours.has(n)).reverse();
      const box = $('scene-list');
      box.replaceChildren(...list.map((name) => {
        const label = document.createElement('label');
        label.className = 'check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = name;
        cb.checked = list.length === 1;
        label.append(cb, document.createTextNode(` ${name}`)); // nom affiché tel quel, jamais interprété comme du HTML
        return label;
      }));
      if (!list.length) box.textContent = 'Aucune scène pour l\'instant : seules les 4 scènes plein écran seront créées.';
      $('step-install').hidden = false;
      status('Connecté à OBS ✓ — choisis où installer, puis clique « Installer dans OBS ».', 'ok');
      $('step-install').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      status(ERRORS[err.code] ?? `Erreur : ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  });

  $('install').addEventListener('click', async () => {
    const btn = $('install');
    btn.disabled = true;
    $('log').replaceChildren();
    status('Installation en cours…');
    try {
      const addTo = [...document.querySelectorAll('#scene-list input:checked')].map((cb) => cb.value);
      const done = await install(obs, {
        siteUrl: SITE,
        key,
        addTo,
        scenes: $('scenes').checked,
        separate: separate(),
        options: { coin: $('coin').value, theme: $('theme').value, son: $('son').checked },
      }, log);
      if (done.collection) {
        status(`C'est prêt ✓ OBS est passé sur le profil et la collection « ${done.collection} ». Il te reste :\n`
          + '1. Paramètres → Stream → « Connecter le compte » (Twitch) : le nouveau profil n\'a pas ta clé de stream, c\'est voulu.\n'
          + '2. Dans la scène « Event · En live » : ajoute ta capture de jeu, ta webcam et ton micro, sous l\'overlay.\n'
          + '3. Pour revenir à ta chaîne : menu Profil ET menu Collection de scènes → ton ancien nom.', 'ok');
        return;
      }
      const parts = [];
      if (done.scenes.length) parts.push(`${done.scenes.length} scènes plein écran`);
      if (done.overlay.length) parts.push(`l'overlay dans ${done.overlay.length} scène${done.overlay.length > 1 ? 's' : ''}`);
      status(`C'est prêt ! ${parts.join(' et ') || 'Rien à installer'} ✓ — tu peux fermer cette page. Pour mettre à jour plus tard, relance simplement l'installation.`, 'ok');
    } catch (err) {
      status(ERRORS[err.code] ?? `Erreur d'OBS : ${err.detail || err.message}`, 'err');
    } finally {
      btn.disabled = false;
    }
  });
})();
