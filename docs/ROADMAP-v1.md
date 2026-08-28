# Portulan — de la maquette au jeu

> **État au 28 août 2026.** P0 livré, l'accompagnement du joueur (échelons,
> découverte, première ouverture), la refonte de l'accueil, et le solde de la
> dette technique — répétition espacée enfin ordonnancée, 193 États, abandon qui
> conserve la progression, dépendances mortes retirées. Reste le lot 3
> (économie). Détail en fin de document.


État des lieux et plan de route vers une v1 jouable. Rédigé après lecture
complète du code existant, mesure des contrastes et vérification des points
douteux.

Le socle technique est bon et n'est pas en cause : la chaîne de production des
données, le moteur de partie, la répétition espacée et la géométrie de la carte
sont solides, testés et bien documentés. Ce qui manque est **au-dessus** — la
peau, la coquille et la boucle de rétention.

---

## Diagnostic

### Ce qui existe

| Couche | État |
| --- | --- |
| Atlas pré-projetés, 101 départements + 193 États | Complet, vérifié |
| Moteur de partie (score, série, sablier, bilan) | Complet, simulé |
| Répétition espacée (boîtes de Leitner) | Écrit, **jamais ordonnancé** |
| Fabrique de questions et leurres pondérés | Complet, remarquable |
| Rendu et pointé de la carte | Complet |
| Jetons de design, typographie, thème nuit | Écrits, **mal calibrés en valeur** |
| Écrans | 4 — accueil, jeu, bilan, atlas |
| Gamification (monnaie, rangs, brevets, missions) | **Inexistante** |
| Drapeaux | **Émojis** |
| Réglages | Persistés, **sans aucune interface** |
| Son | Dépendance et permissions déclarées, **zéro code** |

### Les cinq reproches, reformulés

Les remarques initiales se ramènent à cinq problèmes distincts, dont un seul est
esthétique.

1. **Le thème n'a pas d'échelle de valeur.** Toutes les surfaces claires sont à
   la même luminance. Ce n'est pas une question de goût, c'est mesurable — voir
   le tableau ci-dessous. Les cartes ne se détachent pas du fond, les bordures
   n'existent pas, et sur la carte la terre et la mer sont *strictement* de même
   clarté.

2. **La grammaire de mise en page est celle d'une page web, pas d'un jeu.**
   L'accueil est une pile verticale de trois cartes de même poids, chacune
   sur-titre / titre / paragraphe / métrique. C'est la structure d'une section
   « nos offres » sur un site vitrine. Un jeu mobile a un HUD permanent, une
   action primaire qui écrase les autres, et des onglets.

3. **Il n'y a aucune boucle de rétention.** Rien ne s'accumule entre deux
   parties sinon un meilleur score et une série quotidienne. Pas de monnaie, pas
   de rang, pas d'objectifs, pas de récompense, pas de déblocage. Le joueur n'a
   aucune raison de rouvrir l'application le soir même.

