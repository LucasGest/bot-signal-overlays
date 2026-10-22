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

`/overlay lien` donne un lien `https://<site>/installer.html#cle=…`. Le streamer active le serveur WebSocket d'OBS (Outils → Paramètres du serveur WebSocket) et colle le mot de passe. Par défaut, la page crée un **profil** et une **collection de scènes** à part « 📡 Community Event » (sa chaîne habituelle n'est jamais touchée ; le profil reprend résolution, i/s, débit et encodeur, mais jamais la clé de stream : le streamer reconnecte son compte Twitch) avec les 4 scènes plein écran et « 📡 Event · En live » où l'overlay est déjà placé. Autre choix : installer dans la collection actuelle, en cochant les scènes. Relancer l'installation met les adresses à jour (après `/overlay regenerer`) sans rien dupliquer. Le mot de passe OBS ne quitte pas le PC (connexion à `ws://127.0.0.1`).

## Adresse d'un streamer

Chaque streamer reçoit **son** lien sur Discord avec `/overlay lien` (clé secrète après le `#`, jamais envoyée au serveur).

Scènes plein écran : `&scene=debut` (commence bientôt) · `&scene=pause` · `&scene=veille` (sommeil) · `&scene=fin` (fin du stream)
Autres options · `&coin=bd` / `hg` / `hd` · `&theme=clair` · `&son=0`
Overlay principal (scène « En live ») : cadre de la webcam en haut à droite (en haut à gauche si `coin=hd`) et bandeau défilant en bas · `&cam=0` · `&bandeau=0`. L'installateur cale toute source webcam de la scène dans le cadre (relancer l'installation après avoir ajouté la webcam). Scène Pause : même cadre en haut à droite, au-dessus du chat (`&cam=0` pour l'enlever) ; l'installateur y ajoute la même webcam au-dessus de la page, puis le cadre (source « 📡 Cadre webcam · Pause », `#cle=…&cadre=pause`) au-dessus de la webcam pour garder les coins arrondis.
Chat StreamElements : le streamer colle l'adresse de son overlay StreamElements dans l'installateur, qui la pose dans le panneau « Le chat » de la Pause (source « 📡 Chat StreamElements · Pause ») et passe la page en `&chat=ext` (panneau sans messages). Réinstallation sans adresse : celle déjà installée est gardée.
Sinon, scène pause : chat Twitch de la chaîne en lecture seule (connexion anonyme, messages supprimés par la modération retirés aussi) · `&chat=0`. Aperçu : `#demo&scene=pause&chaine=nomdelachaine`.

## Logos

Par défaut, logos texte animés avec GSAP (`vendor/gsap.min.js`, hébergé ici car la page n'accepte aucun script externe) : « La Community Event #2 » et l'antenne « Signal » du bot. Pour mettre les vrais logos : déposer **`logo-event.png`** et **`logo-bot.png`** (fond transparent) à côté d'`index.html` ; ils remplacent les logos texte automatiquement.
Aperçu sans clé, tous les écrans à la suite : `https://<site>/#demo` (ou `#demo=vote`, `alerte`, `partie`, `fin`, `bientot`…).

## Mise en ligne (Render, Static Site gratuit)

1. Dépôt GitHub **privé** avec ce dossier.
2. Render → **New** → **Static Site** → ce dépôt · Build Command : vide · Publish Directory : `.`
3. Mettre l'adresse obtenue dans la variable **`OVERLAY_URL`** du bot (Render → bot-signal → Environment), sans `/` final.

Si l'adresse du bot change : modifier `config.js` **et** `connect-src` dans `index.html`.
