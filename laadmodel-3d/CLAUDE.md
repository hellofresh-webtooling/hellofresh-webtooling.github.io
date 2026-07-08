# Laadmodel — context voor toekomstige sessies

## Wat dit is
Interactief **3D-model** (React + Three.js) dat het laadproces van een
HelloFresh/Factor bezorgbus visualiseert, met een stap-voor-stap besturing en
info-panelen. Hoofdcomponent: `src/LaadModel3D.jsx` (dat is wat `main.jsx`
rendert).

### Weg-en-terug: 3D → 2D → interactief 3D
Er is een tijdje een 2D-SVG-plattegrondvariant geweest (`LaadInstructie.jsx`),
gebouwd omdat de gebruiker het eerste 3D-model "niet interactief genoeg" vond.
Daarna vroeg de gebruiker expliciet om terug te gaan naar 3D — maar dan wél
interactief — en om de 2D-versie te verwijderen. Vandaar de huidige opzet:
**één interactief 3D-model met OrbitControls** (draaien/kantelen/zoomen, touch
+ muis), plus de goede stap-flow en info-panelen die in de 2D-versie zaten.
De 2D-component is verwijderd; zie git-historie als je 'm terug wil.

**De laadvolgorde-logica is al die tijd ongewijzigd** (zelfde uit-foto's-
afgeleide algoritme, zie hieronder); alleen de weergave is geëvolueerd.

## Het interactieve 3D-model (`LaadModel3D.jsx`)
- **Three.js-scene**: doorzichtige donkergroene carrosserie, open schuifdeur
  (rechterzijde, voorzone), 2 open klapdeuren achter, wielen, versimpelde
  cabine, lime accentstrip, vloerraster + slotmarkeringen. Boxen zijn
  kartonkleurige `BoxGeometry` met een merk-accentvlak en een canvas-sprite met
  het laadnummer.
- **OrbitControls** (`three/addons/controls/OrbitControls.js`): slepen =
  draaien, scroll/knijpen = zoomen. `enablePan=false`, `enableDamping=true`,
  `maxPolarAngle` net onder de horizon (niet onder de vloer kijken),
  min/max-afstand begrensd. `frameCamera()` zet target + camerapositie bij het
  (her)bouwen van de bus per route.
- **Stap-flow**: `placed` (0..total). Bij één stap vooruit (play/knop) **vliegt**
  de nieuwe box in vanaf een spawn bij de juiste deur (`easeInOutCubic` + boogje);
  bij scrubben worden boxen **direct** geplaatst. Dit gebeurt in `ensurePlaced()`
  die de scene met `placed` synchroniseert (meshes bijmaken/opruimen).
- **Klik op een box**: raycast-selectie (alleen als je niet sleept — beweging
  < 6px). De geselecteerde box krijgt een lichte lime `emissive` + iets grotere
  schaal, en `SelectedDetail` toont box-info + kolom-opbouw.
- Info-panelen (data-gedreven, ongewijzigd t.o.v. de 2D-versie): `PhaseBanner`
  (zone/golf/kolom), `StepDetail` (`describe()` + `StackDetail` "onderin eerst"
  + terugschuif-notitie bij een voltooide golf), `DoneCard`.
- Bediening: afspelen/pauze, vorige/volgende stap, **scrubber**, snelheid
  (langzaam/normaal/snel), reset, routewissel.
- Alles is `useMemo`'d per route via `buildPlan(route)`, dat de geordende
  `steps[]` (met per stap zone/kolom/golf/baan/laag, `pos3` 3D-positie, `spawn`,
  laadnummer en `waveComplete`-vlag), de cellen en de busafmetingen berekent.

## Projectopzet
Standalone Vite-project met eigen `package.json`, los van de hoofdapp
(`vloeistoffenkast-demo`) in de root van deze repo.

Dit project draait volledig los van de root-app: eigen `package.json`,
`vite.config.js`, `node_modules`. De `deploy.sh`/`netlify.toml` van de root-app
bouwen alleen de root; dit project wordt niet automatisch meegenomen in die
deploy — nog te bepalen of/hoe dit gepubliceerd moet worden.

