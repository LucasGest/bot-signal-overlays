// Chat de la Community Event — widget StreamElements (onglet JS).
// Affiche les messages du chat de la chaîne du compte StreamElements où le widget est installé.
// Texte toujours inséré comme texte (jamais comme HTML) : un message ne peut pas modifier l'overlay.
let opts = { max: 12, duree: 0, commandes: true, ignores: [], badges: true };
const list = document.getElementById('list');

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
/** Couleur du pseudo : uniquement une couleur #rrggbb, sinon la couleur de l'event. */
const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');
/** Image venant seulement des serveurs d'images de Twitch et des services d'emotes connus. */
const safeImg = (u) => (/^https:\/\/(static-cdn\.jtvnw\.net|cdn\.betterttv\.net|cdn\.frankerfacez\.com|cdn\.7tv\.app)\//.test(u || '') ? u : '');

window.addEventListener('onWidgetLoad', (obj) => {
  const f = obj.detail.fieldData || {};
  opts = {
    max: Number(f.max) || 12,
    duree: Number(f.duree) || 0,
    commandes: f.commandes !== 'non',
    ignores: String(f.ignores || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean),
    badges: f.badges !== 'non',
  };
  if (f.titre === 'non') document.getElementById('chat').classList.add('sans-titre');
});

window.addEventListener('onEventReceived', (obj) => {
  const { listener, event } = obj.detail;
  if (listener === 'message') add(event.data || {});
  else if (listener === 'delete-message') remove((li) => li.dataset.id === event.msgId);
  else if (listener === 'delete-messages') remove((li) => li.dataset.user === event.userId);
});

function add(d) {
  const nick = String(d.nick || '').toLowerCase();
  let text = String(d.text || '');
  if (opts.ignores.includes(nick)) return;
  if (!opts.commandes && text.startsWith('!')) return;

  const li = el('li', 'ce-msg');
  li.dataset.id = d.msgId || '';
  li.dataset.user = d.userId || '';
  const color = safeColor(d.displayColor);
  if (color) li.style.setProperty('--c', color);
  const badges = Array.isArray(d.badges) ? d.badges : [];
  if (badges.some((b) => b.type === 'broadcaster' || b.type === 'moderator')) li.classList.add('streamer');

  const who = el('span', 'ce-who');
  if (opts.badges) {
    for (const b of badges) {
      const src = safeImg(b.url);
      if (!src) continue;
      const img = el('img', 'ce-badge');
      img.src = src;
      img.alt = '';
      who.append(img);
    }
  }
  who.append(el('b', null, d.displayName || d.nick || '?'));

  // /me : message en italique, de la couleur du pseudo.
  const action = d.isAction || /^\u0001ACTION /.test(text);
  text = text.replace(/^\u0001ACTION (.*)\u0001$/, '$1');
  const body = el('span', `ce-text${action ? ' action' : ''}`);
  const emotes = new Map((Array.isArray(d.emotes) ? d.emotes : []).map((e) => [e.name, safeImg(e.urls?.['2'] || e.urls?.['1'])]));
  // Mots séparés par les espaces : un mot qui est le nom d'une emote devient son image.
  for (const part of text.split(/(\s+)/)) {
    const src = emotes.get(part);
    if (src) {
      const img = el('img', 'ce-emote');
      img.src = src;
      img.alt = part;
      body.append(img);
    } else if (part) body.append(document.createTextNode(part));
  }

  li.append(who, body);
  list.append(li);
  while (list.children.length > opts.max) list.firstElementChild.remove();
  if (opts.duree > 0) setTimeout(() => fade(li), opts.duree * 1000);
}

function fade(li) {
  if (!li.isConnected) return;
  li.classList.add('out');
  setTimeout(() => li.remove(), 400);
}

/** Messages supprimés par la modération : retirés de l'écran aussi. */
function remove(match) {
  for (const li of [...list.children]) if (match(li)) li.remove();
}
