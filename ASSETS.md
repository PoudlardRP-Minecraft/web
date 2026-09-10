# Ressources visuelles et dépendances

- `dist/assets/castle.webp` : illustration originale générée avec ImageGen pour ce site, à partir d’un paysage de château de sorcellerie en blocs Minecraft, de nuit, au bord d’un lac. Ce visuel ne représente pas la carte du serveur.
- Prompt : « Cinematic wide 16:9 landscape hero for Arcanum, a French Minecraft wizard-school roleplay website. Original majestic gothic wizard-school castle constructed with refined Minecraft voxel geometry, on a dramatic rocky cliff above a dark lake at twilight. Castle and detailed towers occupy the right half/right two thirds; left 40% remains quiet midnight sky, distant mountains, lake and subtle fog for white website text. Sophisticated game key art, cubic stone construction, stepped slate roofs, angular cliffs and block pine silhouettes. Midnight navy, teal lake mist, amber glowing windows, restrained stars and atmospheric depth. No text, logos, watermark, interface or characters. Original concept illustration, not an actual server screenshot. »
- `dist/assets/{lumos,protego,leviosa,bombarda}.svg` : icônes originales du projet, reprises de `PoudlardRP-Minecraft/HogwartsRP/assets-source/ui/spells/`, révision `3f4ea74432850f855f61d99f4c59c47f31c7d1c5`.
- `dist/assets/wand.json` : modèle et atlas de texture extraits de `assets-source/elderwood-wand.bbmodel` du même dépôt, sans modification de la géométrie. Les métadonnées de l’éditeur et chemins locaux ont été retirés.
- Three.js 0.186.0 : bibliothèque MIT, licence distribuée dans `dist/vendor/THREE-LICENSE.txt` et conservée dans le bundle compilé. Source : https://github.com/mrdoob/three.js/tree/r186
- Polices système : Georgia et Arial, aucun téléchargement externe.

Les ressources du jeu sont réutilisées dans le site de la même organisation à la demande du propriétaire. Aucune licence générale de redistribution des ressources du jeu n’est ajoutée.

## Mur de briques

- `dist/assets/brick-clay.webp` : matériau de terre cuite généré avec ImageGen pour cette tâche, issu d’une image 1254 × 1254 et compressé en WebP. Éclairage du matériau neutre ; relief simulé à partir de cette texture dans le matériau 3D. Ce n’est pas un matériau scanné provenant d’un décor de film.
- Brief de génération : « Seamless photorealistic PBR base-color texture of weathered reddish-brown fired clay brick material in extreme close-up; dark warm oxblood, umber and muted terracotta, fine natural grain, pores, small chips and subtle cracks, flat neutral lighting, no brick layout, no mortar, no borders, no directional shadows, no text, not stylized. »
- `src/wall-model.js` : géométrie et animation originales créées pour le site. L’environnement de réflexion et les boîtes arrondies utilisent les modules fournis avec Three.js sous licence MIT.
- Référence d’interaction : https://heritagedepoudlard.fr/ (consultée le 10 septembre 2026), pour le principe d’un passage de briques à l’arrivée. Aucun fichier de cette référence n’est distribué dans ce dépôt.
