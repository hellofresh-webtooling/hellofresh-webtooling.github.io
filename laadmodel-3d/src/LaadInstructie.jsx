import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  RotateCcw,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  MapPin,
  Info,
  Route as RouteIcon,
  CheckCircle2,
  DoorOpen,
  X,
} from "lucide-react";

const BRAND = {
  forest: "#046A38",
  forestDark: "#03502A",
  lime: "#91C11E",
  cream: "#FAF7EF",
  ink: "#1F2A22",
  card: "#E3C9A0",
  cardEdge: "#B99A6B",
};

const MERK_COLOR = { HelloFresh: BRAND.lime, Factor: "#1A1A1A" };

// Werkelijke boxafmetingen (informatief; telt niet mee in de laadvolgorde)
const SIZES = { L: "Groot", M: "Middel", S: "Klein" };

function generateBoxes(prefix, count, maxStop) {
  const merkCycle = ["HelloFresh", "HelloFresh", "Factor"];
  const formaatHF = ["L", "M", "S"];
  const formaatFactor = ["M", "S"];
  const boxes = [];
  for (let i = 0; i < count; i++) {
    const merk = merkCycle[i % merkCycle.length];
    const formaat = merk === "HelloFresh" ? formaatHF[i % formaatHF.length] : formaatFactor[i % formaatFactor.length];
    const stop = (i % maxStop) + 1;
    boxes.push({
      id: `${prefix}-${i + 1}`,
      code: `RUIAM-260708-${String(i + 1).padStart(4, "0")}`,
      merk,
      formaat,
      stop,
    });
  }
  return boxes;
}

const ROUTES = [
  { id: "noord", naam: "Ruinerwold Noord", boxes: generateBoxes("noord", 15, 5) },
  { id: "zuid", naam: "Ruinerwold Zuid", boxes: generateBoxes("zuid", 6, 3) },
  { id: "centrum", naam: "Ruinerwold Centrum", boxes: generateBoxes("centrum", 30, 6) },
];

const COL_HEIGHT = 3; // boxen per kolom — bevestigd op een echte, gefotografeerde belading (RUIAM-260708)
const REAR_LANES = 4; // kolommen naast elkaar bij de achterdeuren
const FRONT_FRACTION = 0.4; // aandeel boxen (hoogste stopnummers) dat vooraan bij de cabine komt

const LAAG_LABEL = ["onderin", "erbovenop", "bovenop"];

