# Studio Nono

Appli web de création musicale. Elle sert à enregistrer sa voix, faire des beats, corriger ou transformer la voix (autotune, grave, aigu, robot, radio, écho, chœur) et générer une instru à partir d'un style et d'une ambiance.

Tout tourne dans le navigateur, sans serveur. Ça fonctionne sur ordinateur comme sur téléphone, et l'appli s'installe sur l'écran d'accueil (PWA).

## Écrans

| Écran | Ce qu'on y fait |
| --- | --- |
| **Studio** | Timeline multipiste : batterie, basse, accords et vos prises micro. Volume, panoramique, muet, calage fin des prises, export d'une piste seule. |
| **Beats** | Séquenceur 6 × 16 pas avec presets (Trap, Lo-fi, Afro, Pop, Drill, House) et 6 pads jouables au doigt ou au clavier (Q S D F G H). |
| **Voix** | Courbe de hauteur réellement détectée dans la prise, avant et après correction. Autotune (tonalité, gamme, force), Grave et Aigu (±4 demi-tons, durée inchangée), puis Robot, Radio, Écho ou Chœur. |
| **Instru** | Choix d'un style et d'une ambiance : accords, basse, batterie et structure (intro, couplet, refrain…) sont composés automatiquement. |

Raccourcis : **Espace** pour lire ou mettre en pause, **R** pour enregistrer (avec un décompte d'une mesure).

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests du traitement de la voix et de l'export WAV
npm run build      # version de production dans dist/
```

Le micro n'est accessible qu'en HTTPS ou sur `localhost`.

## Publication sur GitHub Pages

Le workflow `.github/workflows/pages.yml` teste, construit et publie l'appli à chaque push.

**À faire une fois** : dans le dépôt GitHub, ouvrir **Settings → Pages → Build and deployment → Source** et choisir **GitHub Actions**.

L'appli est alors disponible à l'adresse `https://<utilisateur>.github.io/Nono/`. Si le déploiement est refusé depuis une branche autre que la branche par défaut, il faut fusionner dans `main` ou ajuster la règle de l'environnement `github-pages` (**Settings → Environments**).

## Comment ça marche

- **Son** : Web Audio. Les instruments sont des synthés générés en direct (aucun sample). Les pas sont planifiés à l'avance (~120 ms) pour un tempo stable.
- **Enregistrement** : le micro est capté en PCM brut par un AudioWorklet. Chaque bloc est horodaté dans l'horloge audio, ce qui permet de caler la prise sur le tempo en compensant la latence. Sur les navigateurs sans AudioWorklet, un repli moins précis prend le relais.
- **Autotune** : détection de hauteur YIN, recalage sur la gamme avec hystérésis et vitesse réglable, puis resynthèse TD-PSOLA. Le traitement se fait après l'enregistrement, dans un Web Worker. La prise d'origine est toujours conservée, et l'effet se modifie à tout moment.
- **Export** : le morceau est rejoué dans un `OfflineAudioContext` avec exactement la même partition que la lecture, puis encodé en WAV 16 bits stéréo.
- **Sauvegarde** : les projets et les prises sont stockés dans le navigateur (IndexedDB).

```
src/
  music/      théorie (gammes, accords), presets, générateur d'instru
  audio/      moteur, synthés, effets, enregistreur, rendu WAV
  audio/dsp/  YIN, PSOLA, autotune (+ tests) et le worker
  store/      état du projet (zustand) et sauvegarde IndexedDB
  ui/         écrans React
design/       prototype Claude Design d'origine (référence)
```

## Limites connues

- L'autotune convient à une **voix seule, enregistrée au casque**. Si la musique repasse dans le micro, ou sur du souffle et des passages très graves, il produit des artefacts. Ce n'est pas le niveau d'un plugin professionnel.
- Utilisez un **casque filaire**. Les casques Bluetooth ajoutent une latence importante et variable. Le curseur **Calage** d'une prise permet de la recaler à l'oreille.
- Les projets restent **dans le navigateur de l'appareil** : rien n'est synchronisé entre ordinateur et téléphone. Exportez en WAV pour garder vos morceaux ailleurs. Vider les données du site efface les projets.
- Testé dans Chromium. Safari sur iPhone n'a pas pu être testé sur un vrai appareil.
