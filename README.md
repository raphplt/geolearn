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
| **Découverte** | 2 minutes | Cinq territoires présentés, puis vérifiés dans la foulée. On n'interroge jamais ce qui n'a pas été montré. |
| **Révision** | 2 minutes | Les cartes arrivées à échéance, la plus en retard d'abord. Sans chronomètre : on y mesure une rétention, pas une vitesse. |
| **Expédition** | 1 à 3 minutes | Une réserve de temps s'épuise ; les bonnes réponses la rechargent, la récompense s'érode au fil de la partie. |
| **Relevé du jour** | une fois par jour | Dix questions identiques pour tout le monde, série à tenir, grille d'émojis à partager. |
| **Atlas** | des semaines | La carte se colore à mesure que les territoires entrent en mémoire longue. |

L'écran de préparation propose d'office, dans cet ordre : **réviser ce qui
s'efface, découvrir ce qu'on ignore, puis s'exercer**. La révision passe devant
parce qu'une carte échue est une trace en train de disparaître — la reprendre
coûte quelques secondes aujourd'hui et un réapprentissage complet dans une
semaine.

### L'économie

Un principe, et il gouverne tous les barèmes : **on paie ce qui est appris, pas
ce qui est joué.**

Une partie rapporte peu de **doublons** ; une promotion de carte en rapporte
davantage ; et l'**expérience** — celle qui fait monter en rang — ne vient
*exclusivement* que des promotions, des acquisitions et des cartouches scellés.
Un joueur qui enchaîne les expéditions sans rien retenir gagne quelques doublons
et aucun rang. C'est l'inverse du réglage habituel des jeux d'apprentissage, qui
récompensent le temps passé : celui-ci produit de belles courbes d'engagement et
ment sur ce que les joueurs savent. Ici, « Timonier » est une affirmation.

| Ce qui rapporte | Doublons | Expérience |
| --- | ---: | ---: |
| Une carte promue d'une boîte | 2 | 10 |
| Un territoire en mémoire longue | 10 | 25 |
| Un cartouche scellé | 100 | 150 |
| Une expédition | score ÷ 100 | — |

Huit rangs, de Mousse à Amiral. `economy:verify` simule la France entièrement
sue et vérifie que l'amirauté tombe entre 40 % et 100 % d'un atlas — mesuré à
67 %.

**Les cartouches** sont la récompense la plus liée à la pédagogie : une région
française ou une sous-région du monde dont *tous* les territoires sont en
mémoire longue se scelle, et se colore d'or sur l'atlas. Connaître dix
départements dispersés ne scelle rien ; connaître les cinq de Bretagne scelle la
Bretagne.

**Le carnet de bord** tire trois objectifs par jour de la date — les mêmes pour
tout le monde, sans serveur ni compte. Il évite deux familles d'objectifs :
ceux qui demandent du temps, qui paieraient l'assiduité, et ceux qui demandent
de la chance, qu'un joueur regarde comme un décor.

**Le Comptoir** vend des indices consommables et trois encres de carte. Rien qui
s'achète en argent réel, rien qui accélère la progression, et aucune énergie à
recharger : une application qui enseigne ne ferme pas sa porte au joueur qui veut
travailler. La spécification tarifaire est vérifiée par simulation — après une
vingtaine de parties, on s'offre la première encre et pas la seconde.

**Les avaries** rendent visible ce que le sablier faisait en silence. Six coques
en expédition, et le chiffre est mesuré et non choisi : à six, la longueur
moyenne d'une partie est *identique* à ce qu'elle était sans avaries, à tous les
niveaux de jeu. Elles ne durcissent rien — elles donnent un nom et un décompte à
une fin que la réserve de temps provoquait déjà.

| Précision | sans avaries | 3 avaries | 6 avaries |
| --------- | -----------: | --------: | --------: |
| 50 %      | 12 questions |     6     |    12     |
| 85 %      | 32 questions |    19     |    32     |
| 99 %      | 125 questions|   120     |   125     |

### Les échelons

Le jeu ne s'ouvre pas d'un bloc. Un atlas de 101 départements offert d'emblée,
avec cinq compétences tirées uniformément, n'est pas un jeu d'apprentissage :
c'est un examen. Le premier réglage était exactement celui-là — un débutant
avait autant de chances de tomber sur la Creuse que sur le Nord.

Cinq **échelons** élargissent trois choses ensemble :

| Échelon | Vivier | Compétences | Aide au repérage |
| --- | ---: | --- | ---: |
| Cabotage | 15 % | reconnaître, situer | un tiers de la carte |
| Petit large | 30 % | + chef-lieu | la moitié |
| Haute mer | 55 % | + numéro | les trois quarts |
| Grand large | 80 % | + questions à rebours | aucune |
| Circumnavigation | 100 % | toutes | aucune |

L'échelon se **gagne** — on monte quand 60 % du palier courant a atteint la
boîte 2 — et le niveau déclaré à la première ouverture ne pose qu'un *plancher*.
Se dire novice n'impose aucun plafond ; se dire confirmé n'expose à aucun mur.

L'aide au repérage mérite un mot : aux premiers échelons, une question « situer »
cadre la carte sur la région du territoire au lieu de la France entière. Le cadre
est **délibérément décentré**, à partir d'une empreinte de l'identifiant du
territoire — un cadre centré sur sa réponse se résoudrait en touchant le milieu
de l'écran.

### La difficulté est calculée, pas décrétée