// ---------------------------------------------------------------------------
// Laadplan: dezelfde, uit foto's afgeleide volgorde als het oude 3D-model,
// maar nu vertaald naar een 2D-raster (plattegrond) met per-stap-instructies.
// ---------------------------------------------------------------------------
function buildPlan(route) {
  const order = [...route.boxes].sort((a, b) => b.stop - a.stop);
  const total = order.length;

  const frontCount = Math.min(total, Math.round(total * FRONT_FRACTION));
  const frontBoxes = order.slice(0, frontCount);
  const rearBoxes = order.slice(frontCount);

  const frontColumns = Math.ceil(frontBoxes.length / COL_HEIGHT);
  const rearWaves = Math.max(1, Math.ceil(rearBoxes.length / (COL_HEIGHT * REAR_LANES)));

  // --- geometrie (SVG-eenheden) ---
  const laneW = 46;
  const laneGap = 8;
  const rowH = 46;
  const rowGap = 8;
  const padX = 22;
  const padTop = 58;
  const zoneGap = 26;
  const padBottom = 54;
  const rowPitch = rowH + rowGap;
  const fullWidth = REAR_LANES * laneW + (REAR_LANES - 1) * laneGap;
  const svgWidth = padX * 2 + fullWidth;
  const frontCellX = padX + (fullWidth - laneW) / 2;
  const hasFront = frontColumns > 0;
  const rearStartY = padTop + (hasFront ? frontColumns * rowPitch + zoneGap : 0);
  const svgHeight = rearBoxes.length > 0 ? rearStartY + rearWaves * rowPitch + padBottom : padTop + frontColumns * rowPitch + padBottom;

  const steps = [];
  const cells = [];
  const cellMap = {};
  function getCell(key, x, y, zone, meta) {
    let c = cellMap[key];
    if (!c) {
      c = { key, x, y, zone, boxes: [], ...meta };
      cellMap[key] = c;
      cells.push(c);
    }
    return c;
  }

  // Voorzone: 1 kolom breed, kolom voor kolom vanaf de voorwand naar het midden.
  let idx = 0;
  for (let col = 0; col < frontColumns; col++) {
    const y = padTop + col * rowPitch;
    const c = getCell(`f${col}`, frontCellX, y, "front", { col });
    const count = Math.min(COL_HEIGHT, frontBoxes.length - idx);
    for (let layer = 0; layer < count; layer++, idx++) {
      const step = { box: frontBoxes[idx], zone: "front", col, layer, cellKey: c.key, x: frontCellX, y };
      c.boxes.push(step);
      steps.push(step);
    }
  }

  // Achterzone: golven van (tot) 4 banen breed, 3 hoog, baan voor baan.
  idx = 0;
  for (let wave = 0; wave < rearWaves; wave++) {
    const y = rearStartY + wave * rowPitch;
    for (let lane = 0; lane < REAR_LANES && idx < rearBoxes.length; lane++) {
      const x = padX + lane * (laneW + laneGap);
      const c = getCell(`r${wave}-${lane}`, x, y, "rear", { wave, lane });
      const count = Math.min(COL_HEIGHT, rearBoxes.length - idx);
      for (let layer = 0; layer < count; layer++, idx++) {
        const step = { box: rearBoxes[idx], zone: "rear", wave, lane, layer, cellKey: c.key, x, y };
        c.boxes.push(step);
        steps.push(step);
      }
    }
  }

  const rearWaveLastIndex = {};
  steps.forEach((s, i) => {
    s.index = i;
    s.number = total - i; // laadnummer: eerst geladen = hoogste nummer
    if (s.zone === "rear") rearWaveLastIndex[s.wave] = i;
  });
  steps.forEach((s) => {
    s.waveComplete = s.zone === "rear" && rearWaveLastIndex[s.wave] === s.index;
  });

  return {
    total,
    frontColumns,
    rearWaves,
    frontCount,
    rearCount: rearBoxes.length,
    steps,
    cells,
    cellMap,
    geo: {
      laneW, laneGap, rowH, rowGap, padX, padTop, zoneGap, padBottom,
      rowPitch, fullWidth, svgWidth, svgHeight, frontCellX, rearStartY, hasFront,
    },
  };
}

function describe(step) {
  if (!step) return "";
  if (step.zone === "front") {
    const waar = step.layer === 0 ? (step.col === 0 ? "tegen de voorwand" : "tegen de vorige kolom") : `laag ${step.layer + 1}`;
    return `Laadnummer ${step.number} ${LAAG_LABEL[step.layer]} in de voorzone — kolom ${step.col + 1} (${waar}).`;
  }
  return `Laadnummer ${step.number} ${LAAG_LABEL[step.layer]} achterin — golf ${step.wave + 1}, baan ${step.lane + 1}.`;
}

const SPEEDS = [
  { id: "slow", label: "Langzaam", ms: 1500 },
  { id: "normal", label: "Normaal", ms: 850 },
  { id: "fast", label: "Snel", ms: 420 },
];

