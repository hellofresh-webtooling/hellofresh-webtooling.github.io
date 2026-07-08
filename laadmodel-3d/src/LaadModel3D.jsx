import React, { useState, useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
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
  Move3d,
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

const MERK_HEX = { HelloFresh: 0x91c11e, Factor: 0x1a1a1a };
const CARDBOARD_HEX = 0xd8b98a;
const MERK_COLOR = { HelloFresh: BRAND.lime, Factor: "#1A1A1A" };
const FORMAAT_LABEL = { L: "Groot", M: "Middel", S: "Klein" };

// Boxafmetingen (visueel/informatief; telt niet mee in de volgorde)
const SIZES = { L: { w: 0.5, h: 0.42, d: 0.5 }, M: { w: 0.42, h: 0.34, d: 0.42 }, S: { w: 0.32, h: 0.26, d: 0.32 } };

// Uniform slotraster voor het stapelen
const UNIT = { w: 0.5, h: 0.4, d: 0.5 };
const SLOT_GAP = 0.1;
const PITCH_X = UNIT.w + SLOT_GAP;
const PITCH_Y = UNIT.h + SLOT_GAP * 0.6;
const PITCH_Z = UNIT.d + SLOT_GAP;

const COL_HEIGHT = 3; // boxen per kolom — bevestigd op een echte, gefotografeerde belading (RUIAM-260708)
const REAR_LANES = 4; // kolommen naast elkaar bij de achterdeuren
const FRONT_FRACTION = 0.4; // aandeel boxen (hoogste stopnummers) dat vooraan bij de cabine komt

const LAAG_LABEL = ["onderin", "erbovenop", "bovenop"];

function generateBoxes(prefix, count, maxStop) {
  const merkCycle = ["HelloFresh", "HelloFresh", "Factor"];
  const formaatHF = ["L", "M", "S"];
  const formaatFactor = ["M", "S"];
  const boxes = [];
  for (let i = 0; i < count; i++) {
    const merk = merkCycle[i % merkCycle.length];
    const formaat = merk === "HelloFresh" ? formaatHF[i % formaatHF.length] : formaatFactor[i % formaatFactor.length];
    const stop = (i % maxStop) + 1;
    boxes.push({ id: `${prefix}-${i + 1}`, code: `RUIAM-260708-${String(i + 1).padStart(4, "0")}`, merk, formaat, stop });
  }
  return boxes;
}

const ROUTES = [
  { id: "noord", naam: "Ruinerwold Noord", boxes: generateBoxes("noord", 15, 5) },
  { id: "zuid", naam: "Ruinerwold Zuid", boxes: generateBoxes("zuid", 6, 3) },
  { id: "centrum", naam: "Ruinerwold Centrum", boxes: generateBoxes("centrum", 30, 6) },
];

// ---------------------------------------------------------------------------
// Laadplan: dezelfde, uit foto's afgeleide volgorde als voorheen, met per box
// zowel een 3D-positie (pos3) als de metadata voor de info-panelen.
// ---------------------------------------------------------------------------
function buildPlan(route) {
  const order = [...route.boxes].sort((a, b) => b.stop - a.stop);
  const total = order.length;

  const frontCount = Math.min(total, Math.round(total * FRONT_FRACTION));
  const frontBoxes = order.slice(0, frontCount);
  const rearBoxes = order.slice(frontCount);

  const frontColumns = Math.ceil(frontBoxes.length / COL_HEIGHT);
  const rearWaves = Math.max(rearBoxes.length ? 1 : 0, Math.ceil(rearBoxes.length / (COL_HEIGHT * REAR_LANES)));

  const depthSlots = frontColumns + rearWaves;
  const busDepth = depthSlots * PITCH_Z + 0.8;
  const busWidth = REAR_LANES * PITCH_X + 0.5;
  const busHeight = COL_HEIGHT * PITCH_Y + 0.4;
  const halfD = busDepth / 2;

  const steps = [];
  const cells = [];
  const cellMap = {};
  function getCell(key, zone, meta) {
    let c = cellMap[key];
    if (!c) {
      c = { key, zone, boxes: [], ...meta };
      cellMap[key] = c;
      cells.push(c);
    }
    return c;
  }

  const frontSpawn = { x: busWidth / 2 + 1.3, y: busHeight * 0.62, z: halfD - PITCH_Z };
  const rearSpawn = { x: 0, y: busHeight * 0.62, z: -halfD - 1.3 };

  // Voorzone: 1 kolom breed (x = 0), kolom voor kolom vanaf de voorwand.
  let idx = 0;
  for (let col = 0; col < frontColumns; col++) {
    const z = halfD - 0.4 - (col + 0.5) * PITCH_Z;
    const c = getCell(`f${col}`, "front", { col });
    const count = Math.min(COL_HEIGHT, frontBoxes.length - idx);
    for (let layer = 0; layer < count; layer++, idx++) {
      const box = frontBoxes[idx];
      const step = {
        box, zone: "front", col, layer, cellKey: c.key,
        pos3: { x: 0, y: layer * PITCH_Y + UNIT.h / 2 + 0.02, z },
        spawn: frontSpawn,
      };
      c.boxes.push(step);
      steps.push(step);
    }
  }

  // Achterzone: golven van (tot) 4 banen breed, 3 hoog; laagste stops nabij de deur.
  idx = 0;
  for (let wave = 0; wave < rearWaves; wave++) {
    const rearDepthIndex = rearWaves - 1 - wave; // 0 = dichtst bij de achterdeur
    const z = -halfD + 0.4 + (rearDepthIndex + 0.5) * PITCH_Z;
    for (let lane = 0; lane < REAR_LANES && idx < rearBoxes.length; lane++) {
      const x = ((REAR_LANES - 1) / 2 - lane) * PITCH_X;
      const c = getCell(`r${wave}-${lane}`, "rear", { wave, lane });
      const count = Math.min(COL_HEIGHT, rearBoxes.length - idx);
      for (let layer = 0; layer < count; layer++, idx++) {
        const box = rearBoxes[idx];
        const step = {
          box, zone: "rear", wave, lane, layer, cellKey: c.key,
          pos3: { x, y: layer * PITCH_Y + UNIT.h / 2 + 0.02, z },
          spawn: rearSpawn,
        };
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
    total, frontColumns, rearWaves, frontCount, rearCount: rearBoxes.length,
    steps, cells, cellMap,
    bus: { width: busWidth, height: busHeight, depth: busDepth },
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

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const SPEEDS = [
  { id: "slow", label: "Langzaam", ms: 1500 },
  { id: "normal", label: "Normaal", ms: 850 },
  { id: "fast", label: "Snel", ms: 420 },
];

export default function LaadModel3D() {
  const [routeId, setRouteId] = useState(ROUTES[0].id);
  const route = ROUTES.find((r) => r.id === routeId);
  const plan = useMemo(() => buildPlan(route), [routeId]);

  const [placed, setPlaced] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedId, setSpeedId] = useState("normal");
  const [selectedId, setSelectedId] = useState(null);
  const speedMs = SPEEDS.find((s) => s.id === speedId).ms;

  const mountRef = useRef(null);
  const apiRef = useRef(null);
  const planRef = useRef(plan);
  const prevPlacedRef = useRef(0);
  const selectCbRef = useRef(() => {});
  planRef.current = plan;

  const finished = placed >= plan.total;
  const currentStep = placed > 0 ? plan.steps[placed - 1] : null;
  const nextStep = !finished ? plan.steps[placed] : null;
  const selectedStep = selectedId ? plan.steps.find((s) => s.box.id === selectedId) : null;

  selectCbRef.current = (boxId) => setSelectedId(boxId);

  // ---- Three.js setup (eenmalig) ----
  useEffect(() => {
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = 400;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 200);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.borderRadius = "16px";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x6b7a5a, 0.35);
    scene.add(hemi);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(3, 6, 4);
    scene.add(dirLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enablePan = false;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 0.9;
    controls.maxPolarAngle = Math.PI * 0.495; // niet onder de vloer
    controls.minDistance = 3;
    controls.maxDistance = 40;

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshBasicMaterial({ color: 0xe6e1d4, transparent: true, opacity: 0.5 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);
    const grid = new THREE.GridHelper(24, 24, 0xcfc8b6, 0xdcd6c6);
    grid.position.y = 0;
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    scene.add(grid);

    // Materialen (gedeeld)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b4a2e, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide, transparent: true, opacity: 0.16 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x022e1c, transparent: true, opacity: 0.55 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x91c11e, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.35, metalness: 0.6 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x0b4a2e, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide, transparent: true, opacity: 0.14 });
    const doorEdgeMat = new THREE.LineBasicMaterial({ color: 0x022e1c, transparent: true, opacity: 0.65 });
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x91c11e, transparent: true, opacity: 0.14, side: THREE.DoubleSide });
    const markerEdgeMat = new THREE.LineBasicMaterial({ color: 0x91c11e, transparent: true, opacity: 0.35 });

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

    function addWheel(group, x, z) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 20), wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x, 0.24, z);
      group.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.17, 16), rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(x, 0.24, z);
      group.add(rim);
    }

    function frameCamera(bus) {
      const target = new THREE.Vector3(0, bus.height * 0.4, 0);
      controls.target.copy(target);
      const r = Math.max(bus.depth, bus.width) * 1.15 + 3;
      camera.position.set(bus.width * 0.7 + 2.4, bus.height + r * 0.42, bus.depth * 0.55 + r * 0.55);
      controls.update();
    }

    function buildStaticBus(p, resetCam) {
      scene.remove(staticGroup);
      staticGroup.traverse((obj) => obj.geometry && obj.geometry.dispose());
      staticGroup = new THREE.Group();
      const bus = p.bus;
      const halfD = bus.depth / 2;
      const halfW = bus.width / 2;

      addPanel(staticGroup, bus.width, bus.depth, { x: 0, y: 0, z: 0 }, { x: -Math.PI / 2 }); // vloer
      addPanel(staticGroup, bus.depth, bus.height, { x: -halfW, y: bus.height / 2, z: 0 }, { y: Math.PI / 2 }); // linkerwand

      // Schuifdeur (rechterzijde, voorzone) — altijd open
      {
        const geo = new THREE.PlaneGeometry(bus.depth * 0.42, bus.height);
        const mesh = new THREE.Mesh(geo, doorMat);
        mesh.rotation.y = -Math.PI / 2;
        mesh.position.set(halfW, bus.height / 2, halfD - bus.depth * 0.21);
        staticGroup.add(mesh);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), doorEdgeMat);
        edges.rotation.copy(mesh.rotation);
        edges.position.copy(mesh.position);
        staticGroup.add(edges);
      }

      // 2 klapdeuren achter — altijd open
      {
        const doorW = bus.width / 2;
        const doorGeo = new THREE.PlaneGeometry(doorW, bus.height);
        [-1, 1].forEach((side) => {
          const pivot = new THREE.Group();
          pivot.position.set(side * halfW, bus.height / 2, -halfD);
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

      // lime accentstrip achterkant
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(bus.width, Math.max(0.14, bus.height * 0.1)), accentMat);
      stripe.position.set(0, bus.height * 0.35, -halfD - 0.01);
      staticGroup.add(stripe);

      // versimpelde cabine buiten de voorwand
      const cabW = bus.width * 0.5;
      const cabH = bus.height * 0.78;
      const cabD = 0.9;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabD), wallMat);
      cab.position.set(0, cabH / 2, halfD + cabD / 2 + 0.9);
      staticGroup.add(cab);
      const cabEdges = new THREE.LineSegments(new THREE.EdgesGeometry(cab.geometry), edgeMat);
      cabEdges.position.copy(cab.position);
      staticGroup.add(cabEdges);

      const wheelZ = Math.min(halfD * 0.72, halfD - 0.3);
      addWheel(staticGroup, -halfW, wheelZ);
      addWheel(staticGroup, halfW, wheelZ);
      addWheel(staticGroup, -halfW, -wheelZ);
      addWheel(staticGroup, halfW, -wheelZ);
      addWheel(staticGroup, -halfW * 0.4, halfD + cabD * 0.55);
      addWheel(staticGroup, halfW * 0.4, halfD + cabD * 0.55);

      // slotmarkeringen op de vloer
      p.steps.forEach((s) => {
        if (s.layer !== 0) return;
        const geo = new THREE.PlaneGeometry(UNIT.w + 0.04, UNIT.d + 0.04);
        const marker = new THREE.Mesh(geo, markerMat);
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(s.pos3.x, 0.012, s.pos3.z);
        staticGroup.add(marker);
        const me = new THREE.LineSegments(new THREE.EdgesGeometry(geo), markerEdgeMat);
        me.rotation.copy(marker.rotation);
        me.position.copy(marker.position);
        staticGroup.add(me);
      });

      scene.add(staticGroup);
      if (resetCam) frameCamera(bus);
    }

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
      sprite.scale.set(0.32, 0.32, 1);
      sprite.renderOrder = 999;
      return sprite;
    }

    function makeBoxMesh(box, number, position) {
      const s = SIZES[box.formaat];
      const geo = new THREE.BoxGeometry(s.w, s.h, s.d);
      const mat = new THREE.MeshStandardMaterial({ color: CARDBOARD_HEX, roughness: 0.85, metalness: 0, emissive: 0x000000 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(position.x, position.y, position.z);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x6b5638, transparent: true, opacity: 0.45 }));
      mesh.add(edges);
      const accentH = s.h * 0.42;
      const accentMesh = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 0.82, accentH), new THREE.MeshStandardMaterial({ color: MERK_HEX[box.merk], roughness: 0.7 }));
      accentMesh.position.set(0, s.h * 0.06, s.d / 2 + 0.004);
      mesh.add(accentMesh);
      const label = makeNumberSprite(number);
      label.position.set(0, s.h / 2 + 0.2, 0);
      mesh.add(label);
      mesh.userData = { boxId: box.id, baseColor: CARDBOARD_HEX };
      return mesh;
    }

    const boxMeshes = {}; // index -> mesh
    const animations = [];

    function disposeMesh(m) {
      scene.remove(m);
      m.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      });
    }

    function ensurePlaced(count, animateIndex) {
      const p = planRef.current;
      Object.keys(boxMeshes).forEach((k) => {
        const i = Number(k);
        if (i >= count) {
          disposeMesh(boxMeshes[i]);
          delete boxMeshes[i];
          for (let a = animations.length - 1; a >= 0; a--) if (animations[a].index === i) animations.splice(a, 1);
        }
      });
      for (let i = 0; i < count; i++) {
        if (boxMeshes[i]) continue;
        const step = p.steps[i];
        const doAnim = i === animateIndex;
        const mesh = makeBoxMesh(step.box, step.number, doAnim ? step.spawn : step.pos3);
        boxMeshes[i] = mesh;
        scene.add(mesh);
        if (doAnim) {
          animations.push({
            index: i, mesh,
            from: new THREE.Vector3(step.spawn.x, step.spawn.y, step.spawn.z),
            to: new THREE.Vector3(step.pos3.x, step.pos3.y, step.pos3.z),
            start: performance.now(), duration: 720,
          });
        }
      }
    }

    function clearBoxes() {
      Object.keys(boxMeshes).forEach((k) => { disposeMesh(boxMeshes[k]); delete boxMeshes[k]; });
      animations.length = 0;
    }

    function highlight(boxId) {
      Object.values(boxMeshes).forEach((m) => {
        const on = m.userData.boxId === boxId;
        m.material.emissive.setHex(on ? 0x2f4a12 : 0x000000);
        m.material.emissiveIntensity = on ? 1 : 0;
        m.scale.setScalar(on ? 1.06 : 1);
      });
    }

    // Raycast-selectie (klik zonder te slepen)
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downX = 0, downY = 0;
    renderer.domElement.addEventListener("pointerdown", (e) => { downX = e.clientX; downY = e.clientY; });
    renderer.domElement.addEventListener("pointerup", (e) => {
      if (Math.abs(e.clientX - downX) > 6 || Math.abs(e.clientY - downY) > 6) return; // was slepen
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(Object.values(boxMeshes), true);
      if (hits.length) {
        let o = hits[0].object;
        while (o && !o.userData.boxId) o = o.parent;
        selectCbRef.current(o ? o.userData.boxId : null);
      } else {
        selectCbRef.current(null);
      }
    });

    function handleResize() {
      const w = container.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    }
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    let rafId;
    function animate() {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      for (let i = animations.length - 1; i >= 0; i--) {
        const a = animations[i];
        const t = Math.min(1, (now - a.start) / a.duration);
        const e = easeInOutCubic(t);
        a.mesh.position.lerpVectors(a.from, a.to, e);
        a.mesh.position.y += Math.sin(t * Math.PI) * 0.2;
        if (t >= 1) { a.mesh.position.copy(a.to); animations.splice(i, 1); }
      }
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    apiRef.current = { buildStaticBus, ensurePlaced, clearBoxes, highlight, frameCamera };
    apiRef.current.buildStaticBus(planRef.current, true);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      controls.dispose();
      clearBoxes();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route wisselt: bus opnieuw bouwen + camera reframen
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.clearBoxes();
    api.buildStaticBus(plan, true);
    prevPlacedRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // Geplaatste boxen synchroniseren met `placed`
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const prev = prevPlacedRef.current;
    const animateIndex = placed === prev + 1 ? placed - 1 : null; // alleen één stap vooruit animeert
    api.ensurePlaced(placed, animateIndex);
    prevPlacedRef.current = placed;
  }, [placed, routeId]);

  // Selectie-highlight
  useEffect(() => {
    apiRef.current?.highlight(selectedId);
  }, [selectedId, placed]);

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
    setSelectedId(null);
  }

  function reset() {
    setPlaced(0);
    setPlaying(false);
    setSelectedId(null);
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center py-6 px-4" style={{ backgroundColor: BRAND.cream, color: BRAND.ink, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="w-full max-w-md">
        <div className="mb-4">
          <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: BRAND.lime }}>Laadmodel 3D • HelloFresh &amp; Factor</div>
          <h1 className="text-xl sm:text-2xl font-extrabold leading-tight" style={{ color: BRAND.forestDark }}>
            Zo wordt de bus geladen — Laagjes Methode
          </h1>
        </div>

        {/* Routekeuze */}
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

        {/* Fase-banner */}
        <PhaseBanner plan={plan} step={currentStep} placed={placed} finished={finished} />

        {/* 3D-canvas */}
        <div ref={mountRef} className="rounded-2xl relative" style={{ height: 400, backgroundColor: BRAND.forestDark, overflow: "hidden" }}>
          <div className="absolute left-2.5 bottom-2.5 flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-lg pointer-events-none" style={{ backgroundColor: "rgba(3,80,42,0.72)", color: "#EAF3DD" }}>
            <Move3d size={12} /> sleep = draaien · scroll/knijp = zoomen · tik box = info
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5 mb-3 text-[10px] font-semibold opacity-60">
          <span>Nummer = laadvolgorde (hoog = eerst in, laag = bij de deur)</span>
          <span>{placed} / {plan.total}</span>
        </div>

        {/* Voortgangsbalk */}
        <div className="mb-3">
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E3DFD3" }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(placed / plan.total) * 100}%`, backgroundColor: BRAND.lime }} />
          </div>
        </div>

        {/* Detail */}
        {selectedStep ? (
          <SelectedDetail plan={plan} step={selectedStep} placed={placed} onClose={() => setSelectedId(null)} />
        ) : finished ? (
          <DoneCard plan={plan} />
        ) : (
          <StepDetail plan={plan} currentStep={currentStep} nextStep={nextStep} placed={placed} />
        )}

        {/* Scrubber */}
        <div className="mt-4 mb-3">
          <input
            type="range" min={0} max={plan.total} value={placed}
            onChange={(e) => { setPlaying(false); setPlaced(Number(e.target.value)); }}
            className="w-full" style={{ accentColor: BRAND.forest }}
            aria-label="Sleep om door de laadstappen te gaan"
          />
          <div className="flex justify-between text-[10px] font-semibold opacity-50 mt-0.5">
            <span>Leeg</span><span>Sleep om te scrubben</span><span>Vol</span>
          </div>
        </div>

        {/* Bediening */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { setPlaced((p) => Math.max(0, p - 1)); setPlaying(false); }}
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
            onClick={() => { setPlaced((p) => Math.min(plan.total, p + 1)); setPlaying(false); }}
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
                style={{ backgroundColor: speedId === s.id ? BRAND.forestDark : "#FFFFFF", color: speedId === s.id ? "#FFFFFF" : BRAND.forestDark, border: `1px solid ${BRAND.forestDark}` }}
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

