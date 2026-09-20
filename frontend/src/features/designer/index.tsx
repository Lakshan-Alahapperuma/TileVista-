'use client';
import React, { useState, Suspense, useRef, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ArrowLeft, ChevronRight, CheckCircle, ShoppingBag, Phone, Box, Compass, Eye, Plus, Minus, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react';

// ─── TYPES ──────────────────────────────────────────────────────────────────

type RoomShape = 'rectangular' | 'l-shape' | 'cut' | 't-shape';
type UnitSystem = 'feet' | 'cm';
type DoorStyleId = 'single-panel' | 'glass' | 'french-double' | 'double-panel' | 'bifold' | 'glass-double' | 'none';
type FloorId = 'natural-oak' | 'medium-oak' | 'dark-ash' | 'walnut' | 'cherry' | 'ebony' | 'light-gray' | 'medium-gray' | 'concrete' | 'limestone' | 'sand' | 'white-tile';

interface DesignState {
  step: 1 | 2 | 3 | 4;
  shape: RoomShape;
  widthFt: number;
  depthFt: number;
  unit: UnitSystem;
  doorStyle: DoorStyleId;
  wallColor: string;
  floorId: FloorId;
  doorPlacement?: { wallIndex: number; offset: number; y: number };
  winPlacement?: { wallIndex: number; offset: number; y: number };
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const WALL_COLORS = [
  ['#FAFAF8', '#D4C5B9', '#C4B5A5', '#CC6633', '#8B4040', '#A8C0CC'],
  ['#4A6FA5', '#5C7A5C', '#7A8A8A', '#8A7A6A', '#7A4A80', '#4A6A6A'],
];

interface FloorStyle { id: FloorId; name: string; swatch: string; planks: string; planksAlt: string }
const FLOOR_STYLES: FloorStyle[] = [
  { id: 'natural-oak',  name: 'Natural Oak',  swatch: '#C8A060', planks: '#C8A060', planksAlt: '#B89050' },
  { id: 'medium-oak',  name: 'Medium Oak',   swatch: '#9A7020', planks: '#9A7020', planksAlt: '#8A6015' },
  { id: 'dark-ash',    name: 'Dark Ash',     swatch: '#5C4A2A', planks: '#5C4A2A', planksAlt: '#4E3E20' },
  { id: 'walnut',      name: 'Walnut',       swatch: '#6B3A2A', planks: '#6B3A2A', planksAlt: '#5C2E1A' },
  { id: 'cherry',      name: 'Cherry',       swatch: '#8B3A2A', planks: '#8B3A2A', planksAlt: '#7A2E20' },
  { id: 'ebony',       name: 'Ebony',        swatch: '#2A1A0A', planks: '#2A1A0A', planksAlt: '#1A0A00' },
  { id: 'light-gray',  name: 'Light Gray',   swatch: '#C8C8C8', planks: '#C8C8C8', planksAlt: '#B8B8B8' },
  { id: 'medium-gray', name: 'Medium Gray',  swatch: '#8A8A8A', planks: '#8A8A8A', planksAlt: '#7A7A7A' },
  { id: 'concrete',    name: 'Concrete',     swatch: '#9A9A90', planks: '#9A9A90', planksAlt: '#8A8A80' },
  { id: 'limestone',   name: 'Limestone',    swatch: '#C8C0A8', planks: '#C8C0A8', planksAlt: '#B8B098' },
  { id: 'sand',        name: 'Sand',         swatch: '#D4C090', planks: '#D4C090', planksAlt: '#C4B080' },
  { id: 'white-tile',  name: 'White Tile',   swatch: '#F0F0F0', planks: '#F0F0F0', planksAlt: '#E0E0E0' },
];

const DOOR_STYLES: { id: DoorStyleId; name: string }[] = [
  { id: 'single-panel',  name: 'Single Panel Door' },
  { id: 'glass',         name: 'Glass Door' },
  { id: 'french-double', name: 'French Double Door' },
  { id: 'double-panel',  name: 'Double Panel Door' },
  { id: 'bifold',        name: 'Bifold Panel Double Door' },
  { id: 'glass-double',  name: 'Glass Double Door' },
];

const INITIAL: DesignState = {
  step: 1, shape: 'rectangular', widthFt: 14.5, depthFt: 9.75,
  unit: 'feet', doorStyle: 'single-panel', wallColor: '#FAFAF8', floorId: 'natural-oak',
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function feetToCm(ft: number) { return Math.round(ft * 30.48); }
function formatDim(val: number, unit: UnitSystem) {
  if (unit === 'feet') {
    const ft = Math.floor(val);
    const inches = Math.round((val - ft) * 12);
    return `${ft}' ${inches}"`;
  }
  return `${feetToCm(val)} cm`;
}
function darken(hex: string, amt = 15): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  const r = clamp(parseInt(hex.slice(1, 3), 16) - amt);
  const g = clamp(parseInt(hex.slice(3, 5), 16) - amt);
  const b = clamp(parseInt(hex.slice(5, 7), 16) - amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
function lighten(hex: string, amt = 15): string { return darken(hex, -amt); }

// ─── DOOR IN SVG ROOM (back wall space) ──────────────────────────────────────

interface DoorSVGProps { style: DoorStyleId; x: number; y: number; w: number; h: number; wc: string }

function DoorInRoom({ style, x, y, w, h, wc }: DoorSVGProps) {
  if (style === 'none') return null;
  const fc = darken(wc, 30);  // frame colour (darker than wall)
  const gc = 'rgba(185,215,235,0.55)'; // glass colour

  if (style === 'single-panel') return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={darken(wc, 8)} stroke={fc} strokeWidth="2" />
      <rect x={x+4} y={y+4} width={w-8} height={h-8} fill={darken(wc, 3)} stroke={fc} strokeWidth="1" />
      <circle cx={x+w-7} cy={y+h*0.5} r={2} fill={fc} />
      <path d={`M ${x} ${y+h} A ${w*0.9} ${w*0.9} 0 0 0 ${x-w*0.9} ${y+h-w*0.9}`}
        fill="none" stroke={fc} strokeWidth="0.8" strokeDasharray="3,2" opacity="0.4" />
    </g>
  );

  if (style === 'glass') return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={darken(wc, 5)} stroke={fc} strokeWidth="2" />
      <rect x={x+4} y={y+4} width={w-8} height={h*0.62} fill={gc} stroke={fc} strokeWidth="1" />
      <rect x={x+4} y={y+h*0.64+2} width={w-8} height={h*0.3} fill={darken(wc, 3)} stroke={fc} strokeWidth="1" />
      <circle cx={x+w-7} cy={y+h*0.5} r={2} fill={fc} />
    </g>
  );

  if (style === 'french-double') {
    const hw = w / 2;
    return (
      <g>
        <rect x={x} y={y} width={hw-1} height={h} fill={darken(wc, 5)} stroke={fc} strokeWidth="2" />
        <rect x={x+hw+1} y={y} width={hw-1} height={h} fill={darken(wc, 5)} stroke={fc} strokeWidth="2" />
        {[0,1,2].map(row => (
          <React.Fragment key={row}>
            <rect x={x+4} y={y+4+row*(h/3-1)} width={hw-9} height={h/3-6} fill={gc} stroke={fc} strokeWidth="0.8" />
            <rect x={x+hw+5} y={y+4+row*(h/3-1)} width={hw-9} height={h/3-6} fill={gc} stroke={fc} strokeWidth="0.8" />
          </React.Fragment>
        ))}
      </g>
    );
  }

  if (style === 'double-panel') {
    const hw = w / 2;
    return (
      <g>
        <rect x={x} y={y} width={hw-1} height={h} fill={darken(wc, 5)} stroke={fc} strokeWidth="2" />
        <rect x={x+hw+1} y={y} width={hw-1} height={h} fill={darken(wc, 5)} stroke={fc} strokeWidth="2" />
        {[0,1].map(side => {
          const sx = side === 0 ? x+4 : x+hw+5;
          const sw = hw - 9;
          return (
            <React.Fragment key={side}>
              <rect x={sx} y={y+4} width={sw} height={h*0.38} fill={darken(wc, 3)} stroke={fc} strokeWidth="0.8" />
              <rect x={sx} y={y+h*0.42+2} width={sw} height={h*0.52} fill={darken(wc, 3)} stroke={fc} strokeWidth="0.8" />
            </React.Fragment>
          );
        })}
      </g>
    );
  }

  if (style === 'bifold') {
    const panelW = w / 4;
    return (
      <g>
        {[0,1,2,3].map(i => (
          <rect key={i} x={x+i*panelW} y={y} width={panelW-1} height={h}
            fill={darken(wc, 5)} stroke={fc} strokeWidth="1.5" rx="1" />
        ))}
      </g>
    );
  }

  if (style === 'glass-double') {
    const hw = w / 2;
    return (
      <g>
        <rect x={x} y={y} width={hw-1} height={h} fill={darken(wc, 5)} stroke={fc} strokeWidth="2" />
        <rect x={x+hw+1} y={y} width={hw-1} height={h} fill={darken(wc, 5)} stroke={fc} strokeWidth="2" />
        <rect x={x+4} y={y+4} width={hw-9} height={h-8} fill={gc} stroke={fc} strokeWidth="0.8" />
        <rect x={x+hw+5} y={y+4} width={hw-9} height={h-8} fill={gc} stroke={fc} strokeWidth="0.8" />
      </g>
    );
  }

  return null;
}

// ─── DOOR THUMBNAIL (left panel card) ────────────────────────────────────────

function DoorThumbnail({ style }: { style: DoorStyleId }) {
  const w = 60; const h = 80;
  const dw = 28; const dh = 58;
  const dx = (w - dw) / 2; const dy = h - dh - 4;
  const gc = 'rgba(180,210,230,0.5)';
  const fc = '#888';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      <rect x={dx} y={dy} width={dw} height={dh} fill="#C8C8C0" stroke={fc} strokeWidth="1.5" rx="1" />

      {style === 'single-panel' && (
        <>
          <rect x={dx+3} y={dy+3} width={dw-6} height={dh-6} fill="#E8E8E2" stroke={fc} strokeWidth="0.8" />
          <circle cx={dx+dw-6} cy={dy+dh/2} r={2} fill="#666" />
        </>
      )}
      {style === 'glass' && (
        <>
          <rect x={dx+3} y={dy+3} width={dw-6} height={dh*0.6} fill={gc} stroke={fc} strokeWidth="0.7" />
          <rect x={dx+3} y={dy+dh*0.63+2} width={dw-6} height={dh*0.32} fill="#E8E8E2" stroke={fc} strokeWidth="0.7" />
        </>
      )}
      {style === 'french-double' && (
        <>
          <line x1={w/2} y1={dy} x2={w/2} y2={dy+dh} stroke={fc} strokeWidth="1" />
          {[0,1,2].map(r => (
            <React.Fragment key={r}>
              <rect x={dx+3} y={dy+3+r*(dh/3-1)} width={dw/2-5} height={dh/3-5} fill={gc} stroke={fc} strokeWidth="0.5" />
              <rect x={dx+dw/2+2} y={dy+3+r*(dh/3-1)} width={dw/2-5} height={dh/3-5} fill={gc} stroke={fc} strokeWidth="0.5" />
            </React.Fragment>
          ))}
        </>
      )}
      {style === 'double-panel' && (
        <>
          <line x1={w/2} y1={dy} x2={w/2} y2={dy+dh} stroke={fc} strokeWidth="1" />
          {[0,1].map(side => {
            const sx = side === 0 ? dx+3 : dx+dw/2+2;
            const sw = dw/2-5;
            return (
              <React.Fragment key={side}>
                <rect x={sx} y={dy+3} width={sw} height={dh*0.38} fill="#E8E8E2" stroke={fc} strokeWidth="0.5" />
                <rect x={sx} y={dy+dh*0.44+2} width={sw} height={dh*0.5} fill="#E8E8E2" stroke={fc} strokeWidth="0.5" />
              </React.Fragment>
            );
          })}
        </>
      )}
      {style === 'bifold' && (
        <>
          {[0,1,2,3].map(i => (
            <rect key={i} x={dx+i*(dw/4)} y={dy} width={dw/4-1} height={dh} fill="#E8E8E2" stroke={fc} strokeWidth="0.8" rx="0.5" />
          ))}
        </>
      )}
      {style === 'glass-double' && (
        <>
          <line x1={w/2} y1={dy} x2={w/2} y2={dy+dh} stroke={fc} strokeWidth="1" />
          <rect x={dx+3} y={dy+3} width={dw/2-5} height={dh-6} fill={gc} stroke={fc} strokeWidth="0.5" />
          <rect x={dx+dw/2+2} y={dy+3} width={dw/2-5} height={dh-6} fill={gc} stroke={fc} strokeWidth="0.5" />
        </>
      )}

      <line x1={dx-4} y1={dy+dh} x2={dx+dw+4} y2={dy+dh} stroke={fc} strokeWidth="1.5" />
    </svg>
  );
}

// ─── SHAPE THUMBNAIL ─────────────────────────────────────────────────────────

function ShapeSVG({ shape, selected }: { shape: RoomShape; selected: boolean }) {
  const fill = selected ? '#1A1A1A' : '#D0D0D0';
  return (
    <svg viewBox="0 0 60 60" className="w-full h-full">
      {shape === 'rectangular' && <rect x="8" y="12" width="44" height="36" fill={fill} rx="1" />}
      {shape === 'l-shape' && <polygon points="8,12 52,12 52,36 32,36 32,48 8,48" fill={fill} />}
      {shape === 'cut' && <polygon points="8,12 44,12 52,20 52,48 8,48" fill={fill} />}
      {shape === 't-shape' && (
        <>
          <rect x="20" y="8" width="20" height="16" fill={fill} rx="1" />
          <rect x="8" y="24" width="44" height="28" fill={fill} rx="1" />
        </>
      )}
    </svg>
  );
}

// ─── TOP-DOWN ROOM VIEW (Steps 1–2) ─────────────────────────────────────────

function TopDownRoom({ state }: { state: DesignState }) {
  const { shape, widthFt, depthFt, unit, step } = state;
  const W = 250; const D = 175;
  const ox = 65; const oy = 52;

  const pts: Record<RoomShape, string> = {
    'rectangular': `${ox},${oy} ${ox+W},${oy} ${ox+W},${oy+D} ${ox},${oy+D}`,
    'l-shape':     `${ox},${oy} ${ox+W},${oy} ${ox+W},${oy+D*0.5} ${ox+W*0.55},${oy+D*0.5} ${ox+W*0.55},${oy+D} ${ox},${oy+D}`,
    'cut':         `${ox},${oy} ${ox+W*0.75},${oy} ${ox+W},${oy+D*0.28} ${ox+W},${oy+D} ${ox},${oy+D}`,
    't-shape':     `${ox+W*0.28},${oy} ${ox+W*0.72},${oy} ${ox+W*0.72},${oy+D*0.38} ${ox+W},${oy+D*0.38} ${ox+W},${oy+D} ${ox},${oy+D} ${ox},${oy+D*0.38} ${ox+W*0.28},${oy+D*0.38}`,
  };

  const cx = ox + W / 2; const cy = oy + D / 2;

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#E8E8E8]">
      <svg viewBox="0 0 380 280" style={{ width: '100%', height: '100%' }}>
        <polygon points={pts[shape]} fill="rgba(0,0,0,0.08)" transform="translate(5,5)" />
        <polygon points={pts[shape]} fill="#E8D8C0" />
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1={ox+2} y1={oy+14+i*14} x2={ox+W-2} y2={oy+14+i*14}
            stroke="#D4B890" strokeWidth="0.8" opacity="0.55" />
        ))}
        <ellipse cx={cx} cy={cy} rx={W*0.22} ry={D*0.17} fill="rgba(255,250,230,0.55)" />
        <polygon points={pts[shape]} fill="none" stroke="white" strokeWidth="28" />
        <polygon points={pts[shape]} fill="none" stroke="#1A1A1A" strokeWidth="2" />
        {step === 2 && (
          <>
            <line x1={ox} y1={oy-22} x2={ox+W} y2={oy-22} stroke="#1A1A1A" strokeWidth="1" />
            <line x1={ox} y1={oy-26} x2={ox} y2={oy-18} stroke="#1A1A1A" strokeWidth="1" />
            <line x1={ox+W} y1={oy-26} x2={ox+W} y2={oy-18} stroke="#1A1A1A" strokeWidth="1" />
            <text x={cx} y={oy-26} textAnchor="middle" fontSize="10" fill="#1A1A1A" fontFamily="monospace" fontWeight="600">{formatDim(widthFt, unit)}</text>
            <line x1={ox+W+22} y1={oy} x2={ox+W+22} y2={oy+D} stroke="#1A1A1A" strokeWidth="1" />
            <line x1={ox+W+18} y1={oy} x2={ox+W+26} y2={oy} stroke="#1A1A1A" strokeWidth="1" />
            <line x1={ox+W+18} y1={oy+D} x2={ox+W+26} y2={oy+D} stroke="#1A1A1A" strokeWidth="1" />
            <text x={ox+W+34} y={cy+4} textAnchor="start" fontSize="10" fill="#1A1A1A" fontFamily="monospace" fontWeight="600">{formatDim(depthFt, unit)}</text>
            <line x1={ox} y1={oy+D+22} x2={ox+W} y2={oy+D+22} stroke="#1A1A1A" strokeWidth="1" />
            <line x1={ox} y1={oy+D+18} x2={ox} y2={oy+D+26} stroke="#1A1A1A" strokeWidth="1" />
            <line x1={ox+W} y1={oy+D+18} x2={ox+W} y2={oy+D+26} stroke="#1A1A1A" strokeWidth="1" />
            <text x={cx} y={oy+D+36} textAnchor="middle" fontSize="10" fill="#1A1A1A" fontFamily="monospace" fontWeight="600">{formatDim(widthFt, unit)}</text>
          </>
        )}
      </svg>
    </div>
  );
}