export default function LaadInstructie() {
  const [routeId, setRouteId] = useState(ROUTES[0].id);
  const route = ROUTES.find((r) => r.id === routeId);
  const plan = useMemo(() => buildPlan(route), [routeId]);

  const [placed, setPlaced] = useState(0); // aantal geplaatste boxen (0..total)
  const [playing, setPlaying] = useState(false);
  const [speedId, setSpeedId] = useState("normal");
  const [selectedKey, setSelectedKey] = useState(null);
  const speedMs = SPEEDS.find((s) => s.id === speedId).ms;

  const finished = placed >= plan.total;
  const currentStep = placed > 0 ? plan.steps[placed - 1] : null;
  const nextStep = !finished ? plan.steps[placed] : null;

  // Automatisch afspelen
  useEffect(() => {
    if (!playing || finished) {
      if (finished) setPlaying(false);
      return;
    }
    const t = setTimeout(() => setPlaced((p) => Math.min(plan.total, p + 1)), speedMs);
    return () => clearTimeout(t);
  }, [playing, placed, speedMs, finished, plan.total]);

  function selectRoute(id) {
    if (id === routeId) return;
    setRouteId(id);
    setPlaced(0);
    setPlaying(false);
    setSelectedKey(null);
  }

  function reset() {
    setPlaced(0);
    setPlaying(false);
    setSelectedKey(null);
  }

  const g = plan.geo;
  const selectedCell = selectedKey ? plan.cellMap[selectedKey] : null;

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center py-6 px-4"
      style={{ backgroundColor: BRAND.cream, color: BRAND.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      <style>{`
        @keyframes pulseRing { 0%,100% { stroke-opacity: 1; } 50% { stroke-opacity: 0.25; } }
        .pulse-ring { animation: pulseRing 1.1s ease-in-out infinite; }
        @keyframes popIn { from { opacity: 0; transform: translateY(4px) scale(0.9); } to { opacity: 1; transform: none; } }
        .pop-in { transform-box: fill-box; transform-origin: center; animation: popIn 0.28s ease-out; }
      `}</style>

      <div className="w-full max-w-md">
        <div className="mb-4">
          <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: BRAND.lime }}>
            Laadinstructie • HelloFresh &amp; Factor
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold leading-tight" style={{ color: BRAND.forestDark }}>
            Stap voor stap de bus laden — Laagjes Methode
          </h1>
        </div>

        {/* Routekeuze */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {ROUTES.map((r) => (
            <button
              key={r.id}
              onClick={() => selectRoute(r.id)}
              className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors"
              style={{
                backgroundColor: r.id === routeId ? BRAND.forestDark : "#FFFFFF",
                color: r.id === routeId ? "#FFFFFF" : BRAND.forestDark,
                border: `1.5px solid ${BRAND.forestDark}`,
              }}
            >
              <RouteIcon size={13} /> {r.naam}
            </button>
          ))}
        </div>

        {/* Fase-banner */}
        <PhaseBanner plan={plan} step={currentStep} nextStep={nextStep} placed={placed} finished={finished} />

        {/* Plattegrond */}
        <div className="rounded-2xl p-3 mb-3" style={{ backgroundColor: "#FFFFFF", border: `1.5px solid #E3DFD3` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Plattegrond (bovenaanzicht)</span>
            <span className="text-[10px] font-semibold opacity-50">
              {placed} / {plan.total} geladen
            </span>
          </div>
          <FloorPlan
            plan={plan}
            placed={placed}
            currentStep={currentStep}
            selectedKey={selectedKey}
            onSelectCell={(key) => setSelectedKey((k) => (k === key ? null : key))}
          />
          <p className="text-[10px] leading-snug opacity-60 mt-1.5">
            <span style={{ color: BRAND.lime, fontWeight: 700 }}>▍</span> schuifdeur (voorzone, bij de cabine) ·{" "}
            <span style={{ color: BRAND.forestDark, fontWeight: 700 }}>▲</span> achterdeuren (achterzone). Tik op een stapel voor de opbouw.
          </p>
          <Legend />
        </div>

        {/* Voortgangsbalk */}
        <div className="mb-3">
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E3DFD3" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(placed / plan.total) * 100}%`, backgroundColor: BRAND.lime }}
            />
          </div>
        </div>

        {/* Detail: geselecteerde cel of huidige/afgeronde stap */}
        {selectedCell ? (
          <CellDetail cell={selectedCell} placed={placed} onClose={() => setSelectedKey(null)} />
        ) : finished ? (
          <DoneCard plan={plan} />
        ) : (
          <StepDetail plan={plan} currentStep={currentStep} nextStep={nextStep} />
        )}

        {/* Scrubber */}
        <div className="mt-4 mb-3">
          <input
            type="range"
            min={0}
            max={plan.total}
            value={placed}
            onChange={(e) => {
              setPlaying(false);
              setPlaced(Number(e.target.value));
            }}
            className="w-full"
            style={{ accentColor: BRAND.forest }}
            aria-label="Sleep om door de laadstappen te gaan"
          />
          <div className="flex justify-between text-[10px] font-semibold opacity-50 mt-0.5">
            <span>Leeg</span>
            <span>Sleep om te scrubben</span>
            <span>Vol</span>
          </div>
        </div>

        {/* Bediening */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => {
              setPlaced((p) => Math.max(0, p - 1));
              setPlaying(false);
            }}
            disabled={placed === 0}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-bold px-3 py-3 rounded-xl disabled:opacity-30"
            style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${BRAND.forestDark}`, color: BRAND.forestDark }}
            aria-label="Vorige stap"
          >
            <SkipBack size={16} />
          </button>

          <button
            onClick={() => setPlaying((p) => !p)}
            disabled={finished}
            className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 rounded-xl text-white disabled:opacity-40"
            style={{ backgroundColor: BRAND.forest }}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? "Pauzeren" : "Afspelen"}
          </button>

          <button
            onClick={() => {
              setPlaced((p) => Math.min(plan.total, p + 1));
              setPlaying(false);
            }}
            disabled={finished}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-bold px-3 py-3 rounded-xl disabled:opacity-30"
            style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${BRAND.forestDark}`, color: BRAND.forestDark }}
            aria-label="Volgende stap"
          >
            <SkipForward size={16} />
          </button>
        </div>

        {/* Snelheid + reset */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1.5">
            {SPEEDS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSpeedId(s.id)}
                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                style={{
                  backgroundColor: speedId === s.id ? BRAND.forestDark : "#FFFFFF",
                  color: speedId === s.id ? "#FFFFFF" : BRAND.forestDark,
                  border: `1px solid ${BRAND.forestDark}`,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
            style={{ color: BRAND.forestDark }}
          >
            <RotateCcw size={13} /> Opnieuw
          </button>
        </div>

        <p className="text-xs text-center opacity-50">
          Voorbeeldmodel — routes en boxen zijn aan te passen aan jullie exacte data.
        </p>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
function PhaseBanner({ plan, step, nextStep, placed, finished }) {
  let title, sub, icon;
  if (finished) {
    title = "Bus volledig geladen";
    sub = "Volgorde klopt: laagste stopnummers bij de achterdeur, als eerste weer eruit.";
    icon = <CheckCircle2 size={16} color={BRAND.forest} />;
  } else if (placed === 0) {
    title = "Klaar om te laden";
    sub = "Begin vooraan bij de cabine via de schuifdeur. Druk op afspelen of stap door.";
    icon = <Info size={16} color={BRAND.forest} />;
  } else {
    const ref = step;
    if (ref.zone === "front") {
      title = `Voorzone · schuifdeur · kolom ${ref.col + 1}/${plan.frontColumns}`;
      sub = "Smal gedeelte bij de cabine: 1 box breed, 3 hoog. Hoogste stopnummer onderin.";
    } else {
      title = `Achterzone · achterdeuren · golf ${ref.wave + 1}/${plan.rearWaves}`;
      sub = "Brede gedeelte: 4 banen naast elkaar, 3 hoog. Elke golf schuift daarna naar binnen.";
    }
    icon = <DoorOpen size={16} color={BRAND.forest} />;
  }
  return (
    <div
      className="rounded-xl px-4 py-3 mb-3 flex gap-2 text-xs sm:text-sm leading-snug"
      style={{ backgroundColor: "#EEF3E4", borderLeft: `4px solid ${BRAND.lime}` }}
    >
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div>
        <strong style={{ color: BRAND.forestDark }}>{title}</strong>
        <div className="opacity-75 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
function FloorPlan({ plan, placed, currentStep, selectedKey, onSelectCell }) {
  const g = plan.geo;
  const shellX = g.padX - 12;
  const shellW = g.fullWidth + 24;
  const shellY = g.padTop - 16;
  const shellBottom = g.svgHeight - g.padBottom + 16;
  const shellH = shellBottom - shellY;

  const dividerY = g.hasFront ? g.rearStartY - g.zoneGap / 2 : null;

  // zijvlakken van de voorzone die in het echt door wielkast/koeling niet bruikbaar zijn
  const frontRows = [];
  if (g.hasFront) {
    for (let col = 0; col < plan.frontColumns; col++) {
      frontRows.push(g.padTop + col * g.rowPitch);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${g.svgWidth + 18} ${g.svgHeight}`}
      width="100%"
      style={{ display: "block", maxHeight: 520 }}
      role="img"
      aria-label="Plattegrond van de bus met de laadvolgorde"
    >
      <defs>
        <pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="#EDE7DA" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#D5CDBB" strokeWidth="2" />
        </pattern>
        <marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill={BRAND.forest} />
        </marker>
      </defs>

      {/* Cabine */}
      <g>
        <rect
          x={g.frontCellX - 8}
          y={shellY - 30}
          width={g.laneW + 16}
          height={26}
          rx={9}
          fill="#DDE7D6"
          stroke={BRAND.forestDark}
          strokeWidth="1.5"
        />
        <rect x={g.frontCellX - 2} y={shellY - 26} width={g.laneW + 4} height={9} rx={3} fill="#B9CDE0" />
        <text x={g.svgWidth / 2} y={shellY - 33} textAnchor="middle" fontSize="8" fontWeight="700" fill={BRAND.forestDark} opacity="0.6">
          CABINE
        </text>
      </g>

      {/* Buitenwand */}
      <rect x={shellX} y={shellY} width={shellW} height={shellH} rx={16} fill="#F4F1E8" stroke={BRAND.forestDark} strokeWidth="2.5" />

      {/* Wielen */}
      {[shellY + shellH * 0.32, shellY + shellH * 0.78].map((wy, i) => (
        <g key={i}>
          <rect x={shellX - 5} y={wy} width={5} height={20} rx={2} fill="#2A2A2A" />
          <rect x={shellX + shellW} y={wy} width={5} height={20} rx={2} fill="#2A2A2A" />
        </g>
      ))}

      {/* Niet-bruikbare zijvlakken voorzone (wielkast / koeling) */}
      {frontRows.map((fy, i) => (
        <g key={`fr${i}`}>
          <rect x={shellX + 6} y={fy} width={g.frontCellX - (shellX + 6) - 6} height={g.rowH} rx={6} fill="url(#hatch)" stroke="#D5CDBB" strokeWidth="1" />
          <rect x={g.frontCellX + g.laneW + 6} y={fy} width={shellX + shellW - 6 - (g.frontCellX + g.laneW + 6)} height={g.rowH} rx={6} fill="url(#hatch)" stroke="#D5CDBB" strokeWidth="1" />
          {i === 0 && (
            <text x={shellX + 8} y={fy + g.rowH / 2 + 3} fontSize="7.5" fontWeight="600" fill="#9C907A">
              wielkast
            </text>
          )}
        </g>
      ))}

      {/* Zone-scheiding + terugschuif-hint */}
      {dividerY != null && (
        <g>
          <line x1={shellX + 6} y1={dividerY} x2={shellX + shellW - 6} y2={dividerY} stroke={BRAND.forest} strokeWidth="1.2" strokeDasharray="4 4" opacity="0.5" />
        </g>
      )}

      {/* Cellen (skelet + geplaatste boxen) */}
      {plan.cells.map((cell) => (
        <CellGroup
          key={cell.key}
          cell={cell}
          g={g}
          placed={placed}
          currentStep={currentStep}
          selected={selectedKey === cell.key}
          onSelect={() => onSelectCell(cell.key)}
        />
      ))}

      {/* Schuifdeur (rechterzijde voorzone) */}
      {g.hasFront && (
        <g>
          <line
            x1={shellX + shellW}
            y1={g.padTop + 4}
            x2={shellX + shellW}
            y2={g.padTop + Math.min(2, plan.frontColumns) * g.rowPitch}
            stroke={BRAND.lime}
            strokeWidth="4"
          />
          <line
            x1={shellX + shellW + 16}
            y1={g.padTop + g.rowH / 2}
            x2={shellX + shellW + 3}
            y2={g.padTop + g.rowH / 2}
            stroke={BRAND.forest}
            strokeWidth="1.6"
            markerEnd="url(#arrow)"
          />
        </g>
      )}

      {/* Achterdeuren (onderkant) */}
      <g>
        <line x1={shellX + 4} y1={shellBottom} x2={shellX + shellW * 0.32} y2={shellBottom + 12} stroke={BRAND.forestDark} strokeWidth="2.5" />
        <line x1={shellX + shellW - 4} y1={shellBottom} x2={shellX + shellW - shellW * 0.32} y2={shellBottom + 12} stroke={BRAND.forestDark} strokeWidth="2.5" />
        <line
          x1={g.svgWidth / 2}
          y1={shellBottom + 22}
          x2={g.svgWidth / 2}
          y2={shellBottom + 6}
          stroke={BRAND.forest}
          strokeWidth="1.6"
          markerEnd="url(#arrow)"
        />
        <text x={g.svgWidth / 2} y={shellBottom + 34} textAnchor="middle" fontSize="8" fontWeight="700" fill={BRAND.forestDark}>
          ACHTERDEUREN
        </text>
      </g>
    </svg>
  );
}

// --------------------------------------------------------------------------
function CellGroup({ cell, g, placed, currentStep, selected, onSelect }) {
  const placedBoxes = cell.boxes.filter((b) => b.index < placed);
  const anyPlaced = placedBoxes.length > 0;
  const isCurrentCell = currentStep && currentStep.cellKey === cell.key;
  const offset = 4.5;

  return (
    <g style={{ cursor: "pointer" }} onClick={onSelect}>
      {/* footprint / skelet */}
      <rect
        x={cell.x}
        y={cell.y}
        width={g.laneW}
        height={g.rowH}
        rx={7}
        fill={anyPlaced ? "none" : "#F0ECE0"}
        stroke={anyPlaced ? "none" : "#CFC7B4"}
        strokeWidth="1.3"
        strokeDasharray="4 3"
      />

      {/* gestapelde kaarten (laag voor laag) */}
      {placedBoxes.map((s, i) => {
        const top = i === placedBoxes.length - 1;
        const isCurrent = currentStep && currentStep.box.id === s.box.id;
        const ox = cell.x - i * offset;
        const oy = cell.y - i * offset;
        return (
          <g key={s.box.id} className={isCurrent ? "pop-in" : undefined}>
            <rect x={ox} y={oy} width={g.laneW} height={g.rowH} rx={7} fill={BRAND.card} stroke={BRAND.cardEdge} strokeWidth="1.3" />
            <rect x={ox} y={oy} width={6} height={g.rowH} rx={2} fill={MERK_COLOR[s.box.merk]} />
            {top && (
              <text x={ox + g.laneW / 2 + 2} y={oy + g.rowH / 2 + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill={BRAND.forestDark}>
                {s.number}
              </text>
            )}
          </g>
        );
      })}

      {/* stapel-indicator (aantal lagen geplaatst / totaal in deze cel) */}
      {anyPlaced && (
        <g>
          {cell.boxes.map((_, li) => (
            <rect
              key={li}
              x={cell.x - (placedBoxes.length - 1) * offset + g.laneW - 15 + li * 4}
              y={cell.y - (placedBoxes.length - 1) * offset + 5}
              width={3}
              height={7}
              rx={1}
              fill={li < placedBoxes.length ? BRAND.forest : "#D9D2C2"}
            />
          ))}
        </g>
      )}

      {/* highlight-ring huidige of geselecteerde cel */}
      {(isCurrentCell || selected) && (
        <rect
          x={cell.x - (placedBoxes.length ? (placedBoxes.length - 1) * offset : 0) - 3}
          y={cell.y - (placedBoxes.length ? (placedBoxes.length - 1) * offset : 0) - 3}
          width={g.laneW + 6}
          height={g.rowH + 6}
          rx={9}
          fill="none"
          stroke={selected ? BRAND.forestDark : BRAND.lime}
          strokeWidth="2.5"
          className={isCurrentCell && !selected ? "pulse-ring" : undefined}
        />
      )}
    </g>
  );
}

// --------------------------------------------------------------------------
function StackDetail({ cell, placed, activeBoxId }) {
  // toont de kolom van deze cel van boven (laag 3) naar onder (laag 1)
  const maxLayers = cell.boxes.length;
  const slots = [];
  for (let layer = maxLayers - 1; layer >= 0; layer--) {
    const s = cell.boxes[layer];
    const isPlaced = s.index < placed;
    const isActive = s.box.id === activeBoxId;
    slots.push(
      <div
        key={layer}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5"
        style={{
          backgroundColor: isPlaced ? BRAND.card : "#F0ECE0",
          border: `1.5px ${isActive ? "solid" : "dashed"} ${isActive ? BRAND.forestDark : isPlaced ? BRAND.cardEdge : "#CFC7B4"}`,
          opacity: isPlaced ? 1 : 0.6,
        }}
      >
        <span className="text-[9px] font-bold uppercase opacity-50 w-8">laag {layer + 1}</span>
        {isPlaced ? (
          <>
            <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ backgroundColor: BRAND.forestDark }}>
              {s.number}
            </span>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: MERK_COLOR[s.box.merk] }} />
            <span className="text-[10px] font-semibold opacity-70">stop {s.box.stop}</span>
          </>
        ) : (
          <span className="text-[10px] italic opacity-50">nog leeg</span>
        )}
      </div>
    );
  }
  return <div className="flex flex-col gap-1.5">{slots}</div>;
}

// --------------------------------------------------------------------------
function StepDetail({ plan, currentStep, nextStep }) {
  const cell = currentStep ? plan.cellMap[currentStep.cellKey] : nextStep ? plan.cellMap[nextStep.cellKey] : null;
  const activeBoxId = currentStep ? currentStep.box.id : null;

  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: "#FFFFFF", border: `1.5px solid #E3DFD3` }}>
      {currentStep ? (
        <>
          <div className="flex items-start gap-3 mb-3">
            <div className="shrink-0 flex items-center justify-center rounded-full font-extrabold text-lg text-white" style={{ width: 44, height: 44, backgroundColor: BRAND.forest }}>
              {currentStep.number}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-0.5">Zojuist geplaatst</div>
              <p className="text-sm font-semibold leading-snug" style={{ color: BRAND.forestDark }}>
                {describe(currentStep)}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: MERK_COLOR[currentStep.box.merk] }}>
                  {currentStep.box.merk}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "#EEF3E4", color: BRAND.forestDark }}>
                  {SIZES[currentStep.box.formaat]}
                </span>
                <span className="flex items-center gap-1 text-[10px] opacity-70">
                  <MapPin size={11} /> stop {currentStep.box.stop}
                </span>
                <span className="text-[10px] font-mono opacity-50 truncate">{currentStep.box.code}</span>
              </div>
            </div>
          </div>

          {currentStep.waveComplete && (
            <div className="rounded-lg px-3 py-2 mb-3 text-xs leading-snug flex gap-2" style={{ backgroundColor: "#FDF6E3", border: "1px solid #E7D9A8" }}>
              <span>↩︎</span>
              <span>
                <strong>Golf {currentStep.wave + 1} compleet.</strong> Schuif de hele golf één stap naar binnen — beter voor de
                ergonomie én de laagste stopnummers blijven bij de achterdeur.
              </span>
            </div>
          )}

          {cell && (
            <div>
              <div className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-1.5">Kolom-opbouw (onderin eerst)</div>
              <StackDetail cell={cell} placed={placedFromStep(plan, currentStep)} activeBoxId={activeBoxId} />
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm font-semibold mb-1" style={{ color: BRAND.forestDark }}>
            {plan.total} boxen klaar om te laden
          </p>
          <p className="text-xs opacity-60">Voorzone: {plan.frontCount} · Achterzone: {plan.rearCount}. Druk op afspelen.</p>
        </div>
      )}
    </div>
  );
}

// hulp: hoeveel boxen zijn geplaatst t/m de huidige stap (voor StackDetail binnen StepDetail)
function placedFromStep(plan, step) {
  return step ? step.index + 1 : 0;
}

// --------------------------------------------------------------------------
function CellDetail({ cell, placed, onClose }) {
  const label = cell.zone === "front" ? `Voorzone · kolom ${cell.col + 1}` : `Achterzone · golf ${cell.wave + 1} · baan ${cell.lane + 1}`;
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${BRAND.forestDark}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-extrabold" style={{ color: BRAND.forestDark }}>
          {label}
        </span>
        <button onClick={onClose} className="p-1 rounded-md" style={{ color: BRAND.forestDark }} aria-label="Sluiten">
          <X size={16} />
        </button>
      </div>
      <StackDetail cell={cell} placed={placed} activeBoxId={null} />
      <p className="text-[11px] opacity-60 mt-3 leading-snug">
        Tik op een andere stapel in de plattegrond voor de opbouw daarvan, of sluit dit om terug te gaan naar de stapuitleg.
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------
function DoneCard({ plan }) {
  return (
    <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: BRAND.forestDark }}>
      <div className="mx-auto mb-3 flex items-center justify-center rounded-full" style={{ width: 48, height: 48, backgroundColor: BRAND.lime }}>
        <CheckCircle2 size={26} color={BRAND.forestDark} strokeWidth={2.5} />
      </div>
      <h2 className="text-lg font-extrabold text-white mb-1">Bus volledig geladen</h2>
      <p className="text-sm text-white opacity-80 leading-snug">
        {plan.total} boxen — {plan.frontCount} vooraan via de schuifdeur, {plan.rearCount} achterin via de achterdeuren. Klaar voor de route.
      </p>
    </div>
  );
}

// --------------------------------------------------------------------------
function Legend() {
  return (
    <div className="flex items-center gap-3 flex-wrap mt-2 text-[10px] font-semibold opacity-70">
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: BRAND.lime }} /> HelloFresh
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#1A1A1A" }} /> Factor
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: BRAND.card, borderColor: BRAND.cardEdge }} /> geladen box
      </span>
      <span className="opacity-60">nummer = laadvolgorde</span>
    </div>
  );
}
