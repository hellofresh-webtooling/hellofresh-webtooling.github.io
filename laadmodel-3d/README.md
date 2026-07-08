# Laadmodel 3D — HelloFresh & Factor

Interactief **3D-model** (React + Three.js) dat het laadproces van een
HelloFresh/Factor bezorgbus visualiseert. Draai/kantel/zoom met vinger of muis
(OrbitControls), loop stap voor stap of scrub door de belading, klik een box
voor detail. Standalone Vite-project, los van de hoofdapp
(`vloeistoffenkast-demo`) in de root van deze repo.

Hoofdcomponent: `src/LaadModel3D.jsx`. Een eerdere 2D-plattegrondvariant is
verwijderd; zie git-historie als je die terug wil.

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
