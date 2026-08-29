# Portulan — fluidité et langage mobile

> Chantier ouvert le 29 août 2026. Le socle est livré : machine d'états
> question–feedback, démarrage de session sans cérémonie, moteur de carte à
> couches séparées, grammaire d'interaction commune, parcours vertical refait,
> écrans secondaires repris. Reste la mesure sur appareils réels — elle ne peut
> se faire qu'avec les appareils en main.

L'objectif n'est pas « plus d'animations ». C'est **moins d'animations, mieux
choisies, plus rapides, et reliées au geste**. Trois sensations à obtenir :

- le toucher produit une réponse immédiate ;
- la navigation semble spatiale et continue ;
- aucun écran ne pourrait être pris pour une page web responsive.

---

## 1. Mesurer, sur de vrais appareils

Trois appareils de référence. **L'Android milieu de gamme est l'appareil
déterminant** : ce qui passe dessus passe partout.

| Appareil                        | Rôle                                |
| ------------------------------- | ----------------------------------- |
| Petit iPhone (SE ou équivalent) | Petits écrans, police agrandie      |
| iPhone récent                   | Plancher haut, sert de témoin       |
| Android milieu de gamme         | **Décide de la sortie du chantier** |

### La sonde embarquée

`src/fx/probe.ts` mesure ce qu'un profileur ne dit pas facilement : le délai
entre le toucher et la réaction visible, les blocages du fil JavaScript, et le
coût des spans nommés (construction d'une session, décodage d'un atlas).

Elle s'active dans **Cabine → Développement → Sonde de fluidité**, et n'existe
que dans un build de développement. Un bandeau apparaît en haut de l'écran :
nombre de dépassements et pire mesure de la session. On le touche pour dérouler
le détail, on le maintient pour repartir de zéro avant d'enregistrer un
parcours. `probe.report()` sort une ligne par span, prête à coller.

Ce qu'elle ne voit pas : les chutes du **fil UI**. Pour celles-là, Perfetto sur
Android, Instruments sur iOS.

### Les cinq parcours à enregistrer

1. lancement → accueil ;
2. accueil → choix du mode → découverte ;
3. découverte → vérification ;
4. partie complète, avec bonnes et mauvaises réponses ;
5. Atlas : zoom, déplacement, bascule France/Monde, fiche d'un territoire.

Pour chacun : délai toucher → réaction, chutes des deux fils, coût des
transitions, coût du rendu SVG, remontages complets d'écran, temps réellement
passé sur un indicateur de chargement.

### Critères de sortie

| Mesure                                  |           Seuil | Jeton                            |
| --------------------------------------- | --------------: | -------------------------------- |
| Réaction visuelle au toucher            |        < 100 ms | `motion.budget.touchResponse`    |
| Pause perceptible                       | aucune > 150 ms | `motion.budget.perceptiblePause` |
| Transitions sur Android milieu de gamme |         ~60 FPS | —                                |
| Écran intermédiaire artificiel          |           aucun | `motion.budget.loaderThreshold`  |

---

## 2. Ce qui a été corrigé

### Les animations décoratives

Une seule animation structurante par navigation. Pas d'apparition séquentielle
des blocs d'un écran. Durées ordinaires entre 160 et 240 ms
(`motion.duration.base` et `emphasis`), 360 ms réservés au cérémoniel
(`motion.duration.ceremony`). Aucune animation d'entrée au retour sur un onglet
déjà visité — les onglets sont persistants et ne rejouent rien.

Le mouvement subsiste pour : une bonne ou mauvaise réponse, une promotion, un
brevet, le scellement d'un cartouche, un changement d'état de la carte. Il a
disparu des listes, des réglages, du Comptoir et des écrans familiers.

Tout ce qui bouge respecte **la réduction des animations du système**
(`useReducedMotion`), y compris la bottom sheet et la glissée de question.

### Le démarrage des parties

