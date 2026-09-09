# Arcanum — site de présentation

Site immersif en français du projet PoudlardRP-Minecraft : HTML/CSS, JavaScript et Three.js. Les effets WebGL sont compilés et servis localement, sans CDN ni service externe à l’affichage.

## Lancer en local

Depuis la racine du dépôt, avec Python 3 :

```sh
python3 -m http.server 8080 --directory dist
```

Ouvrir http://localhost:8080. Utiliser un serveur HTTP : les modules JavaScript et le chargement du modèle 3D nécessitent HTTP(S).

## Structure

- `dist/index.html` : contenu, sections et métadonnées.
- `dist/styles.css` : thème, mise en page adaptative et accessibilité.
- `dist/script.js` : navigation mobile (ouverture, fermeture, Échap, changement de largeur).
- `src/effects.js` : scènes Three.js, particules, effets des quatre sorts, interactions et cycle de rendu.
- `src/wand-model.js` : import du modèle Blockbench, pivots, texture et UV.
- `dist/effects.bundle.js` : bundle généré et versionné pour un déploiement immédiat.
- `dist/assets/` : illustration et icônes locales.
- `.openai/hosting.json` : configuration de l’aperçu privé Sites.

Le dossier `dist` contient les fichiers statiques versionnés : HTML/CSS éditables, ressources et bundle JavaScript compilé. Déployer son contenu sur un hébergement statique (Nginx, Apache, Cloudflare Pages, etc.). Tous les chemins sont relatifs pour permettre un hébergement sous un sous-chemin.

Après une modification de `src/`, avec Node.js 20.19+ :

```sh
npm ci
npm run check
npm run build
```

Three.js 0.186.0 et esbuild 0.25.12 sont verrouillés dans `package-lock.json`. Le bundle est autonome. Aucun `node_modules` ne doit être publié.

## Déploiement sur Netlify

Le fichier `netlify.toml` à la racine configure la compilation (`npm run build`), Node.js 22 et le dossier publié (`dist`). Connecter Netlify à ce dépôt et à la branche `main` ; les réglages versionnés prennent priorité sur les valeurs correspondantes de l’interface Netlify.

Si l’accueil renvoie une 404 alors que `/dist/` affiche le site, la racine du dépôt a été publiée au lieu de `dist`. Relancer le déploiement après récupération de cette configuration. Pour un déploiement manuel par glisser-déposer, déposer le dossier `dist` lui-même : le fichier `index.html` doit être directement à la racine de l’artefact publié.

## Contenu et état du projet

Références : `PoudlardRP-Minecraft/HogwartsRP`, `README.md` et `docs/PROJECT-CONTEXT.md`, consultés le 9 septembre 2026, révision `3f4ea74432850f855f61d99f4c59c47f31c7d1c5`.

Le nom Arcanum et les fonctionnalités sont repris de la documentation du prototype : quatre sorts, grimoire, progression de la première à la septième année, quatre caractéristiques et tenues Braise, Marée, Sylve et Ambre. Les cours, l’identité RP complète et le vocal sont explicitement présentés comme à venir.

Aucune IP publique, URL Discord ou date d’ouverture confirmée n’a été fournie. Le site n’affiche donc pas de faux bouton de connexion ni de téléchargement. Quand ces informations seront disponibles, actualiser la section `#projet` et les appels à l’action.

L’illustration du château est une création d’ambiance générée, explicitement légendée sur la page ; elle ne représente pas une carte du serveur. Les icônes des sorts proviennent du dépôt HogwartsRP (`assets-source/ui/spells/`). Voir `ASSETS.md`.

## Vérifications

Vérifier la syntaxe JavaScript avec `node --check dist/script.js`. Contrôler les références locales, les ancres et les métadonnées après toute modification. Les cartes de sorts utilisent l’élément natif `details`, utilisable au clavier et sans JavaScript. Le menu mobile gère `aria-expanded`, Échap, les clics extérieurs et les changements de largeur. Les animations respectent `prefers-reduced-motion`, y compris ses changements pendant la session. Le bouton « Effets animés » permet aussi de les arrêter. Les rendus se suspendent hors écran et lorsque l’onglet est masqué. La densité des particules et le ratio de pixels sont limités sur mobile. En cas de WebGL indisponible, de modèle non chargé ou de perte de contexte, un affichage statique conserve tout le contenu.

Le paysage est une image avec parallaxe et particules 3D ; il ne s’agit pas d’une carte navigable. La baguette est un véritable modèle 3D issu du projet. Les effets des sorts sur le site sont des aperçus artistiques, pas le moteur de simulation du mod.

Validation effectuée : compilation, syntaxe JavaScript, géométrie importée, références locales et ancres. Aucun test dans un navigateur réel n’a été effectué dans cette livraison.

## Confidentialité

Ni collecte de données, ni cookies, ni analytics, ni polices externes. Aucun code serveur, secret ou artefact privé du jeu n’est inclus.
