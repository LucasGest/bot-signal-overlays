// Adresse du Bot Signal (connexion temps réel). Pas un secret.
// Si elle change, mettre aussi à jour « connect-src » dans index.html.
'use strict';
window.BOT_SIGNAL = {
  ws: ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'ws://localhost:3000/overlay/ws' // tests sur le PC
    : 'wss://bot-signal-tqps.onrender.com/overlay/ws',
  // Chat Twitch en lecture seule (scène pause), sans compte. Aussi dans « connect-src ».
  chat: 'wss://irc-ws.chat.twitch.tv:443',
};
