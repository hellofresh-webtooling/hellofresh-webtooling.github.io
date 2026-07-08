# Laadmodel — HelloFresh & Factor

Interactieve, stap-voor-stap **2D-laadinstructie** (React + SVG) die het
laadproces van een HelloFresh/Factor bezorgbus visualiseert: een strakke
plattegrond (bovenaanzicht) die zich per stap opbouwt, met per box een
werkinstructie en kolom-opbouw. Standalone Vite-project, los van de hoofdapp
(`vloeistoffenkast-demo`) in de root van deze repo.

Het oude Three.js-model (`src/LaadModel3D.jsx`) staat er nog als referentie,
maar de app rendert nu `src/LaadInstructie.jsx`.

## Draaien

```bash
cd laadmodel-3d
npm install
npm run dev
```

## Bouwen

```bash
npm run build   # output in dist/
npm run preview # lokaal de build bekijken
```

Zie `CLAUDE.md` in deze map voor de volledige achtergrond (SOP-bronnen, aannames,
openstaande punten).
