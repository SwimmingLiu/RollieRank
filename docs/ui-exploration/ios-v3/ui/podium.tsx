import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  ExtrudeGeometry,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  OrthographicCamera,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
  Shape,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Avatar, NumberTicker } from "./primitives";

export type PodiumPerson = { place: 1 | 2 | 3; name: string; score: number | string };
export type PodiumProps = { people: PodiumPerson[] };
type Anchor = { x: number; personY: number; numberX: number; numberY: number; reveal: number };
type Anchors = Record<PodiumPerson["place"], Anchor>;
type RendererState = "svg" | "webgl";
type EntranceState = "entering" | "settled";

const COLUMNS = [
  { place: 2, x: -1.72, height: 1.18, color: "#e2e3e6", delay: 35 },
  { place: 1, x: 0, height: 1.88, color: "#efb8b3", delay: 70 },
  { place: 3, x: 1.72, height: 0.96, color: "#e8e8ea", delay: 0 },
] satisfies { place: PodiumPerson["place"]; x: number; height: number; color: string; delay: number }[];
const PLAQUE_WIDTH = 1.48;
const PLAQUE_DEPTH = 0.24;
const PLAQUE_BASE = 0.035;
const BEVEL = 0.018;
const ENTRANCE_DURATION = 500;
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const easeOut = (value: number) => 1 - (1 - value) ** 3;

// The camera and fallback share the same compact framing. A failed WebGL
// context still leaves every real name, score and place available in the DOM.
const FALLBACK_ANCHORS: Anchors = {
  1: { x: 50, personY: 44.4, numberX: 49.8, numberY: 73.6, reveal: 1 },
  2: { x: 19.7, personY: 59.4, numberX: 19.5, numberY: 79.9, reveal: 1 },
  3: { x: 80.3, personY: 66.3, numberX: 80, numberY: 84.2, reveal: 1 },
};

function plaqueShape(width: number, height: number, radius: number) {
  const shape = new Shape();
  const left = -width / 2;
  const right = width / 2;
  shape.moveTo(left + radius, 0);
  shape.lineTo(right - radius, 0);
  shape.quadraticCurveTo(right, 0, right, radius);
  shape.lineTo(right, height - radius);
  shape.quadraticCurveTo(right, height, right - radius, height);
  shape.lineTo(left + radius, height);
  shape.quadraticCurveTo(left, height, left, height - radius);
  shape.lineTo(left, radius);
  shape.quadraticCurveTo(left, 0, left + radius, 0);
  shape.closePath();
  return shape;
}

function PodiumFallback() {
  return (
    <svg className="rr2-podium-fallback" viewBox="0 0 600 440" preserveAspectRatio="none" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      {[
        { x: 40, y: 284, w: 156, h: 119, color: "#e2e3e6", edge: "#d5d6da", top: "#ededef" },
        { x: 220, y: 219, w: 156, h: 188, color: "#efb8b3", edge: "#dfa4a0", top: "#f6ceca" },
        { x: 405, y: 315, w: 156, h: 96, color: "#e8e8ea", edge: "#d9d9dd", top: "#f1f1f3" },
      ].map((plaque) => (
        <g key={plaque.x}>
          <ellipse cx={plaque.x + plaque.w / 2 + 4} cy={plaque.y + plaque.h + 3} rx={plaque.w * .52} ry="4" fill="#27272a" opacity=".035" />
          <rect x={plaque.x + 5} y={plaque.y - 4} width={plaque.w} height={plaque.h} rx="12" fill={plaque.edge} />
          <path d={`M${plaque.x + 12},${plaque.y}l5,-4h${plaque.w - 24}l-5,4Z`} fill={plaque.top} />
          <rect x={plaque.x} y={plaque.y} width={plaque.w} height={plaque.h} rx="12" fill={plaque.color} />
        </g>
      ))}
    </svg>
  );
}

