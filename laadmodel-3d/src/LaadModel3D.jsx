import React, { useState, useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { RotateCcw, Play, Pause, SkipForward, MapPin, Info, Route as RouteIcon, CheckCircle2 } from "lucide-react";

const BRAND = {
  forest: "#046A38",
  forestDark: "#03502A",
  lime: "#91C11E",
  cream: "#FAF7EF",
  ink: "#1F2A22",
};

const MERK_HEX = { HelloFresh: 0x91c11e, Factor: 0x1a1a1a };
const CARDBOARD_HEX = 0xc9a876;
const MERK_COLOR = { HelloFresh: BRAND.lime, Factor: "#1A1A1A" };

// Werkelijke boxafmetingen (visueel/informatief, telt niet mee in de volgorde)
const SIZES = { L: { w: 0.5, h: 0.42, d: 0.5 }, M: { w: 0.4, h: 0.32, d: 0.4 }, S: { w: 0.3, h: 0.24, d: 0.3 } };

// Uniforme slotmaat voor het stapelraster (3 boxen naast elkaar per laag)
const UNIT = { w: 0.5, h: 0.38, d: 0.5 };
const SLOT_GAP = 0.1;

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
      code: `RUIAM-260707-${String(i + 1).padStart(4, "0")}`,
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

const BLOCK_LAYERS = 4; // "tot aan de lijn" — schematische invulling van de 20cm-vrije-ruimte-regel
const BLOCK_CAPACITY = 3 * BLOCK_LAYERS;
const ADDON_LAYERS = 6;
const ADDON_CAPACITY = 2 * ADDON_LAYERS; // max 12 boxen (2x6), voor restant/add-on/Factor-boxen

// Laadproces (zijkant-module) — volgens de "HelloFresh Laagjes Methode" uit de SOP:
// laders staan bij de pallet en geven boxen door aan de lader bij de zijdeur, die in
// laagjes stapelt, van links naar rechts (zodat de eerstvolgende stop altijd rechts staat).
// Eerst het blok vooraan (bij de cabine) volledig vullen tot aan de lijn, dan het blok
// achteraan. Restant-, add-on- en Factor-boxen (max 12, 2x6) komen apart bij de zijdeur —
// onderop het hoogste nummer, bovenop het laagste. Volgorde: aflopend stopnummer.
function computeSideLayout(boxesList) {
  const order = [...boxesList].sort((a, b) => b.stop - a.stop);

  const pitchX = UNIT.w + SLOT_GAP;
  const pitchY = UNIT.h + SLOT_GAP * 0.6;
  const pitchZ = UNIT.d + SLOT_GAP;

  let frontZ = pitchZ * 0.6;
  let backZ = -pitchZ * 1.6;
  let addonZ = pitchZ * 1.9;
  const addonPitchX = pitchX * 0.62;

  // centreren zodat de wanden/deuren (die symmetrisch rond z=0 gebouwd worden) blijven kloppen
  const rearmost = backZ - pitchZ / 2;
  const frontmost = addonZ + pitchZ / 2;
  const shift = -(rearmost + frontmost) / 2;
  frontZ += shift;
  backZ += shift;
  addonZ += shift;

  const positions = {};
  let idx = 0;

  const frontCount = Math.min(BLOCK_CAPACITY, order.length - idx);
  for (let j = 0; j < frontCount; j++, idx++) {
    const layer = Math.floor(j / 3);
    const lane = j % 3;
    positions[order[idx].id] = { x: (lane - 1) * pitchX, y: layer * pitchY + UNIT.h / 2 + 0.02, z: frontZ };
  }

  const backCount = Math.min(BLOCK_CAPACITY, order.length - idx);
  for (let j = 0; j < backCount; j++, idx++) {
    const layer = Math.floor(j / 3);
    const lane = j % 3;
    positions[order[idx].id] = { x: (lane - 1) * pitchX, y: layer * pitchY + UNIT.h / 2 + 0.02, z: backZ };
  }

  const addonCount = Math.min(ADDON_CAPACITY, order.length - idx);
  for (let j = 0; j < addonCount; j++, idx++) {
    const layer = Math.floor(j / 2);
    const lane = j % 2;
    positions[order[idx].id] = { x: (lane - 0.5) * addonPitchX, y: layer * pitchY + UNIT.h / 2 + 0.02, z: addonZ };
  }

  const busWidth = pitchX * 3 + 0.6;
  const busDepth = frontmost - rearmost + 0.8;
  const busHeight = BLOCK_LAYERS * pitchY + 0.5;

  return {
    order,
    positions,
    busWidth,
    busDepth,
    busHeight,
    spawn: { x: busWidth / 2 + 1.3, y: busHeight * 0.5, z: addonZ },
    cameraCenterY: busHeight * 0.42,
    cameraRadius: Math.max(5.2, busDepth * 1.3, busHeight * 2.2),
    meta: { frontCount, backCount, addonCount },
  };
}

// Laadproces (achterkant-module) — vereenvoudigde spiegelversie: trapsgewijs oplopend
// profiel vanaf de achterdeuren naar voren. Niet gebaseerd op een officiële SOP.
function computeRearLayout(boxesList) {
  const order = [...boxesList].sort((a, b) => b.stop - a.stop);

  const pitchX = UNIT.w + SLOT_GAP;
  const pitchY = UNIT.h + SLOT_GAP * 0.6;
  const pitchZ = UNIT.d + SLOT_GAP;

  const blocks = [];
  let remaining = order.length;
  let layers = 2;
  while (remaining > 0) {
    const capacity = 3 * layers;
    const used = Math.min(capacity, remaining);
    blocks.push({ used, usedLayers: Math.ceil(used / 3) });
    remaining -= used;
    layers += 1;
  }

  const totalDepth = blocks.length * pitchZ;
  let zCursor = totalDepth / 2;
  let boxCursor = 0;
  let maxLayers = 0;
  const positions = {};

  blocks.forEach((block) => {
    const zCenter = zCursor - pitchZ / 2;
    zCursor -= pitchZ;
    for (let j = 0; j < block.used; j++) {
      const box = order[boxCursor];
      boxCursor++;
      const layer = Math.floor(j / 3);
      const lane = j % 3;
      positions[box.id] = { x: (lane - 1) * pitchX, y: layer * pitchY + UNIT.h / 2 + 0.02, z: -zCenter };
    }
    maxLayers = Math.max(maxLayers, block.usedLayers);
  });

  const busWidth = pitchX * 3 + 0.5;
  const busDepth = totalDepth + 0.8;
  const busHeight = maxLayers * pitchY + 0.5;

  return {
    order,
    positions,
    busWidth,
    busDepth,
    busHeight,
    spawn: { x: 0, y: busHeight * 0.5, z: -(busDepth / 2 + 1.4) },
    cameraCenterY: busHeight * 0.42,
    cameraRadius: Math.max(5.2, busDepth * 1.3, busHeight * 2.2),
  };
}

function computeLayout(boxesList, entryMode) {
  return entryMode === "rear" ? computeRearLayout(boxesList) : computeSideLayout(boxesList);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const SPEEDS = [
  { id: "slow", label: "Langzaam", ms: 1600 },
  { id: "normal", label: "Normaal", ms: 950 },
  { id: "fast", label: "Snel", ms: 500 },
];

function LoadingModule({ entryMode }) {
  const [routeId, setRouteId] = useState(ROUTES[0].id);
  const route = ROUTES.find((r) => r.id === routeId);
  const layout = useMemo(() => computeLayout(route.boxes, entryMode), [routeId, entryMode]);

  const [placedCount, setPlacedCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedId, setSpeedId] = useState("normal");
  const speedMs = SPEEDS.find((s) => s.id === speedId).ms;

  const mountRef = useRef(null);
  const apiRef = useRef(null);

  const finished = placedCount === route.boxes.length;
  const currentBox = placedCount > 0 ? layout.order[placedCount - 1] : null;
  const nextBox = !finished ? layout.order[placedCount] : null;

  // ---- Three.js setup (eenmalig) ----
  useEffect(() => {
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = 360;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(72, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.borderRadius = "16px";
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshBasicMaterial({ color: 0xe3dfd3, transparent: true, opacity: 0.4 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b4a2e, roughness: 0.4, metalness: 0.15, side: THREE.DoubleSide, transparent: true, opacity: 0.18 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x022e1c, transparent: true, opacity: 0.6 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x91c11e, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide });
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x91c11e, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const markerEdgeMat = new THREE.LineBasicMaterial({ color: 0x91c11e, transparent: true, opacity: 0.4 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.35, metalness: 0.6 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x0b4a2e, roughness: 0.4, metalness: 0.15, side: THREE.DoubleSide, transparent: true, opacity: 0.18 });
    const doorEdgeMat = new THREE.LineBasicMaterial({ color: 0x022e1c, transparent: true, opacity: 0.7 });

    let staticGroup = new THREE.Group();
    scene.add(staticGroup);

    function addPanel(group, w, h, pos, rot) {
      const geo = new THREE.PlaneGeometry(w, h);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(pos.x, pos.y, pos.z);
      if (rot) mesh.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
      group.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      group.add(edges);
    }

    let activeLayout = null;

    function updateCamera() {
      if (!activeLayout) return;
      // Kijkrichting over de lengte van de bus (in plaats van dwars over de breedte),
      // zodat de 3-brede laag echt links-naar-rechts in beeld staat. Standpunt: iets
      // terug van de schuifdeur, aan de voorkant, zodat het hele laadproces in beeld past.
      const eyeX = activeLayout.busWidth / 2 - 0.35;
      const eyeY = 1.75;
      const eyeZ = activeLayout.busDepth / 2 + 0.75;
      camera.position.set(eyeX, eyeY, eyeZ);
      camera.lookAt(new THREE.Vector3(eyeX * 0.4, activeLayout.busHeight * 0.4, eyeZ - 6));
    }

    function addWheel(group, x, z) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 20), wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x, 0.22, z);
      group.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.17, 16), rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(x, 0.22, z);
      group.add(rim);
    }

    function buildStaticBus(lay) {
      scene.remove(staticGroup);
      staticGroup.traverse((obj) => obj.geometry && obj.geometry.dispose());
      staticGroup = new THREE.Group();

      const halfD = lay.busDepth / 2;
      const halfW = lay.busWidth / 2;

      // Laadruimte: solide donkergroene wanden + lime accentstrip
      addPanel(staticGroup, lay.busWidth, lay.busDepth, { x: 0, y: 0, z: 0 }, { x: -Math.PI / 2 });
      addPanel(staticGroup, lay.busDepth, lay.busHeight, { x: -halfW, y: lay.busHeight / 2, z: 0 }, { y: Math.PI / 2 });

      // Schuifdeur op de zijkant (x = +halfW) — altijd open, zodat direct zichtbaar is dat dit de zijkant is
      {
        const geo = new THREE.PlaneGeometry(lay.busDepth, lay.busHeight);
        const mesh = new THREE.Mesh(geo, doorMat);
        mesh.rotation.y = -Math.PI / 2;
        mesh.position.set(halfW, lay.busHeight / 2, lay.busDepth * 0.85);
        staticGroup.add(mesh);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), doorEdgeMat);
        edges.rotation.copy(mesh.rotation);
        edges.position.copy(mesh.position);
        staticGroup.add(edges);
      }

      // 2 klapdeuren aan de achterkant (z = -halfD) — altijd open, zodat direct zichtbaar is dat dit de achterkant is
      {
        const doorW = lay.busWidth / 2;
        const doorGeo = new THREE.PlaneGeometry(doorW, lay.busHeight);
        [-1, 1].forEach((side) => {
          const pivot = new THREE.Group();
          pivot.position.set(side * halfW, lay.busHeight / 2, -halfD);
          pivot.rotation.y = side === -1 ? -Math.PI * 0.42 : Math.PI * 0.42;
          const mesh = new THREE.Mesh(doorGeo, doorMat);
          mesh.position.x = (side * doorW) / 2;
          pivot.add(mesh);
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(doorGeo), doorEdgeMat);
          edges.position.copy(mesh.position);
          pivot.add(edges);
          staticGroup.add(pivot);
        });
      }

      const stripeY = lay.busHeight * 0.35;
      const stripeH = Math.max(0.14, lay.busHeight * 0.1);
      const backStripe = new THREE.Mesh(new THREE.PlaneGeometry(lay.busWidth, stripeH), accentMat);
      backStripe.position.set(0, stripeY, -halfD - 0.01);
      staticGroup.add(backStripe);

      // Cabine (versimpeld) net buiten de schuifdeur, om de vorm van een bus te suggereren
      const cabW = lay.busWidth * 0.85;
      const cabH = lay.busHeight * 0.75;
      const cabD = 0.85;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabD), wallMat);
      cab.position.set(0, cabH / 2, halfD + cabD / 2 + 1.1);
      staticGroup.add(cab);
      const cabEdges = new THREE.LineSegments(new THREE.EdgesGeometry(cab.geometry), edgeMat);
      cabEdges.position.copy(cab.position);
      staticGroup.add(cabEdges);

      // Wielen
      const wheelZ = Math.min(halfD * 0.75, halfD - 0.3);
      addWheel(staticGroup, -halfW, wheelZ);
      addWheel(staticGroup, halfW, wheelZ);
      addWheel(staticGroup, -halfW, -wheelZ);
      addWheel(staticGroup, halfW, -wheelZ);
      addWheel(staticGroup, -halfW * 0.7, halfD + cabD * 0.6);
      addWheel(staticGroup, halfW * 0.7, halfD + cabD * 0.6);

      Object.values(lay.positions).forEach((p) => {
        const markerGeo = new THREE.PlaneGeometry(UNIT.w + 0.04, UNIT.d + 0.04);
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(p.x, 0.01, p.z);
        staticGroup.add(marker);
        const me = new THREE.LineSegments(new THREE.EdgesGeometry(markerGeo), markerEdgeMat);
        me.rotation.copy(marker.rotation);
        me.position.copy(marker.position);
        staticGroup.add(me);
      });

      scene.add(staticGroup);
      activeLayout = lay;
      updateCamera();
    }

    function handleResize() {
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    }
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    const boxMeshes = {};
    const animations = [];
    let currentSpawn = { x: 0, y: 1, z: 3 };

    function makeNumberSprite(number) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(64, 64, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = "#0b4a2e";
      ctx.stroke();
      ctx.fillStyle = "#0b4a2e";
      ctx.font = "bold 60px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(number), 64, 68);
      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.34, 0.34, 1);
      sprite.renderOrder = 999;
      return sprite;
    }

    function makeBoxMesh(box, number) {
      const s = SIZES[box.formaat];
      const geo = new THREE.BoxGeometry(s.w, s.h, s.d);
      const mat = new THREE.MeshStandardMaterial({ color: CARDBOARD_HEX, roughness: 0.85, metalness: 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(currentSpawn.x, currentSpawn.y, currentSpawn.z);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x6b5638, transparent: true, opacity: 0.4 })
      );
      mesh.add(edges);

      // Merkaccent op de voorkant, zoals het logo/label op de echte boxen
      const accentH = s.h * 0.42;
      const accentGeo = new THREE.PlaneGeometry(s.w * 0.82, accentH);
      const accentMesh = new THREE.Mesh(accentGeo, new THREE.MeshStandardMaterial({ color: MERK_HEX[box.merk], roughness: 0.7 }));
      accentMesh.position.set(0, s.h * 0.06, s.d / 2 + 0.005);
      mesh.add(accentMesh);

      const label = makeNumberSprite(number);
      label.position.set(0, s.h / 2 + 0.22, 0);
      mesh.add(label);
      scene.add(mesh);
      return mesh;
    }

    function flyBoxIn(box, targetPos, number) {
      const mesh = makeBoxMesh(box, number);
      boxMeshes[box.id] = mesh;
      animations.push({
        mesh,
        from: new THREE.Vector3(currentSpawn.x, currentSpawn.y, currentSpawn.z),
        to: new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z),
        start: performance.now(),
        duration: 800,
      });
    }

    function clearBoxes() {
      Object.values(boxMeshes).forEach((m) => {
        scene.remove(m);
        m.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        });
      });
      Object.keys(boxMeshes).forEach((k) => delete boxMeshes[k]);
      animations.length = 0;
    }

    function setSpawn(spawn) { currentSpawn = spawn; }

    let rafId;
    function animate() {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      for (let i = animations.length - 1; i >= 0; i--) {
        const a = animations[i];
        const t = Math.min(1, (now - a.start) / a.duration);
        const e = easeInOutCubic(t);
        a.mesh.position.lerpVectors(a.from, a.to, e);
        a.mesh.position.y += Math.sin(t * Math.PI) * 0.18;
        if (t >= 1) {
          a.mesh.position.copy(a.to);
          animations.splice(i, 1);
        }
      }
      updateCamera();
      renderer.render(scene, camera);
    }
    animate();

    apiRef.current = { buildStaticBus, flyBoxIn, clearBoxes, setSpawn };
    apiRef.current.buildStaticBus(layout);
    apiRef.current.setSpawn(layout.spawn);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      clearBoxes();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeNext() {
    if (finished) return;
    const box = layout.order[placedCount];
    const volgnummer = route.boxes.length - placedCount;
    apiRef.current?.flyBoxIn(box, layout.positions[box.id], volgnummer);
    setPlacedCount((c) => c + 1);
  }

  // Automatisch afspelen
  useEffect(() => {
    if (!playing || finished) {
      if (finished) setPlaying(false);
      return;
    }
    const t = setTimeout(placeNext, speedMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, placedCount, speedMs, finished]);

  function reset() {
    apiRef.current?.clearBoxes();
    setPlacedCount(0);
    setPlaying(false);
  }

  function selectRoute(id) {
    if (id === routeId) return;
    const nextRoute = ROUTES.find((r) => r.id === id);
    const nextLayout = computeLayout(nextRoute.boxes, entryMode);
    apiRef.current?.clearBoxes();
    apiRef.current?.buildStaticBus(nextLayout);
    apiRef.current?.setSpawn(nextLayout.spawn);
    setRouteId(id);
    setPlacedCount(0);
    setPlaying(false);
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center py-6 px-4" style={{ backgroundColor: BRAND.cream, color: BRAND.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="mb-4">
          <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: BRAND.lime }}>Laadmodel 3D • HelloFresh & Factor</div>
          <h1 className="text-xl sm:text-2xl font-extrabold leading-tight" style={{ color: BRAND.forestDark }}>
            {entryMode === "rear" ? "Zo wordt de bus geladen via de achterdeuren" : "Zo wordt de bus geladen — HelloFresh Laagjes Methode"}
          </h1>
        </div>

        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {ROUTES.map((r) => (
            <button
              key={r.id}
              onClick={() => selectRoute(r.id)}
              className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold flex items-center gap-1.5 transition-colors"
              style={{ backgroundColor: r.id === routeId ? BRAND.forestDark : "#FFFFFF", color: r.id === routeId ? "#FFFFFF" : BRAND.forestDark, border: `1.5px solid ${BRAND.forestDark}` }}
            >
              <RouteIcon size={13} /> {r.naam}
            </button>
          ))}
        </div>

        <div className="rounded-xl px-4 py-3 mb-4 flex gap-2 text-xs sm:text-sm leading-snug" style={{ backgroundColor: "#EEF3E4", borderLeft: `4px solid ${BRAND.lime}` }}>
          <Info size={16} className="shrink-0 mt-0.5" color={BRAND.forest} />
          <div>
            {entryMode === "rear" ? (
              <>
                <strong>Regel:</strong> laden begint bij de achterdeuren, 3 boxen per laag naast elkaar,
                2 lagen op de eerste plek. Elke volgende plek — verder naar voren de bus in — komt 1 laag
                hoger dan de vorige. Volgorde: aflopend stopnummer, laatste stop het eerst, vlak bij de achterdeuren.
              </>
            ) : (
              <>
                <strong>HelloFresh Laagjes Methode:</strong> laders staan bij de pallet en geven boxen door aan
                de lader bij de zijdeur, die in laagjes stapelt — van links naar rechts, zodat de
                eerstvolgende stop altijd rechts staat. Eerst het blok vooraan (bij de cabine) volledig
                vullen tot aan de lijn, dan het blok achteraan. Restant-, add-on- en Factor-boxen (max 12)
                komen apart bij de zijdeur. Volgorde: aflopend stopnummer.
              </>
            )}
          </div>
        </div>

        <div ref={mountRef} className="mb-4 rounded-2xl" style={{ height: 360, backgroundColor: BRAND.forestDark, overflow: "hidden" }} />

        {/* Voortgang */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest mb-1.5 opacity-60">
            <span>Voortgang</span>
            <span>{placedCount} / {route.boxes.length}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E3DFD3" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(placedCount / route.boxes.length) * 100}%`, backgroundColor: BRAND.lime }}
            />
          </div>
        </div>

        {/* Huidige / volgende box */}
        {!finished && nextBox && (
          <div className="rounded-xl p-3 mb-4 flex items-center gap-3" style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${MERK_COLOR[nextBox.merk]}` }}>
            <div
              className="shrink-0 flex items-center justify-center rounded-full font-extrabold text-lg"
              style={{ width: 44, height: 44, backgroundColor: BRAND.forestDark, color: "#fff" }}
            >
              {route.boxes.length - placedCount}
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-1">Volgende box</div>
              <div className="text-sm font-mono">{nextBox.code}</div>
              <span className="flex items-center gap-1 text-[11px] opacity-70 mt-1"><MapPin size={11} /> stop {nextBox.stop}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: MERK_COLOR[nextBox.merk], color: "#fff" }}>{nextBox.merk}</span>
              <span className="text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full" style={{ backgroundColor: "#EEF3E4", color: BRAND.forestDark }}>{nextBox.formaat}</span>
            </div>
          </div>
        )}

        {/* Bediening */}
        {!finished ? (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 rounded-xl text-white"
              style={{ backgroundColor: BRAND.forest }}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? "Pauzeren" : "Afspelen"}
            </button>
            <button
              onClick={placeNext}
              disabled={playing}
              className="inline-flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 rounded-xl disabled:opacity-30"
              style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${BRAND.forestDark}`, color: BRAND.forestDark }}
            >
              <SkipForward size={16} /> Stap
            </button>
          </div>
        ) : (
          <div className="rounded-2xl p-6 text-center mb-4" style={{ backgroundColor: BRAND.forestDark }}>
            <div className="mx-auto mb-3 flex items-center justify-center rounded-full" style={{ width: 48, height: 48, backgroundColor: BRAND.lime }}>
              <CheckCircle2 size={26} color={BRAND.forestDark} strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-extrabold text-white mb-1">Bus volledig geladen</h2>
            <p className="text-sm text-white opacity-80">Dit is het complete, correcte laadvoorbeeld voor deze route.</p>
          </div>
        )}

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
          <button onClick={reset} className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg" style={{ color: BRAND.forestDark }}>
            <RotateCcw size={13} /> Opnieuw
          </button>
        </div>

        <p className="text-xs text-center opacity-50">Voorbeeldmodel — routes en boxen zijn aan te passen aan jullie exacte data.</p>
      </div>
    </div>
  );
}

const MODULES = [
  { id: "side", naam: "Via schuifdeur" },
  { id: "rear", naam: "Via achterdeuren" },
];

export default function LaadModel3D() {
  const [moduleId, setModuleId] = useState("side");

  return (
    <div>
      <div className="w-full flex justify-center pt-4" style={{ backgroundColor: BRAND.cream }}>
        <div className="w-full max-w-md flex gap-2">
          {MODULES.map((m) => (
            <button
              key={m.id}
              onClick={() => setModuleId(m.id)}
              className="flex-1 text-xs font-bold px-3 py-2.5 rounded-xl transition-colors"
              style={{
                backgroundColor: moduleId === m.id ? BRAND.lime : "#FFFFFF",
                color: BRAND.forestDark,
                border: `1.5px solid ${BRAND.forestDark}`,
              }}
            >
              {m.naam}
            </button>
          ))}
        </div>
      </div>
      <LoadingModule entryMode={moduleId} key={moduleId} />
    </div>
  );
}