## Eén doorlopend model — geen tabs meer
Eerdere versies hadden twee losstaande tabs ("Via schuifdeur" / "Via
achterdeuren") die deden alsof het twee **alternatieve** methodes waren om de
hele bus te laden. Dat klopte niet: op **2026-07-08 is een volledige, echte
belading van begin tot eind gefotografeerd** (route RUIAM-260708, ~51 stops) en
daaruit bleek dat schuifdeur en achterdeuren voor **twee verschillende stukken
van dezelfde bus** worden gebruikt binnen één doorlopend proces. De tabs zijn
daarom verwijderd; het model toont nu één bus, in één keer geladen via beide
toegangen. Zie git-historie voor de oude tab-versie als referentie.

## De echte methode (gereconstrueerd uit foto's, niet uit een geschreven SOP)
Er is geen geschreven SOP-tekst voor dit deel geraadpleegd — dit is stap voor
stap afgeleid uit een fotoserie van een daadwerkelijk geladen bus. Twee
zones, ontdekt in deze volgorde:

**Vooraan (bij de cabine, bereikt via de schuifdeur):**
- Slechts **1 box breed** (smal gedeelte, waarschijnlijk door de koelunit/
  wielkast vooraan) — géén brede rij van 3 zoals eerder aangenomen.
- Kolommen van **3 hoog**: eerste (hoogste, dus laatst te bezorgen) stopnummer
  van de kolom onderin, volgende erbovenop, laagste van de drie bovenin.
- Kolom 1 helemaal tegen de voorwand; elke volgende kolom een stap verder het
  midden van de bus in. Doorlopend aflopend stopnummer over alle kolommen heen.

**Achterin (bereikt via de achterdeuren):**
- **4 kolommen naast elkaar**, ook 3 hoog — hier past de volle breedte wel.
- Gebouwd in **golven van 12** (4 kolommen × 3 lagen): een golf wordt vlak bij
  de achterdeur opgebouwd (hoogste stopnummer van de golf het eerst, dat
  wordt de kolom aan de "linkerkant" vanuit de lader bij de achterdeur
  gezien, aflopend naar rechts), en zodra de golf compleet is wordt hij **in
  zijn geheel een stukje naar binnen geschoven** om plek te maken voor de
  volgende golf. Reden: ergonomie / voorkomen dat je moet overstrekken.
  Netto-effect: **de laagste (eerst te bezorgen) stopnummers eindigen het
  dichtst bij de achterdeur.**
- Laatste golf mag onvolledig zijn (bijv. nog maar 4 boxen over → 2 kolommen
  van 2 i.p.v. 4 van 3).

**Kernregel achter alles** (uit twee "hoe het niet moet"-waarschuwingsposters
die bij dit fotomateriaal hoorden): boxen moeten in **oplopende stopvolgorde**
(1, 2, 3, …) bereikbaar zijn zonder ooit een box van een latere stop opzij te
hoeven tillen. Het hele bouwpatroon (welke kolom eerst, welke golf wanneer
terugschuift) dient uitsluitend om dat te garanderen.

### Wat dit NIET (meer) is
- De eerdere aanname "voorblok/achterblok, elk 3 breed × 4 hoog, met een apart
  restant-/add-on-/Factor-hoekje van 2×6" kwam uit screenshots van SOP A-034/
  B-034/C-034 en is **niet bevestigd** door de echte foto's — mogelijk was dat
  een andere bus, ander protocol, of verkeerd geïnterpreteerde screenshots.
  Vertrouw voor de laadvolgorde-logica op de fotoserie, niet op die eerdere
  aanname.
- Er was ook een "Laagjesmethode museum" (fysieke trainingsopstelling met een
  demo-pallet, STAP 1 t/m 6-bordjes) die op het eerste gezicht een ander
  patroon liet zien (afwisselend "achterste stapel"/"voorste stapel" op één
  vaste plek). Dat bleek bij nader inzien **consistent** met de hierboven
  beschreven "golf, dan terugschuiven"-logica, alleen gefotografeerd
  halverwege het terugschuiven. Bij twijfel: de complete, doorlopende
  fotoserie van de echte belading is de meest betrouwbare bron.

## Implementatie van de laadvolgorde (`buildPlan` in `LaadModel3D.jsx`)
- `COL_HEIGHT = 3`, `REAR_LANES = 4`, `FRONT_FRACTION = 0.4` (aandeel van de
  boxen — de hoogste stopnummers — dat naar de smalle voorzone gaat; verder
  niet uit de foto's te herleiden hoe die verhouding er in het echt precies
  uitziet voor een volledige route, dit is een redelijke schatting).
- Boxen gesorteerd op aflopend stopnummer; eerste `frontCount` boxen → smalle
  kolom-voor-kolom voorzone (x = 0, van de voorwand naar het midden); rest →
  brede golven-achterzone (4 banen, laagste stops nabij de achterdeur). Elke
  stap krijgt een `pos3` (3D-doelpositie) via het `PITCH_X/Y/Z`-slotraster.
- De voor- en achterzone sluiten in de diepte (z-as) op elkaar aan.

## Boxdata
- Drie voorbeeldroutes (Noord/Zuid/Centrum) in `ROUTES`, gegenereerd via
  `generateBoxes()` — **geen live data, puur illustratief**. Voor
  productiegebruik moet dit gekoppeld worden aan echte route-/bestelgegevens.
  Let op: de fictieve `stop`-waarden herhalen zich cyclisch (bijv. 1 t/m 5),
  wat niet overeenkomt met de echte foto's (unieke oplopende stopnummers
  1 t/m ~51) — voor deze demo maakt dat niet uit omdat het layout-algoritme
  alleen op relatieve volgorde sorteert, geen unieke stops vereist.
