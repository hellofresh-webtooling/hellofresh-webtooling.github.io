# Laadmodel 3D — context voor toekomstige sessies

## Wat dit is
Interactief/demonstratief 3D-model (React + Three.js) dat het laadproces van een
HelloFresh/Factor bezorgbus visualiseert. Hoofdcomponent: `src/LaadModel3D.jsx`.
Oorspronkelijk gebouwd als los Claude.ai-artifact (single-file React component,
Tailwind-classes, `three` via importmap); hier gemigreerd naar een standalone
Vite-project met eigen `package.json`, los van de hoofdapp (`vloeistoffenkast-demo`)
in de root van deze repo.

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

## Implementatie (`computeVanLayout` in `LaadModel3D.jsx`)
- `COL_HEIGHT = 3`, `REAR_LANES = 4`, `FRONT_FRACTION = 0.4` (aandeel van de
  boxen — de hoogste stopnummers — dat naar de smalle voorzone gaat; verder
  niet uit de foto's te herleiden hoe die verhouding er in het echt precies
  uitziet voor een volledige route, dit is een redelijke schatting).
- Boxen gesorteerd op aflopend stopnummer; eerste `frontCount` boxen → smalle
  kolom-voor-kolom voorzone; rest → brede golven-achterzone.
  Zie codecommentaar in de functie voor de exacte z/x-berekening per zone.
- De twee zones sluiten in de diepte (z-as) op elkaar aan; geen kunstmatige
  tussenruimte.

## Boxdata
- Drie voorbeeldroutes (Noord/Zuid/Centrum) in `ROUTES`, gegenereerd via
  `generateBoxes()` — **geen live data, puur illustratief**. Voor
  productiegebruik moet dit gekoppeld worden aan echte route-/bestelgegevens.
  Let op: de fictieve `stop`-waarden herhalen zich cyclisch (bijv. 1 t/m 5),
  wat niet overeenkomt met de echte foto's (unieke oplopende stopnummers
  1 t/m ~51) — voor deze demo maakt dat niet uit omdat het layout-algoritme
  alleen op relatieve volgorde sorteert, geen unieke stops vereist.
- Formaten: HelloFresh = L/M/S, Factor = alleen M/S.
- Boxen zijn genummerd (canvas-sprite, geen echt 3D-lettertype geladen) **van
  hoog naar laag**: eerst geladen box krijgt het hoogste nummer, laatst
  geladen box nummer 1. Dit "volgnummer" (aftellend vanaf het totaal) is iets
  anders dan het fictieve `stop`-veld — zie boxdata hierboven.

## Visueel
- HelloFresh-kleuren: kartonkleurige boxromp + merkaccent (lime voor
  HelloFresh, zwart/antraciet voor Factor — geen echte logo's/typografie).
- Bus: transparante, donkergroene carrosserie, lime accentstrip alleen op de
  achterkant, wielen, vereenvoudigde cabine, schuifdeur + 2 klapdeuren —
  **altijd open** (geen toggle-interactie). Beide deuren worden nu ook
  daadwerkelijk allebei "gebruikt" door het model (voorzone via schuifdeur,
  achterzone via achterdeuren) — dat is inhoudelijk correct, niet enkel
  decoratief zoals voorheen.
- Bus-breedte is nu gebaseerd op de bredere achterzone (4 kolommen); de smalle
  voorzone (1 kolom) staat gecentreerd in diezelfde breedte — de muren zelf
  zijn dus niet visueel taps toelopend, dat is een bewuste vereenvoudiging.
- Camera: **vast**, geen orbit/drag/zoom. POV vanaf net terug van de
  schuifdeur (die zich ter hoogte van de smalle voorzone bevindt), kijkend
  over de lengte van de bus — de achterzone ligt daardoor verder van de
  camera af en oogt kleiner/dieper in beeld, wat overeenkomt met de
  werkelijke afstand tot de achterdeuren.
- Boxanimatie: vloeiende vlucht (`easeInOutCubic`, lichte boog via
  `Math.sin(t * Math.PI) * 0.18`), geen tuimelende rotatie. Eén vast
  spawn-punt bij de schuifdeur voor alle boxen (ook die naar de achterzone
  vliegen) — vereenvoudiging, want de camera ziet de achterdeuren toch niet.

## Besturing
- Geen tik-interactie op losse boxen (was eerst een spel-idee, is nu een
  demonstratiemodel).
- Afspelen/pauzeren/stap-voor-stap, snelheid instelbaar (langzaam/normaal/snel
  via `SPEEDS`), reset, routewissel.

## Techniek na migratie
- `three` en `lucide-react` op recente major-versies (niet gepind op de oude
  r128-beperking van de Claude.ai-sandbox) — component gebruikt alleen
  stabiele, langjarige Three.js-API's (Scene/Mesh/Geometry/Material/Sprite),
  geen breaking changes verwacht.
- Tailwind v4 via `@tailwindcss/vite` (geen los `tailwind.config.js`/PostCSS
  nodig) om de bestaande `className`-utility-classes ongewijzigd te laten
  werken.
- Getest: `npm run build` + Playwright-screenshots (start, tussenstand,
  volledig geladen bij een grotere route) — rendert correct, geen
  console-errors (op een onschuldige favicon-404 na).

## Bekende openstaande punten
- `FRONT_FRACTION = 0.4` is een schatting, geen uit foto's afgeleide waarde —
  in het echt hing het af van waar precies de koelunit/wielkast de bus
  versmalt. Idealiter per voertuigtype configureerbaar maken.
- Camera-afstand/FOV kan nog verder gebalanceerd worden per route-grootte.
- Boxdata is fictief; voor productiegebruik koppelen aan echte route-/
  orderdata (en dan bij voorkeur met unieke oplopende stopnummers, zoals in
  het echt).
- Publicatie/deploy van dit subproject (los van de root-app) is nog niet
  ingericht.
