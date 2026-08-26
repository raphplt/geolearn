# Portulan

Apprentissage gamifié de la géographie : les 101 départements français et leurs
chefs-lieux, les 193 États membres de l'ONU, leurs capitales et leurs drapeaux.

Application mobile native (Expo / React Native), **entièrement hors ligne**,
sans compte ni serveur en v1.

---

## Démarrer

```bash
pnpm install
pnpm start          # puis « i » pour iOS, « a » pour Android
```

Les jeux de données et les assets sont versionnés : rien à générer pour lancer
l'application.

```bash
pnpm verify         # types + atlas + moteur de carte + moteur de jeu
```

### Dev build

Le projet natif n'est pas versionné : il est régénéré par `prebuild` à partir de
`app.json` (workflow CNG d'Expo). Ne modifiez jamais `android/` à la main — le
prochain `--clean` effacerait vos changements. Toute personnalisation native
passe par un plugin de configuration.

**Dans le nuage (EAS).** Ne demande ni JDK ni SDK Android en local.

```bash
eas build --profile development --platform android
```

Le profil `development` d'`eas.json` produit un **APK** à installation directe,
avec `expo-dev-client` embarqué. Une fois installé sur l'appareil, le cycle de
travail quotidien est simplement `pnpm start` : le dev build se recharge tout
seul. Un nouveau build n'est nécessaire que si l'on ajoute une dépendance native
ou que l'on touche à `app.json`.

**En local (Android).** Plus rapide en itération, mais demande la chaîne
complète :

```bash
export ANDROID_HOME="$HOME/Android/Sdk"          # à mettre dans ~/.bashrc
export PATH="$ANDROID_HOME/platform-tools:$PATH"

pnpm prebuild                                    # génère android/
pnpm android                                     # compile, installe, lance Metro
```

Il faut un **JDK** et non un simple JRE : Gradle échoue sinon sur un « No Java
compiler found » qui ne dit pas d'où vient le problème. Sur Arch,
`sudo pacman -S jdk21-openjdk`.

iOS demande macOS pour un build local ; sinon
`eas build --profile development --platform ios`.

---

## Le jeu

Trois couches, qui répondent à trois horizons de temps différents.

| Mode | Horizon | Ressort |
| --- | --- | --- |
| **Expédition** | 1 à 3 minutes | Une réserve de temps s'épuise ; les bonnes réponses la rechargent, la récompense s'érode au fil de la partie. |
| **Relevé du jour** | une fois par jour | Dix questions identiques pour tout le monde, série à tenir, grille d'émojis à partager. |
| **Atlas** | des semaines | Répétition espacée. La carte se colore à mesure que les territoires entrent en mémoire longue. |

L'expédition est calibrée pour que **toute partie se termine sur une erreur du
joueur**, jamais sur un plafond arbitraire : la récompense en temps décroît de
100 % à 10 % sur les trente-deux premières réponses, tandis que la pénalité
reste constante. Mesuré en simulation :

| Précision · réflexion | Questions | Durée |
| --- | --- | --- |
| 99 % · 1,0 s | 160 | 2 min 40 |
| 85 % · 2,5 s | 30 | 1 min 16 |
| 50 % · 4,5 s | 9 | 41 s |

---

## Architecture

```
scripts/         Chaîne de production des données et des assets (Node, hors application)
src/data/        Atlas pré-projetés + types
src/map/         Décodage des tracés, pointé, rendu SVG
src/game/        Aléatoire déterministe, répétition espacée, questions, moteur de partie
src/store/       Progression persistée (zustand + AsyncStorage) et partie en cours
src/theme/       Jetons de design, typographie, thème clair/nuit
src/ui/          Primitives d'interface et marque
app/             Écrans (expo-router)
```

### Les données sont calculées à la compilation

`pnpm geo:build` télécharge les sources publiques, **simplifie en préservant la
topologie**, projette, calcule les voisins et les ancres d'étiquettes, puis écrit
des chaînes de tracé SVG prêtes à peindre. L'application n'embarque pas d3 et
affiche sa carte au premier rendu, sans mise en page à faire.

Deux choix structurants :

- **Espace atlas entier de 4000 unités, tracés relatifs.** Les sommets d'un
  littoral simplifié sont voisins : encodés en relatif et arrondis à l'entier,
  ils tiennent sur un ou deux chiffres. L'atlas France passe de 2,0 Mo à 350 Ko
  sans perte visible (une unité vaut ~275 m). L'erreur est diffusée le long du
  tracé plutôt que sommée, ce qui la borne à un demi-quantum où qu'on se trouve.

- **Projections choisies pour ce qu'elles enseignent.** La France est en conique
  conforme (parallèles 44°/49°, méridien 3°E) : les paramètres du Lambert
  français, la forme sous laquelle tout le monde a appris l'hexagone. Le monde
  est en Natural Earth 1 et non en Mercator — historiquement plus juste pour un
  portulan, mais Mercator triple la taille apparente du Groenland, ce qu'une
  application qui *enseigne* la géographie ne peut pas se permettre.

Les départements d'outre-mer sont rendus dans des **cartouches**, à la manière
des cartes IGN : les placer à leur position réelle réduirait la métropole à un
timbre-poste.

### Corrections apportées aux sources

Consignées et justifiées dans `scripts/lib/corrections.mts`. À ce jour :
mledoze/countries classe le Saint-Siège parmi les membres de l'ONU (il en est un
*État observateur*), ce qui portait le décompte à 194.