Deux signaux, déjà présents dans les données, classés en **rangs centiles**
plutôt qu'en valeurs — les deux grandeurs ont des queues trop lourdes pour une
normalisation linéaire, et un rang centile donne par construction la
distribution uniforme dont un système de paliers a besoin.

- **La notoriété.** On connaît un département par sa préfecture : le Nord, c'est
  Lille ; le Rhône, c'est Lyon. Pour le monde, la population.
- **La taille**, qui compte pour « situer » sans jamais effacer la notoriété.

Deux corrections, consignées dans `src/game/difficulty.ts` :

- **L'outre-mer est classé à part.** Son aire projetée est mesurée dans son
  cartouche, à une échelle qui n'est pas celle de la métropole — La Réunion y
  pèse 192 875 unités quand la Gironde, plus grand département métropolitain,
  n'en fait que 117 389. Et son chef-lieu ne dit rien de sa notoriété :
  Basse-Terre compte 9 417 habitants, ce qui rangeait la Guadeloupe parmi les
  départements les plus obscurs de France.
- **La notoriété pèse 0,78 en France.** À 0,62, le premier échelon contenait la
  Sarthe et le Loiret mais ni Paris, ni le Nord, ni le Rhône, ni les
  Bouches-du-Rhône. `pnpm ladder:verify` interdit désormais ce retour.

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
assets/flags/    193 drapeaux + territoires, PNG, générés par `pnpm flags:build`
src/data/        Atlas pré-projetés, table des drapeaux, types
src/map/         Décodage des tracés, pointé, rendu SVG, zoom
src/game/        Aléatoire, difficulté, échelons, questions, moteur, révision, économie
src/store/       Progression persistée (zustand + AsyncStorage) et partie en cours
src/theme/       Jetons de design, typographie, thème clair/nuit
src/ui/          Primitives d'interface, icônes, barre d'onglets, marque
app/(tabs)/      Cap, Atlas, Brevets, Cabine — la coquille de l'application
app/             Première ouverture, préparation, découverte, comptoir, partie, bilan
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

**Vingt-huit micro-États n'ont pas de contour.** Natural Earth au
1/110 000 000 ne dessine ni Malte, ni Singapour, ni Bahreïn, ni Saint-Marin. Le
jeu ne les écarte pas pour autant : `SKILL_NEEDS_SHAPE` distingue les
compétences qui ont besoin d'un tracé — situer, nommer sur la carte — de celles
qui n'en ont pas — drapeau, capitale. Les 193 États membres sont donc
interrogeables ; 165 le sont sur la carte.

### Ce qui est vérifié

| Commande | Contrôles |
| --- | --- |
| `pnpm theme:verify` | 286 — contrastes des deux thèmes, seuil par usage, intégrité des jetons |
| `pnpm geo:verify` | 6 003 — intégrité des atlas, cartouches, symétrie du voisinage, cohérence des chefs-lieux |
| `pnpm map:verify` | 732 — décodage, pointé, recoupement chefs-lieux × contours |
| `pnpm game:verify` | 48 — barème, déterminisme du relevé, file de révision, répétition espacée, fin de partie |
| `pnpm ladder:verify` | 109 — ordres de difficulté, emboîtement des paliers, jouabilité de chaque échelon |
| `pnpm economy:verify` | 26 — courbe des rangs, pouvoir d'achat simulé, carnet, atteignabilité des brevets |
| `pnpm flags:verify` | 221 — couverture des 193 membres, dimensions déclarées, absence d'émoji dans le rendu |

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

**L'échelle est une échelle de valeur, pas seulement de teinte.** Une palette de
portulan peut très bien produire un lavis délavé, et c'est ce qui était arrivé :
quatre surfaces claires séparées de 1,1:1, des bordures à 1,5:1, une terre et
une mer de clarté *strictement* égale (1,01:1). Un portulan authentique est
l'inverse — encre noire sur vélin, traits de côte appuyés, mers franchement
teintées. Trois règles en découlent, que `pnpm theme:verify` fait respecter :

- **La lisibilité d'une feuille vient de son bord, pas de son fond.** Deux
  parchemins ne peuvent pas s'écarter de plus de ~1,3:1 sans que l'un cesse
  d'être du parchemin. Une feuille posée se lit donc à trois signes conjugués :
  l'ombre dessous, la bordure d'encre autour, le biseau clair sur l'arête haute.
  D'où trois rôles de bordure et non un seul, chacun avec son seuil — 3:1 pour
  ce qu'on touche, conformément à WCAG 1.4.11.

- **Sur la carte, l'information est portée par le trait.** Terre et mer ne se
  séparent que modérément (1,8:1) : au-delà, on quitte le parchemin. C'est le
  trait de côte qui tient 3:1 contre les deux — la solution cartographique
  classique.

- **Tout texte porteur d'information tient 4,5:1**, cartouches et légendes
  comprises. Le décoratif qui peut descendre a son propre rôle, `textQuiet`, ce
  qui rend l'exception explicite au lieu de la laisser se répandre.

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
- Drapeaux — [flagcdn.com](https://flagcdn.com), d'après [lipis/flag-icons](https://github.com/lipis/flag-icons) (MIT)

---

## v2 — prévu

Multijoueur : classements, duels asynchrones. Le moteur y est préparé — une
partie est entièrement décrite par une graine, si bien qu'un duel se transmet
sans envoyer la liste des questions.