`InteractionManager`, l'écran tournant « Casting » et l'attente forcée de 620 ms
ont disparu. La session est construite **avant la transition**, dans
`useLaunch`, et l'écran de partie s'ouvre directement sur une question.

Une expédition ne tire plus 300 questions d'un coup : `buildQueue` en produit
huit, garde le tirage sous la main et complète au fil de la partie
(`PREFETCH`, `LOOKAHEAD`). Une session courte — relevé, révision, découverte —
reste construite d'un bloc : dix questions ne coûtent rien.

L'index de pointage des cartes, lui, se décode hors du chemin critique
(`warmHitIndex`), dès que la partie démarre plutôt qu'au premier rendu qui en a
besoin.

### La carte

Le fond géographique — eau, graticule, halo côtier, encarts — et l'ensemble des
territoires au repos sont des couches mémorisées qui ne dépendent que de
l'atlas et de la palette. Répondre à une question ne repeint plus cent tracés :
`MapAccents` ne dessine que les territoires dont l'état change.

**Deux régimes, et c'est délibéré.** Une question colore un ou deux territoires :
la carte au repos reste mémorisée et un mince calque passe par-dessus. L'Atlas,
lui, en colore presque tous — un second calque complet doublerait le nombre de
tracés. Au-delà de `DENSE_STATES`, la couche de terre porte donc elle-même les
couleurs, et il n'y a plus de calque du tout.

Les épaisseurs de trait vivent sur les groupes `<G>` et non sur les tracés :
zoomer change un attribut, jamais cent éléments.

L'animation d'accueil qui modifiait l'état toutes les 70 ms est remplacée par
`AtlasReveal` : l'atlas est découpé une fois en douze vagues suivant l'ordre de
difficulté — des départements que tout le monde connaît à ceux que personne ne
situe — et chaque vague devient un calque dont la seule opacité est animée, en
cascade, sur le fil UI. Rien n'est recalculé pendant que ça joue.

### La partie mise en arrière-plan

Un appel téléphonique au milieu d'une expédition vidait la réserve de temps en
silence, et le joueur retrouvait une partie déjà perdue. `suspend` et `wake`
figent puis décalent d'un bloc **toutes** les horloges de la session — la
réserve de temps, le chronomètre de réponse et la durée de la partie — de la
durée exacte de l'absence. La reprise après fermeture complète en est devenue un
cas particulier plutôt qu'un chemin séparé. Sept contrôles de `game:verify` le
tiennent.

### Le cycle question–feedback

`src/game/session.ts` tient désormais une vraie machine d'états :

```
question visible → réponse → feedback → question suivante visible
     asking          answer      feedback         advance
```

`answer()` enregistre et fige ; `advance()` fait avancer l'index, redémarre le
chronomètre de réponse et relance la réserve de temps qui était en pause. Cela
corrige d'un seul coup :

- le compteur `2/10` affiché pendant la correction de la question 1 ;
- les bonus de vitesse faussés par la durée du feedback ;
- le temps d'hésitation faussé, donc les promotions de cartes faussées ;
- le décalage entre les simulations de `game:verify` et le jeu réel.

Le feedback n'est plus un blocage : un toucher n'importe où l'abrège.

---

## 3. Le langage d'interaction

### Navigation

| Situation                             | Forme                                 |
| ------------------------------------- | ------------------------------------- |
| Onglets                               | Persistants, aucune animation rejouée |
| Niveau plus profond                   | Poussé horizontalement, retour natif  |
| Décision temporaire                   | Bottom sheet (`src/ui/Sheet.tsx`)     |
| Action immersive (découverte, partie) | Plein écran                           |
| Vraie modale                          | Croix — et seulement là               |

Le geste de retour natif fonctionne partout, sauf pendant une partie active :
elle demande confirmation, et intercepte le retour matériel Android.

### Composition

