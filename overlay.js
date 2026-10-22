// Overlay OBS du Bot Signal (F-40 à F-46).
// Adresse : https://<site des overlays>/#cle=…  Options après le # (séparées par &) :
//   scene=debut         scène plein écran « Ça commence bientôt »
//   scene=pause         scène plein écran « Petite pause »
//   scene=veille        scène plein écran « En veille » (sommeil)
//   scene=fin           scène plein écran « Fin du stream » (raid, classement)
//   coin=bg|bd|hg|hd    coin du widget (bas-gauche par défaut)
//   theme=clair         cartes claires (packs blancs / minimalistes)
//   son=0               sans le son de l'alerte
//   cam=0               sans le cadre de la webcam (overlay principal)
//   bandeau=0           sans le bandeau défilant (overlay principal)
//   chat=0              sans le chat Twitch (scène pause)
//   demo                aperçu sans clé : fait défiler tous les écrans (pour placer l'overlay dans OBS)
//   cadre=pause         source à part : cadre de la webcam de la scène Pause (posé au-dessus de la webcam)
//   chaine=nom         avec demo et scene=pause : affiche le vrai chat de cette chaîne
'use strict';

(() => {
  const params = new URLSearchParams(location.hash.slice(1));
  const opt = {
    cle: params.get('cle') || '',
    scene: ['debut', 'pause', 'veille', 'fin'].includes(params.get('scene')) ? params.get('scene') : null,
    coin: ['bg', 'bd', 'hg', 'hd'].includes(params.get('coin')) ? params.get('coin') : 'bg',
    theme: params.get('theme') === 'clair' ? 'clair' : 'sombre',
    son: params.get('son') !== '0',
    cam: params.get('cam') !== '0',
    bandeau: params.get('bandeau') !== '0',
    chat: params.get('chat') !== '0',
    chatExt: params.get('chat') === 'ext', // chat StreamElements posé par-dessus le panneau dans OBS
    demo: params.has('demo'),
    cadre: params.get('cadre') === 'pause',
  };
  // La clé reste dans l'adresse : le bouton « Actualiser » d'OBS recharge l'adresse courante
  // (elle n'apparaît jamais à l'écran dans OBS).

  document.documentElement.dataset.theme = opt.theme;
  const $ = (id) => document.getElementById(id);
  const stack = $('stack');
  stack.dataset.coin = opt.coin;
  document.body.dataset.coin = opt.coin;

  // Logos (logo-event.png, logo-bot.png à côté de la page) : sans fichier, le logo texte reste affiché.
  for (const img of document.querySelectorAll('img[data-logo]')) {
    const ok = () => img.parentElement.classList.add('has-img');
    if (img.complete && img.naturalWidth) ok();
    img.addEventListener('load', ok);
    img.addEventListener('error', () => img.remove());
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const clock = (ms) => {
    const t = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(t / 3600);
    return (h ? `${pad(h)}:` : '') + `${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
  };
  const hour = (ms) => new Date(ms).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
  const day = (ms) => new Date(ms).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  let snap = null;
  let offset = 0; // heure du serveur − heure de la machine
  const now = () => Date.now() + offset;

  // ───────────── Son de l'alerte (généré, aucun fichier) ─────────────
  function playSignal() {
    if (!opt.son) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      const beep = (t, f, d) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(f, ctx.currentTime + t);
        g.gain.setValueAtTime(0, ctx.currentTime + t);
        g.gain.linearRampToValueAtTime(0.5, ctx.currentTime + t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);
        o.connect(g).connect(master);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + d + 0.05);
      };
      // « bip-bip-bip … bip montant » : un signal radio
      [0, 0.18, 0.36].forEach((t) => beep(t, 880, 0.12));
      [0.8, 0.98, 1.16].forEach((t) => beep(t, 880, 0.12));
      beep(1.6, 660, 0.25);
      beep(1.9, 990, 0.6);
      setTimeout(() => ctx.close(), 3500);
    } catch { /* pas de son possible : l'animation suffit */ }
  }

  // ───────────── Animation plein écran (une fois par alerte) ─────────────
  const seenIntro = new Set();
  function intro(a) {
    const key = `${a.no}`;
    if (seenIntro.has(key)) return;
    seenIntro.add(key);
    $('intro-kicker').textContent = a.libelle;
    $('intro-sub').textContent = a.phase === 'vote' ? 'Le chat vote pour le jeu !' : (a.jeu ? `${a.jeu} · 10 min pour se rejoindre` : '');
    const el = $('intro');
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth; // relance l'animation
    el.style.animation = '';
    playSignal();
    setTimeout(() => { el.hidden = true; }, 5200);
  }

  // ───────────── Rendu ─────────────
  function widgetHtml(s) {
    if (s.event.etat === 'avant') {
      const left = s.event.debut ? s.event.debut - now() : 0;
      const days = Math.floor(left / 86400000);
      return `<div class="kicker">📡 ${esc(s.event.nom)}</div>
        <div class="soon-title">Bientôt</div>
        <div class="soon-count">${left > 0 ? `${days ? `${days}<small>j</small> ` : ''}${clock(left % 86400000)}` : '<small>Lancement imminent…</small>'}</div>
        ${s.streamer.frequence ? `<div class="w-note">Fréquence <b class="mono">${esc(s.streamer.frequence)}</b></div>` : ''}`;
    }
    const j = s.jauge;
    const pct = j ? Math.round((j.points / j.seuil) * 100) : 0;
    const note = s.event.etat === 'termine' ? 'Event terminé · merci à tous 💜'
      : s.pause ? `⏸ Pause jusqu'à ${hour(s.pause)}` : '';
    return `<div class="w-top">
        <div><div class="kicker">Fréquence</div><div class="w-freq">${esc(s.streamer.frequence || '—')}<small>MHz</small></div></div>
        <div class="w-signals"><div class="kicker">Signaux</div><b>${s.signaux}</b></div>
      </div>
      ${j ? `<div class="w-row"><span>Jauge de l'event</span><b>${j.points}/${j.seuil}</b></div>
      <div class="bar${pct >= 100 ? ' full' : ''}"><i data-w="${pct}"></i></div>` : ''}
      ${note ? `<div class="w-note">${esc(note)}</div>` : ''}`;
  }

  function players(list) {
    return `<div class="p-players">${list.map((p) => {
      const cls = p.parti ? 'gone' : p.retard ? 'late' : p.arrive ? 'on' : '';
      const mark = p.parti ? '' : p.premier ? '🥇 ' : p.arrive ? '✓ ' : '';
      return `<span class="chip ${cls}${p.moi ? ' me' : ''}">${mark}${esc(p.pseudo)}</span>`;
    }).join('')}</div>`;
  }

  function panelHtml(s) {
    const a = s.alerte;
    if (a && a.concerne) {
      if (a.phase === 'vote') {
        const v = a.vote;
        const best = Math.max(...v.options.map((o) => o.votes));
        return ['alert', `<div class="p-kicker">${esc(a.libelle)} · vote du chat</div>
          <div class="p-label">Tapez <b class="mono">!vote 1</b>, <b class="mono">2</b> ou <b class="mono">3</b> dans le chat · fin dans <b class="mono">${clock(v.finA - now())}</b></div>
          ${v.options.map((o, i) => `<div class="vote-opt${o.votes && o.votes === best ? ' win' : ''}">
            <div class="w-row"><span><b>${i + 1}</b>${esc(o.nom)}</span><span class="mono">${o.votes}</span></div>
            <div class="bar"><i data-w="${v.total ? Math.round((o.votes / v.total) * 100) : 0}"></i></div></div>`).join('')}`];
      }
      if (a.phase === 'countdown') {
        const left = a.rejoindreAvant - now();
        return ['alert', `<div class="p-kicker">${esc(a.libelle)}</div>
          <div class="p-game">${esc(a.jeu)}</div>
          <div class="p-timer${left < 60000 ? ' urgent' : ''}">${clock(left)}</div>
          <div class="p-label">pour rejoindre le lobby</div>
          ${players(a.joueurs)}`];
      }
      const left = a.partieFin - now();
      return ['alert', `<div class="p-kicker">En partie${a.prolongations ? ` · prolongée ×${a.prolongations}` : ''}</div>
        <div class="p-game">${esc(a.jeu)}</div>
        <div class="p-timer">${clock(now() - a.partieDebut)}</div>
        <div class="p-label">${left > 0 ? `fin dans <b class="mono">${clock(left)}</b> au moins` : 'temps minimum atteint'}</div>
        ${players(a.joueurs)}`];
    }
    if (a) {
      return ['banner', `<span class="p-kicker"></span><span>Alerte en cours${a.jeu ? ` · <b>${esc(a.jeu)}</b>` : ''}</span>`];
    }
    if (s.fin) {
      const f = s.fin;
      if (f.annulee) return ['', `<div class="kicker">Alerte annulée</div><div class="p-label">Souci technique : on reprend le stream normalement.</div>`];
      return ['', `<div class="kicker">🏁 Fin de l'alerte</div>
        <div class="p-game">Merci à ${esc(f.joueurs.join(', '))} 💜</div>
        <div class="p-label">${f.points ? `+${f.points} pt${f.points > 1 ? 's' : ''} pour ${esc(s.streamer.pseudo)}` : ''}${f.gages.length ? ` · gage pour ${esc(f.gages.join(', '))} 😈` : ''}</div>`];
    }
    return null;
  }

  // La politique de sécurité de la page interdit les styles écrits dans le HTML :
  // les largeurs des barres sont posées par le script (autorisé).
  function setHtml(el, html) {
    if (el.dataset.html === html) return; // rien de changé : pas de redessin
    el.dataset.html = html;
    el.innerHTML = html;
    el.querySelectorAll('[data-w]').forEach((bar) => { bar.style.width = `${Math.max(0, Math.min(100, Number(bar.dataset.w) || 0))}%`; });
  }

  // ───────────── Scènes plein écran ─────────────
  const SCENES = {
    debut: (s) => {
      // Avant l'event : compte à rebours tant que la date de début n'est pas passée, puis « imminent ».
      const left = s.event.etat === 'avant' && s.event.debut ? s.event.debut - now() : 0;
      return {
        badge: '📡',
        kicker: s.event.nom,
        title: 'Ça commence bientôt',
        text: s.event.etat !== 'avant' ? 'Installe-toi : le Signal peut tomber à tout moment 👀'
          : left > 0 ? "Lancement de l'event dans" : "Lancement de l'event imminent 🚀",
        extra: left > 0 ? countdown(left) : '',
      };
    },
    pause: (s) => ({
      badge: '☕',
      kicker: s.event.nom,
      title: 'Petite pause',
      text: "Je reviens très vite !<br>Pendant ce temps, l'event continue sur les autres chaînes.",
    }),
    veille: (s) => ({
      badge: '🌙',
      kicker: s.event.nom,
      title: 'En veille',
      text: "Le streamer recharge les batteries 😴<br>L'event continue sur les autres chaînes.",
    }),
    fin: (s) => {
      const others = s.enLive.filter((x) => !x.moi);
      const rank = s.classement.filter((x) => x.points > 0);
      const next = others.length ? "<br>L'aventure continue en live chez :"
        : '<br>On se retrouve très vite ! Tape <b>!event</b> dans le chat pour suivre la suite.';
      return {
        badge: '💜',
        kicker: s.event.nom,
        title: 'Fin du stream',
        text: `Merci d'être passé${next}`,
        extra: (others.length ? `<div class="scene-raid">${others.map((x) => `<span class="chip">${esc(x.pseudo)}</span>`).join('')}</div>` : '')
          + (rank.length ? `<div class="scene-rank glass">${rank.map((x, i) => `<b>${i + 1}</b><span class="${x.moi ? 'me' : ''}">${esc(x.pseudo)}</span><span class="pts">${x.points} pts</span>`).join('')}</div>` : ''),
      };
    },
  };

  function countdown(ms) {
    const days = Math.floor(ms / 86400000);
    return `<div class="scene-count">${days ? `${days}<small>j</small>` : ''}${clock(ms % 86400000)}</div>`;
  }

  function sceneBar(s) {
    const j = s.jauge;
    const lives = s.enLive.map((x) => x.pseudo);
    const gauge = j ? `<div><div class="w-row"><span>Jauge de l'event</span><b>${j.points}/${j.seuil}</b></div>
      <div class="bar${j.points >= j.seuil ? ' full' : ''}"><i data-w="${Math.round((j.points / j.seuil) * 100)}"></i></div></div>`
      : `<div class="w-row"><span>Signaux</span><b>${s.signaux}</b></div>`;
    const live = `<div class="lives"><span class="dot"></span>${lives.length ? `En live : <b>${esc(lives.join(' · '))}</b>` : 'Personne en live pour le moment'}</div>`;
    return `${gauge}<div class="sep"></div>${live}`;
  }

  // ───────────── Scène de live : cadre webcam et bandeau défilant ─────────────
  function camTag(s) {
    return `${s.live ? '<span class="dot"></span>' : ''}<b>${esc(s.streamer.pseudo)}</b>${s.streamer.frequence ? `<span class="mono">${esc(s.streamer.frequence)} MHz</span>` : ''}`;
  }

  function tickerItems(s) {
    const items = [];
    const a = s.alerte;
    if (a) items.push(`<b class="hot">⚡ ${esc(a.libelle)} en cours${a.jeu ? ` · ${esc(a.jeu)}` : ''}</b>`);
    items.push(`<b>${esc(s.event.nom)}</b>`);
    if (s.event.etat === 'avant' && s.event.debut) items.push(`Lancement ${esc(day(s.event.debut))}`);
    if (s.event.etat === 'termine') items.push('Event terminé · merci à tous 💜');
    if (s.streamer.frequence) items.push(`Fréquence de ${esc(s.streamer.pseudo)} : <b class="mono">${esc(s.streamer.frequence)} MHz</b>`);
    if (s.jauge) items.push(`Jauge de l'event : <b class="mono">${s.jauge.points}/${s.jauge.seuil}</b>`);
    const rank = s.classement.filter((x) => x.points > 0).slice(0, 3);
    if (rank.length) items.push(`🏆 ${rank.map((x, i) => `${i + 1}. <b>${esc(x.pseudo)}</b> ${x.points} pts`).join('  ')}`);
    const others = s.enLive.filter((x) => !x.moi);
    if (others.length) items.push(`🔴 Aussi en live : <b>${esc(others.map((x) => x.pseudo).join(' · '))}</b>`);
    items.push('Tape <b class="mono">!event</b> dans le chat pour tout savoir');
    return items.map((x) => `<span>${x}</span><i class="tk-sep"></i>`).join('');
  }

  function renderLive(s) {
    const cam = $('cam');
    cam.hidden = !opt.cam;
    if (opt.cam) {
      cam.classList.toggle('hot', Boolean(s.alerte?.concerne));
      setHtml($('cam-tag'), camTag(s));
    }
    $('ticker').hidden = !opt.bandeau;
    if (opt.bandeau) {
      const items = tickerItems(s);
      const track = $('ticker-track');
      if (track.dataset.items !== items) {
        track.dataset.items = items;
        // Texte en double pour une boucle sans à-coup ; vitesse constante (~90 px/s), quelle que soit la longueur.
        track.innerHTML = `<div class="tk-run">${items}</div><div class="tk-run">${items}</div>`;
        track.style.animationDuration = `${Math.max(20, track.firstElementChild.scrollWidth / 90)}s`;
      }
    }
  }

  function renderScene(s) {
    const sc = SCENES[opt.scene](s);
    const el = $('scene');
    el.hidden = false;
    el.dataset.scene = opt.scene;
    $('scene-badge').textContent = sc.badge;
    $('scene-clock').textContent = hour(now());
    $('scene-kicker').textContent = sc.kicker;
    $('scene-title').textContent = sc.title;
    setHtml($('scene-who'), `${esc(s.streamer.pseudo)}${s.streamer.frequence ? `<span class="mono">${esc(s.streamer.frequence)} MHz</span>` : ''}`);
    setHtml($('scene-text'), sc.text);
    setHtml($('scene-extra'), sc.extra || '');
    setHtml($('scene-bar'), sceneBar(s));
    const withChat = opt.scene === 'pause' && opt.chat;
    // Pause : cadre de la webcam en haut à droite, au-dessus du chat (l'installateur y pose la webcam).
    const withCam = opt.scene === 'pause' && opt.cam;
    el.classList.toggle('with-chat', withChat);
    el.classList.toggle('with-cam', withCam);
    document.body.classList.toggle('pause-cam', withCam);
    $('chat').hidden = !withChat;
    // Dans OBS, le cadre est une source à part posée au-dessus de la webcam (#cadre=pause) : la page
    // garde juste la place. En aperçu (#demo), on le dessine ici.
    $('cam').hidden = !(withCam && opt.demo);
    if (withCam) {
      $('cam').classList.toggle('hot', Boolean(s.alerte?.concerne));
      setHtml($('cam-tag'), camTag(s));
    }
    $('chat').classList.toggle('ext', opt.chatExt);
    if (withChat && !opt.chatExt && !opt.demo && s.streamer.chaine) chat.start(s.streamer.chaine);
    stack.classList.add('over-scene');
  }

  /** Source « cadre webcam » de la scène Pause : seulement le cadre et le nom, fond transparent, sans son. */
  function renderCadre(s) {
    document.body.classList.add('pause-cam');
    stack.hidden = true;
    const cam = $('cam');
    cam.hidden = false;
    cam.classList.toggle('hot', Boolean(s.alerte?.concerne));
    setHtml($('cam-tag'), camTag(s));
  }

  function render() {
    const s = snap;
    if (!s) return;
    if (opt.cadre) return renderCadre(s);
    if (opt.scene) renderScene(s);
    else renderLive(s);
    if (s.alerte?.concerne) intro(s.alerte);
    // Sur une scène plein écran, le coin permanent est remplacé par le bandeau de la scène ;
    // seule l'alerte (si elle concerne le streamer) reste affichée par-dessus.
    const w = $('widget');
    w.hidden = Boolean(opt.scene);
    if (!opt.scene) setHtml(w, widgetHtml(s));
    const p = $('panel');
    const panel = panelHtml(s);
    p.hidden = !panel;
    if (opt.scene && panel && !s.alerte?.concerne) p.hidden = true;
    if (panel) {
      p.className = `panel glass ${panel[0]}`;
      setHtml(p, panel[1]);
    }
  }

  // ───────────── Chat Twitch (scène pause) : lecture seule, anonyme, aucun compte ─────────────
  const chat = (() => {
    const list = $('chat-list');
    const MAX = 14;
    let login = null;
    let ws = null;
    let delay = 2000;
    const tags = (raw) => Object.fromEntries(raw.slice(1).split(';').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i), kv.slice(i + 1).replace(/\\s/g, ' ')];
    }));
    function add(name, color, text, id, user) {
      list.querySelector('.empty')?.remove();
      const li = document.createElement('li');
      li.dataset.id = id || '';
      li.dataset.user = user || '';
      const b = document.createElement('b');
      b.textContent = name;
      if (/^#[0-9a-f]{6}$/i.test(color || '')) b.style.color = color;
      li.append(b, document.createTextNode(text)); // texte affiché tel quel, jamais interprété comme du HTML
      list.append(li);
      while (list.children.length > MAX) list.firstElementChild.remove();
    }
    function onLine(line) {
      if (line.startsWith('PING')) return ws.send('PONG :tmi.twitch.tv');
      if (/ 366 /.test(line)) list.dataset.etat = 'connecte'; // salon rejoint
      const m = /^(@\S+) :(\w+)!\S+ PRIVMSG #\w+ :(.*)$/.exec(line);
      if (m) {
        const t = tags(m[1]);
        let text = m[3];
        if (text.startsWith('\u0001ACTION ')) text = text.slice(8, -1); // /me
        return add(t['display-name'] || m[2], t.color, text, t.id, m[2]);
      }
      // Messages supprimés par la modération : retirés de l'écran aussi.
      const del = /^(@\S+) :tmi\.twitch\.tv CLEARMSG/.exec(line);
      if (del) return list.querySelector(`li[data-id="${CSS.escape(tags(del[1])['target-msg-id'] || '')}"]`)?.remove();
      const clr = /^@\S+ :tmi\.twitch\.tv CLEARCHAT #\w+(?: :(\w+))?$/.exec(line);
      if (clr) for (const li of [...list.children]) if (!clr[1] || li.dataset.user === clr[1]) li.remove();
    }
    function connect() {
      const me = login;
      ws = new WebSocket(window.BOT_SIGNAL.chat);
      ws.onopen = () => {
        delay = 2000;
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`); // connexion anonyme : lecture seule
        ws.send(`JOIN #${me}`);
      };
      ws.onmessage = (ev) => String(ev.data).split('\r\n').filter(Boolean).forEach(onLine);
      ws.onclose = () => {
        if (login !== me) return;
        setTimeout(() => { if (login === me) connect(); }, delay);
        delay = Math.min(delay * 2, 30000);
      };
    }
    return {
      start(name) {
        const l = String(name).toLowerCase();
        if (l === login || !/^\w{2,25}$/.test(l)) return;
        login = l;
        ws?.close();
        connect();
      },
      add,
      onLine,
    };
  })();

  function showError(text) {
    const e = $('error');
    e.textContent = text;
    e.hidden = false;
    stack.hidden = true;
  }

  setInterval(render, 250);

  // ───────────── Aperçu sans clé (#demo) ─────────────
  if (opt.demo) {
    const t0 = Date.now();
    const base = (extra) => ({
      streamer: { pseudo: 'Lucanemone', frequence: '101.1' },
      live: true, event: { nom: 'La Community Event #2', etat: 'en cours', debut: null },
      jauge: { points: 64, seuil: 100 }, signaux: 3, pause: null, alerte: null, fin: null,
      enLive: [{ pseudo: 'Lucanemone', moi: true }, { pseudo: 'Biskar' }, { pseudo: 'Zeph Red Lion' }],
      classement: [{ pseudo: 'Biskar', points: 14 }, { pseudo: 'Lucanemone', points: 11, moi: true }, { pseudo: 'Zeph Red Lion', points: 9 }, { pseudo: 'Master67', points: 6 }],
      ...extra,
    });
    const joueurs = (arr) => [
      { pseudo: 'Lucanemone', moi: true, arrive: arr > 0, premier: arr > 0 },
      { pseudo: 'Biskar', arrive: arr > 1 },
      { pseudo: 'Zeph Red Lion', arrive: arr > 2 },
      { pseudo: 'Master67', arrive: false, parti: arr > 3 },
    ];
    const alerte = (extra) => ({ no: 1, type: 'aleatoire', libelle: 'Signal aléatoire', concerne: true, jeu: 'Valorant', prolongations: 0, ...extra });
    const SCENES = {
      bientot: () => base({ event: { nom: 'La Community Event #2', etat: 'avant', debut: t0 + 2 * 86400000 + 4 * 3600000 } }),
      widget: () => base(),
      alerte: () => base({ alerte: alerte({ phase: 'countdown', rejoindreAvant: t0 + 8 * 60000, joueurs: joueurs(2) }) }),
      vote: () => base({ alerte: alerte({ no: 2, type: 'chat', libelle: 'Signal du chat', phase: 'vote', jeu: null, joueurs: joueurs(0),
        vote: { options: [{ nom: 'Valorant', votes: 42 }, { nom: 'Fall Guys', votes: 57 }, { nom: 'Among Us', votes: 18 }], total: 117, finA: t0 + 95000 } }) }),
      partie: () => base({ alerte: alerte({ phase: 'playing', partieDebut: t0 - 42 * 60000, partieFin: t0 + 18 * 60000, prolongations: 1, joueurs: joueurs(3) }) }),
      fin: () => base({ fin: { no: 1, annulee: false, jeu: 'Valorant', joueurs: ['Lucanemone', 'Biskar', 'Zeph Red Lion'], points: 3, gages: ['Biskar'] } }),
      autre: () => base({ alerte: { ...alerte({ concerne: false, jeu: 'Rocket League', phase: 'playing' }) } }),
    };
    const order = ['bientot', 'widget', 'alerte', 'vote', 'partie', 'fin', 'autre'];
    const fixed = params.get('demo');
    let i = 0;
    const next = () => {
      const name = SCENES[fixed] ? fixed : order[i++ % order.length];
      snap = SCENES[name]();
      if (name !== 'alerte' && name !== 'vote') seenIntro.add('1').add('2');
      else seenIntro.delete(`${snap.alerte.no}`);
      render();
    };
    next();
    if (!SCENES[fixed]) setInterval(next, 7000);
    const fake = [['Biskar', '#ff6b6b', 'bon retour de pause 👋'], ['Zeph', '#4dabf7', 'GG pour la dernière partie'], ['Master67', '#ffd43b', '!event'],
      ['Lucie_', '#b197fc', 'on attend le prochain signal 👀'], ['Nox', '#69db7c', 'la fréquence 101.1 est trop forte'], ['Kaori', '#f783ac', 'pause pipi validée']];
    // Aperçu avec le vrai chat d'une chaîne : #demo&scene=pause&chaine=nomdelachaine
    if (params.get('chaine')) chat.start(params.get('chaine'));
    else fake.forEach(([n, c, t], i) => setTimeout(() => chat.add(n, c, t), 300 + i * 900));
    return;
  }

  // ───────────── Temps réel (F-44) ─────────────
  if (!opt.cle) return showError('Adresse d\'overlay incomplète : demande la tienne avec /overlay lien sur Discord.');
  let delay = 1000;
  function connect() {
    const ws = new WebSocket(window.BOT_SIGNAL.ws);
    let refused = false;
    ws.onopen = () => { delay = 1000; ws.send(JSON.stringify({ cle: opt.cle })); };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.erreur === 'cle') {
        refused = true;
        return showError('Adresse d\'overlay refusée (clé fausse ou régénérée). Redemande ton lien avec /overlay lien.');
      }
      if (msg.removed) return showError('Ce streamer ne fait plus partie de l\'event.');
      offset = msg.now - Date.now();
      // Les intros des alertes déjà en cours au chargement de la page ne se rejouent pas.
      if (!snap && msg.alerte) seenIntro.add(`${msg.alerte.no}`);
      snap = msg;
      $('error').hidden = true;
      stack.hidden = false;
      render();
    };
    ws.onclose = () => {
      if (refused) return;
      setTimeout(connect, delay); // reconnexion automatique
      delay = Math.min(delay * 2, 10000);
    };
  }
  connect();
})();
