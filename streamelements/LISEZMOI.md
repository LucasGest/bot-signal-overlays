# Chat de la Community Event (StreamElements)

Un seul chat aux couleurs de l'event, pour tous les streamers : chacun l'a dans **son** compte StreamElements, donc il affiche **son** chat.

## 1. Créer le widget (une seule fois, par l'orga)

1. streamelements.com → **Streaming tools → Overlays** → **New overlay**, résolution **1920 × 1080**. Nom : « Chat Community Event ».
2. Dans l'éditeur : **+** → **Static / Custom** → **Custom widget**.
3. Clique le widget, puis **Open editor**. Colle chaque fichier dans l'onglet du même nom :
   - `chat.html` → onglet **HTML**
   - `chat.css` → onglet **CSS**
   - `chat.js` → onglet **JS**
   - `fields.json` → onglet **Fields**
   Puis **Done**.
4. Position du widget (panneau de gauche, *Position, size & style*), pour tomber pile sur la zone du chat de la scène Pause :
   **Left 1390 · Top 466 · Width 470 · Height 558**.
5. **Save**.

Réglages (panneau de gauche du widget) : couleur de l'event, taille du texte, opacité des bulles, nombre de messages, disparition, titre, badges, commandes, pseudos ignorés (bots).

## 2. Le partager aux streamers

Dans la liste des overlays, menu du chat → **Share** : le lien permet à chaque streamer de copier l'overlay dans son propre compte (relié à sa chaîne).

## 3. Chez chaque streamer

1. Ouvrir le lien de partage → l'overlay est copié dans son compte.
2. Dans ses overlays StreamElements : **Copy URL** sur le chat (adresse `https://streamelements.com/overlay/…`, personnelle : ne pas la partager).
3. La coller dans l'installateur OBS (champ « Adresse de ton chat StreamElements »), puis **Installer** : le chat est posé dans la scène Pause, à la place du chat intégré.

## Sécurité

Le texte des messages est toujours affiché comme du texte (jamais interprété comme du HTML), les couleurs de pseudo sont vérifiées et les images (badges, emotes) ne viennent que de Twitch, BTTV, FFZ et 7TV. Les messages supprimés par la modération disparaissent aussi de l'écran.