Ce que l'on presse est un objet, pas un rectangle coloré : `PressPlate` porte la
physique commune — une tranche colorée sous une face, un reflet sur l'arête
haute, une face qui s'enfonce au toucher. Les actions principales et **les
rangées de réponse** partagent ce modèle, parce qu'une réponse est la surface la
plus pressée de l'application. Un verdict repeint la plaque au lieu de lui
ajouter une décoration.

Les cartes encadrées sont devenues exceptionnelles : `PaperSurface` ne sert plus
qu'aux récompenses de l'écran de bilan. Réglages, Comptoir, statistiques et
fiches passent par `ListSection` / `ListRow` — titre, description, action, un
filet fin entre les lignes. Les actions importantes restent dans la zone du
pouce. Les informations secondaires sont consultables, pas affichées en
permanence : le HUD de l'accueil est devenu une ligne de rang, et son contenu
vit dans le carnet de bord, à un toucher.

### Mouvement

Le mouvement indique une relation spatiale. Une bottom sheet monte du bas. La
fiche d'un territoire sort de la carte touchée. La question suivante glisse dans
le sens de la progression. Le feedback reste local à la réponse et à la carte.

---

## 4. Le test « anti-page web »

À appliquer à la fin de chaque écran :

- Est-ce une navigation, une modalité ou une hiérarchie qu'un utilisateur mobile
  reconnaît immédiatement ?
- La transition dit-elle d'où vient l'écran et où il repart ?
- Peut-on accomplir l'action principale au pouce, sans parcourir la page ?
- Les cartes et bordures ont-elles une fonction, ou découpent-elles seulement la
  mise en page ?
- Le contenu est-il disponible immédiatement, sans cérémonie répétée ?
- L'écran tient-il avec le geste de retour, une police agrandie et la réduction
  des animations ?
- À l'aveugle, quelqu'un pourrait-il croire à une WebView ? Si oui, l'écran
  n'est pas terminé.

---

## 5. Invariants produit corrigés en parallèle

La refonte ne devait pas maquiller les bugs connus.

| Invariant                                        | État                                                                         |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Total Monde cohérent avec les 193 États jouables | `masteryOf` compte le vivier jouable, plus les contours dessinables          |
| Niveau distinct pour France et Monde             | `settings.floors`, un plancher par atlas, migration v6                       |
| Relevé quotidien                                 | Isolé du SRS : dix questions identiques pour tous, sans effet sur les boîtes |
| Définition stable de la maîtrise                 | Un seul `masteryOf`, un seul dénominateur, sur tous les écrans               |
| Descriptions des indices                         | Affichées au Comptoir, sous le nom                                           |
| Alternative au pointage sur la carte             | « Répondre par une liste » sur les questions « situer »                      |
| Persistance d'une partie interrompue             | Reprise proposée au Cap, six heures de validité                              |

Deux manques de conception sont tombés avec eux, signalés à l'usage :

- **La France n'était qu'une carte.** Ses deux premiers échelons ne posaient que
  des questions cartographiques ; le numéro de département n'apparaissait qu'au
  troisième, et dans un seul sens. Il ouvre désormais l'échelle, dans les deux
  directions — le premier échelon passe de 100 % à 50 % de questions sur la
  carte.
- **Il fallait choisir un atlas.** On peut maintenant apprendre les deux, avec
  une seule file de révision et un niveau par atlas.

---

## 6. Ce qui reste

1. **Instrumentation sur appareils réels** — les cinq parcours, les trois
   appareils, les quatre critères de sortie. Rien ne remplace les appareils.
2. **Accessibilité, petits écrans, Android milieu de gamme** — passe dédiée une
   fois les mesures faites.
3. **Gel** — aucune nouvelle récompense, monnaie, badge ni effet visuel tant que
   ce chantier n'est pas clos. La prochaine grande amélioration de Portulan ne
   doit pas être quelque chose qui se voit sur une capture d'écran : ce doit être
   ce qui se sent dans les cinq premières secondes.