// --------------------------------------------------------------------------
function PhaseBanner({ plan, step, placed, finished }) {
  let title, sub, icon;
  if (finished) {
    title = "Bus volledig geladen";
    sub = "Volgorde klopt: laagste stopnummers bij de achterdeur, als eerste weer eruit.";
    icon = <CheckCircle2 size={16} color={BRAND.forest} />;
  } else if (placed === 0) {
    title = "Klaar om te laden";
    sub = "Begin vooraan bij de cabine via de schuifdeur. Druk op afspelen of stap door.";
    icon = <Info size={16} color={BRAND.forest} />;
  } else if (step.zone === "front") {
    title = `Voorzone · schuifdeur · kolom ${step.col + 1}/${plan.frontColumns}`;
    sub = "Smal gedeelte bij de cabine: 1 box breed, 3 hoog. Hoogste stopnummer onderin.";
    icon = <DoorOpen size={16} color={BRAND.forest} />;
  } else {
    title = `Achterzone · achterdeuren · golf ${step.wave + 1}/${plan.rearWaves}`;
    sub = "Brede gedeelte: 4 banen naast elkaar, 3 hoog. Elke golf schuift daarna naar binnen.";
    icon = <DoorOpen size={16} color={BRAND.forest} />;
  }
  return (
    <div className="rounded-xl px-4 py-3 mb-3 flex gap-2 text-xs sm:text-sm leading-snug" style={{ backgroundColor: "#EEF3E4", borderLeft: `4px solid ${BRAND.lime}` }}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div>
        <strong style={{ color: BRAND.forestDark }}>{title}</strong>
        <div className="opacity-75 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
function StackDetail({ cell, placed, activeBoxId }) {
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
            <span className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ backgroundColor: BRAND.forestDark }}>{s.number}</span>
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
function BoxChips({ box }) {
  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <span className="text-[10px] font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: MERK_COLOR[box.merk] }}>{box.merk}</span>
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "#EEF3E4", color: BRAND.forestDark }}>{FORMAAT_LABEL[box.formaat]}</span>
      <span className="flex items-center gap-1 text-[10px] opacity-70"><MapPin size={11} /> stop {box.stop}</span>
      <span className="text-[10px] font-mono opacity-50 truncate">{box.code}</span>
    </div>
  );
}