export function Podium({ people }: PodiumProps) {
  const sceneElement = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion() === true;
  const [mode, setMode] = useState<RendererState>("svg");
  const [entrance, setEntrance] = useState<EntranceState>(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "settled" : "entering");
  const [anchors, setAnchors] = useState<Anchors>(FALLBACK_ANCHORS);

  useEffect(() => {
    const element = sceneElement.current;
    const surface = canvas.current;
    if (!element || !surface) return;
    const reduced = reduce || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: surface, alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      setEntrance("settled");
      return;
    }
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = VSMShadowMap;
    renderer.setClearColor(0x000000, 0);

    const scene = new Scene();
    const createEnvironment = () => {
      const room = new RoomEnvironment();
      const generator = new PMREMGenerator(renderer);
      try {
        return generator.fromScene(room, 0.04);
      } finally {
        room.dispose();
        generator.dispose();
      }
    };
    let environment = createEnvironment();
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.6;
    scene.environmentRotation.y = 0.7;
    const camera = new OrthographicCamera(-2.83, 2.83, 2.12, -2.12, 0.1, 40);
    camera.position.set(1.15, 5, 12);
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    const geometry = <T extends BufferGeometry>(value: T) => { geometries.add(value); return value; };
    const material = <T extends Material>(value: T) => { materials.add(value); return value; };

    scene.add(new HemisphereLight(0xffffff, 0xe7e7e7, 0.42));
    scene.add(new AmbientLight(0xffffff, 0.12));
    const key = new DirectionalLight(0xffffff, 2);
    key.position.set(-4, 7, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.0002;
    key.shadow.radius = 5;
    key.shadow.blurSamples = 12;
    key.shadow.intensity = 0.4;
    scene.add(key);
    const rim = new DirectionalLight(0xffffff, 0.5);
    rim.position.set(4, 3.5, -2);
    scene.add(rim);

    const plaques = COLUMNS.map((column) => {
      // The thin, softly glazed faces retain real depth without the former
      // thick edge bands; rank is encoded by height, exact score stays in DOM.
      const finish = material(new MeshPhysicalMaterial({ color: column.color, roughness: 0.42, metalness: 0.035, clearcoat: 0.18, clearcoatRoughness: 0.55, ior: 1.46 }));
      const bodyGeometry = geometry(new ExtrudeGeometry(plaqueShape(PLAQUE_WIDTH, column.height, 0.11), {
        depth: PLAQUE_DEPTH, steps: 1, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 3, curveSegments: 18,
      }));
      const mesh = new Mesh(bodyGeometry, finish);
      mesh.position.set(column.x, PLAQUE_BASE, -PLAQUE_DEPTH / 2);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return { column, mesh };
    });
    const floor = new Mesh(geometry(new PlaneGeometry(16, 16)), material(new ShadowMaterial({ opacity: 0.045 })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.012;
    floor.receiveShadow = true;
    scene.add(floor);

    let frame: number | null = null;
    let disposed = false;
    let lost = false;
    const startedAt = performance.now();
    let settled = Boolean(reduced);
    if (settled) setEntrance("settled");
    else setEntrance("entering");

    const render = (now: number) => {
      frame = null;
      if (disposed || lost) return;
      const { width, height } = element.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const aspect = width / height;
      const halfWidth = Math.max(2.83, 2.1 * aspect);
      const halfHeight = halfWidth / aspect;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      // Move the camera's target with its actual frustum: the plaque bases
      // stay near 93% of the surface instead of leaving a fixed empty tail.
      camera.lookAt(0, halfHeight * 0.9, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      const next: Anchors = { ...FALLBACK_ANCHORS };
      for (const { column, mesh } of plaques) {
        const elapsed = (now - startedAt - column.delay) / ENTRANCE_DURATION;
        const progress = settled || reduced ? 1 : easeOut(clamp(elapsed));
        mesh.scale.y = Math.max(0.001, progress);
        // People and engraved numerals use this same rising height, so their
        // motion belongs to the real object rather than an unrelated fade.
        const person = new Vector3(column.x, PLAQUE_BASE + column.height * progress + 0.23, 0).project(camera);
        const number = new Vector3(column.x, PLAQUE_BASE + column.height * progress * 0.46, PLAQUE_DEPTH / 2 + BEVEL + 0.006).project(camera);
        next[column.place] = {
          x: (person.x + 1) * 50,
          personY: (1 - person.y) * 50,
          numberX: (number.x + 1) * 50,
          numberY: (1 - number.y) * 50,
          reveal: clamp(progress * 2),
        };
      }
      renderer.render(scene, camera);
      setAnchors(next);
      setMode("webgl");
      if (!settled && now - startedAt >= ENTRANCE_DURATION + 70) {
        settled = true;
        setEntrance("settled");
      }
      if (!settled) frame = requestAnimationFrame(render);
    };
    const scheduleRender = () => {
      if (disposed || lost || frame !== null) return;
      frame = requestAnimationFrame(render);
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      settled = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      setAnchors(FALLBACK_ANCHORS);
      setMode("svg");
      setEntrance("settled");
    };
    const onContextRestored = () => {
      scene.environment = null;
      environment.dispose();
      environment = createEnvironment();
      scene.environment = environment.texture;
      lost = false;
      scheduleRender();
    };
    surface.addEventListener("webglcontextlost", onContextLost);
    surface.addEventListener("webglcontextrestored", onContextRestored);
    const observer = new ResizeObserver(scheduleRender);
    observer.observe(element);
    scheduleRender();

    return () => {
      disposed = true;
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      surface.removeEventListener("webglcontextlost", onContextLost);
      surface.removeEventListener("webglcontextrestored", onContextRestored);
      for (const value of geometries) value.dispose();
      for (const value of materials) value.dispose();
      scene.environment = null;
      environment.dispose();
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      scene.clear();
    };
  }, [reduce]);

  return (
    <div className="rr-podium-scene rr2-podium" ref={sceneElement} data-renderer={mode} data-motion={entrance} style={{ position: "relative" }} role="group" aria-label="练习榜前三名">
      {/* Do not flash the finished fallback before the first rising WebGL frame. */}
      {mode === "svg" ? <span style={{ opacity: entrance === "settled" ? 1 : 0 }}><PodiumFallback /></span> : null}
      <canvas ref={canvas} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: mode === "webgl" ? 1 : 0, pointerEvents: "none" }} />
      {COLUMNS.map(({ place }) => {
        const person = people.find((entry) => entry.place === place);
        if (!person) return null;
        const anchor = anchors[person.place];
        const numericScore = typeof person.score === "number" ? person.score : Number(person.score);
        return (
          <div className="rr2-podium-person" data-place={person.place} key={person.place} role="group" aria-label={`第${person.place}名`} style={{ position: "absolute", left: `${anchor.x}%`, top: `${anchor.personY}%`, transform: "translate(-50%, -100%)", opacity: mode === "svg" && entrance === "entering" ? 0 : anchor.reveal }}>
            <Avatar name={person.name} src="assets/profile-default.svg" size="sm" className="rr2-podium-avatar" />
            <span className="rr2-podium-name">{person.name}</span>
            <span className="rr2-podium-score"><strong><NumberTicker value={numericScore} decimals={2} duration={0.48} stagger={0.015} /></strong><small>分</small></span>
          </div>
        );
      })}
      {people.map((person) => <span className="rr2-podium-number" data-place={person.place} key={person.place} style={{ position: "absolute", left: `${anchors[person.place].numberX}%`, top: `${anchors[person.place].numberY}%`, transform: "translate(-50%, -50%)", opacity: mode === "svg" && entrance === "entering" ? 0 : anchors[person.place].reveal }} aria-hidden="true">{person.place}</span>)}
    </div>
  );
}
