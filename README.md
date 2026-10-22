# 🖥️ Overlays OBS — Bot Signal

Les pages d'overlay de **La Community Event #2**, à ajouter comme *source navigateur* dans OBS (1920×1080, fond transparent).
Site statique : aucun serveur, aucune donnée. Les infos en direct (alerte, jauge, vote, chrono) arrivent du **Bot Signal** par une connexion temps réel.

| Fichier | Rôle |
|---|---|
| `index.html` | La page (et sa politique de sécurité) |
| `overlay.css` | Le style : cartes « verre dépoli », thème sombre ou clair |
| `overlay.js` | Connexion au bot, comptes à rebours, animation et son des alertes, aperçu `#demo` |
| `config.js` | Adresse du bot (`wss://bot-signal-tqps.onrender.com/overlay/ws`) |
| `installer.html`, `installer.js`, `installer.css` | Page « Installer dans OBS en 1 clic » |
| `obs-installer.js` | Connexion au serveur WebSocket d'OBS (v5) et création des scènes / sources |

## Installer dans OBS en 1 clic

`/overlay lien` donne un lien `https://<site>/installer.html#cle=…`. Le streamer active le serveur WebSocket d'OBS (Outils → Paramètres du serveur WebSocket), colle le mot de passe, coche sa scène de jeu : la page crée les 4 scènes plein écran (📡 Event · …) et met l'overlay en haut des scènes cochées, à la taille de son écran OBS. Relancer l'installation met les adresses à jour (après `/overlay regenerer`) sans rien dupliquer. Le mot de passe OBS ne quitte pas le PC (connexion à `ws://127.0.0.1`).

## Adresse d'un streamer

Chaque streamer reçoit **son** lien sur Discord avec `/overlay lien` (clé secrète après le `#`, jamais envoyée au serveur).

Scènes plein écran : `&scene=debut` (commence bientôt) · `&scene=pause` · `&scene=veille` (sommeil) · `&scene=fin` (fin du stream)
Autres options · `&coin=bd` / `hg` / `hd` · `&theme=clair` · `&son=0`
Aperçu sans clé, tous les écrans à la suite : `https://<site>/#demo` (ou `#demo=vote`, `alerte`, `partie`, `fin`, `bientot`…).

## Mise en ligne (Render, Static Site gratuit)

1. Dépôt GitHub **privé** avec ce dossier.
2. Render → **New** → **Static Site** → ce dépôt · Build Command : vide · Publish Directory : `.`
3. Mettre l'adresse obtenue dans la variable **`OVERLAY_URL`** du bot (Render → bot-signal → Environment), sans `/` final.

Si l'adresse du bot change : modifier `config.js` **et** `connect-src` dans `index.html`.
