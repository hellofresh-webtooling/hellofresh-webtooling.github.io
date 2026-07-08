# Laadmodel 3D — context voor toekomstige sessies

## Wat dit is
Interactief/demonstratief 3D-model (React + Three.js) dat het laadproces van een
HelloFresh/Factor bezorgbus visualiseert. Hoofdcomponent: `src/LaadModel3D.jsx`.
Oorspronkelijk gebouwd als los Claude.ai-artifact (single-file React component,
Tailwind-classes, `three` via importmap); hier gemigreerd naar een standalone
Vite-project met eigen `package.json`, zodat het los te draaien en te bouwen is
van de hoofdapp (`vloeistoffenkast-demo`) in de root van deze repo.

Dit project draait volledig los van de root-app: eigen `package.json`,
`vite.config.js`, `node_modules`. De `deploy.sh`/`netlify.toml` van de root-app
bouwen alleen de root; dit project wordt niet automatisch meegenomen in die
deploy — nog te bepalen of/hoe dit gepubliceerd moet worden.

## Twee losstaande modules (tabs bovenaan)
1. **"Via schuifdeur"** — de echte, geldende methode: **HelloFresh Laagjes Methode**.
2. **"Via achterdeuren"** — een vereenvoudigde spiegelversie, **niet gebaseerd op
   een officiële SOP**. Status onduidelijk: mogelijk te laten vervallen nu de
   echte SOP alleen de zijdeur beschrijft — dat gesprek was nog niet afgerond op
   het moment van migratie. Niet zomaar verwijderen zonder navraag.

## HelloFresh Laagjes Methode (zijdeur-module) — bron: interne SOP's
- Gebaseerd op SOP A-034 (voorkoelen), B-034 (loading), C-034 (temperatuurmanagement).
- **Voorblok** (bij de cabine) eerst volledig vullen: 3 boxen per laag naast
  elkaar, laag voor laag omhoog, tot aan "de lijn" (schematisch ingevuld als
  `BLOCK_LAYERS = 4` in `LaadModel3D.jsx` — benadering van de regel "minimaal
  20 cm ruimte tussen bovenste box en plafond/koelunit").
- Dan pas het **achterblok** (bij de achterdeuren), zelfde methode.
- **Restant-/add-on-/Factor-boxen**: apart bij de zijdeur, max 12 boxen
  (`ADDON_CAPACITY`, 2 breed × 6 hoog), onderop het hoogste nummer, bovenop het
  laagste.
- Laadvolgorde: **aflopend stopnummer** (laatste stop het eerst). Klopt met de
  regel "eerste te bezorgen stop staat altijd rechts in de rij" — de
  laatst-geladen box komt rechts, en dat is de stop die het eerst geleverd wordt.
- Geen boxen gooien; boxen nooit op kop/zijkant/grond/dak (alleen als
  tekstuele regel vermeld in de UI, niet fysiek afgedwongen in het model).

## Boxdata
- Drie voorbeeldroutes (Noord/Zuid/Centrum) in `ROUTES`, gegenereerd via
  `generateBoxes()` — **geen live data, puur illustratief**. Voor
  productiegebruik moet dit gekoppeld worden aan echte route-/bestelgegevens.
- Formaten: HelloFresh = L/M/S, Factor = alleen M/S.
- Boxen zijn genummerd (canvas-sprite, geen echt 3D-lettertype geladen) **van
  hoog naar laag**: eerst geladen box krijgt het hoogste nummer, laatst
  geladen box nummer 1.

## Visueel
- HelloFresh-kleuren: kartonkleurige boxromp + merkaccent (lime voor
  HelloFresh, zwart/antraciet voor Factor — geen echte logo's/typografie).
- Bus: transparante, donkergroene carrosserie, lime accentstrip alleen op de
  achterkant (zijkanten bewust leeg — zaten in het zicht tijdens het laden),
  wielen, vereenvoudigde cabine, schuifdeur + 2 klapdeuren — **altijd open**
  (geen toggle-interactie).
- Camera: **vast**, geen orbit/drag/zoom. POV vanaf net terug van de
  schuifdeur, kijkend over de lengte van de bus. FOV 72°.
  `updateCamera()` in `LaadModel3D.jsx` berekent positie/lookAt puur uit
  `busWidth`/`busDepth`/`busHeight` — niet dynamisch per route afgestemd,
  handmatig geschatte factoren.
- Boxanimatie: vloeiende vlucht (`easeInOutCubic`, lichte boog via
  `Math.sin(t * Math.PI) * 0.18`), geen tuimelende rotatie.

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
- Getest: `npm run build` + Playwright-screenshot van beide modules (schuifdeur
  en achterdeuren), stap-voor-stap laden gecontroleerd — rendert correct, geen
  console-errors (op een onschuldige favicon-404 na).

## Bekende openstaande punten
- Achterdeuren-module: behouden, aanpassen aan een eventuele echte SOP, of
  verwijderen? Nog niet besloten.
- Camera-afstand/FOV kan nog verder gebalanceerd worden per route.
- Boxdata is fictief; voor productiegebruik koppelen aan echte route-/
  orderdata.
- Publicatie/deploy van dit subproject (los van de root-app) is nog niet
  ingericht.