- Formaten: HelloFresh = L/M/S, Factor = alleen M/S.
- Boxen krijgen een **laadnummer van hoog naar laag**: eerst geladen box krijgt
  het hoogste nummer (diep in de bus), laatst geladen box nummer 1 (bij de
  achterdeur, en dus als eerste weer eruit bij bezorgen). Dit "laadnummer"
  (aftellend vanaf het totaal) is iets anders dan het fictieve `stop`-veld.

## Visueel (3D)
- HelloFresh-kleuren: kartonkleurige boxen met een merk-accentvlak (lime voor
  HelloFresh, zwart/antraciet voor Factor — geen echte logo's/typografie).
- Bus: doorzichtige donkergroene carrosserie (alleen vloer + linkerwand als
  vlakken, zodat je van rechts/achter naar binnen kijkt), open schuifdeur
  rechts (voorzone), 2 open klapdeuren achter, wielen, versimpelde cabine, lime
  accentstrip achter. Vloerraster + lime slotmarkeringen tonen het laadraster.
- Bewuste vereenvoudiging: de carrosserie is niet fysiek taps toelopend; de
  voorzone is gewoon 1 kolom breed gecentreerd. De echte reden (wielkast/koeling
  vooraan) is in deze 3D-versie niet apart uitgetekend.
- Boxanimatie: alleen bij één stap vooruit vliegt de box in (`easeInOutCubic`
  + boogje) vanaf een spawn bij de betreffende deur; bij scrubben plaatsen
  boxen direct.

## Besturing
- **Camera**: OrbitControls — slepen = draaien/kantelen, scroll/knijpen = zoomen
  (touch + muis). Pannen staat uit; er is demping.
- Afspelen/pauzeren, vorige/volgende stap, **scrubber** (range-slider), snelheid
  (langzaam/normaal/snel via `SPEEDS`), reset, routewissel.
- **Klik op een box** (zonder te slepen): selecteert 'm (lime gloed) en toont
  box-info + kolom-opbouw in `SelectedDetail`.

## Techniek
- `three` (0.185) voor de scene, `OrbitControls` via `three/addons/...`.
  `lucide-react` voor iconen. Tailwind v4 via `@tailwindcss/vite` (geen los
  `tailwind.config.js`/PostCSS nodig).
- WebGL-bundle is groot (~716 kB / ~192 kB gzip) — de Vite chunk-grootte-
  waarschuwing is hier onschuldig.
- Getest: `npm run build` + Playwright (leeg, tussenstand, volledig geladen,
  én slepen-om-te-draaien) — rendert correct, geen console-errors (op een
  onschuldige favicon-404 na).

## Bekende openstaande punten
- `FRONT_FRACTION = 0.4` is een schatting, geen uit foto's afgeleide waarde —
  in het echt hing het af van waar precies de koelunit/wielkast de bus
  versmalt. Idealiter per voertuigtype configureerbaar maken.
- Bij grote routes overlappen de nummer-sprites wat in vooraanzicht; inzoomen/
  draaien lost het op. Eventueel later de labels schaal-/afstand-afhankelijk maken.
- Boxdata is fictief; voor productiegebruik koppelen aan echte route-/
  orderdata (en dan bij voorkeur met unieke oplopende stopnummers, zoals in
  het echt).
- Publicatie/deploy van dit subproject (los van de root-app) is nog niet
  ingericht.