### Ce qui est vérifié

| Commande | Contrôles |
| --- | --- |
| `pnpm geo:verify` | 6 003 — intégrité des atlas, cartouches, symétrie du voisinage, cohérence des chefs-lieux |
| `pnpm map:verify` | 732 — décodage, pointé, recoupement chefs-lieux × contours |
| `pnpm game:verify` | 31 — barème, déterminisme du relevé, répétition espacée, fin de partie |

L'invariant le plus utile est le plus simple : **l'ancre d'étiquette d'un
territoire doit désigner ce territoire**. Il met en cause d'un seul coup le
décodeur de tracés, la sémantique de `closepath`, le test d'appartenance et le
placement des ancres.

`pnpm geo:preview` produit des SVG des deux atlas : un jeu de données peut
satisfaire toutes les assertions et rester visuellement faux.

---

## Direction artistique

Cartographie néo-rétro : parchemin, encre sépia, rehauts vermillon et
vert-de-gris, dorure réservée aux récompenses. La rose des vents est la marque —
sa géométrie vit dans `src/ui/brand/rose-geometry.ts`, partagée entre le
composant de l'application et le générateur d'icônes, pour qu'elles ne divergent
jamais.

Typographie : **Fraunces** (display), **Spectral** (texte), **Space Mono**
(instruments — chronomètres, scores, numéros de départements).

Le grain du papier est un asset précalculé (`pnpm assets:build`) et non un filtre
SVG : react-native-svg expose `feTurbulence` côté JavaScript mais sans
implémentation native. L'intensité du grain est encodée dans le canal alpha d'un
aplat d'encre, ce qui reproduit un mode « multiply » avec le seul alpha-blending.

---

## Sources

- Contours France — [france-geojson](https://github.com/gregoiredavid/france-geojson) (Grégoire David), d'après l'IGN ADMIN-EXPRESS, licence ouverte
- Chefs-lieux et régions — [API Découpage administratif](https://geo.api.gouv.fr) (Etalab)
- Contours monde — [Natural Earth](https://www.naturalearthdata.com) (domaine public)
- Métadonnées pays — [mledoze/countries](https://github.com/mledoze/countries) (ODbL)
- Populations — [Banque mondiale](https://data.worldbank.org) (SP.POP.TOTL, CC BY 4.0)

---

## v2 — prévu

Multijoueur : classements, duels asynchrones. Le moteur y est préparé — une
partie est entièrement décrite par une graine, si bien qu'un duel se transmet
sans envoyer la liste des questions.