4. **Les émojis drapeaux ne sont pas des images.** Ils héritent de l'art de la
   plateforme (rendu brillant d'Apple, plat chez Google), ne rendent pas du tout
   sur la version web sous Windows ni sur certaines surcouches Android, ne
   supportent ni cadre, ni ombre, ni rapport d'image, et ne montent pas en
   taille proprement. Une question « à quel pays appartient ce drapeau ? » qui
   affiche un glyphe de 40 px n'est pas une question sur un drapeau.

5. **Rien ne bouge et rien ne charge.** Les questions se remplacent d'un coup,
   le score apparaît sans se poser, il n'y a ni transition d'entrée en partie,
   ni retour de récompense, ni écran de chargement. L'application se sent
   instantanée au mauvais sens : sans matière.

### Contrastes mesurés (WCAG 2.1)

Calculés sur les jetons actuels de `src/theme/tokens.ts`.

| Couple | Ratio | Attendu | Verdict |
| --- | ---: | ---: | --- |
| Terre inconnue / mer — thème clair | **1,01:1** | ≥ 2,2 | La carte n'existe pas |
| Territoire acquis / inconnu — clair | **1,24:1** | ≥ 2,5 | La promesse « la carte se colore » est invisible |
| Terre / mer — thème nuit | **1,19:1** | ≥ 2,2 | Idem |
| Carte posée / fond — clair | **1,11:1** | ≥ 1,6 | Aucun relief |
| Carte posée / fond — nuit | **1,21:1** | ≥ 1,6 | Aucun relief |
| Bordure de carte / carte — clair | **1,53:1** | ≥ 3,0 | Bordure décorative, pas structurante |
| Bordure de carte / carte — nuit | **1,20:1** | ≥ 3,0 | Idem |
| `textTertiary` sur surface — clair | **2,85:1** | ≥ 4,5 | Échoue AA — et c'est la couleur des cartouches, des légendes et des libellés de statistiques |
| `textTertiary` sur surface — nuit | **3,07:1** | ≥ 4,5 | Échoue AA |
| Trait de côte / terre — clair | **2,23:1** | ≥ 3,0 | Frontières trop pâles |

Sont corrects et resteront tels quels : le texte principal (16,1:1), le texte
secondaire (5,4:1), les aplats de bonne et de mauvaise réponse.

### Anomalies relevées au passage

Faits vérifiés dans le code, indépendants des remarques ci-dessus.

- **La répétition espacée n'est jamais ordonnancée.** `reviewPriority` et
  `isDue` (`src/game/srs.ts`) ne sont appelés nulle part hors de leur propre
  module. Les cartes sont bien mises à jour après chaque partie, mais rien ne
  propose jamais les cartes échues : le mode `'lesson'` est déclaré dans
  `SessionMode` sans configuration ni écran. La promesse centrale du projet —
  « des semaines, répétition espacée » — n'est aujourd'hui pas tenue.
- **Quitter une partie perd la progression.** `app/play.tsx` fait
  `router.replace('/')` sans appeler `recordSession` : les cartes révisées
  pendant la session sont jetées.
- **Deux comptes de maîtrise divergents.** L'accueil compte des *cartes*
  (`level >= 3`, toutes compétences confondues) et l'affiche « sur N vus » ;
  l'écran Atlas compte des *territoires* au minimum de leurs cartes. Les deux
  écrans annoncent des chiffres différents pour la même idée.
- **La question est plus petite que le sujet.** `Prompt` rend la consigne en
  `cartouche` — 12 px, capitales espacées. Pour les compétences `name` et
  `flag`, `subject` vaut `''` : il ne reste alors qu'une ligne de 12 px au
  milieu de l'écran.
- **Bouton mal nommé.** « Retour à l'atlas » sur l'écran de bilan navigue vers
  l'accueil.
- **Trois dépendances installées et inutilisées** : `expo-audio`, `expo-image`,
  `expo-linear-gradient`. Les permissions Android `RECORD_AUDIO`,
  `FOREGROUND_SERVICE` et `FOREGROUND_SERVICE_MEDIA_PLAYBACK` sont déclarées
  dans `app.json` sans qu'aucune ligne de code ne les justifie — c'est un motif
  de friction, voire de rejet, à la publication.
- **Coût d'entrée en partie.** `startSession` d'une expédition tire 300
  questions d'un coup : 15 ms sur V8 de bureau, mesuré, donc de l'ordre de 150 à
  300 ms sous Hermes sans JIT. Un à-coup au moment précis où le joueur appuie.
- **`accessibilityRole="adjustable"`** sur la carte : c'est le rôle d'un
  curseur. La carte n'est pas atteignable au lecteur d'écran.

---

## Principes directeurs

Trois règles pour que les lots qui suivent restent cohérents entre eux.

**On ne change pas la direction artistique, on lui donne du relief.** Les
teintes restent : parchemin, encre sépia, vermillon, vert-de-gris, laiton, mer.
Ce qui change est l'échelle de *valeur* — l'écart de luminance entre les
surfaces. Une carte portulan authentique est très contrastée : encre noire sur
vélin, traits de côte appuyés, mers franchement teintées. Le thème actuel a la
palette d'un portulan et la valeur d'un lavis délavé.

**La gamification épouse la fiction, elle ne s'y colle pas.** Pas de gemmes ni
de coffres. Des **doublons**, un **rang de navigateur**, des **brevets**, un
**carnet de bord**, des **cartouches à sceller**. Chaque mécanique récompense
une vraie progression pédagogique plutôt que du temps passé.

**Ce qui se vérifie se vérifie.** Le projet a déjà `geo:verify`, `map:verify`,
`game:verify`. Les nouvelles couches s'y ajoutent : `theme:verify` calcule les
contrastes et échoue sous seuil, `flags:verify` contrôle la couverture des 193
drapeaux, `economy:verify` simule la courbe de progression.

---

## Plan par priorités

### P0 — Le socle. Rien de crédible ne se construit dessus tant que ce n'est pas fait.

#### Lot 0 · Recalibrage du thème

*Intention : que les surfaces se distinguent, que la carte se lise, que la
progression se voie.*

- Réécrire l'échelle `parchment` et `night` en **échelle de valeur** : quatre
  paliers de surface séparés d'au moins 1,25:1 chacun, du fond creusé à la
  feuille posée.
- Bordures en **encre diluée** et non en parchemin foncé : une bordure est un
  élément structurant, elle doit tenir 3:1 contre sa surface.
- `textTertiary` remonté au-dessus de 4,5:1. Introduire un rôle `textQuiet`
  distinct pour le décoratif réellement non porteur d'information, seul autorisé
  à descendre.
- **Carte** : mer franchement teintée, terre inconnue plus sourde, territoire
  acquis en vert-de-gris ou laiton *saturé* et non en parchemin clair, trait de
  côte en encre appuyée, frontières internes en encre diluée. Le halo côtier
  gagne un troisième anneau.
- Ombres : les élévations actuelles sont trop diffuses pour se voir sur
  parchemin. Ombres plus courtes, plus contrastées, et un liseré clair en haut
  de chaque surface — le biseau d'une feuille posée sur une autre.
- `scripts/verify-theme.mts` + `pnpm theme:verify` : table de couples
  (avant-plan, arrière-plan, seuil), calcul du ratio, sortie en échec sous
  seuil. Branché dans `pnpm verify`.

*Fait quand :* `pnpm theme:verify` passe sur les deux thèmes, et une capture de
l'atlas France montre les départements acquis sans qu'on ait à chercher.

#### Lot 1 · Vrais drapeaux

*Intention : qu'une question sur un drapeau montre un drapeau.*

- `scripts/build-flags.mts` : télécharge les 193 drapeaux des membres de l'ONU
  en PNG (source `flagcdn`, dérivée de `lipis/flag-icons`, MIT), via le cache de
  `scripts/lib/fetch-cache.mts` étendu au binaire. Écrit `assets/flags/{cca2}.png`
  et un module `src/data/flags.ts` portant la table statique de `require` —
  Metro exige des chemins littéraux.
- Deux tailles : une pour les rangées de propositions, une pour le drapeau en
  vedette. Budget visé : moins de 1,5 Mo au total, les aplats se compressant
  très bien.
- Composant `<Flag />` bâti sur **`expo-image`** (déjà installé, jamais utilisé) :
  rapport 4:3, coins arrondis, liseré d'encre, ombre courte, aplat de parchemin
  en attente de décodage.
- La question `flag` passe du glyphe de 40 px à un **drapeau en vedette**
  encadré, occupant le haut de l'écran.
- Le champ `emblem` des `Choice` et `Question` cesse de porter un émoji et porte
  un code pays.
- `pnpm flags:verify` : un fichier par membre de l'ONU, dimensions et poids
  cohérents. Attribution ajoutée aux crédits, à la manière des sources
  géographiques déjà consignées.

*Fait quand :* les 193 drapeaux s'affichent hors ligne, sur appareil et sur web,
identiques d'une plateforme à l'autre.

#### Lot 2 · Coquille de jeu

*Intention : que l'application cesse d'être une pile d'écrans et devienne un
lieu.*

- **Onglets** — passage à `app/(tabs)/` : **Cap** (jouer), **Atlas**,
  **Brevets**, **Cabine**. Barre d'onglets dessinée à la main, en papier et
  encre, l'onglet actif marqué d'une rose des vents. Pas la barre par défaut.
- **HUD permanent** en haut des onglets : doublons, rang et jauge d'expérience,
  série du jour. C'est la première chose qu'on voit en ouvrant, et ce qui donne
  envie de rouvrir.
- **Accueil refondu.** Fin des trois cartes égales. Une **vedette Expédition**
  plein cadre, la carte de l'atlas courant en fond, le record gravé dedans ;
  au-dessous, deux tuiles courtes (Relevé du jour, Révision) ; puis le carnet de
  bord du jour. La sélection d'atlas devient un sélecteur en tête, pas une
  rangée de puces au milieu.
- **Cabine** — l'écran de réglages qui n'existe pas : thème, retour haptique,
  son, remise à zéro, crédits et sources. Les préférences sont déjà persistées
  et n'ont jamais eu d'interface.
- Pile hors onglets : `play`, `results`, `territory/[id]`, `shop`, `onboarding`.
  Animations de transition choisies par route, et non `fade` pour tout.

*Fait quand :* on peut atteindre chaque fonction en deux touchers depuis
n'importe où, et l'accueil ne ressemble plus à une page vitrine.

---

### P1 — Le jeu. Ce qui donne envie de revenir.

#### Lot 3 · Économie et progression

*Intention : que quelque chose s'accumule.*

Nouveau module `src/game/economy.ts`, pur et testable comme le reste du moteur.

- **Doublons.** Gagnés en fin d'expédition (indexés sur le score), au relevé du
  jour, à chaque promotion de carte en boîte supérieure, à chaque brevet.
  Dépensés au Comptoir. Aucune monnaie réelle, aucun achat.
- **Rang de navigateur.** Huit rangs — Mousse, Matelot, Gabier, Timonier,
  Second, Capitaine, Commodore, Amiral. Expérience gagnée à la bonne réponse et
  surtout à la **promotion d'une carte**, pour que le rang mesure ce qu'on sait
  et non le temps passé.
- **Avaries.** Trois erreurs et le relevé du jour s'arrête. L'expédition garde
  son sablier, qui remplit déjà ce rôle. Pas d'énergie qui empêche de jouer :
  une application qui enseigne ne doit pas fermer sa porte au joueur qui veut
  travailler — si la mécanique est souhaitée malgré tout, elle sera un réglage,
  jamais un défaut.
- **Carnet de bord.** Trois objectifs par jour, tirés de la date comme le relevé
  — donc identiques pour tout le monde et rejouables. « Situer douze
  départements », « une expédition sans erreur pendant dix questions », « sceller
  un cartouche ». Récompense en doublons.
- **Brevets.** Catalogue déclaratif, évalué à partir de la progression :
  Tour de France, Tour du monde, Sans une avarie, Cent jours en mer, Le tour de
  la Manche, Cartographe (tous les cartouches scellés)…
- **Cartouches scellés.** Une région française ou une sous-région du monde
  entièrement acquise se **scelle** : un sceau de cire doré apparaît sur
  l'atlas, une récompense tombe. C'est le lien direct entre la vraie pédagogie
  et la récompense — et le plus beau geste que la direction artistique
  autorise.
- **Comptoir.** Indices achetables (retirer deux propositions, révéler les
  voisins, une seconde chance), encres de carte, roses alternatives.
- `progress.ts` : version 2 du format et migration écrite. Le point d'entrée
  existe déjà et n'a jamais servi ; c'est sa première vraie migration.
- `pnpm economy:verify` : la courbe de rangs, le rythme d'acquisition des
  doublons, l'atteignabilité de chaque brevet.

#### Lot 4 · Le jeu lui-même

*Intention : que jouer soit lisible et jouable.*

- **Mode Révision.** Enfin brancher `reviewPriority` : file construite des
  cartes échues, la plus en retard en tête, sans chronomètre. C'est la troisième
  couche annoncée par le projet et la seule qui n'existe pas.
- **Hiérarchie de la question inversée.** La consigne remonte en taille de
  titre ; la vedette reste la vedette ; les questions sans sujet (`name`,
  `flag`) ne laissent plus une ligne de 12 px seule au milieu de l'écran.
- **Cadrage automatique de la carte.** Une question `locate` cadre sur la région
  pertinente au lieu de montrer le monde entier — désigner Andorre ou le
  Territoire de Belfort sur une carte plein cadre est aujourd'hui hors de
  portée. Pincement pour zoomer et déplacement au doigt
  (`react-native-gesture-handler`, déjà installé).
- **Barre de temps** segmentée, pulsation et virage au vermillon sous dix
  secondes.
- **Verdict** : bandeau animé, points qui volent vers le score, série qui
  s'embrase au palier.
- **Confirmation avant abandon**, et enregistrement de la session quittée — la
  progression de répétition espacée ne doit pas être jetée.

---

### P2 — La matière. Ce qui fait « vraie app ».

#### Lot 5 · Mouvement, chargements, son

- **Transition d'embarquement** — « On lève l'ancre », rose qui tourne, carte
  qui se déplie. Masque au passage les 150 à 300 ms de tirage de la file de
  questions sous Hermes.
- **Transitions de question** : la fiche sortante glisse, l'entrante se pose.
- **Bilan animé** : le score monte au compteur, les doublons tombent un à un, le
  sceau de record s'appose.
- **Son.** Soit on l'implémente — plume qui gratte, sceau qui claque, cloche de
  record, avec le réglage déjà persisté — soit on retire `expo-audio` et les
  permissions Android. Les deux sont défendables ; le statu quo, non.
- **Réduction de mouvement** respectée (`AccessibilityInfo`).

#### Lot 6 · Profondeur

- **Fiche territoire** `/territory/[id]` : contour cadré, chef-lieu, région,
  population, superficie, voisins atteignables d'un toucher, maîtrise détaillée
  par compétence. Donne enfin une raison de toucher la carte hors partie.
- **Atlas enrichi** : filtre par compétence, bascule maîtrise / dernières
  erreurs, sceaux de cartouche, et le compte de maîtrise réconcilié avec celui
  de l'accueil.
- **Brevets** : grille de badges, gagnés et à gagner, plus les statistiques
  cumulées — précision, temps de jeu, répartition des cartes par boîte.

#### Lot 7 · Première ouverture

- Trois écrans d'accueil qui posent la fiction, choix de l'atlas de départ,
  première expédition guidée et raccourcie.
- État vierge soigné partout : aujourd'hui la bannière de série disparaît
  purement et simplement et les métriques affichent « — ».

---

### P3 — Finitions

- Accessibilité : rôle correct pour la carte et accès non visuel aux
  territoires, libellés complets, tailles de police dynamiques.
- Nettoyage des dépendances et des permissions Android non justifiées.
- Renommage du bouton « Retour à l'atlas » du bilan.
- Réconciliation des deux comptes de maîtrise divergents.

---

## Ordre d'exécution conseillé

Les lots 0, 1 et 2 sont préalables au reste : recalibrer le thème après avoir
dessiné dix écrans obligerait à tout reprendre, et la coquille à onglets
détermine où vivent les écrans des lots suivants.

```
Lot 0  Thème                    ─┐
Lot 1  Drapeaux                  ├─ P0, dans cet ordre  ✓ fait
Lot 2  Coquille et navigation   ─┘
Lot 3  Économie                 ─┐
Lot 4  Jeu                       ├─ P1, parallélisables
Lot 5  Mouvement et son         ─┘
Lot 6  Profondeur               ─┐
Lot 7  Première ouverture        ├─ P2
Lot 8  Finitions                ─┘  P3
```

---

## Journal — P0

### Lot 0 · Recalibrage du thème ✓

`src/theme/tokens.ts` réécrit en échelle de valeur ; trois rôles de bordure
(`borderSoft` / `border` / `borderStrong`), un rôle `textQuiet` pour le
décoratif, un `bevel` pour le liseré d'arête, et des rôles de carte séparés
(`mapWater`, `mapLabel`, `mapLabelHalo`). Ombres relevées : à 0,10 d'opacité sur
du parchemin, elles ne se voyaient pas.

`scripts/verify-theme.mts` + `pnpm theme:verify` — 164 contrôles, seuil par
usage, branché dans `pnpm verify`. Il a servi à *choisir* les valeurs, pas
seulement à les contrôler après coup.

| Couple | Avant | Après | Seuil |
| --- | ---: | ---: | ---: |
| Terre / mer — clair | 1,01:1 | 1,86:1 | 1,8 |
| Terre / mer — nuit | 1,19:1 | 1,86:1 | 1,8 |
| Acquis / inconnu — clair | 1,24:1 | 2,87:1 | 2,4 |
| Feuille / fond — clair | 1,11:1 | 1,27:1 | 1,22 |
| Bordure de feuille — clair | 1,53:1 | 2,87:1 | 2,2 |
| Contour tactile — clair | — | 5,76:1 | 3,0 |
| `textTertiary` sur fond | 2,85:1 | 4,52:1 | 4,5 |

`PaperSurface` gagne le biseau et les trois tons de bordure ; c'est lui, et non
la couleur de fond, qui fait ressortir une carte du parchemin.

### Lot 1 · Vrais drapeaux ✓

`pnpm flags:build` télécharge 203 drapeaux en PNG 320 px depuis flagcdn
(dérivé de `lipis/flag-icons`, MIT), **292 Ko au total** — moins cher que
craint, les drapeaux étant des aplats. Le script mesure les dimensions réelles
de chaque fichier et les inscrit dans `src/data/flags.ts`, table de `require`
générée puisque Metro n'accepte que des chemins littéraux.

`src/ui/Flag.tsx` inscrit le drapeau dans une **boîte** au lieu de lui imposer
des dimensions : les rapports vont de 2,54:1 (Qatar) à 0,82:1 (Népal, plus haut
que large), et une grille au format fixe les rognerait ou les étirerait — une
faute factuelle dans un jeu dont l'objet est de les reconnaître. La question
« à quel pays appartient ce drapeau ? » montre désormais un drapeau encadré de
240 points et non un glyphe de 40.

`pnpm flags:verify` — 216 contrôles, dont un qui interdit tout retour d'émoji
dans les écrans.

### Lot 2 · Coquille de jeu ✓

Trois onglets — **Cap**, **Atlas**, **Cabine** — bâtis sur la variante sans
interface d'expo-router (`expo-router/ui`), avec une barre entièrement dessinée :
réglette de bois, biseau, pastille de laiton sous l'onglet actif. Le quatrième
onglet, **Brevets**, attend le lot 3 : un onglet vide promet une salle et ouvre
sur un couloir.

**HUD permanent** (`src/ui/Hud.tsx`) qui prend des jauges et n'en connaît
aucune — les doublons et le rang s'y glisseront sans le toucher.

**Accueil refondu** : fin des trois cartes égales. Sélecteur de terrain en tête
(il conditionne tous les chiffres qui suivent et se trouvait auparavant *entre*
eux), vedette Expédition avec la silhouette du terrain en filigrane et un seul
bouton, puis deux entrées nettement plus basses en poids.

**Cabine** — l'écran de réglages qui n'existait pas : thème, retour haptique,
relevés cumulés, effacement en deux temps qui *nomme* ce qui sera perdu, et la
provenance des données. Interrupteur dessiné plutôt que le `Switch` natif, dont
le vert iOS et le violet Material sont la première chose que l'œil trouve sur du
parchemin.

Icônes dessinées à la main (`src/ui/icons.tsx`) : rose, globe gradué, barre de
gouvernail. L'engrenage universel des réglages n'a rien à faire sur un portulan.

### Hors lot · Zoom de la carte ✓

Remonté du lot 4 : `AtlasMap` était réécrit de toute façon.

Pincement et déplacement au doigt, en **deux temps** — pendant le geste, une
transformation de vue répond à soixante images par seconde ; au relâché, elle
est repliée dans le `viewBox` et le SVG se redessine net. Transformer la vue en
continu suffirait à l'animation mais rendrait les traits de côte flous dès le
facteur deux, react-native-svg rendant dans une couche rasterisée.

Trois détails qui comptent :

- **Le pincement grossit sous les doigts** et non au centre de la vue. Sans la
  compensation du point focal, la carte fuit sous la main.
- **Les épaisseurs sont corrigées du zoom.** Un trait de côte exprimé en unités
  atlas s'épaissit à l'écran quand on cadre serré ; toutes les mesures de tracé
  passent par un facteur `unit`.
- **Pas de double toucher pendant une question.** Le faire cohabiter avec le
  toucher simple oblige celui-ci à attendre trois cents millisecondes que le
  double échoue — inacceptable dans un mode chronométré au dixième. Le retour au
  cadre plein passe par un bouton « Recadrer », qui a en outre l'avantage d'être
  visible.

La carte gagne au passage une **vraie mer** (elle n'en avait aucune : les
territoires flottaient sur la couleur de fond de l'écran), un trait de côte à
l'encre retracé par-dessus l'ensemble des terres, un halo côtier à trois
anneaux, et des **étiquettes à halo** — rendues deux fois, épaissies dans la
couleur du papier puis à plat — qui apparaissent progressivement à mesure qu'on
entre dans la carte.

### Corrections de passage

- Les deux comptes de maîtrise divergents sont réconciliés dans
  `src/game/mastery.ts`, qui retient la définition juste : le **minimum** des
  niveaux des cartes d'un territoire.
- « Retour à l'atlas », sur l'écran de bilan, menait à l'accueil. Le libellé
  nomme désormais ce qu'il fait.
- La consigne d'une question était rendue en cartouche de 12 points, plus petite
  que tout le reste de l'écran, et restait seule au milieu du vide pour les
  questions sans sujet. Elle a la taille d'un titre.

### Reste ouvert

- La répétition espacée n'est toujours pas ordonnancée — lot 4.
- Quitter une partie jette encore la progression — lot 4.
- `expo-audio` reste installé et inutilisé, avec ses permissions Android. La
  décision — implémenter le son ou retirer la dépendance — appartient au lot 5,
  et retirer les permissions sans retirer le greffon ne servirait à rien : le
  greffon `expo-audio` les réinjecte.
- `expo-linear-gradient` reste inutilisé.


---

## Journal — accompagnement et accueil

Deux critiques après la livraison de P0 : l'accueil restait trop dense et trop
plat, et — plus grave — le jeu ne demandait jamais le niveau du joueur, si bien
qu'on tombait d'emblée sur des questions hors de portée.

### Le fond : le jeu n'accompagnait personne

Le diagnostic exact : `randomQuestion` tirait **uniformément** sur les 101
départements, uniformément sur les 165 pays, uniformément sur les cinq
compétences. Un joueur qui n'a jamais révisé se voyait donc demander la Creuse à
sa première partie, avec exactement la même probabilité que le Nord. Et il n'y
avait aucun moment, nulle part, où l'on *montrait* un territoire avant de
l'interroger : la répétition espacée entretient une trace, elle ne la crée pas.

Quatre pièces neuves.

**`src/game/difficulty.ts`** — la difficulté d'un territoire, calculée depuis les
données embarquées : notoriété (population du chef-lieu, ou du pays) et taille,
en rangs centiles. Deux corrections documentées, l'une et l'autre trouvées en
regardant le résultat plutôt qu'en relisant le code :

- L'aire projetée de l'outre-mer est mesurée dans son cartouche : La Réunion
  pesait 192 875 unités contre 117 389 pour la Gironde, plus grand département
  métropolitain. Ils sont désormais classés à part.
- La notoriété est passée de 0,62 à 0,78 pour la France. À 0,62, le premier
  échelon contenait la Sarthe et le Loiret mais **ni Paris, ni le Nord, ni le
  Rhône, ni les Bouches-du-Rhône** — les 104 contrôles passaient, et le résultat
  était faux. Deux contrôles neufs interdisent ce retour.

**`src/game/ladder.ts`** — cinq échelons qui élargissent ensemble le vivier, les
compétences autorisées et le cadrage d'aide. L'échelon se gagne à la progression
réelle ; le niveau déclaré à la première ouverture ne pose qu'un plancher.

**`app/decouverte.tsx`** — cinq fiches, tirées des territoires ouverts et jamais
rencontrés, puis vérification immédiate sur ces cinq-là, sans chronomètre. C'est
la pièce qui manquait le plus.

**`app/onboarding.tsx`** — trois volets, une seule question (le niveau), et une
sortie **en découverte** : le premier geste d'un joueur doit être d'apprendre,
pas d'échouer.

Le cadrage d'aide (`src/map/framing.ts`) est délibérément **décentré** à partir
d'une empreinte FNV-1a de l'identifiant : un cadre centré sur sa réponse se
résoudrait en touchant le milieu de l'écran.

`pnpm ladder:verify` — 109 contrôles : ordres qui ne se discutent pas,
emboîtement des paliers, et jouabilité de chaque compétence à chaque échelon.

### La forme : accueil épuré, et de la matière

**L'accueil ne défile plus.** C'est la contrainte dont tout découle : un accueil
qui défile se remplit, et un accueil rempli est une page. Il reste quatre choses
— le bandeau, une vedette qui occupe la moitié de l'écran, une action, et le
relevé du jour sur une ligne. La vedette porte l'**échelon** et non le record :
un record dit ce qu'on a fait de mieux un jour, un échelon dit où l'on en est.

**`app/embarquer.tsx`** — l'écran de préparation qui reçoit ce que l'accueil a
perdu : terrain en grandes tuiles illustrées, trois modes avec ce qu'ils
promettent, et un bouton final qui prend la teinte du mode choisi.

**Les boutons ont une épaisseur.** `Button` est réécrit autour d'une tranche
visible qui s'écrase sous le doigt — deux vues superposées, aucune ombre, de la
géométrie. C'est ce qui distingue une touche d'une case coloriée. L'accent
remplace l'encre : vermillon pour l'expédition, laiton pour le relevé,
vert-de-gris pour la découverte. Trois teintes profondes ajoutées au thème, avec
leurs six contrôles de contraste.

**Le rideau d'appareillage.** Le tirage d'une expédition construit 300 questions
— quinze à vingt millisecondes sur un moteur de bureau, donc de l'ordre de deux
cents sous Hermes. Le magasin de session sépare désormais l'**intention** du
**tirage** : l'écran de préparation dépose une intention et navigue aussitôt,
l'écran de jeu tire la file derrière une rose qui cherche le nord.

`expo-linear-gradient`, installé et inutilisé depuis le début, sert enfin —
vedette, tuiles, reflet des boutons, barres de progression.

### Reste ouvert

- Le SRS n'est toujours pas ordonnancé : `reviewPriority` reste sans appelant, et
  le mode révision n'existe pas. C'est le lot 4, et c'est désormais la dernière
  grosse pièce de fond qui manque.
- Quitter une partie jette encore la progression.
- L'économie (doublons, rang, brevets, cartouches scellés) — lot 3.
- `expo-audio` reste installé et inutilisé, avec ses permissions Android.
- Les questions du monde portent sur **165 pays et non 193** : Natural Earth au
  1/110 000 000 ne fournit pas de contour pour les micro-États, et
  `playablePool` les écarte tous — y compris des questions de drapeau, qui n'ont
  pourtant pas besoin de géométrie. Le README annonce 193.

---

## Journal — solde de la dette

Trois retours d'écran : l'accueil creusait un trou vertical, la légende de
l'Atlas s'étirait en ovales géants, et la première ouverture était introuvable.
Puis le solde de tout ce qui restait ouvert.

### Ce que les captures ont montré

**Le trou de l'accueil.** La vedette avait une hauteur fixe (`height * 0.42`,
plafonnée à 420) suivie d'un ressort `flex: 1` qui poussait le bouton en bas :
sur un grand téléphone, quatre cents points de vide entre les deux. La vedette
prend désormais la place au lieu de la laisser.

**Deux décors au même endroit.** La rose des vents était superposée à la
silhouette du terrain, à opacités voisines : elles se brouillaient l'une l'autre
au lieu de composer. La rose est retirée de la vedette — elle reste seule sur
l'appareillage et la première ouverture, où elle est la marque.

**La légende de l'Atlas en ovales de six cents points.** Un `ScrollView`
horizontal placé dans une colonne s'étire sur *tout* l'espace vertical restant
s'il n'a pas `flexGrow: 0`. Les pastilles, de rayon « pilule », devenaient des
capsules géantes. C'est le piège classique du défilement horizontal en flexbox
React Native, et il ne se voit qu'à l'écran.

**Les étiquettes de la carte, illisibles et superposées.** Deux fautes
distinctes :

- *Le corps du texte était exprimé en unités atlas.* 26 unités sur une carte
  large de 4 000 rendue dans 360 points font **0,14 point** — un cheveu. Toutes
  les mesures de tracé — traits de côte, frontières, halo, graticule, étiquettes
  — passent maintenant par les points d'écran, ce qui rend l'épaisseur apparente
  constante par construction et lisible d'emblée.
- *Le tri se faisait sur l'aire.* Les départements français vont de 0,4 % à
  1,1 % du cadre : une plage trop resserrée pour trier quoi que ce soit, si bien
  qu'ils s'affichaient tous d'un coup. La règle est désormais celle du lettrage
  cartographique — **un nom s'affiche s'il tient dans la largeur que son
  territoire occupe à l'écran** —, qui a la bonne propriété d'être
  automatiquement progressive.

**La barre à roue ressemblait à un astérisque.** Les rayons couraient d'un bord
à l'autre du cadre, bien au-delà d'une jante de rayon 5,6. Redessinée : jante
dominante, rayons qui s'y arrêtent, courtes poignées qui la dépassent à peine.

**Les jauges du bandeau débordaient.** Une jauge en rangée — icône, puis valeur
et libellé empilés à côté — ne laisse au libellé qu'une soixantaine de points sur
les quatre-vingt-huit de la boîte. L'icône est passée sur la ligne de la valeur.

**La première ouverture était introuvable.** La migration v1→v2 marquait « déjà
accueilli » toute progression contenant des cartes. L'intention était bonne — ne
pas resservir une présentation à quelqu'un en cours de route — mais elle avait
deux défauts : l'écran ne fait pas que présenter, il **demande le niveau**, seule
question du jeu ; et aucune installation existante n'avait plus de chemin vers
lui, ce qui le rendait invisible et intestable. Migration v3 : tout le monde le
voit une fois, la progression n'est pas touchée, et la Cabine permet d'y revenir.

### La dette de fond

**La répétition espacée est enfin ordonnancée.** `reviewPriority` et `isDue`
n'avaient aucun appelant hors de `srs.ts` : les échéances étaient calculées avec
soin après chaque partie et **personne ne les lisait**. `src/game/revision.ts`
construit la file des cartes échues, la plus en retard d'abord ; `lessonConfig`
en fait une séance qui repose exactement ces cartes-là, dans cet ordre, sans
chronomètre. Neuf contrôles neufs dans `game:verify`, dont celui qui compte :
*chaque question porte la carte attendue, dans l'ordre d'urgence*.

La file ne renvoie que les cartes **réellement échues** — pas les cartes jamais
vues, qui sont l'objet de la Découverte, ni les cartes à jour, dont la révision
ferait un simple générateur de questions. Une file vide est une information :
il n'y a rien à réviser aujourd'hui.

**Abandonner ne jette plus la progression.** « Quitter » naviguait vers l'accueil
sans rien consigner : douze réponses justes suivies d'un appel téléphonique, et
tout repartait de zéro — le contraire exact de ce qu'une application de
répétition espacée doit faire. La progression est enregistrée, le score non :
une partie abandonnée n'est pas un record.

**193 États et non 165.** Natural Earth au 1/110 000 000 ne dessine pas les
micro-États, et le vivier les écartait *entièrement* — y compris des questions de
drapeau et de capitale, qui n'ont besoin d'aucune géométrie. `SKILL_NEEDS_SHAPE`
distingue les compétences qui exigent un tracé de celles qui n'en exigent pas.
Malte et Singapour sont interrogeables sur leur drapeau ; ils restent hors des
questions de carte, et leur difficulté les place au dernier échelon.

**`expo-audio` est retiré**, avec ses quatre permissions Android — `RECORD_AUDIO`
en tête — qu'aucune ligne de code ne justifiait. Le réglage `sound`, persisté
depuis le début et sans effet, tombe dans la même migration. Le son reviendra
avec du code, pas avant.

`expo-linear-gradient` est le seul des trois à avoir trouvé son emploi.

### Reste ouvert

- L'économie du jeu — doublons, rang de navigateur, brevets, cartouches scellés
  — reste entière. C'est le lot 3, et c'est désormais la seule grande pièce
  manquante.
- Retirer `expo-audio` touche au natif : il faut un `pnpm install` et un
  nouveau build de développement pour que le changement prenne.


### La première ouverture, refaite

Sa première version était un README : un titre, puis deux paragraphes de prose
expliquant la mécanique des paliers, sur un fond nu. Tout y était juste et rien
n'y était lisible. Personne n'ouvre une application pour lire la description de
son système de progression, et un mur de texte ne donne aucune envie de jouer.

Ce qui la remplace tient en une idée : **on montre le produit en train de faire
ce qu'il promet.** La carte de France se colore d'elle-même, département après
département, dans l'ordre exact où le jeu les enseignera — le même classement de
difficulté que les échelons. C'est la promesse du projet, « votre carte se colore
à mesure que les territoires entrent en mémoire longue », rendue en trois
secondes et sans une phrase. La boucle se rejoue : dix secondes d'hésitation sur
cet écran, et on l'a vue se remplir deux fois.

Le texte se réduit à ce qui ne se dessine pas — trois mots de titre, une ligne de
cadrage, trois arguments d'une ligne. Les échelons, la répétition espacée et
l'ordre de difficulté s'apprennent en jouant et n'ont rien à faire là.

Au passage : `AtlasMap` ne construit plus son index de pointé quand aucun
toucher n'est attendu. Décoder cent-un contours en anneaux de polygones ne sert
qu'au pointé, et le faire payer au tout premier écran de l'application — comme à
l'atlas de maîtrise et aux fiches de découverte, qui n'en ont pas davantage
l'usage — retardait leur premier rendu pour rien.

---

## Journal — Lot 3, l'économie

### Le principe, et ce qu'il exclut

**On paie ce qui est appris, pas ce qui est joué.** C'est la seule décision
structurante, et elle se lit dans tous les barèmes : l'expérience ne vient
*exclusivement* que des promotions de cartes, des acquisitions et des cartouches
scellés. Un joueur qui enchaîne les expéditions sans rien retenir gagne quelques
doublons et **aucun rang**.

L'alternative — récompenser le temps passé — produit des courbes d'engagement
flatteuses et ment sur ce que les joueurs savent. Le rang de Portulan est une
affirmation, et il ne doit pas pouvoir s'acheter en heures. La même règle écarte
du catalogue de brevets tout titre indexé sur le nombre de parties, et du carnet
de bord tout objectif de durée.

### Les pièces

- **`economy.ts`** — huit rangs (Mousse → Amiral), barèmes, catalogue du
  Comptoir. Le décompte est rendu **ligne par ligne** et jamais en total : un
  joueur qui lit « 12 cartes promues · +24 » apprend la règle du jeu sans qu'on
  la lui explique.
- **`quests.ts`** — trois objectifs par jour, tirés de la date comme le relevé,
  donc identiques pour tout le monde sans serveur. Tirage sans remise : une
  journée ne peut pas demander trois fois la même chose à trois seuils
  différents.
- **`brevets.ts`** — treize titres, chacun **fonction pure de la progression** et
  jamais un compteur. Un compteur se désynchronise à la première migration ; une
  fonction de l'état ne le peut pas. Seule la *date* d'obtention est persistée.
- **`mastery.ts`** — les cartouches. Une région entièrement sue se scelle et se
  colore d'or sur l'atlas. Les groupes d'un seul territoire sont écartés :
  sceller « Mayotte » parce qu'on connaît Mayotte dévaluerait les vrais sceaux.
- **`inks.ts`** — trois encres de carte, qui ne redéfinissent **que** les rôles
  `map*`. Une règle du vérificateur l'impose : le jour où une encre toucherait à
  `canvas` ou `text`, elle cesserait d'être un habillage de planche pour devenir
  une seconde identité de l'application.

### Ce que la simulation a corrigé

`economy:verify` joue vingt parties avec le vrai moteur et la vraie répétition
espacée, puis regarde ce que la bourse permet. Le premier réglage donnait
**5,8 encres et 87 indices** en vingt parties : la boutique était vide avant
d'avoir servi, et la monnaie sans horizon. Prix et gains revus, la
spécification est désormais énoncée et vérifiée — *après une vingtaine de
parties, on s'offre la première encre et pas la seconde.*

Le contrôle a aussi confirmé que l'amirauté tombe à 67 % d'un atlas entièrement
su : ni un titre décoratif atteint en trois jours, ni un mur.

### Les avaries — six, et le chiffre est mesuré

Le premier réglage était trois. La simulation a montré qu'il **raccourcissait
les parties de moitié** et transformait la fin en coup de dé sur les premières
erreurs, ce qui défaisait toute la calibration documentée de l'expédition.

À six, les longueurs moyennes sont *identiques* à celles sans avaries — 12, 19,
32, 99, 125 questions selon la précision — et seule la raison de la fin change.
Les avaries ne durcissent rien : elles donnent un nom et un décompte visible à
une fin que le sablier provoquait déjà en silence. `game:verify` en fait un
invariant : si un réglage futur écarte les deux colonnes de plus de 12 %, la
mécanique aura cessé d'être gratuite.

La **seconde chance** achetée au Comptoir se propose au naufrage et nulle part
ailleurs : c'est le seul instant où l'indice est une décision plutôt qu'un
bouton de plus dans une fenêtre d'une seconde et demie.

### Fluidité de la carte

Trois causes, toutes mesurables dans le code :

- **Cent à cent soixante-cinq propriétés changeaient à chaque repliement de
  zoom.** L'épaisseur du trait était passée à chaque tracé ; elle est désormais
  portée par le groupe parent, dont les enfants — mémoïsés et référentiellement
  identiques d'un zoom à l'autre — sont purement sautés par React.
- **L'objet d'états était reconstruit à chaque rendu** dans l'écran de jeu, ce
  qui invalidait cette mémoïsation à chaque battement du chronomètre et
  redessinait l'atlas entier pour rien.
- **Le halo côtier peignait quatre fois la silhouette entière** — un trait très
  large à jointures arrondies sur un littoral de plusieurs milliers de sommets,
  ce qui est parmi les choses les plus coûteuses qu'un moteur 2D sache faire. Il
  passe à deux anneaux, et disparaît dès qu'on entre dans la carte, où le large
  sort du cadre de toute façon.

S'y ajoute `renderToHardwareTextureAndroid` / `shouldRasterizeIOS` sur la vue
transformée pendant le geste : le contenu est peint une fois puis déplacé par le
compositeur, au lieu d'être redessiné à chaque image.

### Reste ouvert

Le lot 3 clôt la feuille de route. Ce qui reste relève des lots P2/P3 : fiche
territoire, son, réduction de mouvement, et l'accessibilité non visuelle de la
carte.


### Correctif — la boucle de rendu au montage

`Maximum update depth exceeded` dès l'ouverture. **Deux fautes indépendantes**,
et la seconde aurait fini par se manifester ailleurs.

**Un sélecteur zustand qui fabriquait un tableau neuf à chaque lecture.**
`useProgress((s) => selectQuests(s, key))` : `questsFor` construit ses objectifs
à chaque appel, si bien que l'instantané différait à chaque lecture et que
`useSyncExternalStore` en concluait, indéfiniment, que le magasin avait changé.
C'est le piège classique de zustand, et il ne se voit qu'à l'exécution — aucun
type ne l'attrape. La fonction s'appelle désormais `questsOf`, prend les tranches
brutes du magasin et se mémoïse dans le composant ; son commentaire dit
explicitement de ne jamais la passer à un sélecteur.

**La variante sans interface d'expo-router.** `expo-router/ui` paraissait le bon
choix — elle ne fournit que le routeur, la barre est entièrement à nous. Elle
reconstruit en réalité ses écrans et sa table de déclencheurs à **chaque rendu**,
en analysant l'arbre React qu'on lui passe, et l'application s'y prenait les
pieds au montage.

Le navigateur d'onglets standard accepte une barre entièrement personnalisée par
sa propriété `tabBar` : même rendu, sans analyse d'arbre à chaque image. La
`PaperTabBar` est inchangée à l'œil ; seule sa source de données passe des
déclencheurs à l'état du navigateur.