// ─── UTILS ───────────────────────────────────────────────────────────────────

function isPointInPolygon(pt: [number, number], poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > pt[1]) !== (yj > pt[1]))
        && (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── SPOTLIGHT COMPONENT ─────────────────────────────────────────────────────

const Spotlight = ({ x, z, h, visible }: { x: number; z: number; h: number; visible: boolean }) => {
  const [target, setTarget] = useState<THREE.Object3D | null>(null);
  return (
    <group>
      <object3D ref={setTarget} position={[x, 0, z]} />
      {visible && (
        <group>
          <mesh position={[x, h - 0.02, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.22, 0.04, 16]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={1.5} />
          </mesh>
          <mesh position={[x, h - 0.04, z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.22, 0.03, 8, 24]} />
            <meshStandardMaterial color="#ddd" roughness={0.2} />
          </mesh>
        </group>
      )}
      {target && (
        <spotLight
          position={[x, h - 0.1, z]}
          target={target}
          angle={Math.PI / 3.2}
          penumbra={0.7}
          intensity={3.5}
          distance={14}
          castShadow
          shadow-mapSize={[512, 512]}
          shadow-bias={-0.0001}
        />
      )}
    </group>
  );
};


// ─── THREE.JS ROTATABLE 3D ROOM ──────────────────────────────────────────────

function RoomScene({
  state,
  topView,
  setTopView,
  activeSideView,
  setActiveSideView,
  zoomTrigger,
  setZoomTrigger,
  setNumWalls,
  doorPlacement,
  setDoorPlacement,
  winPlacement,
  setWinPlacement,
  onChange,
}: {
  state: DesignState;
  topView: boolean;
  setTopView: (b: boolean) => void;
  activeSideView: number | null;
  setActiveSideView: (n: number | null) => void;
  zoomTrigger: 'in' | 'out' | null;
  setZoomTrigger: (t: 'in' | 'out' | null) => void;
  setNumWalls: (n: number) => void;
  doorPlacement: { wallIndex: number; offset: number; y: number };
  setDoorPlacement: React.Dispatch<React.SetStateAction<{ wallIndex: number; offset: number; y: number }>>;
  winPlacement: { wallIndex: number; offset: number; y: number };
  setWinPlacement: React.Dispatch<React.SetStateAction<{ wallIndex: number; offset: number; y: number }>>;
  onChange?: (s: Partial<DesignState>) => void;
}) {
  const { camera, gl } = useThree();
  const floor = FLOOR_STYLES.find(f => f.id === state.floorId)!;
  const wc = state.wallColor;
  
  // Draggable wall corners state with parent sync
  const [wallW, setWallW] = useState(state.widthFt);
  const [wallD, setWallD] = useState(state.depthFt);
  const h = 9.0;

  useEffect(() => {
    setWallW(state.widthFt);
  }, [state.widthFt]);

  useEffect(() => {
    setWallD(state.depthFt);
  }, [state.depthFt]);

  useEffect(() => {
    if (onChange) {
      onChange({ widthFt: Number(wallW.toFixed(2)), depthFt: Number(wallD.toFixed(2)) });
    }
  }, [wallW, wallD, onChange]);

  const w = wallW;
  const d = wallD;

  const isGlass = ['glass', 'glass-double', 'french-double'].includes(state.doorStyle);
  const isDouble = ['french-double', 'double-panel', 'bifold', 'glass-double'].includes(state.doorStyle);
  const DOOR_W = isDouble ? 4.0 : 2.8;
  const DOOR_H = 7.0;
  const WIN_W = 3.2;
  const WIN_H = 3.0;

  // Dragging states
  const doorGroupRef = useRef<any>(null);
  const winGroupRef  = useRef<any>(null);
  const dragging     = useRef<'door' | 'window' | null>(null);
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  // ── Room shape polygon (x, z) in world space ──
  const polygon = useMemo((): [number, number][] => {
    switch (state.shape) {
      case 'l-shape':  return [[-w/2,-d/2],[w/2,-d/2],[w/2,0],[w*0.05,0],[w*0.05,d/2],[-w/2,d/2]];
      case 'cut':      return [[-w/2,-d/2],[w*0.25,-d/2],[w/2,-d/2+d*0.28],[w/2,d/2],[-w/2,d/2]];
      case 't-shape':  return [[-w*0.22,-d/2],[w*0.22,-d/2],[w*0.22,-d*0.12],[w/2,-d*0.12],[w/2,d/2],[-w/2,d/2],[-w/2,-d*0.12],[-w*0.22,-d*0.12]];
      default:         return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
    }
  }, [state.shape, w, d]);

  // ShapeGeometry for floor / ceiling
  const floorGeom = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(polygon[0][0], -polygon[0][1]);
    for (let i = 1; i < polygon.length; i++) shape.lineTo(polygon[i][0], -polygon[i][1]);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 3);
  }, [polygon]);

  // Wall segments derived from polygon edges (ALL walls included for 360° view)
  const walls = useMemo(() => {
    return polygon.flatMap((p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      const dx  = q[0] - p[0];
      const dz  = q[1] - p[1];
      const len = Math.sqrt(dx * dx + dz * dz);
      // Inward normal: points towards center of room (interior side)
      // Polygon vertices go CLOCKWISE (top-down), so inward normal is (-dz, dx)
      const nx = -dz / len;  // inward X
      const nz =  dx / len;  // inward Z
      return [{
        p1: p,
        p2: q,
        cx: (p[0]+q[0])/2,
        cz: (p[1]+q[1])/2,
        len,
        rotY: Math.atan2(-dz, dx),
        nx,
        nz,
      }];
    });
  }, [polygon]);

  // Inform parent of number of walls
  useEffect(() => {
    setNumWalls(walls.length);
  }, [walls.length, setNumWalls]);

  // Clamp placements when walls change
  useEffect(() => {
    if (walls.length === 0) return;
    setDoorPlacement(prev => {
      const wallIdx = prev.wallIndex >= walls.length ? 0 : prev.wallIndex;
      const wall = walls[wallIdx];
      const maxOffset = Math.max(DOOR_W / 2 + 0.3, wall.len - DOOR_W / 2 - 0.3);
      const minOffset = Math.min(DOOR_W / 2 + 0.3, wall.len - DOOR_W / 2 - 0.3);
      const offset = Math.max(minOffset, Math.min(maxOffset, prev.offset));
      return { ...prev, wallIndex: wallIdx, offset };
    });
    setWinPlacement(prev => {
      const wallIdx = prev.wallIndex >= walls.length ? 0 : prev.wallIndex;
      const wall = walls[wallIdx];
      const maxOffset = Math.max(WIN_W / 2 + 0.3, wall.len - WIN_W / 2 - 0.3);
      const minOffset = Math.min(WIN_W / 2 + 0.3, wall.len - WIN_W / 2 - 0.3);
      const offset = Math.max(minOffset, Math.min(maxOffset, prev.offset));
      return { ...prev, wallIndex: wallIdx, offset };
    });
  }, [walls, DOOR_W, WIN_W, setDoorPlacement, setWinPlacement]);

  // Raycasting setups
  const raycasterRef = useMemo(() => new THREE.Raycaster(), []);
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  const getFloorHit = useCallback(
    (e: PointerEvent): THREE.Vector3 | null => {
      const rect = gl.domElement.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.setFromCamera(new THREE.Vector2(mx, my), camera);
      const pt = new THREE.Vector3();
      return raycasterRef.ray.intersectPlane(floorPlane, pt) ? pt : null;
    },
    [camera, gl, raycasterRef, floorPlane],
  );

  // Dragging event listener
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current || walls.length === 0) return;
      const pt = getFloorHit(e);
      if (!pt) return;

      // Find closest wall
      let closestWallIndex = 0;
      let closestDist = Infinity;
      let closestOffset = 0;

      walls.forEach((wall, idx) => {
        const p1 = wall.p1;
        const p2 = wall.p2;
        const dx = p2[0] - p1[0];
        const dz = p2[1] - p1[1];
        
        const ux = pt.x - p1[0];
        const uz = pt.z - p1[1];
        const dot = ux * dx + uz * dz;
        const wallLenSq = wall.len * wall.len;
        const t = Math.max(0, Math.min(1, wallLenSq > 0 ? dot / wallLenSq : 0));
        
        const projX = p1[0] + t * dx;
        const projZ = p1[1] + t * dz;
        const dist = Math.sqrt((pt.x - projX) ** 2 + (pt.z - projZ) ** 2);
        
        if (dist < closestDist) {
          closestDist = dist;
          closestWallIndex = idx;
          closestOffset = t * wall.len;
        }
      });

      const wall = walls[closestWallIndex];

      if (dragging.current === 'door') {
        const minOffset = DOOR_W / 2 + 0.3;
        const maxOffset = Math.max(minOffset, wall.len - DOOR_W / 2 - 0.3);
        const offset = Math.max(minOffset, Math.min(maxOffset, closestOffset));
        setDoorPlacement({ wallIndex: closestWallIndex, offset, y: 0 });
      } else {
        const minOffset = WIN_W / 2 + 0.3;
        const maxOffset = Math.max(minOffset, wall.len - WIN_W / 2 - 0.3);
        const offset = Math.max(minOffset, Math.min(maxOffset, closestOffset));

        const dx = wall.p2[0] - wall.p1[0];
        const dz = wall.p2[1] - wall.p1[1];
        const ux = dx / wall.len;
        const uz = dz / wall.len;
        const nx = -uz;
        const nz = ux;
        
        const wallPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          new THREE.Vector3(nx, 0, nz).normalize(),
          new THREE.Vector3(wall.cx, 0, wall.cz)
        );
        
        const wallPt = new THREE.Vector3();
        let heightY = 4.5;
        if (raycasterRef.ray.intersectPlane(wallPlane, wallPt)) {
          heightY = Math.max(1.5, Math.min(h - WIN_H / 2 - 0.4, wallPt.y));
        }

        setWinPlacement({ wallIndex: closestWallIndex, offset, y: heightY });
      }
    };

    const onUp = () => {
      if (dragging.current) {
        dragging.current = null;
        setOrbitEnabled(true);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [getFloorHit, walls, DOOR_W, WIN_W, WIN_H, h, raycasterRef, setDoorPlacement, setWinPlacement]);

  // Compute positions/rotations
  const doorPos = useMemo(() => {
    if (walls.length === 0 || doorPlacement.wallIndex >= walls.length) return new THREE.Vector3();
    const wall = walls[doorPlacement.wallIndex];
    const dx = wall.p2[0] - wall.p1[0];
    const dz = wall.p2[1] - wall.p1[1];
    const ux = dx / wall.len;
    const uz = dz / wall.len;
    const nx = -uz;
    const nz = ux;
    const bias = 0.05;
    return new THREE.Vector3(
      wall.p1[0] + ux * doorPlacement.offset + nx * bias,
      0,
      wall.p1[1] + uz * doorPlacement.offset + nz * bias
    );
  }, [walls, doorPlacement]);

  const doorRot = useMemo(() => {
    if (walls.length === 0 || doorPlacement.wallIndex >= walls.length) return 0;
    return walls[doorPlacement.wallIndex].rotY;
  }, [walls, doorPlacement]);

  const winPos = useMemo(() => {
    if (walls.length === 0 || winPlacement.wallIndex >= walls.length) return new THREE.Vector3();
    const wall = walls[winPlacement.wallIndex];
    const dx = wall.p2[0] - wall.p1[0];
    const dz = wall.p2[1] - wall.p1[1];
    const ux = dx / wall.len;
    const uz = dz / wall.len;
    const nx = -uz;
    const nz = ux;
    const bias = 0.05;
    return new THREE.Vector3(
      wall.p1[0] + ux * winPlacement.offset + nx * bias,
      winPlacement.y,
      wall.p1[1] + uz * winPlacement.offset + nz * bias
    );
  }, [walls, winPlacement]);

  const winRot = useMemo(() => {
    if (walls.length === 0 || winPlacement.wallIndex >= walls.length) return 0;
    return walls[winPlacement.wallIndex].rotY;
  }, [walls, winPlacement]);

  const controlsRef = useRef<any>(null);

  // Sync camera on top view toggle
  useEffect(() => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    
    if (topView) {
      controls.target.set(0, 0, 0);
      camera.position.set(0, Math.max(w, d) * 1.5, 0);
      controls.update();
    } else {
      controls.target.set(0, h * 0.28, 0);
      camera.position.set(w * 0.48, h * 0.52, d * 1.18);
      controls.update();
    }
  }, [topView, camera, w, d, h]);

  // Sync camera on side view focus
  useEffect(() => {
    if (activeSideView === null || !controlsRef.current || walls.length === 0) return;
    const controls = controlsRef.current;
    const wall = walls[activeSideView];
    if (!wall) return;
    
    const dx = wall.p2[0] - wall.p1[0];
    const dz = wall.p2[1] - wall.p1[1];
    const ux = dx / wall.len;
    const uz = dz / wall.len;
    const nx = -uz;
    const nz = ux;
    
    const viewDist = Math.max(w, d) * 0.8;
    camera.position.set(
      wall.cx + nx * viewDist,
      h * 0.5,
      wall.cz + nz * viewDist
    );
    controls.target.set(wall.cx, h * 0.5, wall.cz);
    controls.update();
    
    setTopView(false);
    setActiveSideView(null);
  }, [activeSideView, walls, w, d, h, camera, setActiveSideView, setTopView]);

  // Zoom controls trigger
  useEffect(() => {
    if (zoomTrigger === null || !controlsRef.current) return;
    const controls = controlsRef.current;
    const target = controls.target;
    const dir = new THREE.Vector3().subVectors(camera.position, target);
    
    if (zoomTrigger === 'in') {
      dir.multiplyScalar(0.8);
    } else {
      dir.multiplyScalar(1.25);
    }
    
    camera.position.addVectors(target, dir);
    controls.update();
    setZoomTrigger(null);
  }, [zoomTrigger, camera, setZoomTrigger]);

  // Wall material refs (for per-frame opacity control)
  const wallMatRefs   = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const wallSkirtRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  // Ceiling visibility + wall smart culling – single useFrame
  const [showCeiling, setShowCeiling] = useState(true);
  useFrame(() => {
    const camY        = camera.position.y;
    const aboveCeil   = camY > h * 1.05;
    const shouldShow  = !topView && !aboveCeil;
    if (shouldShow !== showCeiling) setShowCeiling(shouldShow);

    // Per-wall transparency: fade out when camera is on the exterior side
    walls.forEach((wall, i) => {
      const mat   = wallMatRefs.current[i];
      const skirt = wallSkirtRefs.current[i];
      if (!mat && !skirt) return;

      // Vector from wall centre to camera (XZ plane)
      const toCamX = camera.position.x - wall.cx;
      const toCamZ = camera.position.z - wall.cz;
      // Dot with inward normal: positive = inside, negative = outside
      const dot = toCamX * wall.nx + toCamZ * wall.nz;

      // Gradient: opaque when dot >= 1.5, transparent when dot <= 0
      const target = Math.max(0, Math.min(1, dot / 1.5));
      if (mat) {
        mat.opacity     = THREE.MathUtils.lerp(mat.opacity, target, 0.22);
        mat.transparent = true;
        mat.needsUpdate = true;
      }
      if (skirt) {
        skirt.opacity     = THREE.MathUtils.lerp(skirt.opacity, target, 0.22);
        skirt.transparent = true;
        skirt.needsUpdate = true;
      }
    });
  });

  // Spotlight points within boundary
  const boundingBox = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    polygon.forEach(([x, z]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    });
    return { minX, maxX, minZ, maxZ };
  }, [polygon]);

  const spotlights = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = boundingBox;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const cols = Math.max(2, Math.round(width / 5.5));
    const rows = Math.max(2, Math.round(depth / 5.5));
    
    const list: { x: number; z: number }[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = minX + (i + 0.5) * (width / cols);
        const z = minZ + (j + 0.5) * (depth / rows);
        if (isPointInPolygon([x, z], polygon)) {
          list.push({ x, z });
        }
      }
    }
    return list;
  }, [boundingBox, polygon]);

  const doorFrameColor = darken(wc, 35);
  const doorFillColor  = isGlass ? '#B9DCF0' : darken(wc, 22);
  const winW = WIN_W, winH = WIN_H;

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[w * 0.4, h * 1.2, d * 0.9]} intensity={0.35} castShadow />
      
      {spotlights.map((sl, index) => (
        <Spotlight key={index} x={sl.x} z={sl.z} h={h} visible={showCeiling} />
      ))}

      {/* Floor */}
      <mesh geometry={floorGeom} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color={floor.planks} roughness={0.85} metalness={0.02} side={THREE.DoubleSide} />
      </mesh>

      {/* Floor plank lines */}
      {Array.from({ length: 12 }, (_, i) => {
        const fz = -d / 2 + (i + 1) * (d / 13);
        return (
          <mesh key={`fpl${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, fz]}>
            <planeGeometry args={[w * 0.95, 0.04]} />
            <meshStandardMaterial color={floor.planksAlt} roughness={1} transparent opacity={0.3} />
          </mesh>
        );
      })}

      {/* Ceiling */}
      <mesh geometry={floorGeom} rotation={[-Math.PI / 2, 0, 0]} position={[0, h, 0]} visible={showCeiling}>
        <meshStandardMaterial color="#F2F0EC" roughness={1} side={THREE.DoubleSide} />
      </mesh>

      {/* Walls – fade out when camera is on exterior side */}
      {walls.map((wall, i) => (
        <React.Fragment key={`wall${i}`}>
          <mesh position={[wall.cx, h / 2, wall.cz]} rotation={[0, wall.rotY, 0]}>
            <planeGeometry args={[wall.len, h]} />
            <meshStandardMaterial
              ref={(m) => { wallMatRefs.current[i] = m; }}
              color={wc}
              roughness={0.88}
              side={THREE.DoubleSide}
              transparent
              opacity={1}
              depthWrite={false}
            />
          </mesh>
          {/* Skirting board */}
          <mesh position={[wall.cx, 0.18, wall.cz]} rotation={[0, wall.rotY, 0]}>
            <planeGeometry args={[wall.len, 0.36]} />
            <meshStandardMaterial
              ref={(m) => { wallSkirtRefs.current[i] = m; }}
              color={darken(wc, 14)}
              roughness={0.68}
              side={THREE.DoubleSide}
              transparent
              opacity={1}
              depthWrite={false}
            />
          </mesh>
        </React.Fragment>
      ))}

      {/* Wall Corner Resizing Handles */}
      {!topView && (
        <>
          <mesh
            position={[w / 2, h / 2, 0]}
            onPointerOver={(e) => { e.object.scale.set(1.3, 1.3, 1.3); }}
            onPointerOut={(e) => { e.object.scale.set(1, 1, 1); }}
            onPointerDown={(e) => {
              e.stopPropagation();
              const startX = e.clientX;
              const startW = w;
              const onMove = (evt: PointerEvent) => {
                const delta = evt.clientX - startX;
                const nextW = Math.max(4, Math.min(30, startW + delta * 0.03));
                setWallW(nextW);
              };
              const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
              };
              window.addEventListener('pointermove', onMove);
              window.addEventListener('pointerup', onUp);
            }}
          >
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#D4C5B9" transparent opacity={0.7} roughness={0.3} />
          </mesh>

          <mesh
            position={[0, h / 2, -d / 2]}
            onPointerOver={(e) => { e.object.scale.set(1.3, 1.3, 1.3); }}
            onPointerOut={(e) => { e.object.scale.set(1, 1, 1); }}
            onPointerDown={(e) => {
              e.stopPropagation();
              const startZ = e.clientX;
              const startD = d;
              const onMove = (evt: PointerEvent) => {
                const delta = evt.clientY - startZ;
                const nextD = Math.max(4, Math.min(30, startD - delta * 0.03));
                setWallD(nextD);
              };
              const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
              };
              window.addEventListener('pointermove', onMove);
              window.addEventListener('pointerup', onUp);
            }}
          >
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#D4C5B9" transparent opacity={0.7} roughness={0.3} />
          </mesh>
        </>
      )}

      {/* Door */}
      {state.doorStyle !== 'none' && (
        <group
          ref={doorGroupRef}
          position={doorPos}
          rotation={[0, doorRot, 0]}
          onPointerDown={(e) => {
            e.stopPropagation();
            dragging.current = 'door';
            setOrbitEnabled(false);
          }}
        >
          <mesh position={[0, DOOR_H + 0.5, 0]}>
            <torusGeometry args={[0.22, 0.04, 8, 24]} />
            <meshStandardMaterial color="#A0907A" transparent opacity={0.7} />
          </mesh>
          <mesh position={[0, DOOR_H / 2, 0]}>
            <boxGeometry args={[DOOR_W + 0.24, DOOR_H + 0.14, 0.09]} />
            <meshStandardMaterial color={doorFrameColor} roughness={0.65} />
          </mesh>
          {isDouble ? (
            <>
              <mesh position={[-(DOOR_W / 4), DOOR_H / 2, 0.05]}>
                <boxGeometry args={[DOOR_W / 2 - 0.08, DOOR_H - 0.1, 0.06]} />
                <meshStandardMaterial color={doorFillColor} roughness={isGlass ? 0.05 : 0.7} transparent={isGlass} opacity={isGlass ? 0.55 : 1} />
              </mesh>
              <mesh position={[DOOR_W / 4, DOOR_H / 2, 0.05]}>
                <boxGeometry args={[DOOR_W / 2 - 0.08, DOOR_H - 0.1, 0.06]} />
                <meshStandardMaterial color={doorFillColor} roughness={isGlass ? 0.05 : 0.7} transparent={isGlass} opacity={isGlass ? 0.55 : 1} />
              </mesh>
            </>
          ) : (
            <mesh position={[0, DOOR_H / 2, 0.05]}>
              <boxGeometry args={[DOOR_W - 0.1, DOOR_H - 0.08, 0.06]} />
              <meshStandardMaterial color={doorFillColor} roughness={isGlass ? 0.05 : 0.7} transparent={isGlass} opacity={isGlass ? 0.55 : 1} />
            </mesh>
          )}
          <mesh position={[DOOR_W * 0.32, DOOR_H * 0.46, 0.1]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color="#C0A060" roughness={0.3} metalness={0.6} />
          </mesh>
        </group>
      )}

      {/* Window */}
      <group
        ref={winGroupRef}
        position={winPos}
        rotation={[0, winRot, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          dragging.current = 'window';
          setOrbitEnabled(false);
        }}
      >
        <mesh position={[0, winH / 2 + 0.45, 0]}>
          <torusGeometry args={[0.22, 0.04, 8, 24]} />
          <meshStandardMaterial color="#A0907A" transparent opacity={0.7} />
        </mesh>
        <mesh>
          <boxGeometry args={[winW + 0.2, winH + 0.2, 0.11]} />
          <meshStandardMaterial color={darken(wc, 28)} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0, 0.07]}>
          <boxGeometry args={[winW - 0.04, winH - 0.04, 0.04]} />
          <meshStandardMaterial color="#B9DCF0" roughness={0.05} metalness={0.1} transparent opacity={0.52} />
        </mesh>
        <mesh position={[0, 0, 0.12]}>
          <boxGeometry args={[winW, 0.07, 0.03]} />
          <meshStandardMaterial color={darken(wc, 28)} />
        </mesh>
        <mesh position={[0, 0, 0.12]}>
          <boxGeometry args={[0.07, winH, 0.03]} />
          <meshStandardMaterial color={darken(wc, 28)} />
        </mesh>
        <mesh position={[0, -(winH / 2 + 0.07), 0.09]}>
          <boxGeometry args={[winW + 0.34, 0.13, 0.2]} />
          <meshStandardMaterial color={darken(wc, 20)} roughness={0.58} />
        </mesh>
      </group>

      <OrbitControls
        ref={controlsRef}
        enabled={orbitEnabled}
        target={[0, h * 0.28, 0]}
        enablePan={true}
        enableRotate={!topView}
        minDistance={d * 0.45}
        maxDistance={Math.max(w, d) * 1.9}
        maxPolarAngle={topView ? 0 : Math.PI * 0.78}
        minPolarAngle={topView ? 0 : Math.PI * 0.08}
        rotateSpeed={0.55}
        zoomSpeed={0.9}
      />
    </>
  );
}

function Room3DPreview({ state, onChange }: { state: DesignState; onChange?: (s: Partial<DesignState>) => void }) {
  const w = state.widthFt;
  const d = state.depthFt;
  const h = 9.0;
  
  const [topView, setTopView] = useState(false);
  const [activeSideView, setActiveSideView] = useState<number | null>(null);
  const [zoomTrigger, setZoomTrigger] = useState<'in' | 'out' | null>(null);
  const [numWalls, setNumWalls] = useState(0);

  const [doorPlacement, setDoorPlacement] = useState({ wallIndex: 0, offset: 3.5, y: 0 });
  const [winPlacement, setWinPlacement] = useState({ wallIndex: 0, offset: 9.0, y: 4.5 });

  // Update parent state on door/window placements
  useEffect(() => {
    if (onChange) {
      onChange({ doorPlacement, winPlacement });
    }
  }, [doorPlacement, winPlacement]);

  const getWallLabel = (idx: number) => {
    if (state.shape === 'rectangular') {
      if (idx === 0) return 'Wall 1 (Back)';
      if (idx === 1) return 'Wall 2 (Right)';
      if (idx === 2) return 'Wall 3 (Left)';
    }
    return `Wall ${idx + 1}`;
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#CACAC5', position: 'relative' }}>
      <Canvas
        camera={{ position: [w * 0.48, h * 0.52, d * 1.18], fov: 48 }}
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <RoomScene
            state={state}
            topView={topView}
            setTopView={setTopView}
            activeSideView={activeSideView}
            setActiveSideView={setActiveSideView}
            zoomTrigger={zoomTrigger}
            setZoomTrigger={setZoomTrigger}
            setNumWalls={setNumWalls}
            doorPlacement={doorPlacement}
            setDoorPlacement={setDoorPlacement}
            winPlacement={winPlacement}
            setWinPlacement={setWinPlacement}
            onChange={onChange}
          />
        </Suspense>
      </Canvas>

      {/* Control Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/85 backdrop-blur-md border border-gray-200 shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-4 z-20 transition-all duration-300">
        <button
          onClick={() => setTopView(false)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 ${
            !topView
              ? 'bg-[#1A1A1A] text-white shadow-md'
              : 'text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100/50'
          }`}
        >
          <Box size={13} />
          Dollhouse
        </button>

        <button
          onClick={() => setTopView(true)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 ${
            topView
              ? 'bg-[#1A1A1A] text-white shadow-md'
              : 'text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100/50'
          }`}
        >
          <Compass size={13} />
          Top View
        </button>

        {numWalls > 0 && (
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100/50 transition-all duration-300">
              <Eye size={13} />
              Side Views
              <ChevronDown size={10} className="ml-0.5 opacity-60" />
            </button>
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-xl rounded-xl py-1.5 hidden group-hover:flex flex-col min-w-[130px] z-30 transition-all duration-300">
              {Array.from({ length: numWalls }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSideView(idx)}
                  className="w-full text-center px-4 py-2 text-[10px] font-bold tracking-wider uppercase text-gray-700 hover:bg-gray-100/80 hover:text-[#1A1A1A] transition-colors"
                >
                  {getWallLabel(idx)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="w-[1px] h-5 bg-gray-200" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomTrigger('in')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100/50 transition-all duration-300"
            title="Zoom In"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setZoomTrigger('out')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100/50 transition-all duration-300"
            title="Zoom Out"
          >
            <Minus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SUCCESS MODAL ────────────────────────────────────────────────────────────

function SuccessModal({ design, onClose, onShop, onContact }: {
  design: DesignState;
  onClose: () => void;
  onShop: () => void;
  onContact: () => void;
}) {
  const floor = FLOOR_STYLES.find(f => f.id === design.floorId)!;
  const door  = DOOR_STYLES.find(d => d.id === design.doorStyle);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white max-w-md w-full mx-4 shadow-2xl">
        <div className="bg-[#1A1A1A] px-8 py-7 text-white">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle size={22} className="text-[#D4C5B9]" />
            <span className="text-xs font-bold tracking-widest uppercase text-[#D4C5B9]">Design Complete</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Your custom bathroom is ready!</h2>
          <p className="text-sm text-gray-400 font-light mt-2 leading-relaxed">
            Bring this design to our showroom in Matara and our experts will help you bring it to life.
          </p>
        </div>

        <div className="px-8 py-6 space-y-3 border-b border-gray-100">
          {[
            { label: 'Shape', value: design.shape.charAt(0).toUpperCase() + design.shape.slice(1) },
            { label: 'Size',  value: `${formatDim(design.widthFt, design.unit)} × ${formatDim(design.depthFt, design.unit)}` },
            { label: 'Door',  value: design.doorStyle === 'none' ? 'None' : `${door?.name ?? 'Single Panel'} (${design.doorPlacement ? `Wall ${design.doorPlacement.wallIndex + 1} at ${formatDim(design.doorPlacement.offset, design.unit)}` : 'Back Wall'})` },
            { label: 'Window', value: design.winPlacement ? `Wall ${design.winPlacement.wallIndex + 1} at ${formatDim(design.winPlacement.offset, design.unit)} (Height: ${formatDim(design.winPlacement.y, design.unit)})` : 'Back Wall' },
            { label: 'Floor', value: floor.name },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">{label}</span>
              <span className="text-sm font-semibold text-[#1A1A1A]">{value}</span>
            </div>
          ))}
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Wall Color</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border border-gray-200 rounded-sm" style={{ background: design.wallColor }} />
              <span className="text-xs font-mono text-gray-600">{design.wallColor}</span>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 flex flex-col gap-3">
          <button onClick={onShop}
            className="flex items-center justify-center gap-2 w-full bg-[#1A1A1A] hover:bg-[#333] text-white font-semibold text-xs tracking-widest uppercase py-4 transition-all">
            <ShoppingBag size={14} />
            Browse Matching Products
          </button>
          <button onClick={onContact}
            className="flex items-center justify-center gap-2 w-full border border-[#1A1A1A] hover:bg-gray-50 text-[#1A1A1A] font-semibold text-xs tracking-widest uppercase py-4 transition-all">
            <Phone size={14} />
            Contact Our Design Team
          </button>
          <button onClick={onClose}
            className="text-[10px] text-gray-400 hover:text-gray-700 font-semibold tracking-widest uppercase text-center py-2 transition-colors">
            Continue Designing
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── STEP 1: Shape ───────────────────────────────────────────────────────────

function Step1({ state, onChange }: { state: DesignState; onChange: (s: Partial<DesignState>) => void }) {
  const shapes: { id: RoomShape; label: string }[] = [
    { id: 'rectangular', label: 'Rectangular' },
    { id: 'l-shape',     label: 'L-Shape' },
    { id: 'cut',         label: 'Cut' },
    { id: 't-shape',     label: 'T-Shape' },
  ];
  return (
    <div className="grid grid-cols-2 gap-4">
      {shapes.map(({ id, label }) => {
        const active = state.shape === id;
        return (
          <button key={id} onClick={() => onChange({ shape: id })}
            className={`flex flex-col items-center gap-3 p-4 border-2 transition-all duration-200 ${active ? 'border-[#1A1A1A] bg-gray-50' : 'border-gray-200 hover:border-gray-400 bg-white'}`}>
            <div className="w-20 h-16"><ShapeSVG shape={id} selected={active} /></div>
            <span className={`text-xs font-semibold tracking-wide ${active ? 'text-[#1A1A1A]' : 'text-gray-500'}`}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── STEP 2: Dimensions ──────────────────────────────────────────────────────

function Step2({ state, onChange }: { state: DesignState; onChange: (s: Partial<DesignState>) => void }) {
  const fromCm = (c: number) => parseFloat((c / 30.48).toFixed(2));
  const { unit, widthFt, depthFt } = state;
  return (
    <div className="flex flex-col gap-7">
      <p className="text-sm text-gray-500 font-light leading-relaxed">
        Edit the floor plan dimensions below or drag the handles directly in the 3D room.
      </p>
      <div className="grid grid-cols-2 gap-3 p-1 bg-gray-100 rounded-full">
        {(['feet', 'cm'] as UnitSystem[]).map(u => (
          <button key={u} onClick={() => onChange({ unit: u })}
            className={`py-2 text-xs font-semibold tracking-widest uppercase rounded-full transition-all ${state.unit === u ? 'bg-white shadow text-[#1A1A1A]' : 'text-gray-400 hover:text-gray-600'}`}>
            {u === 'feet' ? 'Feet' : 'Centimeters'}
          </button>
        ))}
      </div>
      <div className="space-y-5">
        {([
          { label: 'Width', val: widthFt, key: 'widthFt' as const },
          { label: 'Depth', val: depthFt, key: 'depthFt' as const },
        ]).map(({ label, val, key }) => (
          <div key={key} className="flex flex-col gap-2">
            <label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
              {label} {unit === 'feet' ? '(feet)' : '(cm)'}
            </label>
            <input type="number"
              value={unit === 'feet' ? val : feetToCm(val)}
              step={unit === 'feet' ? 0.5 : 10}
              min={unit === 'feet' ? 4 : 120}
              max={unit === 'feet' ? 30 : 900}
              onChange={e => {
                const v = parseFloat(e.target.value) || 0;
                onChange({ [key]: unit === 'feet' ? v : fromCm(v) });
              }}
              className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A] font-mono transition-colors"
            />
            <span className="text-[10px] text-gray-400 font-light">
              Current: <strong className="text-gray-600">{formatDim(val, unit)}</strong>
            </span>
          </div>
        ))}
      </div>
      {/* Mini sketch */}
      <div className="border border-gray-200 p-4 bg-[#F9F9F7]">
        <svg viewBox="0 0 160 110" className="w-full h-20">
          <rect x="20" y="15" width="120" height="80" fill="none" stroke="#1A1A1A" strokeWidth="3" />
          <line x1="20" y1="15" x2="20" y2="95" stroke="#D4C5B9" strokeWidth="4" />
          {[[20,15],[140,15],[140,95],[20,95]].map(([cx,cy],i) => (
            <circle key={i} cx={cx} cy={cy} r={4} fill="white" stroke="#1A1A1A" strokeWidth="1.5" />
          ))}
          <line x1="20" y1="5" x2="140" y2="5" stroke="#999" strokeWidth="1" />
          <line x1="150" y1="15" x2="150" y2="95" stroke="#999" strokeWidth="1" />
          <text x="80" y="3" textAnchor="middle" fontSize="7" fill="#666" fontFamily="monospace">{formatDim(widthFt, unit)}</text>
          <text x="158" y="58" textAnchor="middle" fontSize="7" fill="#666" fontFamily="monospace">{formatDim(depthFt, unit)}</text>
        </svg>
      </div>
    </div>
  );
}

// ─── STEP 3: Doors & Windows ─────────────────────────────────────────────────

function Step3({ state, onChange }: { state: DesignState; onChange: (s: Partial<DesignState>) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xs font-bold tracking-widest text-[#1A1A1A] uppercase mb-4">Door styles</h3>
        <div className="grid grid-cols-3 gap-3">
          {DOOR_STYLES.map(d => {
            const active = state.doorStyle === d.id;
            return (
              <button key={d.id} onClick={() => onChange({ doorStyle: d.id })}
                className={`flex flex-col items-center gap-2 p-3 border-2 transition-all duration-200 ${active ? 'border-[#1A1A1A] bg-gray-50' : 'border-gray-200 hover:border-gray-400 bg-white'}`}>
                <div className="w-12 h-16"><DoorThumbnail style={d.id} /></div>
                <span className={`text-[9px] font-semibold text-center leading-tight ${active ? 'text-[#1A1A1A]' : 'text-gray-500'}`}>{d.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-gray-100 pt-5">
        <button onClick={() => onChange({ doorStyle: 'none' })}
          className={`w-full py-3 border-2 text-xs font-semibold tracking-widest uppercase transition-all ${state.doorStyle === 'none' ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
          No Door (Window Only)
        </button>
      </div>
    </div>
  );
}

// ─── STEP 4: Room Style ──────────────────────────────────────────────────────

function Step4({ state, onChange }: { state: DesignState; onChange: (s: Partial<DesignState>) => void }) {
  const currentFloor = FLOOR_STYLES.find(f => f.id === state.floorId)!;
  return (
    <div className="flex flex-col gap-7">
      <div>
        <h3 className="text-xs font-bold tracking-widest text-[#1A1A1A] uppercase mb-4">Wall color</h3>
        <div className="flex flex-col gap-2">
          {WALL_COLORS.map((row, ri) => (
            <div key={ri} className="flex gap-2">
              {row.map(color => (
                <button key={color} onClick={() => onChange({ wallColor: color })}
                  style={{ background: color }}
                  className={`w-10 h-10 border-2 transition-all duration-200 flex-shrink-0 ${state.wallColor === color ? 'border-[#1A1A1A] scale-110 shadow-md' : 'border-gray-200 hover:border-gray-400'}`}
                  title={color} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-gray-100 pt-5">
        <h3 className="text-xs font-bold tracking-widest text-[#1A1A1A] uppercase mb-1">Floor style</h3>
        <p className="text-[11px] text-gray-500 font-light mb-4">{currentFloor.name}</p>
        <div className="flex flex-col gap-2">
          {[FLOOR_STYLES.slice(0,6), FLOOR_STYLES.slice(6)].map((row, ri) => (
            <div key={ri} className="flex gap-2">
              {row.map(f => (
                <button key={f.id} onClick={() => onChange({ floorId: f.id })}
                  style={{ background: f.swatch }}
                  className={`w-10 h-10 border-2 transition-all duration-200 flex-shrink-0 ${state.floorId === f.id ? 'border-[#1A1A1A] scale-110 shadow-md' : 'border-gray-200 hover:border-gray-400'}`}
                  title={f.name} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN WIZARD ─────────────────────────────────────────────────────────────

export default function CustomDesignerPage() {
  const router = useRouter();
  const [design, setDesign] = useState<DesignState>(INITIAL);
  const [done, setDone] = useState(false);

  const update = (p: Partial<DesignState>) => setDesign(prev => ({ ...prev, ...p }));
  const goNext = () => { if (design.step < 4) update({ step: (design.step + 1) as DesignState['step'] }); };
  const goBack = () => { if (design.step > 1) update({ step: (design.step - 1) as DesignState['step'] }); else router.push('/'); };

  const TITLES = ['Set the shape and size', 'Adjust your dimensions', 'Add doors and windows', 'Choose your room style'];

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden select-none">

      {/* ── SUCCESS MODAL ── */}
      {done && (
        <SuccessModal
          design={design}
          onClose={() => setDone(false)}
          onShop={() => router.push('/products')}
          onContact={() => router.push('/contact')}
        />
      )}

      {/* ── LEFT PANEL ── */}
      <div className="w-[38%] min-w-[320px] flex flex-col border-r border-gray-100 bg-white overflow-y-auto">
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <button onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-gray-400 hover:text-[#1A1A1A] uppercase mb-5 transition-colors">
            <ArrowLeft size={12} /> Back to Showroom
          </button>
          <p className="text-[11px] font-bold tracking-widest text-[#D4C5B9] uppercase mb-1">Step {design.step} of 4</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">{TITLES[design.step - 1]}</h1>
          <div className="flex gap-1.5 mt-4">
            {[1,2,3,4].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= design.step ? 'bg-[#1A1A1A]' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        <div className="flex-1 px-8 py-6">
          {design.step === 1 && <Step1 state={design} onChange={update} />}
          {design.step === 2 && <Step2 state={design} onChange={update} />}
          {design.step === 3 && <Step3 state={design} onChange={update} />}
          {design.step === 4 && <Step4 state={design} onChange={update} />}
        </div>

        <div className="px-8 pb-8 pt-4 border-t border-gray-100 flex gap-3">
          {design.step > 1 && (
            <button onClick={goBack}
              className="flex-1 border border-gray-300 hover:border-[#1A1A1A] text-[#1A1A1A] font-semibold text-xs tracking-widest uppercase py-4 transition-all duration-300">
              Go back
            </button>
          )}
          {design.step < 4 ? (
            <button onClick={goNext}
              className={`font-semibold text-xs tracking-widest uppercase py-4 transition-all duration-300 flex items-center justify-center gap-2 bg-[#1A1A1A] hover:bg-[#333] text-white ${design.step > 1 ? 'flex-1' : 'w-full'}`}>
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={() => setDone(true)}
              className="flex-1 bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-semibold text-xs tracking-widest uppercase py-4 transition-all duration-300">
              Design this room
            </button>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL (Always 3D!) ── */}
      <div className="flex-1 overflow-hidden">
        <Room3DPreview state={design} onChange={update} />
      </div>
    </div>
  );
}