// --------------------------------------------------------------------------
function StepDetail({ plan, currentStep, placed }) {
  const cell = currentStep ? plan.cellMap[currentStep.cellKey] : null;
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: "#FFFFFF", border: `1.5px solid #E3DFD3` }}>
      {currentStep ? (
        <>
          <div className="flex items-start gap-3 mb-3">
            <div className="shrink-0 flex items-center justify-center rounded-full font-extrabold text-lg text-white" style={{ width: 44, height: 44, backgroundColor: BRAND.forest }}>{currentStep.number}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-0.5">Zojuist geplaatst</div>
              <p className="text-sm font-semibold leading-snug" style={{ color: BRAND.forestDark }}>{describe(currentStep)}</p>
              <BoxChips box={currentStep.box} />
            </div>
          </div>
          {currentStep.waveComplete && (
            <div className="rounded-lg px-3 py-2 mb-3 text-xs leading-snug flex gap-2" style={{ backgroundColor: "#FDF6E3", border: "1px solid #E7D9A8" }}>
              <span>↩︎</span>
              <span><strong>Golf {currentStep.wave + 1} compleet.</strong> Schuif de hele golf één stap naar binnen — beter voor de ergonomie én de laagste stopnummers blijven bij de achterdeur.</span>
            </div>
          )}
          {cell && (
            <div>
              <div className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-1.5">Kolom-opbouw (onderin eerst)</div>
              <StackDetail cell={cell} placed={placed} activeBoxId={currentStep.box.id} />
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm font-semibold mb-1" style={{ color: BRAND.forestDark }}>{plan.total} boxen klaar om te laden</p>
          <p className="text-xs opacity-60">Voorzone: {plan.frontCount} · Achterzone: {plan.rearCount}. Druk op afspelen, of draai het model met je vinger.</p>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
function SelectedDetail({ plan, step, placed, onClose }) {
  const cell = plan.cellMap[step.cellKey];
  const label = step.zone === "front" ? `Voorzone · kolom ${step.col + 1}` : `Achterzone · golf ${step.wave + 1} · baan ${step.lane + 1}`;
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${BRAND.forestDark}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-extrabold" style={{ color: BRAND.forestDark }}>Box {step.number} · {label}</span>
        <button onClick={onClose} className="p-1 rounded-md" style={{ color: BRAND.forestDark }} aria-label="Sluiten"><X size={16} /></button>
      </div>
      <BoxChips box={step.box} />
      <div className="mt-3">
        <div className="text-[10px] uppercase font-bold tracking-widest opacity-50 mb-1.5">Kolom-opbouw (onderin eerst)</div>
        <StackDetail cell={cell} placed={placed} activeBoxId={step.box.id} />
      </div>
      <p className="text-[11px] opacity-60 mt-3 leading-snug">Tik op een andere box in het 3D-model, of sluit dit om terug te gaan naar de stapuitleg.</p>
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
      <p className="text-sm text-white opacity-80 leading-snug">{plan.total} boxen — {plan.frontCount} vooraan via de schuifdeur, {plan.rearCount} achterin via de achterdeuren. Draai het model om de belading te bekijken.</p>
    </div>
  );
}
