# Laadmodel — context voor toekomstige sessies

## Wat dit is
Interactieve, stap-voor-stap **2D-laadinstructie** (React + SVG) die het
laadproces van een HelloFresh/Factor bezorgbus visualiseert. Hoofdcomponent:
`src/LaadInstructie.jsx` (dat is wat `main.jsx` rendert).

### Waarom 2D i.p.v. het oude 3D-model
De eerste versie was een 3D-model (React + Three.js, `src/LaadModel3D.jsx`).
De gebruiker vond dat "niet interactief genoeg" en wilde iets nieuws in de
richting van (1) een strak 2D-schema én (3) een stap-voor-stap werkinstructie.
Daarom vervangen door een SVG-plattegrond met een stappen-flow. Het oude
`LaadModel3D.jsx` staat er nog als referentie maar wordt niet meer gerenderd —
verwijder het niet zonder overleg, het bevat dezelfde laadlogica in 3D-vorm.

**De laadvolgorde-logica is ongewijzigd** overgenomen uit het 3D-model (zelfde
uit-foto's-afgeleide algoritme, zie hieronder); alleen de *weergave* is nieuw.

## De 2D-instructie (`LaadInstructie.jsx`)
- **Plattegrond (bovenaanzicht, SVG)**: cabine boven, achterdeuren onder,
  schuifdeur (lime strook + pijl) rechts bij de voorzone. De voorzone is 1 cel
  breed; de zijvlakken ernaast zijn gearceerd ("wielkast") om te tonen *waarom*
  daar maar 1 box breed past. De achterzone is tot 4 banen breed.
- Elke cel toont de geplaatste boxen als **gestapelde kaarten** (fan naar
  linksboven per laag) met het laadnummer op de bovenste kaart, plus een
  balkjes-indicator voor het aantal gevulde lagen (max 3). Merk = kleur van de
  linker rand (lime = HelloFresh, zwart = Factor).
- **Stap-flow**: `placed` (0..total) telt hoeveel boxen geplaatst zijn.
  Bediening: afspelen/pauze, vorige/volgende stap, een **scrubber (range-slider)**
  om vrij door de belading te slepen, snelheid (langzaam/normaal/snel), reset.
- **Fase-banner** boven de plattegrond zegt in welke zone/golf/kolom je zit.
- **StepDetail** onder de plattegrond: beschrijft de zojuist geplaatste box
  (`describe()`), toont merk/formaat/stop/code, en een **kolom-opbouw**-detail
  (`StackDetail`) die laag 3→1 toont zodat "onderin eerst" duidelijk is. Bij de
  laatste box van een achterzone-golf verschijnt de terugschuif-notitie.
- **Klikken op een stapel** in de plattegrond opent `CellDetail` met de opbouw
  van die specifieke kolom (klik nogmaals of kruisje om terug te gaan).
- Alles is `useMemo`'d per route via `buildPlan(route)`, dat het raster,
  de cellen en de geordende `steps[]` (met per stap zone/kolom/golf/baan/laag,
  laadnummer en `waveComplete`-vlag) berekent.

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

## Implementatie van de laadvolgorde (`buildPlan` in `LaadInstructie.jsx`)
- `COL_HEIGHT = 3`, `REAR_LANES = 4`, `FRONT_FRACTION = 0.4` (aandeel van de
  boxen — de hoogste stopnummers — dat naar de smalle voorzone gaat; verder
  niet uit de foto's te herleiden hoe die verhouding er in het echt precies
  uitziet voor een volledige route, dit is een redelijke schatting).
- Boxen gesorteerd op aflopend stopnummer; eerste `frontCount` boxen → smalle
  kolom-voor-kolom voorzone; rest → brede golven-achterzone. Dit is exact
  dezelfde ordening als het oude 3D-`computeVanLayout`, alleen naar een
  2D-raster (rij = diepte, baan = breedte, laag = hoogte) vertaald.
- De voor- en achterzone sluiten in de diepte op elkaar aan (met een dunne
  zone-scheiding in de plattegrond, puur visueel).

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

## Visueel (2D)
- HelloFresh-kleuren: kartonkleurige kaarten met merk-randkleur (lime voor
  HelloFresh, zwart/antraciet voor Factor — geen echte logo's/typografie).
- Plattegrond: donkergroene buitenwand, cabine boven, achterdeuren onder,
  schuifdeur als lime strook + pijl rechts bij de voorzone. De niet-bruikbare
  zijvlakken van de voorzone zijn gearceerd met een klein "wielkast"-label om
  te tonen *waarom* de voorzone maar 1 box breed is (i.p.v. een verzonnen
  taps-toelopende wand zoals de 3D-versie suggereerde).
- Stapeling wordt getoond als kaarten die per laag naar linksboven "fannen",
  met het laadnummer op de bovenste kaart en een balkjes-indicator voor het
  aantal gevulde lagen. De actieve cel krijgt een pulserende lime-ring.
- Lichte pop-in-animatie (CSS `@keyframes`) bij het plaatsen van een box; geen
  zware 3D/WebGL meer, dus de bundel is fors kleiner (~168 kB i.p.v. ~540 kB).

## Besturing
- Afspelen/pauzeren, vorige/volgende stap, **scrubber** (range-slider) om vrij
  door de belading te slepen, snelheid (langzaam/normaal/snel via `SPEEDS`),
  reset, routewissel.
- **Klikken op een stapel** in de plattegrond toont de kolom-opbouw van die cel.

## Techniek
- Geen `three` meer nodig voor de weergave (`LaadInstructie.jsx` gebruikt puur
  React + inline SVG). `three` staat nog in `package.json` omdat het oude
  `LaadModel3D.jsx` het importeert; dat bestand wordt niet gerenderd en wordt
  uit de productiebundle getreeshaket. Bij definitief opruimen van het 3D-model
  kan `three` als dependency weg.
- `lucide-react` voor iconen. Tailwind v4 via `@tailwindcss/vite` (geen los
  `tailwind.config.js`/PostCSS nodig).
- Getest: `npm run build` + Playwright-screenshots (leeg, tussenstand, en
  volledig geladen bij de grootste route) — rendert correct, geen
  console-errors (op een onschuldige favicon-404 na).

## Bekende openstaande punten
- `FRONT_FRACTION = 0.4` is een schatting, geen uit foto's afgeleide waarde —
  in het echt hing het af van waar precies de koelunit/wielkast de bus
  versmalt. Idealiter per voertuigtype configureerbaar maken.
- Boxdata is fictief; voor productiegebruik koppelen aan echte route-/
  orderdata (en dan bij voorkeur met unieke oplopende stopnummers, zoals in
  het echt).
- Het oude `LaadModel3D.jsx` (+ `three`-dependency) staat er nog puur als
  referentie; kan opgeruimd worden zodra het niet meer nodig is.
- Publicatie/deploy van dit subproject (los van de root-app) is nog niet
  ingericht.
