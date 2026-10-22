# 🖥️ Overlays OBS — Bot Signal

Les pages d'overlay de **La Community Event #2**, à ajouter comme *source navigateur* dans OBS (1920×1080, fond transparent).
Site statique : aucun serveur, aucune donnée. Les infos en direct (alerte, jauge, vote, chrono) arrivent du **Bot Signal** par une connexion temps réel.

| Fichier | Rôle |
|---|---|
| `index.html` | La page (et sa politique de sécurité) |
| `overlay.css` | Le style : cartes « verre dépoli », thème sombre ou clair |
| `overlay.js` | Connexion au bot, comptes à rebours, animation et son des alertes, aperçu `#demo` |
| `config.js` | Adresse du bot (`wss://bot-signal-tqps.onrender.com/overlay/ws`) |

## Adresse d'un streamer

Chaque streamer reçoit **son** lien sur Discord avec `/overlay lien` (clé secrète après le `#`, jamais envoyée au serveur).

Options à ajouter à la fin du lien : `&scene=veille` (scène « En veille ») · `&coin=bd` / `hg` / `hd` · `&theme=clair` · `&son=0`
Aperçu sans clé, tous les écrans à la suite : `https://<site>/#demo` (ou `#demo=vote`, `alerte`, `partie`, `fin`, `bientot`…).

## Mise en ligne (Render, Static Site gratuit)

1. Dépôt GitHub **privé** avec ce dossier.
2. Render → **New** → **Static Site** → ce dépôt · Build Command : vide · Publish Directory : `.`
3. Mettre l'adresse obtenue dans la variable **`OVERLAY_URL`** du bot (Render → bot-signal → Environment), sans `/` final.

Si l'adresse du bot change : modifier `config.js` **et** `connect-src` dans `index.html`.
