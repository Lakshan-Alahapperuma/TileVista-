'use client';

import { useDesignerStore } from '../../store/designer.store';
import React, {
  useState,
  Suspense,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Canvas, useThree, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  ArrowLeft,
  X,
  Trash2,
  RotateCw,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import DesignerToolbar from './DesignerToolbar';
import ProductPanel from './ProductPanel';
import SaveDesignModal from './SaveDesignModal';
import { parseTileDimensions } from './tileCalculation';

export function remoteLog(message: string, ...args: any[]) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  fetch(`${apiUrl}/designer/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, args })
  }).catch(() => { });
}

// ─── TYPES 

import { RoomShape, UnitSystem, TileItemDetails } from '../../types/designer';

interface WallSplitDesign {
  splitMode: 'full' | 'horizontal' | 'vertical';
  tileColorBottom: string;
  tileColorTop: string;
  tileColorCenter: string;
  tileColorSides: string;
  textureUrl?: string;
  textureCoverageHeight?: number;
  tileAssetId?: string;
  tileItem?: TileItemDetails;
}

interface PlacedItem {
  id: string;
  type: string;
  name: string;
  cost: number;
  position: [number, number, number];
  rotation: number;
  color?: string;
  model?: string;
  image?: string;
  isWallMounted: boolean;
  rotationOffset?: number;
  scale?: { x?: number; y?: number; z?: number };
}

interface WallOpening {
  id: string;
  type: 'door' | 'window';
  style: string;
  name: string;
  wallIndex: number;
  positionOffset: number; // distance from start vertex in meters
  width: number;
  height: number;
  sillHeight: number; // height from floor in meters (0 for doors)
}

interface DesignState {
  widthFt: number;
  depthFt: number;
  heightFt: number;
  shape: RoomShape;
  unit: UnitSystem;
  floorColor: string;
  wallDesigns: WallSplitDesign[];
  designType: 'room' | 'bathroom';
  subRoomType?: 'dining_room' | 'bed_room' | 'living_room';
  wallOpenings: WallOpening[];
  floorTextureUrl?: string;
  floorTileItem?: TileItemDetails;
  wallTextureUrl?: string;
  wallTileItem?: TileItemDetails;
}


// ─── GEOMETRY HELPERS ───────────────────────────────────────────────────────

function pointInPolygon(pt: { x: number, z: number }, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], zi = -polygon[i][1];
    const xj = polygon[j][0], zj = -polygon[j][1];
    const intersect = ((zi > pt.z) !== (zj > pt.z))
      && (pt.x < (xj - xi) * (pt.z - zi) / (zj - zi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function closestPointOnPolygon(pt: { x: number, z: number }, polygon: [number, number][]): { x: number, z: number } {
  let closestDist = Infinity;
  let closestPt = { x: pt.x, z: pt.z };

  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const p1 = { x: polygon[i][0], z: -polygon[i][1] };
    const p2 = { x: polygon[j][0], z: -polygon[j][1] };

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const lenSq = dx * dx + dz * dz;

    let t = 0;
    if (lenSq > 0) {
      t = ((pt.x - p1.x) * dx + (pt.z - p1.z) * dz) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const projX = p1.x + t * dx;
    const projZ = p1.z + t * dz;
    const dist = Math.hypot(pt.x - projX, pt.z - projZ);

    if (dist < closestDist) {
      closestDist = dist;
      closestPt = { x: projX, z: projZ };
    }
  }
  return closestPt;
}

function isPointIn2DPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isItemFullyInsideRoom(x: number, z: number, width: number, depth: number, rotation: number, polygon: [number, number][]): boolean {
  const corners = getItemCorners(x, z, width, depth, rotation);
  return corners.every(c => isPointIn2DPolygon(c.x, c.z, polygon));
}

function getGuaranteedInsidePoint(polygon: [number, number][]): { x: number, z: number } {
  let sumX = 0, sumZ = 0;
  polygon.forEach(p => {
    sumX += p[0];
    sumZ += p[1];
  });
  const centerX = sumX / polygon.length;
  const centerZ = sumZ / polygon.length;

  if (isPointIn2DPolygon(centerX, centerZ, polygon)) {
    return { x: centerX, z: centerZ };
  }

  const v0 = polygon[0];
  const vx = v0[0];
  const vz = v0[1];

  for (let t = 0.1; t < 1.0; t += 0.1) {
    const tx = vx + (centerX - vx) * t;
    const tz = vz + (centerZ - vz) * t;
    if (isPointIn2DPolygon(tx, tz, polygon)) {
      return { x: tx, z: tz };
    }
  }
  return { x: vx, z: vz };
}

function clampItemToPolygon(
  pt: { x: number, z: number },
  width: number,
  depth: number,
  rotation: number,
  polygon: [number, number][],
  shape: string = 'rectangular',
  roomW: number = 10,
  roomD: number = 10,
  prevPt?: { x: number, z: number }
): { x: number, z: number } {
  const poly3D = polygon.map(p => ({ x: p[0], z: p[1] }));
  if (poly3D.length === 0) return pt;

  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  poly3D.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  });

  // Calculate rotated bounds to prevent clipping out of the room
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const rotatedW = width * cos + depth * sin;
  const rotatedD = depth * cos + width * sin;

  const bufferX = rotatedW / 2;
  const bufferZ = rotatedD / 2;

  // Clamp the item center inside the room boundaries
  const targetX = Math.max(minX + bufferX, Math.min(maxX - bufferX, pt.x));
  const targetZ = Math.max(minZ + bufferZ, Math.min(maxZ - bufferZ, pt.z));

  // If the target is fully inside the room shape, use it!
  if (isItemFullyInsideRoom(targetX, targetZ, width, depth, rotation, polygon)) {
    return { x: targetX, z: targetZ };
  }

  // If a valid previous position is provided, try to slide or fall back
  if (prevPt && isItemFullyInsideRoom(prevPt.x, prevPt.z, width, depth, rotation, polygon)) {
    // Try sliding in X
    if (isItemFullyInsideRoom(targetX, prevPt.z, width, depth, rotation, polygon)) {
      return { x: targetX, z: prevPt.z };
    }
    // Try sliding in Z
    if (isItemFullyInsideRoom(prevPt.x, targetZ, width, depth, rotation, polygon)) {
      return { x: prevPt.x, z: targetZ };
    }
    // Fall back to previous point
    return prevPt;
  }

  // Ray-march from a guaranteed inside point towards the target
  const start = getGuaranteedInsidePoint(polygon);
  let best = { x: start.x, z: start.z };

  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const testX = start.x + (targetX - start.x) * t;
    const testZ = start.z + (targetZ - start.z) * t;
    if (isItemFullyInsideRoom(testX, testZ, width, depth, rotation, polygon)) {
      best = { x: testX, z: testZ };
    } else {
      break;
    }
  }
  return best;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────


const TILE_COLORS = [
  { id: 'white', name: 'Metro White', hex: '#EAEAEA' },
  { id: 'gray', name: 'Slate Gray', hex: '#63666A' },
  { id: 'dark', name: 'Charcoal Black', hex: '#1E2022' },
  { id: 'blue', name: 'Oceanic Blue', hex: '#4A6FA5' },
  { id: 'green', name: 'Sage Green', hex: '#7A8B7B' },
  { id: 'gold', name: 'Sandstone Beige', hex: '#D2B48C' },
  { id: 'terracotta', name: 'Terracotta', hex: '#C07050' },
  { id: 'mosaic', name: 'Teal Mosaic', hex: '#2A7B88' },
];

const FLOOR_TILES = [
  { id: 'dark-gray', name: 'Dark Slate', hex: '#34383C' },
  { id: 'light-gray', name: 'Light Cement', hex: '#AEB4B8' },
  { id: 'black', name: 'Ebony Marble', hex: '#1A1A1C' },
  { id: 'wood-deck', name: 'Teak Plank', hex: '#8B5A2B' },
];

const ITEM_CATALOG = [
  { type: 'sink', name: 'Vanity Cabinet Sink', cost: 249.99, isWallMounted: false },
  { type: 'bathtub', name: 'Freestanding Bath', cost: 599.99, isWallMounted: false },
  { type: 'shower', name: 'Walk-In Shower Box', cost: 449.99, isWallMounted: false },
  { type: 'toilet', name: 'Wall-Hung Toilet', cost: 199.99, isWallMounted: false },
  { type: 'towel_rail', name: 'Chrome Towel Ladder', cost: 119.99, isWallMounted: true },
  { type: 'washing_machine', name: 'Eco Wash Machine', cost: 349.99, isWallMounted: false },
  { type: 'light', name: 'Vanity Mirror Light', cost: 79.99, isWallMounted: true },
  { type: 'plant', name: 'Deco Ceramic Plant', cost: 44.99, isWallMounted: false },
];

const INITIAL_WALL_DESIGN: WallSplitDesign = {
  splitMode: 'full',
  tileColorBottom: '#ffffff',
  tileColorTop: '#ffffff',
  tileColorCenter: '#ffffff',
  tileColorSides: '#ffffff',
};

const INITIAL: DesignState = {
  widthFt: 12.0,
  depthFt: 9.0,
  heightFt: 8.5,
  shape: 'rectangular',
  unit: 'feet',
  floorColor: '#ffffff',
  wallDesigns: Array(8).fill(null).map(() => ({ ...INITIAL_WALL_DESIGN })),
  designType: 'bathroom',
  subRoomType: 'living_room',
  wallOpenings: [],
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function feetToCm(ft: number) { return Math.round(ft * 30.48); }
function cmToFeet(cm: number) { return parseFloat((cm / 30.48).toFixed(2)); }
function fromCm(c: number) { return parseFloat((c / 30.48).toFixed(2)); }

function getWallSegments(wallLength: number, wallIndex: number, openings: WallOpening[]) {
  const wallOpenings = openings
    .filter(op => Number(op.wallIndex) === Number(wallIndex))
    .sort((a, b) => a.positionOffset - b.positionOffset);

  const segments: { start: number; end: number; type: 'solid' | 'opening'; opening?: WallOpening }[] = [];
  let cur = 0;

  for (const op of wallOpenings) {
    const opWidth = op.width;
    const opStart = Math.max(cur, op.positionOffset - opWidth / 2);
    const opEnd = Math.min(wallLength, op.positionOffset + opWidth / 2);

    if (opStart > cur) {
      segments.push({ start: cur, end: opStart, type: 'solid' });
    }
    if (opEnd > opStart) {
      segments.push({ start: opStart, end: opEnd, type: 'opening', opening: op });
    }
    cur = opEnd;
  }

  if (cur < wallLength) {
    segments.push({ start: cur, end: wallLength, type: 'solid' });
  }

  return segments;
}

function getOverlap(minA: number, maxA: number, minB: number, maxB: number): [number, number] | null {
  const start = Math.max(minA, minB);
  const end = Math.min(maxA, maxB);
  return start < end ? [start, end] : null;
}

// Tile texture cache (canvas-generated with grout lines)
const tileTextureCache: Record<string, any> = {};
const clonedTextureCache = new Map<string, any>();

function getTileTexture(color: string, repeatX: number, repeatY: number): any {
  const key = `${color}_${repeatX}_${repeatY}`;
  if (tileTextureCache[key]) return tileTextureCache[key];

  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(180,184,188,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, 126, 126);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tileTextureCache[key] = tex;
  return tex;
}

function getWoodTexture(color: string, repeatX: number, repeatY: number): any {
  const key = `wood_${color}_${repeatX}_${repeatY}`;
  if (tileTextureCache[key]) return tileTextureCache[key];

  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Solid wood background color
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);

    // Draw wood plank lines (subtle dark separators)
    ctx.strokeStyle = 'rgba(40, 25, 10, 0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      const y = i * 64;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }

    // Draw offset vertical joints (staggered wood planks)
    for (let i = 0; i < 4; i++) {
      const y = i * 64;
      const offset = (i % 2) * 64;
      for (let j = 0; j < 3; j++) {
        const x = j * 128 + offset;
        ctx.beginPath();
        ctx.moveTo(x % 256, y);
        ctx.lineTo(x % 256, y + 64);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tileTextureCache[key] = tex;
  return tex;
}

// ─── LIVING ROOM & NORMAL ROOM ICONS ─────────────────────────────────────────

const SOFA_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 10V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" />
    <path d="M2 14v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4" />
    <path d="M2 14h20v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5Z" />
    <path d="M6 14v4M18 14v4" />
  </svg>
);
const BED_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 4v16M22 4v16M2 8h20M2 17h20" />
    <rect x="5" y="10" width="6" height="4" rx="1" />
    <rect x="13" y="10" width="6" height="4" rx="1" />
  </svg>
);
const TABLE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 8h18M6 8v12M18 8v12M10 8v8M14 8v8" />
  </svg>
);
const CHAIR_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M7 20V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
    <path d="M4 11h16M7 11V20M17 11V20" />
  </svg>
);
const WARDROBE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M12 3v18M9 11v2M15 11v2" />
  </svg>
);
const TV_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="5" width="18" height="11" rx="2" />
    <path d="M12 16v4M8 20h8" />
  </svg>
);
const COFFEE_TABLE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <ellipse cx="12" cy="9" rx="8" ry="3" />
    <path d="M6 10v9M18 10v9M10 12v6M14 12v6" />
  </svg>
);

const OPENINGS_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M3 11h6M15 11h6M15 3v8" />
  </svg>
);

const WALL_COLORS_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="13.5" cy="6.5" r=".5" />
    <circle cx="17.5" cy="10.5" r=".5" />
    <circle cx="8.5" cy="7.5" r=".5" />
    <circle cx="6.5" cy="12.5" r=".5" />
    <path d="M12 2C6.5 2 2 6.5 2 12s5 10 10 10c1.2 0 2.2-1 2.2-2.2 0-.6-.2-1.1-.6-1.5-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h1.4c3 0 5.5-2.5 5.5-5.5C22 6.5 17.5 2 12 2z" />
  </svg>
);

const OSPOS_TILES_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const MIRROR_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <ellipse cx="12" cy="12" rx="6" ry="9" />
    <path d="M12 3v18" opacity="0.3" />
  </svg>
);
const DRESSING_TABLE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="12" width="18" height="9" rx="1" />
    <rect x="7" y="3" width="10" height="9" rx="1" />
  </svg>
);
const RUG_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="6" width="16" height="12" rx="1" />
    <path d="M4 10h16M4 14h16" opacity="0.5" />
  </svg>
);

// ─── DYNAMIC CATALOG & CATEGORIES ───────────────────────────────────────────


function MirrorModel({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[1.5, 2.0, 0.1]} />
        <meshStandardMaterial color="#CCCCCC" metalness={1.0} roughness={0.0} />
      </mesh>
      {selected && (
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[1.55, 2.05, 0.15]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function RugModel({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 5]} />
        <meshStandardMaterial color="#916147" roughness={1.0} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.1, 5.1]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

const isBathtub = (type?: string, name?: string) => {
  const t = (type || '').toLowerCase();
  const n = (name || '').toLowerCase();
  return (
    t === 'bathtub' ||
    t === 'bath' ||
    t === 'tub' ||
    n.includes('bath tub') ||
    n.includes('bathtub') ||
    n.includes('bath') ||
    n.includes('tub') ||
    n.includes('soaker') ||
    n.includes('jacuzzi') ||
    n.includes('freestanding') ||
    n.includes('oval')
  );
};

const isShower = (type?: string, name?: string) => {
  const t = (type || '').toLowerCase();
  const n = (name || '').toLowerCase();
  return t === 'shower' || n.includes('shower');
};

const isSink = (type?: string, name?: string) => {
  const t = (type || '').toLowerCase();
  const n = (name || '').toLowerCase();
  return t === 'sink' || t === 'basin' || n.includes('sink') || n.includes('basin');
};

export function getDefaultMountHeight(type?: string, name?: string): number {
  const t = (type || '').toLowerCase();
  const n = (name || '').toLowerCase();

  if (t === 'sink' || t === 'basin' || n.includes('sink') || n.includes('basin')) {
    return 0.85; // Ergonomic 85cm height from floor for wall-hung wash basins
  }
  if (t === 'toilet' || n.includes('toilet') || n.includes('closet') || n.includes('wc') || n.includes('commode')) {
    return 0.45; // Ergonomic 45cm height from floor for wall-hung toilets
  }
  if (t === 'shower' || n.includes('shower') || n.includes('mixer')) {
    if (n.includes('column') || n.includes('riser') || n.includes('system') || n.includes('exposed') || n.includes('thermostatic')) {
      return 1.00; // Exposed column base at 1.0m -> top rain head reaches 2.10m
    }
    return 2.10; // Wall rain shower head / arm / hand shower: mounted overhead at 2.10m
  }
  if (t === 'mirror' || n.includes('mirror') || t === 'light' || n.includes('light')) {
    return 1.45; // Eye-level height for mirrors & vanity lights
  }
  if (t === 'towel_rail' || n.includes('towel') || n.includes('holder') || n.includes('soap') || n.includes('paper') || n.includes('hook')) {
    return 1.10; // Accessories / towel rail height
  }
  return 0.85; // Default fallback wall mount height
}

export function checkIsWallMounted(item: any): boolean {
  if (!item) return false;

  const nameLower = (item.name || '').toLowerCase();
  const catLower = (item.category || '').toLowerCase();
  const typeLower = (item.type || '').toLowerCase();
  const subcatId = item.subcategoryId !== null && item.subcategoryId !== undefined ? Number(item.subcategoryId) : null;

  // 1. Explicit floor items (pedestals, floor closets, bathtubs, enclosures)
  if (
    nameLower.includes('floor mounted') ||
    nameLower.includes('floor-mounted') ||
    nameLower.includes('pedestal') ||
    nameLower.includes('freestanding') ||
    nameLower.includes('free standing') ||
    nameLower.includes('enclosure') ||
    nameLower.includes('bathtub') ||
    nameLower.includes('bath tub') ||
    nameLower.includes('cabin') ||
    nameLower.includes('box') ||
    typeLower === 'bathtub'
  ) {
    return false;
  }

  // 2. Explicit wall-mounted flag if specified
  if (item.isWallMounted === true) return true;
  if (item.isWallMounted === false) return false;

  // 3. Known wall-mounted item keywords (wall-hung sinks, dew point, mirrors, towel rails, lights, wall toilets)
  if (
    nameLower.includes('wall') ||
    nameLower.includes('hung') ||
    nameLower.includes('wall-hung') ||
    nameLower.includes('wall mounted') ||
    nameLower.includes('dew point') ||
    nameLower.includes('half pedestal') ||
    nameLower.includes('floating') ||
    nameLower.includes('mirror') ||
    nameLower.includes('towel') ||
    nameLower.includes('soap') ||
    nameLower.includes('paper') ||
    nameLower.includes('hook') ||
    nameLower.includes('holder') ||
    nameLower.includes('light') ||
    (nameLower.includes('shower') && !nameLower.includes('enclosure') && !nameLower.includes('box')) ||
    subcatId === 17
  ) {
    return true;
  }

  return false;
}

export function calculateRealWorldScale(item: any, size: THREE.Vector3): number {
  if (!size || size.x <= 0 || size.y <= 0 || size.z <= 0) return 1.0;

  const t = (item.type || '').toLowerCase();
  const nameLower = (item.name || '').toLowerCase();
  const maxDim = Math.max(size.x, size.y, size.z);
  const horizDim = Math.max(size.x, size.z);

  // Target physical dimensions in real-world METERS
  let targetWorldMeters = 0.70;
  let scaleDimension = maxDim; // Default to max dimension of GLB model

  if (isSink(t, nameLower)) {
    const aspectRatio = size.y / horizDim;
    if (aspectRatio < 0.75 || checkIsWallMounted(item)) {
      // Wall-hung basin / counter basin: scale width to 0.65 meters (65 cm)
      targetWorldMeters = 0.65;
      scaleDimension = horizDim;
    } else {
      // Pedestal basin: scale total height to 0.90 meters (90 cm)
      targetWorldMeters = 0.90;
      scaleDimension = size.y;
    }
  } else if (t === 'toilet' || nameLower.includes('toilet') || nameLower.includes('closet') || nameLower.includes('wc') || nameLower.includes('commode')) {
    const aspectRatio = size.y / horizDim;
    if (aspectRatio < 0.75 || nameLower.includes('wall')) {
      targetWorldMeters = 0.60; // Wall-hung toilet: 60 cm depth
      scaleDimension = horizDim;
    } else {
      targetWorldMeters = 0.82; // Floor toilet with tank: 82 cm height (2.7 ft)
      scaleDimension = size.y;
    }
  } else if (isBathtub(t, nameLower)) {
    targetWorldMeters = 2.10; // Bathtub length: 2.10 meters (210 cm / 6.9 ft)
    scaleDimension = maxDim;
  } else if (isShower(t, nameLower)) {
    if (nameLower.includes('enclosure') || nameLower.includes('box') || nameLower.includes('cabin')) {
      targetWorldMeters = 2.15; // Shower glass box / enclosure height: 215 cm
      scaleDimension = size.y;
    } else if (nameLower.includes('column') || nameLower.includes('riser') || nameLower.includes('system') || nameLower.includes('exposed') || nameLower.includes('thermostatic') || (size.y / horizDim) > 1.5) {
      targetWorldMeters = 1.10; // Shower column height: 110 cm
      scaleDimension = size.y;
    } else {
      targetWorldMeters = 0.45; // Wall shower head / mixer set: 45 cm
      scaleDimension = maxDim;
    }
  } else if (t === 'washing_machine' || nameLower.includes('wash') || nameLower.includes('machine')) {
    targetWorldMeters = 0.90; // Washing machine height: 90 cm
    scaleDimension = size.y;
  } else if (t === 'mirror' || nameLower.includes('mirror')) {
    targetWorldMeters = 0.85; // Mirror max dimension: 85 cm
    scaleDimension = maxDim;
  } else if (t === 'light' || nameLower.includes('light')) {
    targetWorldMeters = 0.40; // Light max dimension: 40 cm
    scaleDimension = maxDim;
  } else if (t === 'towel_rail' || nameLower.includes('towel') || nameLower.includes('holder') || nameLower.includes('soap') || nameLower.includes('paper') || nameLower.includes('hook')) {
    targetWorldMeters = 0.60; // Accessories max dimension: 60 cm
    scaleDimension = maxDim;
  } else if (t === 'beds' || t === 'bed') {
    targetWorldMeters = 2.10; // Bed length/width: 210 cm
    scaleDimension = horizDim;
  } else if (t === 'sofa' || t === 'sofas') {
    targetWorldMeters = 2.20; // Sofa length: 220 cm
    scaleDimension = horizDim;
  } else if (t === 'wardrobes' || t === 'wardrobe') {
    targetWorldMeters = 2.20; // Wardrobe height: 220 cm
    scaleDimension = size.y;
  } else if (t === 'table' || t === 'dressing_table') {
    targetWorldMeters = 1.60; // Table length: 160 cm
    scaleDimension = horizDim;
  } else if (t === 'chair' || t === 'chairs') {
    targetWorldMeters = 0.95; // Chair height: 95 cm
    scaleDimension = size.y;
  } else if (t === 'tv_cabinet' || t === 'cabinet') {
    targetWorldMeters = 1.60; // Cabinet length: 160 cm
    scaleDimension = horizDim;
  } else if (t === 'coffee_table') {
    targetWorldMeters = 1.10; // Coffee table length: 110 cm
    scaleDimension = horizDim;
  } else {
    targetWorldMeters = 0.90; // Default fallback: 90 cm
    scaleDimension = maxDim;
  }

  // Convert targetWorldMeters to target size in group internal units (divided by 0.3048)
  const targetGroupSize = targetWorldMeters / 0.3048;

  if (scaleDimension > 0 && scaleDimension !== Infinity && !isNaN(scaleDimension)) {
    return targetGroupSize / scaleDimension;
  }
  return 1.0;
}

class ModelErrorBoundary extends React.Component<
  { item: any; selected: boolean; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn("GLTF Model load failed, using fallback:", error);
  }
  render() {
    if (this.state.hasError) {
      return <FallbackColoredBox item={this.props.item} selected={this.props.selected} />;
    }
    return this.props.children;
  }
}

function DynamicFurnitureModel({ item, selected, CustomFurniture }: { item: any, selected: boolean, CustomFurniture?: any }) {
  // If a GLB model exists, ALWAYS prioritize it over procedural models with safety error boundary
  if (item.model) {
    return (
      <ModelErrorBoundary item={item} selected={selected}>
        <React.Suspense fallback={<FallbackModel item={item} selected={selected} />}>
          <GLBModel url={item.model} selected={selected} item={item} />
        </React.Suspense>
      </ModelErrorBoundary>
    );
  }

  if (CustomFurniture) {
    return <CustomFurniture item={item} selected={selected} />;
  }
  return <FallbackColoredBox item={item} selected={selected} />;
}

function GLBModel({ url, selected, item }: { url: string, selected: boolean, item: any }) {
  const { state } = useDesignerStore();
  const STATIC_BASE = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : 'http://localhost:4000';
  const fullUrl = url.startsWith('/uploads') ? `${STATIC_BASE}${url}` : url;
  const { scene } = useGLTF(fullUrl) as any;
  const clonedScene = React.useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone();

    // Fix materials
    clone.traverse((node: any) => {
      if (node.material) {
        // Fix for "material.onBuild is not a function" on any object
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((mat: any) => {
          if (mat && typeof mat.onBuild !== 'function') {
            mat.onBuild = function () { };
          }
        });
      }
    });

    // Auto-scale to a realistic size based on category type
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);

    let scale = calculateRealWorldScale(item, size);

    // Cap scale based on room size so items don't overflow small rooms
    if (state && (state.widthFt || (state as any).width) && (state.depthFt || (state as any).length)) {
      const rawW = state.widthFt ?? (state as any).width ?? 12;
      const rawD = state.depthFt ?? (state as any).length ?? 9;
      const wMeters = rawW > 25 ? rawW * 0.3048 : (rawW > 10 ? rawW * 0.3048 : rawW);
      const dMeters = rawD > 25 ? rawD * 0.3048 : (rawD > 10 ? rawD * 0.3048 : rawD);

      const isBathtubItem = isBathtub(item.type, item.name);
      if (isBathtubItem) {
        const maxRoomDim = Math.max(wMeters, dMeters);
        const maxTargetWorldSize = Math.max(1.80, maxRoomDim * 0.95);
        const currentTargetWorldSize = (Math.max(size.x, size.y, size.z) * scale) * 0.3048;

        if (currentTargetWorldSize > maxTargetWorldSize) {
          scale = scale * (maxTargetWorldSize / currentTargetWorldSize);
        }
      } else {
        const maxRoomDim = Math.min(Math.max(1.5, wMeters), Math.max(1.5, dMeters));
        const limitFactor = (item.type === 'beds' || item.type === 'bed' || item.type === 'sofa' || item.type === 'sofas') ? 0.95 : 0.85;
        const maxTargetWorldSize = maxRoomDim * limitFactor;
        const currentTargetWorldSize = (Math.max(size.x, size.y, size.z) * scale) * 0.3048;

        if (currentTargetWorldSize > maxTargetWorldSize) {
          scale = scale * (maxTargetWorldSize / currentTargetWorldSize);
        }
      }
    }

    console.log("GLB Size:", size, "Scale:", scale);
    if (scale > 0 && scale !== Infinity && !isNaN(scale)) {
      // Apply base scale and custom asset scale transformations if defined
      const sx = item.scale?.x ? Number(item.scale.x) : 1;
      const sy = item.scale?.y ? Number(item.scale.y) : 1;
      const sz = item.scale?.z ? Number(item.scale.z) : 1;
      clone.scale.set(scale * sx, scale * sy, scale * sz);
    } else {
      console.warn("Invalid scale for GLB", scale);
    }

    // Apply custom asset rotation transformations if defined
    if (item.rotationY !== undefined && item.rotationY !== null) {
      const ry = Number(item.rotationY) * (Math.PI / 180);
      clone.rotation.set(0, ry, 0);
    } else if (item.rotation && typeof item.rotation === 'object') {
      const rx = item.rotation.x ? Number(item.rotation.x) * (Math.PI / 180) : 0;
      const ry = item.rotation.y ? Number(item.rotation.y) * (Math.PI / 180) : 0;
      const rz = item.rotation.z ? Number(item.rotation.z) * (Math.PI / 180) : 0;
      clone.rotation.set(rx, ry, rz);
    }

    // Recalculate box to center and ground the model
    box.setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);

    clone.position.x = -center.x;
    clone.position.y = -box.min.y;
    clone.position.z = -center.z;

    // Compute final size after scaling
    const finalBox = new THREE.Box3().setFromObject(clone);
    const finalSize = new THREE.Vector3();
    finalBox.getSize(finalSize);

    if (item && item.id) {
      // Store exact world dimensions (finalSize is scaled locally, 0.3048 is the parent group scale)
      globalItemDimensions.set(item.id, {
        width: finalSize.x * 0.3048,
        depth: finalSize.z * 0.3048,
        height: finalSize.y * 0.3048
      });
    }

    return { clone, finalSize, finalCenter: [0, finalSize.y / 2, 0] };
  }, [scene, item.type]);

  const modelRotation = [0, 0, 0];
  const position = [0, 0, 0];

  return (
    <group position={position as any} rotation={modelRotation as any}>
      {clonedScene && <primitive object={clonedScene.clone} />}
      {selected && clonedScene && (
        <mesh position={clonedScene.finalCenter as any}>
          <boxGeometry args={[clonedScene.finalSize.x, clonedScene.finalSize.y, clonedScene.finalSize.z]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function FallbackModel({ item, selected }: { item: any, selected: boolean }) {
  if (item.image) {
    return (
      <React.Suspense fallback={
        <FallbackColoredBox item={item} selected={selected} />
      }>
        <ImageTextureModel url={item.image} item={item} selected={selected} />
      </React.Suspense>
    );
  }
  return <FallbackColoredBox item={item} selected={selected} />;
}

// A global cache to store exact physical dimensions of loaded GLB items
// so the drag-and-drop collision logic can be pixel-perfect without causing React re-renders.
export const globalItemDimensions = new Map<string, { width: number, depth: number, height?: number }>();

function FallbackColoredBox({ item, selected }: { item: any, selected: boolean }) {
  const rotation = item.isWallMounted ? [0, 0, 0] : [-Math.PI / 2, 0, 0];
  const position = [0, 0, 0];
  const itemColor = item.color || '#FFFFFF';
  return (
    <group>
      <mesh position={position as any} rotation={rotation as any}>
        <planeGeometry args={[3, 3]} />
        <meshStandardMaterial color={itemColor} />
      </mesh>
      {selected && (
        <mesh position={position as any} rotation={rotation as any}>
          <planeGeometry args={[3.1, 3.1]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function ImageTextureModel({ url, item, selected }: { url: string, item: any, selected: boolean }) {
  const texture = useLoader(THREE.TextureLoader as any, url) as any;
  const rotation = item.isWallMounted ? [0, 0, 0] : [-Math.PI / 2, 0, 0];
  const position = [0, 0, 0];
  const itemColor = item.color || '#FFFFFF';
  return (
    <group>
      <mesh position={position as any} rotation={rotation as any}>
        <planeGeometry args={[3, 3]} />
        <meshStandardMaterial map={texture as any} transparent={true} color={itemColor} />
      </mesh>
      {selected && (
        <mesh position={position as any} rotation={rotation as any}>
          <planeGeometry args={[3.1, 3.1]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

export function getActiveCatalog(designType: 'room' | 'bathroom', subRoomType?: 'dining_room' | 'bed_room' | 'living_room') {
  if (designType === 'room') {
    let items = [
      { type: 'sofa', name: 'Modern 3-Seater Sofa', cost: 499.99, isWallMounted: false },
      { type: 'bed', name: 'King Size Bed Frame', cost: 699.99, isWallMounted: false },
      { type: 'table', name: 'Wooden Dining Table', cost: 299.99, isWallMounted: false },
      { type: 'chair', name: 'Upholstered Dining Chair', cost: 89.99, isWallMounted: false },
      { type: 'wardrobe', name: 'Double Wardrobe Cabinet', cost: 399.99, isWallMounted: false },
      { type: 'tv_cabinet', name: 'Media Console & TV', cost: 249.99, isWallMounted: false },
      { type: 'coffee_table', name: 'Minimalist Coffee Table', cost: 149.99, isWallMounted: false },
      { type: 'plant', name: 'Tall Floor Fiddle Leaf', cost: 59.99, isWallMounted: false },
      { type: 'dressing_table', name: 'Vanity Dressing Table', cost: 229.99, isWallMounted: false },
      { type: 'mirror', name: 'Wall Mounted Mirror', cost: 99.99, isWallMounted: true },
      { type: 'runner', name: 'Floor Runner Rug', cost: 49.99, isWallMounted: false },
      { type: 'rug', name: 'Large Area Rug', cost: 129.99, isWallMounted: false },
      { type: 'cabinet', name: 'Display Cabinet', cost: 349.99, isWallMounted: false },
    ];
    if (subRoomType === 'dining_room') {
      return items.filter(i => ['table', 'cabinet', 'rug', 'plant'].includes(i.type));
    } else if (subRoomType === 'bed_room') {
      return items.filter(i => ['bed', 'wardrobe', 'dressing_table', 'mirror', 'runner', 'rug', 'tv_cabinet', 'plant'].includes(i.type));
    } else if (subRoomType === 'living_room') {
      return items.filter(i => ['sofa', 'tv_cabinet', 'coffee_table', 'rug', 'plant'].includes(i.type));
    }
    return items;
  }
  return [
    { type: 'sink', name: 'Vanity Cabinet Sink', cost: 249.99, isWallMounted: false },
    { type: 'bathtub', name: 'Freestanding Bath', cost: 599.99, isWallMounted: false },
    { type: 'shower', name: 'Walk-In Shower Box', cost: 449.99, isWallMounted: false },
    { type: 'toilet', name: 'Wall-Hung Toilet', cost: 199.99, isWallMounted: false },
    { type: 'towel_rail', name: 'Chrome Towel Ladder', cost: 119.99, isWallMounted: true },
    { type: 'washing_machine', name: 'Eco Wash Machine', cost: 349.99, isWallMounted: false },
    { type: 'light', name: 'Vanity Mirror Light', cost: 79.99, isWallMounted: true },
    { type: 'plant', name: 'Deco Ceramic Plant', cost: 44.99, isWallMounted: false },
  ];
}

export function getActiveCategories(designType: 'room' | 'bathroom', subRoomType?: 'dining_room' | 'bed_room' | 'living_room') {
  const common = [
    { id: 'openings', label: 'Doors & Windows', icon: OPENINGS_ICON },
    { id: 'wall_colours', label: 'Wall Colours', icon: WALL_COLORS_ICON },
    { id: 'ospos_tiles', label: 'Load Tiles', icon: OSPOS_TILES_ICON }
  ];
  if (designType === 'room') {
    let cats = [
      { id: 'sofa', label: 'Sofa & Lounge', icon: SOFA_ICON },
      { id: 'bed', label: 'Beds', icon: BED_ICON },
      { id: 'wardrobe', label: 'Wardrobes', icon: WARDROBE_ICON },
      { id: 'dressing_table', label: 'Dressing Table', icon: DRESSING_TABLE_ICON },
      { id: 'mirror', label: 'Mirrors', icon: MIRROR_ICON },
      { id: 'runner', label: 'Runners', icon: RUG_ICON },
      { id: 'rug', label: 'Rugs', icon: RUG_ICON },
      { id: 'table', label: 'Dining Tables', icon: TABLE_ICON },
      { id: 'chair', label: 'Chairs', icon: CHAIR_ICON },
      { id: 'cabinet', label: 'Display Cabinets', icon: WARDROBE_ICON },
      { id: 'tv_cabinet', label: 'TV & Console', icon: TV_ICON },
      { id: 'coffee_table', label: 'Coffee Tables', icon: COFFEE_TABLE_ICON },
      { id: 'plant', label: 'Decor Plants', icon: ACCESSORIES_ICON },
    ];
    if (subRoomType === 'dining_room') {
      cats = cats.filter(c => ['table', 'cabinet', 'rug', 'plant'].includes(c.id));
    } else if (subRoomType === 'bed_room') {
      cats = [
        { id: 'beds', label: 'Beds', icon: BED_ICON },
        { id: 'wardrobes', label: 'Wardrobes', icon: WARDROBE_ICON },
        { id: 'dressing_table', label: 'Dressing Table', icon: DRESSING_TABLE_ICON },
        { id: 'mirror', label: 'Mirrors', icon: MIRROR_ICON },
        { id: 'runners_and_small_rugs', label: 'Runners and Small Rugs', icon: RUG_ICON },
      ];
    } else if (subRoomType === 'living_room') {
      cats = cats.filter(c => ['sofa', 'tv_cabinet', 'coffee_table', 'rug', 'plant'].includes(c.id));
    }
    return [
      ...common,
      ...cats
    ];
  }
  return [
    ...common,
    { id: 'sink', label: 'Wash Basin', icon: SINK_ICON },
    { id: 'bathtub', label: 'Bathtubs', icon: BATHTUB_ICON },
    { id: 'towel_rail', label: 'Towel Rails', icon: TOWEL_RAIL_ICON },
    { id: 'shower', label: 'Shower Cabin', icon: SHOWER_ICON },
    { id: 'toilet', label: 'Toilets', icon: TOILET_ICON },
    { id: 'washing_machine', label: 'Wash Machines', icon: WASHING_MACHINE_ICON },
    { id: 'light', label: 'Lighting', icon: LIGHT_ICON },
    { id: 'plant', label: 'Plants & Decor', icon: ACCESSORIES_ICON },
  ];
}
export const renderDoorIcon = (style: string) => {
  switch (style) {
    case 'single_door':
      return (
        <svg viewBox="0 0 40 60" className="w-10 h-16 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="32" height="52" rx="1" fill="#fcfcfc" />
          <line x1="8" y1="4" x2="8" y2="56" />
          <circle cx="30" cy="30" r="2" fill="currentColor" />
        </svg>
      );
    case 'glass_door':
      return (
        <svg viewBox="0 0 40 60" className="w-10 h-16 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="32" height="52" rx="1" fill="#fcfcfc" />
          <rect x="10" y="10" width="20" height="40" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1" />
          <circle cx="32" cy="30" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'french_door':
      return (
        <svg viewBox="0 0 60 60" className="w-14 h-14 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="4" width="22" height="52" fill="#fcfcfc" />
          <rect x="32" y="4" width="22" height="52" fill="#fcfcfc" />
          <rect x="10" y="8" width="14" height="12" fill="#e0f2fe" />
          <rect x="10" y="24" width="14" height="12" fill="#e0f2fe" />
          <rect x="10" y="40" width="14" height="12" fill="#e0f2fe" />
          <rect x="36" y="8" width="14" height="12" fill="#e0f2fe" />
          <rect x="36" y="24" width="14" height="12" fill="#e0f2fe" />
          <rect x="36" y="40" width="14" height="12" fill="#e0f2fe" />
        </svg>
      );
    case 'double_door':
      return (
        <svg viewBox="0 0 60 60" className="w-14 h-14 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="4" width="22" height="52" fill="#fcfcfc" />
          <rect x="32" y="4" width="22" height="52" fill="#fcfcfc" />
          <line x1="12" y1="4" x2="12" y2="56" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="48" y1="4" x2="48" y2="56" strokeWidth="1" strokeDasharray="2,2" />
          <circle cx="24" cy="30" r="1.5" fill="currentColor" />
          <circle cx="36" cy="30" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'bifold_door':
      return (
        <svg viewBox="0 0 60 60" className="w-14 h-14 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="4" width="10" height="52" fill="#fcfcfc" />
          <rect x="17" y="4" width="10" height="52" fill="#fcfcfc" />
          <rect x="33" y="4" width="10" height="52" fill="#fcfcfc" />
          <rect x="44" y="4" width="10" height="52" fill="#fcfcfc" />
        </svg>
      );
    case 'glass_double_door':
      return (
        <svg viewBox="0 0 60 60" className="w-14 h-14 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="4" width="22" height="52" fill="#fcfcfc" />
          <rect x="32" y="4" width="22" height="52" fill="#fcfcfc" />
          <rect x="10" y="8" width="14" height="44" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1" />
          <rect x="36" y="8" width="14" height="44" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1" />
        </svg>
      );
    case 'bathroom_window':
      return (
        <svg viewBox="0 0 40 40" className="w-10 h-10 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="6" width="28" height="28" rx="2" fill="#f4f4f5" stroke="#10b981" strokeWidth="2" />
          <rect x="10" y="10" width="20" height="20" fill="#ccfbf1" stroke="#0d9488" strokeWidth="1" />
          <line x1="20" y1="10" x2="20" y2="30" stroke="#0d9488" strokeWidth="1" />
          <line x1="10" y1="20" x2="30" y2="20" stroke="#0d9488" strokeWidth="1" />
        </svg>
      );
    case 'small_window':
      return (
        <svg viewBox="0 0 40 40" className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="10" width="28" height="20" rx="1" fill="#fcfcfc" />
          <rect x="10" y="14" width="20" height="12" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1" />
        </svg>
      );
    case 'standard_window':
      return (
        <svg viewBox="0 0 40 40" className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="32" height="32" rx="1" fill="#fcfcfc" />
          <line x1="20" y1="4" x2="20" y2="36" />
          <line x1="4" y1="20" x2="36" y2="20" />
          <rect x="8" y="8" width="8" height="8" fill="#e0f2fe" />
          <rect x="24" y="8" width="8" height="8" fill="#e0f2fe" />
          <rect x="8" y="24" width="8" height="8" fill="#e0f2fe" />
          <rect x="24" y="24" width="8" height="8" fill="#e0f2fe" />
        </svg>
      );
    case 'double_window':
      return (
        <svg viewBox="0 0 60 40" className="w-14 h-10 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="52" height="32" rx="1" fill="#fcfcfc" />
          <line x1="30" y1="4" x2="30" y2="36" />
          <line x1="17" y1="4" x2="17" y2="36" strokeWidth="1" strokeDasharray="2,2" />
          <line x1="43" y1="4" x2="43" y2="36" strokeWidth="1" strokeDasharray="2,2" />
          <rect x="8" y="8" width="18" height="24" fill="#e0f2fe" />
          <rect x="34" y="8" width="18" height="24" fill="#e0f2fe" />
        </svg>
      );
    case 'large_window':
      return (
        <svg viewBox="0 0 60 40" className="w-14 h-10 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="52" height="32" rx="1" fill="#fcfcfc" />
          <rect x="8" y="8" width="44" height="24" fill="#e0f2fe" stroke="#38bdf8" />
        </svg>
      );
    default:
      return null;
  }
};

// ─── DOORS & WINDOWS DEFINITIONS ───────────────────────────────────────────

export const DOOR_STYLES = [
  { id: 'single_door', name: 'Single Panel Door', width: 0.9, height: 2.0, sillHeight: 0 },
  { id: 'glass_door', name: 'Glass Door', width: 0.9, height: 2.0, sillHeight: 0 },
  { id: 'french_door', name: 'French Double Door', width: 1.6, height: 2.0, sillHeight: 0 },
  { id: 'double_door', name: 'Double Panel Door', width: 1.6, height: 2.0, sillHeight: 0 },
  { id: 'bifold_door', name: 'Bifold Panel Double Door', width: 1.6, height: 2.0, sillHeight: 0 },
  { id: 'glass_double_door', name: 'Glass Double Door', width: 1.8, height: 2.0, sillHeight: 0 },
];

export const WINDOW_STYLES = [
  { id: 'bathroom_window', name: 'Bathroom Privacy Window', width: 0.6, height: 0.6, sillHeight: 1.6 },
  { id: 'small_window', name: 'Small Awning Window', width: 0.8, height: 0.6, sillHeight: 1.5 },
  { id: 'standard_window', name: 'Standard Window', width: 1.0, height: 1.2, sillHeight: 0.9 },
  { id: 'double_window', name: 'Double Window', width: 1.6, height: 1.2, sillHeight: 0.9 },
  { id: 'large_window', name: 'Large Glass Window', width: 2.0, height: 1.8, sillHeight: 0.3 },
];

function getDoorWoodTexture(baseColor: string, grainColor: string): any {
  const key = `door_wood_${baseColor}_${grainColor}`;
  if (tileTextureCache[key]) return tileTextureCache[key];

  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Base solid wood color
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    // Draw vertical wood grain fibers
    ctx.strokeStyle = grainColor;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 300; i++) {
      ctx.globalAlpha = 0.04 + Math.random() * 0.1;
      const x = Math.random() * 512;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      let currentX = x;
      for (let y = 0; y <= 512; y += 32) {
        currentX += Math.sin(y * 0.04 + x * 0.2) * 1.5;
        ctx.lineTo(currentX, y);
      }
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tileTextureCache[key] = tex;
  return tex;
}

function Door3D({ style, width, height, depth = 0.08, opacity = 1.0 }: { style: string; width: number; height: number; depth?: number; opacity?: number }) {
  const isGlass = style.includes('glass') || style.includes('french');
  const isDouble = style.includes('double') || style.includes('french');
  const isBifold = style.includes('bifold');

  // Let's create white lacquer for glass/french doors and rich walnut for standard panels
  const woodTexture: any = useMemo(() => {
    return isGlass
      ? getDoorWoodTexture('#f4f4f5', '#e4e4e7')
      : getDoorWoodTexture('#5c4033', '#2d1e17');
  }, [isGlass]);

  const frameColor = isGlass ? '#e4e4e7' : '#4e3629';

  // Render casing helper (front and back architrave)
  const Casing = () => (
    <>
      {/* Front Architrave */}
      <mesh position={[-width / 2 - 0.03, height / 2 + 0.015, depth / 2 + 0.01]}>
        <boxGeometry args={[0.06, height + 0.03, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.65} />
      </mesh>
      <mesh position={[width / 2 + 0.03, height / 2 + 0.015, depth / 2 + 0.01]}>
        <boxGeometry args={[0.06, height + 0.03, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.65} />
      </mesh>
      <mesh position={[0, height + 0.02, depth / 2 + 0.01]}>
        <boxGeometry args={[width + 0.12, 0.06, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.65} />
      </mesh>

      {/* Back Architrave */}
      <mesh position={[-width / 2 - 0.03, height / 2 + 0.015, -depth / 2 - 0.01]}>
        <boxGeometry args={[0.06, height + 0.03, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.65} />
      </mesh>
      <mesh position={[width / 2 + 0.03, height / 2 + 0.015, -depth / 2 - 0.01]}>
        <boxGeometry args={[0.06, height + 0.03, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.65} />
      </mesh>
      <mesh position={[0, height + 0.02, -depth / 2 - 0.01]}>
        <boxGeometry args={[width + 0.12, 0.06, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.65} />
      </mesh>
    </>
  );

  // Render Handle helper
  const DoorHandle = ({ xPos, zPos, rotY }: { xPos: number; zPos: number; rotY: number }) => (
    <group position={[xPos, height / 2, zPos]} rotation={[0, rotY, 0]}>
      {/* Chrome backing plate */}
      <mesh position={[0, 0, 0.005]}>
        <boxGeometry args={[0.04, 0.18, 0.008]} />
        <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Lock cylinder keyhole representation */}
      <mesh position={[0, -0.05, 0.01]}>
        <boxGeometry args={[0.01, 0.02, 0.005]} />
        <meshStandardMaterial color="#333333" roughness={0.9} />
      </mesh>
      {/* Handle base shaft sticking out */}
      <mesh position={[0, 0.03, 0.025]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.04, 12]} />
        <meshStandardMaterial color="#dddddd" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* Horizontal lever handle */}
      <mesh position={[-0.04, 0.03, 0.045]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.1, 12]} />
        <meshStandardMaterial color="#dddddd" metalness={0.95} roughness={0.05} />
      </mesh>
      {/* Rounded end cap for handle lever */}
      <mesh position={[-0.09, 0.03, 0.045]}>
        <sphereGeometry args={[0.008, 12, 12]} />
        <meshStandardMaterial color="#dddddd" metalness={0.95} roughness={0.05} />
      </mesh>
    </group>
  );

  // Render single panel details helper
  const PanelDetails = ({ wPanel, hPanel }: { wPanel: number; hPanel: number }) => (
    <>
      {/* Two raised bevel panels (upper & lower) */}
      <mesh position={[0, height * 0.7, 0.005]}>
        <boxGeometry args={[wPanel - 0.08, height * 0.35, 0.006]} />
        <meshStandardMaterial map={woodTexture} roughness={0.4} />
      </mesh>
      <mesh position={[0, height * 0.28, 0.005]}>
        <boxGeometry args={[wPanel - 0.08, height * 0.38, 0.006]} />
        <meshStandardMaterial map={woodTexture} roughness={0.4} />
      </mesh>
      {/* Inset shadow moldings */}
      <mesh position={[0, height * 0.7, 0.002]}>
        <boxGeometry args={[wPanel - 0.05, height * 0.38, 0.002]} />
        <meshStandardMaterial color={isGlass ? "#cbd5e0" : "#2f1f17"} roughness={0.8} />
      </mesh>
      <mesh position={[0, height * 0.28, 0.002]}>
        <boxGeometry args={[wPanel - 0.05, height * 0.41, 0.002]} />
        <meshStandardMaterial color={isGlass ? "#cbd5e0" : "#2f1f17"} roughness={0.8} />
      </mesh>
    </>
  );

  const groupRef = useRef<any>(null);
  React.useLayoutEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.traverse((child: any) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat: any) => {
          if (mat) {
            mat.transparent = true;
            if (mat.userData.originalOpacity === undefined) {
              mat.userData.originalOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
            }
            if (mat.userData.originalTransparent === undefined) {
              mat.userData.originalTransparent = true;
            }
            mat.opacity = mat.userData.originalOpacity * opacity;
            mat.depthWrite = opacity >= 1.0;
          }
        });
      }
    });
  }, [opacity]);

  return (
    <group ref={groupRef}>
      {/* Frame Jam */}
      <mesh position={[-width / 2 - 0.01, height / 2, 0]}>
        <boxGeometry args={[0.02, height, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.7} />
      </mesh>
      <mesh position={[width / 2 + 0.01, height / 2, 0]}>
        <boxGeometry args={[0.02, height, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.7} />
      </mesh>
      <mesh position={[0, height + 0.01, 0]}>
        <boxGeometry args={[width + 0.04, 0.02, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.7} />
      </mesh>

      <Casing />

      {/* Render Slabs */}
      {isDouble ? (
        <>
          {/* Left panel - opens outwards 25 degrees */}
          <group position={[-width / 2, 0, 0]} rotation={[0, 0.4, 0]}>
            <group position={[width / 4, 0, 0]}>
              {/* Wood slab */}
              <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width / 2 - 0.01, height - 0.02, 0.04]} />
                <meshStandardMaterial map={woodTexture} roughness={0.4} />
              </mesh>

              {/* French Glass Window panes */}
              {isGlass ? (
                <>
                  <mesh position={[0, height / 2, 0]}>
                    <boxGeometry args={[width / 2 - 0.12, height - 0.24, 0.015]} />
                    <meshStandardMaterial color="#e0f2fe" transparent opacity={0.22} roughness={0.05} metalness={0.95} />
                  </mesh>
                  {/* Grid bars */}
                  <mesh position={[0, height / 2, 0.009]}>
                    <boxGeometry args={[width / 2 - 0.12, 0.02, 0.018]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} />
                  </mesh>
                  <mesh position={[0, height * 0.3, 0.009]}>
                    <boxGeometry args={[width / 2 - 0.12, 0.02, 0.018]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} />
                  </mesh>
                  <mesh position={[0, height * 0.7, 0.009]}>
                    <boxGeometry args={[width / 2 - 0.12, 0.02, 0.018]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} />
                  </mesh>
                </>
              ) : (
                <PanelDetails wPanel={width / 2 - 0.01} hPanel={height} />
              )}
            </group>

            {/* Handle on Left panel */}
            <DoorHandle xPos={width / 2 - 0.06} zPos={0.02} rotY={0} />
            <DoorHandle xPos={width / 2 - 0.06} zPos={-0.02} rotY={Math.PI} />
          </group>

          {/* Right panel - opens outwards 25 degrees */}
          <group position={[width / 2, 0, 0]} rotation={[0, -0.4, 0]}>
            <group position={[-width / 4, 0, 0]}>
              {/* Wood slab */}
              <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width / 2 - 0.01, height - 0.02, 0.04]} />
                <meshStandardMaterial map={woodTexture} roughness={0.4} />
              </mesh>

              {/* French Glass Window panes */}
              {isGlass ? (
                <>
                  <mesh position={[0, height / 2, 0]}>
                    <boxGeometry args={[width / 2 - 0.12, height - 0.24, 0.015]} />
                    <meshStandardMaterial color="#e0f2fe" transparent opacity={0.22} roughness={0.05} metalness={0.95} />
                  </mesh>
                  {/* Grid bars */}
                  <mesh position={[0, height / 2, 0.009]}>
                    <boxGeometry args={[width / 2 - 0.12, 0.02, 0.018]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} />
                  </mesh>
                  <mesh position={[0, height * 0.3, 0.009]}>
                    <boxGeometry args={[width / 2 - 0.12, 0.02, 0.018]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} />
                  </mesh>
                  <mesh position={[0, height * 0.7, 0.009]}>
                    <boxGeometry args={[width / 2 - 0.12, 0.02, 0.018]} />
                    <meshStandardMaterial color={frameColor} roughness={0.6} />
                  </mesh>
                </>
              ) : (
                <PanelDetails wPanel={width / 2 - 0.01} hPanel={height} />
              )}
            </group>
          </group>
        </>
      ) : isBifold ? (
        <>
          {/* Left folded bifold panel */}
          <group position={[-width / 2, 0, 0]} rotation={[0, 0.8, 0]}>
            <mesh position={[width / 8, height / 2, 0]}>
              <boxGeometry args={[width / 4 - 0.01, height - 0.02, 0.035]} />
              <meshStandardMaterial map={woodTexture} roughness={0.4} />
            </mesh>
            <group position={[width / 4, 0, 0]} rotation={[0, -1.5, 0]}>
              <mesh position={[width / 8, height / 2, 0]}>
                <boxGeometry args={[width / 4 - 0.01, height - 0.02, 0.035]} />
                <meshStandardMaterial map={woodTexture} roughness={0.4} />
              </mesh>
            </group>
          </group>

          {/* Right folded bifold panel */}
          <group position={[width / 2, 0, 0]} rotation={[0, -0.8, 0]}>
            <mesh position={[-width / 8, height / 2, 0]}>
              <boxGeometry args={[width / 4 - 0.01, height - 0.02, 0.035]} />
              <meshStandardMaterial map={woodTexture} roughness={0.4} />
            </mesh>
            <group position={[-width / 4, 0, 0]} rotation={[0, 1.5, 0]}>
              <mesh position={[-width / 8, height / 2, 0]}>
                <boxGeometry args={[width / 4 - 0.01, height - 0.02, 0.035]} />
                <meshStandardMaterial map={woodTexture} roughness={0.4} />
              </mesh>
            </group>
          </group>
        </>
      ) : (
        /* Single door panel */
        <group position={[-width / 2, 0, 0]} rotation={[0, 0.35, 0]}>
          <group position={[width / 2, 0, 0]}>
            <mesh position={[0, height / 2, 0]}>
              <boxGeometry args={[width - 0.01, height - 0.02, 0.04]} />
              <meshStandardMaterial map={woodTexture} roughness={0.4} />
            </mesh>

            {/* Glass panel vs Recessed Panel details */}
            {isGlass ? (
              <>
                <mesh position={[0, height / 2, 0]}>
                  <boxGeometry args={[width - 0.16, height - 0.28, 0.015]} />
                  <meshStandardMaterial color="#e0f2fe" transparent opacity={0.22} roughness={0.05} metalness={0.95} />
                </mesh>
                {/* Muntin grids */}
                <mesh position={[0, height / 2, 0.009]}>
                  <boxGeometry args={[width - 0.16, 0.02, 0.018]} />
                  <meshStandardMaterial color={frameColor} roughness={0.6} />
                </mesh>
                <mesh position={[0, height * 0.3, 0.009]}>
                  <boxGeometry args={[width - 0.16, 0.02, 0.018]} />
                  <meshStandardMaterial color={frameColor} roughness={0.6} />
                </mesh>
                <mesh position={[0, height * 0.7, 0.009]}>
                  <boxGeometry args={[width - 0.16, 0.02, 0.018]} />
                  <meshStandardMaterial color={frameColor} roughness={0.6} />
                </mesh>
              </>
            ) : (
              <PanelDetails wPanel={width - 0.01} hPanel={height} />
            )}
          </group>

          {/* Handles */}
          <DoorHandle xPos={width - 0.07} zPos={0.02} rotY={0} />
          <DoorHandle xPos={width - 0.07} zPos={-0.02} rotY={Math.PI} />
        </group>
      )}
    </group>
  );
}

function Window3D({ style, width, height, depth = 0.08, opacity = 1.0 }: { style: string; width: number; height: number; depth?: number; opacity?: number }) {
  const isDouble = style.includes('double');
  const isLarge = style.includes('large');

  const frameColor = '#f4f4f5'; // Premium vinyl window white

  // Outer casing border (front & back)
  const WindowCasing = () => (
    <>
      {/* Front Casing */}
      <mesh position={[-width / 2 - 0.025, height / 2, depth / 2 + 0.01]}>
        <boxGeometry args={[0.05, height + 0.05, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[width / 2 + 0.025, height / 2, depth / 2 + 0.01]}>
        <boxGeometry args={[0.05, height + 0.05, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.025, depth / 2 + 0.01]}>
        <boxGeometry args={[width + 0.1, 0.05, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[0, height + 0.025, depth / 2 + 0.01]}>
        <boxGeometry args={[width + 0.1, 0.05, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>

      {/* Back Casing */}
      <mesh position={[-width / 2 - 0.025, height / 2, -depth / 2 - 0.01]}>
        <boxGeometry args={[0.05, height + 0.05, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[width / 2 + 0.025, height / 2, -depth / 2 - 0.01]}>
        <boxGeometry args={[0.05, height + 0.05, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.025, -depth / 2 - 0.01]}>
        <boxGeometry args={[width + 0.1, 0.05, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[0, height + 0.025, -depth / 2 - 0.01]}>
        <boxGeometry args={[width + 0.1, 0.05, 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
    </>
  );

  const groupRef = useRef<any>(null);
  React.useLayoutEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.traverse((child: any) => {
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat: any) => {
          if (mat) {
            mat.transparent = true;
            if (mat.userData.originalOpacity === undefined) {
              mat.userData.originalOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
            }
            if (mat.userData.originalTransparent === undefined) {
              mat.userData.originalTransparent = true;
            }
            mat.opacity = mat.userData.originalOpacity * opacity;
            mat.depthWrite = opacity >= 1.0;
          }
        });
      }
    });
  }, [opacity]);

  return (
    <group ref={groupRef}>
      {/* Outer frame core jam */}
      <mesh position={[-width / 2 - 0.01, height / 2, 0]}>
        <boxGeometry args={[0.02, height, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[width / 2 + 0.01, height / 2, 0]}>
        <boxGeometry args={[0.02, height, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.01, 0]}>
        <boxGeometry args={[width + 0.04, 0.02, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[0, height + 0.01, 0]}>
        <boxGeometry args={[width + 0.04, 0.02, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>

      <WindowCasing />

      {/* Render Sashes */}
      {isLarge ? (
        <>
          {/* Minimalist large picture window - double pane side by side */}
          <group position={[-width / 4, height / 2, 0]}>
            {/* Left Glass */}
            <mesh>
              <boxGeometry args={[width / 2 - 0.05, height - 0.1, 0.02]} />
              <meshStandardMaterial color="#e0f2fe" transparent opacity={0.22} roughness={0.05} metalness={0.95} />
            </mesh>
            {/* Sash Frame */}
            <mesh position={[0, 0, 0.01]}>
              <boxGeometry args={[width / 2 - 0.04, height - 0.08, 0.02]} />
              <meshStandardMaterial color={frameColor} roughness={0.5} wireframe={true} />
            </mesh>
          </group>

          <group position={[width / 4, height / 2, 0]}>
            {/* Right Glass */}
            <mesh>
              <boxGeometry args={[width / 2 - 0.05, height - 0.1, 0.02]} />
              <meshStandardMaterial color="#e0f2fe" transparent opacity={0.22} roughness={0.05} metalness={0.95} />
            </mesh>
          </group>

          {/* Center divider post */}
          <mesh position={[0, height / 2, 0]}>
            <boxGeometry args={[0.06, height, depth + 0.02]} />
            <meshStandardMaterial color={frameColor} roughness={0.5} />
          </mesh>
        </>
      ) : isDouble ? (
        <>
          {/* Double slider window sashes */}
          {/* Left sash - slightly in front */}
          <group position={[-width / 4 + 0.01, height / 2, 0.02]}>
            <mesh>
              <boxGeometry args={[width / 2 - 0.03, height - 0.08, 0.025]} />
              <meshStandardMaterial color={frameColor} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0, 0.002]}>
              <boxGeometry args={[width / 2 - 0.09, height - 0.14, 0.015]} />
              <meshStandardMaterial color="#e0f2fe" transparent opacity={0.22} roughness={0.05} metalness={0.95} />
            </mesh>
          </group>

          {/* Right sash - slightly in back */}
          <group position={[width / 4 - 0.01, height / 2, -0.02]}>
            <mesh>
              <boxGeometry args={[width / 2 - 0.03, height - 0.08, 0.025]} />
              <meshStandardMaterial color={frameColor} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0, -0.002]}>
              <boxGeometry args={[width / 2 - 0.09, height - 0.14, 0.015]} />
              <meshStandardMaterial color="#e0f2fe" transparent opacity={0.22} roughness={0.05} metalness={0.95} />
            </mesh>
          </group>

          {/* Meeting rail chrome locks */}
          <group position={[0, height / 2, 0.02]}>
            <mesh>
              <boxGeometry args={[0.02, 0.08, 0.03]} />
              <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Latch Lever */}
            <mesh position={[0, 0, 0.025]} rotation={[0, 0.5, 0]}>
              <boxGeometry args={[0.006, 0.006, 0.03]} />
              <meshStandardMaterial color="#999999" metalness={0.95} roughness={0.05} />
            </mesh>
          </group>
        </>
      ) : (
        /* Standard window with single sash and mullions */
        <group position={[0, height / 2, 0]}>
          <mesh>
            <boxGeometry args={[width - 0.04, height - 0.08, 0.03]} />
            <meshStandardMaterial color={frameColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.002]}>
            <boxGeometry args={[width - 0.1, height - 0.14, 0.015]} />
            <meshStandardMaterial color="#e0f2fe" transparent opacity={0.22} roughness={0.05} metalness={0.95} />
          </mesh>

          {/* Grids / mullions */}
          <mesh position={[0, 0, 0.01]}>
            <boxGeometry args={[width - 0.1, 0.02, 0.018]} />
            <meshStandardMaterial color={frameColor} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <boxGeometry args={[0.02, height - 0.14, 0.018]} />
            <meshStandardMaterial color={frameColor} roughness={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ─── 3D FIXTURE MODELS ───────────────────────────────────────────────────────

function SinkModel({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[1.5, 2.3, 1.3]} />
        <meshStandardMaterial color="#A08060" roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.45, 0]}>
        <boxGeometry args={[1.6, 0.2, 1.4]} />
        <meshStandardMaterial color="#fafafa" roughness={0.1} />
      </mesh>
      <mesh position={[0, 2.7, -0.4]}>
        <cylinderGeometry args={[0.04, 0.04, 0.4, 8]} />
        <meshStandardMaterial color="#c0c5c8" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 2.9, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.2, 8]} />
        <meshStandardMaterial color="#c0c5c8" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.5, 0.67]}>
        <boxGeometry args={[0.6, 0.06, 0.06]} />
        <meshStandardMaterial color="#d0d5d8" metalness={0.8} />
      </mesh>
      {selected && (
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[1.7, 2.9, 1.5]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function BathtubModel({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[4.2, 1.7, 2.2]} />
        <meshStandardMaterial color="#f8f8f8" roughness={0.15} />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <boxGeometry args={[4.3, 0.1, 2.3]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.8, 1.8]} />
        <meshStandardMaterial color="#a5d8f3" transparent opacity={0.65} roughness={0.05} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[4.4, 1.9, 2.4]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function ShowerModel({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[2.5, 0.2, 2.5]} />
        <meshStandardMaterial color="#333" roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.5, -1.2]}>
        <boxGeometry args={[2.4, 6.8, 0.1]} />
        <meshStandardMaterial color="#fafafa" roughness={0.4} />
      </mesh>
      <mesh position={[-1.2, 3.5, 0]}>
        <boxGeometry args={[0.06, 6.8, 2.4]} />
        <meshStandardMaterial color="#dbeafe" transparent opacity={0.35} roughness={0.05} />
      </mesh>
      <mesh position={[0, 4.0, -1.1]}>
        <cylinderGeometry args={[0.04, 0.04, 3.5, 8]} />
        <meshStandardMaterial color="#b0b8c0" metalness={0.9} />
      </mesh>
      <mesh position={[0, 5.7, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.06, 16]} />
        <meshStandardMaterial color="#b0b8c0" metalness={0.9} />
      </mesh>
      {selected && (
        <mesh position={[0, 3.5, 0]}>
          <boxGeometry args={[2.6, 7.1, 2.6]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function ToiletModel({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.8, 0.3]}>
        <boxGeometry args={[1.1, 1.4, 1.4]} />
        <meshStandardMaterial color="#fefefe" roughness={0.1} />
      </mesh>
      <mesh position={[0, 2.0, -0.4]}>
        <boxGeometry args={[1.2, 1.2, 0.7]} />
        <meshStandardMaterial color="#fefefe" roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.55, 0.35]}>
        <boxGeometry args={[1.05, 0.1, 1.3]} />
        <meshStandardMaterial color="#eaeaea" roughness={0.4} />
      </mesh>
      {selected && (
        <mesh position={[0, 1.3, 0]}>
          <boxGeometry args={[1.3, 2.8, 1.6]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function TowelRailModel({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh position={[-0.4, 2.5, 0.05]}>
        <cylinderGeometry args={[0.03, 0.03, 3.5, 8]} />
        <meshStandardMaterial color="#d0d5d8" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0.4, 2.5, 0.05]}>
        <cylinderGeometry args={[0.03, 0.03, 3.5, 8]} />
        <meshStandardMaterial color="#d0d5d8" metalness={0.9} roughness={0.1} />
      </mesh>
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={i} position={[0, 1.1 + i * 0.7, 0.05]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
          <meshStandardMaterial color="#d0d5d8" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      {selected && (
        <mesh position={[0, 2.5, 0.05]}>
          <boxGeometry args={[1.0, 3.7, 0.2]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function WashingMachineModel({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[1.6, 2.5, 1.6]} />
        <meshStandardMaterial color="#fafafa" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.1, 0.82]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.04, 32]} />
        <meshStandardMaterial color="#2d3748" metalness={0.4} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.1, 0.84]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.03, 16]} />
        <meshStandardMaterial color="#c0e0f0" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 2.2, 0.81]}>
        <boxGeometry args={[1.4, 0.3, 0.03]} />
        <meshStandardMaterial color="#d1d5db" />
      </mesh>
      {selected && (
        <mesh position={[0, 1.25, 0]}>
          <boxGeometry args={[1.75, 2.7, 1.75]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function WallLightModel({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.2, 0.6, 0.1]} />
        <meshStandardMaterial color="#333" metalness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.28]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#fff" emissive="#fffae0" emissiveIntensity={2.5} />
      </mesh>
      <pointLight position={[0, 0, 0.4]} intensity={2.0} color="#ffeed0" distance={6} />
      {selected && (
        <mesh position={[0, 0, 0.2]}>
          <boxGeometry args={[0.5, 0.8, 0.6]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function PlantModel({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.35, 0.22, 0.8, 16]} />
        <meshStandardMaterial color="#cc8866" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.33, 0.33, 0.03, 8]} />
        <meshStandardMaterial color="#4b3621" roughness={1.0} />
      </mesh>
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={i} position={[0, 1.1, 0]} rotation={[0.3, i * (Math.PI * 0.4), 0.2]}>
          <boxGeometry args={[0.12, 1.0, 0.02]} />
          <meshStandardMaterial color="#3f8f52" roughness={0.8} />
        </mesh>
      ))}
      {selected && (
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[1.0, 1.9, 1.0]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

// ─── LIVING ROOM / NORMAL ROOM FIXTURE MODELS ────────────────────────────────

function SofaModel({ selected }: { selected: boolean }) {
  return (
    <group>
      {/* Base */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[3.0, 0.4, 1.4]} />
        <meshStandardMaterial color="#4A5568" roughness={0.8} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.85, -0.55]}>
        <boxGeometry args={[3.0, 0.8, 0.3]} />
        <meshStandardMaterial color="#4A5568" roughness={0.8} />
      </mesh>
      {/* Left armrest */}
      <mesh position={[-1.4, 0.55, 0]}>
        <boxGeometry args={[0.2, 0.6, 1.4]} />
        <meshStandardMaterial color="#4A5568" roughness={0.8} />
      </mesh>
      {/* Right armrest */}
      <mesh position={[1.4, 0.55, 0]}>
        <boxGeometry args={[0.2, 0.6, 1.4]} />
        <meshStandardMaterial color="#4A5568" roughness={0.8} />
      </mesh>
      {/* Cushions */}
      <mesh position={[-0.7, 0.5, 0.1]}>
        <boxGeometry args={[1.2, 0.15, 1.0]} />
        <meshStandardMaterial color="#718096" roughness={0.8} />
      </mesh>
      <mesh position={[0.7, 0.5, 0.1]}>
        <boxGeometry args={[1.2, 0.15, 1.0]} />
        <meshStandardMaterial color="#718096" roughness={0.8} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[3.2, 1.3, 1.6]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function BedModel({ selected }: { selected: boolean }) {
  return (
    <group>
      {/* Headboard */}
      <mesh position={[0, 0.9, -1.45]}>
        <boxGeometry args={[3.0, 1.8, 0.2]} />
        <meshStandardMaterial color="#8B5A2B" roughness={0.7} />
      </mesh>
      {/* Bed Base */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[2.8, 0.5, 2.8]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.9} />
      </mesh>
      {/* Mattress */}
      <mesh position={[0, 0.7, 0.05]}>
        <boxGeometry args={[2.7, 0.25, 2.7]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.95} />
      </mesh>
      {/* Pillows */}
      <mesh position={[-0.65, 0.88, -0.9]}>
        <boxGeometry args={[0.9, 0.12, 0.6]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.9} />
      </mesh>
      <mesh position={[0.65, 0.88, -0.9]}>
        <boxGeometry args={[0.9, 0.12, 0.6]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.9} />
      </mesh>

      {/* Headboard */}
      <mesh position={[0, 0.9, -1.45]}>
        <boxGeometry args={[3.0, 1.8, 0.2]} />
        <meshStandardMaterial color="#8B5A2B" roughness={0.7} />
      </mesh>
      {/* Bed Base */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[2.8, 0.5, 2.8]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.9} />
      </mesh>
      {/* Mattress */}
      <mesh position={[0, 0.7, 0.05]}>
        <boxGeometry args={[2.7, 0.25, 2.7]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.95} />
      </mesh>
      {/* Pillows */}
      <mesh position={[-0.65, 0.88, -0.9]}>
        <boxGeometry args={[0.9, 0.12, 0.6]} />
        <meshStandardMaterial color="#EDF2F7" roughness={0.9} />
      </mesh>
      <mesh position={[0.65, 0.88, -0.9]}>
        <boxGeometry args={[0.9, 0.12, 0.6]} />
        <meshStandardMaterial color="#EDF2F7" roughness={0.9} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.75, 0]}>
          <boxGeometry args={[3.2, 2.1, 3.2]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function TableModel({ selected }: { selected: boolean }) {
  return (
    <group>
      {/* Table Top */}
      <mesh position={[0, 1.45, 0]}>
        <boxGeometry args={[2.6, 0.08, 1.6]} />
        <meshStandardMaterial color="#8B5A2B" roughness={0.6} />
      </mesh>
      {/* Legs */}
      {[
        [-1.2, -0.7],
        [1.2, -0.7],
        [-1.2, 0.7],
        [1.2, 0.7]
      ].map((pos, idx) => (
        <mesh key={idx} position={[pos[0], 0.7, pos[1]]}>
          <cylinderGeometry args={[0.06, 0.06, 1.4, 8]} />
          <meshStandardMaterial color="#2d3748" metalness={0.5} roughness={0.2} />
        </mesh>
      ))}
      {selected && (
        <mesh position={[0, 0.75, 0]}>
          <boxGeometry args={[2.8, 1.6, 1.8]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function ChairModel({ selected }: { selected: boolean }) {
  return (
    <group>
      {/* Seat */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.8, 0.08, 0.8]} />
        <meshStandardMaterial color="#A0AEC0" roughness={0.8} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 1.35, -0.36]}>
        <boxGeometry args={[0.8, 0.9, 0.08]} />
        <meshStandardMaterial color="#A0AEC0" roughness={0.8} />
      </mesh>
      {/* Legs */}
      {[
        [-0.34, -0.34],
        [0.34, -0.34],
        [-0.34, 0.34],
        [0.34, 0.34]
      ].map((pos, idx) => (
        <mesh key={idx} position={[pos[0], 0.4, pos[1]]}>
          <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
          <meshStandardMaterial color="#1a202c" roughness={0.4} />
        </mesh>
      ))}
      {selected && (
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[0.9, 1.9, 0.9]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function WardrobeModel({ selected }: { selected: boolean }) {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[2.2, 4.4, 1.2]} />
        <meshStandardMaterial color="#4A3B32" roughness={0.7} />
      </mesh>
      {/* Left door outline */}
      <mesh position={[-0.55, 2.2, 0.61]}>
        <boxGeometry args={[1.0, 4.2, 0.02]} />
        <meshStandardMaterial color="#5C4A3E" roughness={0.6} />
      </mesh>
      {/* Right door outline */}
      <mesh position={[0.55, 2.2, 0.61]}>
        <boxGeometry args={[1.0, 4.2, 0.02]} />
        <meshStandardMaterial color="#5C4A3E" roughness={0.6} />
      </mesh>
      {/* Left handle */}
      <mesh position={[-0.1, 2.2, 0.64]}>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
        <meshStandardMaterial color="#CBD5E0" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Right handle */}
      <mesh position={[0.1, 2.2, 0.64]}>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
        <meshStandardMaterial color="#CBD5E0" metalness={0.9} roughness={0.1} />
      </mesh>
      {selected && (
        <mesh position={[0, 2.2, 0]}>
          <boxGeometry args={[2.4, 4.6, 1.4]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function TvCabinetModel({ selected }: { selected: boolean }) {
  return (
    <group>
      {/* Console Base */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[3.2, 0.8, 1.0]} />
        <meshStandardMaterial color="#2d3748" roughness={0.5} />
      </mesh>
      {/* TV Screen */}
      <mesh position={[0, 1.9, 0]}>
        <boxGeometry args={[2.6, 1.5, 0.08]} />
        <meshStandardMaterial color="#1a202c" roughness={0.1} />
      </mesh>
      {/* TV Stand Pole */}
      <mesh position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.4, 8]} />
        <meshStandardMaterial color="#718096" metalness={0.8} />
      </mesh>
      {/* TV Stand Base */}
      <mesh position={[0, 0.81, 0]}>
        <boxGeometry args={[0.8, 0.02, 0.5]} />
        <meshStandardMaterial color="#718096" metalness={0.8} />
      </mesh>
      {selected && (
        <mesh position={[0, 1.35, 0]}>
          <boxGeometry args={[3.4, 2.7, 1.2]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function CoffeeTableModel({ selected }: { selected: boolean }) {
  return (
    <group>
      {/* Top */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.6, 0.06, 1.0]} />
        <meshStandardMaterial color="#D69E2E" roughness={0.5} />
      </mesh>
      {/* Legs */}
      {[
        [-0.7, -0.4],
        [0.7, -0.4],
        [-0.7, 0.4],
        [0.7, 0.4]
      ].map((pos, idx) => (
        <mesh key={idx} position={[pos[0], 0.27, pos[1]]}>
          <cylinderGeometry args={[0.04, 0.04, 0.54, 8]} />
          <meshStandardMaterial color="#1A202C" roughness={0.4} />
        </mesh>
      ))}
      {selected && (
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[1.8, 0.65, 1.2]} />
          <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
// ─── Oriented Bounding Box (OBB) 2D Collision Helpers (SAT) ───────────────────
function getItemCorners(x: number, z: number, width: number, depth: number, rotation: number) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const localCorners = [
    { x: -halfW, z: -halfD },
    { x: halfW, z: -halfD },
    { x: halfW, z: halfD },
    { x: -halfW, z: halfD },
  ];
  return localCorners.map(p => ({
    x: x + (p.x * cos - p.z * sin),
    z: z + (p.x * sin + p.z * cos),
  }));
}

function projectionOverlap(proj1: { min: number, max: number }, proj2: { min: number, max: number }) {
  return proj1.max >= proj2.min && proj2.max >= proj1.min;
}

function getAxes(corners: { x: number; z: number }[]) {
  const axes = [];
  for (let i = 0; i < 4; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 4];
    axes.push({ x: -(p2.z - p1.z), z: p2.x - p1.x });
  }
  return axes;
}

function projectCorners(corners: { x: number; z: number }[], axis: { x: number; z: number }) {
  const len = Math.hypot(axis.x, axis.z);
  const ax = len > 0 ? axis.x / len : 0;
  const az = len > 0 ? axis.z / len : 0;
  let min = Infinity;
  let max = -Infinity;
  for (const p of corners) {
    const dot = p.x * ax + p.z * az;
    if (dot < min) min = dot;
    if (dot > max) max = dot;
  }
  return { min, max };
}

function rectsIntersect(rectA: { x: number; z: number }[], rectB: { x: number; z: number }[]) {
  const axes = [...getAxes(rectA), ...getAxes(rectB)];
  for (const axis of axes) {
    const projA = projectCorners(rectA, axis);
    const projB = projectCorners(rectB, axis);
    if (!projectionOverlap(projA, projB)) {
      return false;
    }
  }
  return true;
}

// ─── MEASUREMENT TOOL COMPONENTS ───

function formatLength(meters: number, unit: 'ft' | 'cm') {
  if (unit === 'ft') {
    const totalInches = Math.round(meters * 39.3701);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}' ${inches}"`;
  } else {
    return `${Math.round(meters * 100)} cm`;
  }
}

function getItemDimensions(type: string, name?: string): { width: number, depth: number } {
  const t = type;
  if (t === 'beds' || t === 'bed') return { width: 2.1, depth: 2.1 };
  if (t === 'wardrobes' || t === 'wardrobe') return { width: 1.25, depth: 1.25 };
  if (t === 'sofa' || t === 'sofas') return { width: 2.15, depth: 2.15 };
  if (t === 'table' || t === 'dressing_table') return { width: 1.55, depth: 1.55 };
  if (t === 'chair' || t === 'chairs') return { width: 0.65, depth: 0.65 };
  if (t === 'tv_cabinet') return { width: 1.55, depth: 1.55 };
  if (t === 'coffee_table') return { width: 1.1, depth: 1.1 };

  if (isSink(t, name)) return { width: 1.6 * 0.3048, depth: 1.4 * 0.3048 };
  if (isBathtub(t, name)) return { width: 7.9 * 0.3048, depth: 3.8 * 0.3048 };
  if (isShower(t, name)) return { width: 2.2 * 0.3048, depth: 2.2 * 0.3048 };
  if (t === 'toilet') return { width: 1.4 * 0.3048, depth: 2.2 * 0.3048 };
  if (t === 'towel_rail') return { width: 1.8 * 0.3048, depth: 0.4 * 0.3048 };
  if (t === 'washing_machine') return { width: 2.0 * 0.3048, depth: 2.0 * 0.3048 };
  if (t === 'light') return { width: 0.5 * 0.3048, depth: 0.5 * 0.3048 };
  return { width: 1.5 * 0.3048, depth: 1.5 * 0.3048 };
}

function RoomDimensionLine({ start, end, label, angle }: { start: [number, number, number], end: [number, number, number], label: string, angle: number }) {
  const p1 = new THREE.Vector3(...start);
  const p2 = new THREE.Vector3(...end);
  const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

  const direction = new THREE.Vector3().subVectors(p2, p1);
  const len = direction.length();
  const up = new THREE.Vector3(0, 1, 0);
  const rotation = new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize());

  return (
    <group>
      {/* Bold dimension line */}
      <mesh position={midpoint as any} quaternion={rotation as any}>
        <boxGeometry args={[0.006, len, 0.006]} />
        <meshBasicMaterial color="#52525b" />
      </mesh>

      {/* Start slash tick at 45 degrees */}
      <mesh position={start as any} rotation={[0, angle + Math.PI / 4, 0] as any}>
        <boxGeometry args={[0.006, 0.006, 0.16]} />
        <meshBasicMaterial color="#52525b" />
      </mesh>

      {/* End slash tick at 45 degrees */}
      <mesh position={end as any} rotation={[0, angle + Math.PI / 4, 0] as any}>
        <boxGeometry args={[0.006, 0.006, 0.16]} />
        <meshBasicMaterial color="#52525b" />
      </mesh>

      {/* Sleek architectural label (balanced font size) */}
      <Html position={midpoint as any} center distanceFactor={18}>
        <div style={{
          backgroundColor: '#ececec',
          color: '#3f3f46',
          fontSize: '8px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: '800',
          padding: '1px 3px',
          userSelect: 'none',
          pointerEvents: 'none',
          whiteSpace: 'nowrap'
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function MeasurementOverlay({
  settings,
  walls,
  placedItems,
  selectedItemId,
}: {
  settings: any;
  walls: any[];
  placedItems: any[];
  selectedItemId: string | null | undefined;
}) {
  return (
    <group>
      {/* 1. Room Dimensions */}
      {settings.roomDimensions && walls.map((wall, idx) => {
        const dx = wall.p2[0] - wall.p1[0];
        const dz = wall.p2[1] - wall.p1[1];
        const len = wall.len;
        const ux = dx / len;
        const uz = dz / len;
        const ox = uz * 0.45; // Outward shift
        const oz = -ux * 0.45;

        const startPt: [number, number, number] = [wall.p1[0] + ox, 0.05, wall.p1[1] + oz];
        const endPt: [number, number, number] = [wall.p2[0] + ox, 0.05, wall.p2[1] + oz];
        const angle = Math.atan2(dx, dz);

        return (
          <RoomDimensionLine
            key={`room-dim-${idx}`}
            start={startPt}
            end={endPt}
            label={formatLength(len, settings.unit)}
            angle={angle}
          />
        );
      })}

      {/* 2. Product Spacing (Clearance to walls in 4 orthogonal directions) */}
      {settings.productSpacing && (() => {
        if (!selectedItemId) return null;
        const item = placedItems.find(i => i.id === selectedItemId);
        if (!item) return null;

        const itemPos = new THREE.Vector3(item.position[0], item.position[1], item.position[2]);
        const dims = getItemDimensions(item.type);

        const cachedDims = globalItemDimensions.get(item.id);
        let wMeters = 0.5;
        let dMeters = 0.5;
        if (cachedDims) {
          wMeters = cachedDims.width;
          dMeters = cachedDims.depth;
        } else {
          const fallback = getItemDimensions(item.type);
          wMeters = fallback.width;
          dMeters = fallback.depth;
        }

        // We only show FRONT, RIGHT, and LEFT directions (exactly 3 measurements)
        const dirs = [
          { vec: new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), item.rotation), extent: dMeters / 2 },  // Front
          { vec: new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), item.rotation), extent: wMeters / 2 },  // Right
          { vec: new THREE.Vector3(-1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), item.rotation), extent: wMeters / 2 }  // Left
        ];

        return (
          <group>
            {dirs.map((dConfig, dIdx) => {
              const dir = dConfig.vec;
              const extent = dConfig.extent;
              let closestT = Infinity;
              let interPt: THREE.Vector3 | null = null;
              let wallAngle = 0;

              for (const wall of walls) {
                const x1 = wall.p1[0];
                const z1 = wall.p1[1];
                const x2 = wall.p2[0];
                const z2 = wall.p2[1];

                const dx = x2 - x1;
                const dz = z2 - z1;

                const denom = dir.x * dz - dir.z * dx;
                if (Math.abs(denom) < 0.0001) continue;

                // Ignore walls nearly parallel to the ray (sin of angle < 0.08)
                if (Math.abs(denom) / wall.len < 0.08) continue;

                const t = ((x1 - itemPos.x) * dz - (z1 - itemPos.z) * dx) / denom;
                const u = ((x1 - itemPos.x) * dir.z - (z1 - itemPos.z) * dir.x) / denom;

                if (t > 0.01 && u >= 0 && u <= 1) {
                  if (t < closestT) {
                    closestT = t;
                    interPt = new THREE.Vector3(itemPos.x + t * dir.x, 0.05, itemPos.z + t * dir.z);
                    wallAngle = Math.atan2(dx, dz);
                  }
                }
              }

              // Intersect with other products in the scene
              for (const other of placedItems) {
                if (other.id === item.id) continue;

                let otherW = 0.5;
                let otherD = 0.5;
                const otherDims = globalItemDimensions.get(other.id);
                if (otherDims) {
                  otherW = otherDims.width;
                  otherD = otherDims.depth;
                } else {
                  const fallback = getItemDimensions(other.type);
                  otherW = fallback.width;
                  otherD = fallback.depth;
                }

                const corners = getItemCorners(other.position[0], other.position[2], otherW, otherD, other.rotation);
                const segments = [
                  { p1: corners[0], p2: corners[1], len: otherW },
                  { p1: corners[1], p2: corners[2], len: otherD },
                  { p1: corners[2], p2: corners[3], len: otherW },
                  { p1: corners[3], p2: corners[0], len: otherD }
                ];

                for (const seg of segments) {
                  const dx = seg.p2.x - seg.p1.x;
                  const dz = seg.p2.z - seg.p1.z;

                  const denom = dir.x * dz - dir.z * dx;
                  if (Math.abs(denom) < 0.0001) continue;

                  // Ignore segments nearly parallel to the ray
                  if (Math.abs(denom) / seg.len < 0.08) continue;

                  const t = ((seg.p1.x - itemPos.x) * dz - (seg.p1.z - itemPos.z) * dx) / denom;
                  const u = ((seg.p1.x - itemPos.x) * dir.z - (seg.p1.z - itemPos.z) * dir.x) / denom;

                  if (t > 0.01 && u >= 0 && u <= 1) {
                    if (t < closestT) {
                      closestT = t;
                      interPt = new THREE.Vector3(itemPos.x + t * dir.x, 0.05, itemPos.z + t * dir.z);
                      wallAngle = Math.atan2(dx, dz);
                    }
                  }
                }
              }

              if (!interPt) return null;

              const totalDist = itemPos.distanceTo(interPt);
              const actualSpacing = Math.max(0, totalDist - extent);

              const p1 = new THREE.Vector3().addScaledVector(dir, extent).add(itemPos);
              p1.y = 0.05;
              const p2 = interPt;
              const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
              const len = p1.distanceTo(p2);
              const up = new THREE.Vector3(0, 1, 0);
              const lineRotation = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3().subVectors(p2, p1).normalize());

              return (
                <group key={`spacing-${dIdx}`}>
                  {/* Thin line */}
                  <mesh position={midpoint as any} quaternion={lineRotation as any}>
                    <boxGeometry args={[0.006, len, 0.006]} />
                    <meshBasicMaterial color="#0086ff" />
                  </mesh>

                  {/* Tick at wall */}
                  <mesh position={p2 as any} rotation={[0, wallAngle, 0] as any}>
                    <boxGeometry args={[0.16, 0.006, 0.006]} />
                    <meshBasicMaterial color="#0086ff" />
                  </mesh>

                  {/* Dot at item boundary */}
                  <mesh position={p1 as any}>
                    <sphereGeometry args={[0.03, 16, 16]} />
                    <meshBasicMaterial color="#ffffff" />
                  </mesh>

                  {/* Sleek blue badge (slightly reduced size) */}
                  <Html position={midpoint as any} center distanceFactor={18}>
                    <div style={{
                      backgroundColor: '#0086ff',
                      color: '#ffffff',
                      fontSize: '8px',
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 'bold',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      userSelect: 'none',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap'
                    }}>
                      {formatLength(actualSpacing, settings.unit)}
                    </div>
                  </Html>
                </group>
              );
            })}
          </group>
        );
      })()}
    </group>
  );
}

// ─── BATHROOM SCENE ──────────────────────────────────────────────────────────

function BathroomScene({
  state,
  setState,
  topView,
  activeSideView,
  setActiveSideView,
  zoomTrigger,
  setZoomTrigger,
  setNumWalls,
  placedItems,
  setPlacedItems,
  selectedItemId,
  setSelectedItemId,
  isPlacingItem,
  setIsPlacingItem,
  orbitEnabled,
  setOrbitEnabled,
  activePlacement,
  setActivePlacement,
  CustomFurniture,
  measurementSettings,
  isMeasuring,
  setIsMeasuring,
  savedMeasurements,
  setSavedMeasurements,
  measureStartPoint,
  setMeasureStartPoint,
  measureTempEndPoint,
  setMeasureTempEndPoint,
  readOnly = false,
}: {
  state: DesignState;
  setState: React.Dispatch<React.SetStateAction<DesignState>>;
  topView: boolean;
  activeSideView: number | null;
  setActiveSideView: (n: number | null) => void;
  zoomTrigger: 'in' | 'out' | null;
  setZoomTrigger: (t: 'in' | 'out' | null) => void;
  setNumWalls: (n: number) => void;
  placedItems: PlacedItem[];
  setPlacedItems: React.Dispatch<React.SetStateAction<PlacedItem[]>>;
  readOnly?: boolean;
  selectedItemId: string | null;
  setSelectedItemId: (s: string | null) => void;
  isPlacingItem: PlacedItem | null;
  setIsPlacingItem: (item: PlacedItem | null) => void;
  orbitEnabled: boolean;
  setOrbitEnabled: (v: boolean) => void;
  activePlacement: { type: 'door' | 'window'; style: string; name: string; width: number; height: number; sillHeight: number } | null;
  setActivePlacement: (ap: any) => void;
  CustomFurniture?: any;
  measurementSettings?: any;
  isMeasuring?: boolean;
  setIsMeasuring?: (v: boolean) => void;
  savedMeasurements?: any[];
  setSavedMeasurements?: React.Dispatch<React.SetStateAction<any[]>>;
  measureStartPoint?: THREE.Vector3 | null;
  setMeasureStartPoint?: (p: THREE.Vector3 | null) => void;
  measureTempEndPoint?: THREE.Vector3 | null;
  setMeasureTempEndPoint?: (p: THREE.Vector3 | null) => void;
}) {
  const { camera, gl } = useThree();
  const { selectedWallIdx, setSelectedWallIdx, activeCategory, recordHistory, selectedRoomType } = useDesignerStore();
  const w = Math.max(1.5, state.widthFt * 0.3048);
  const d = Math.max(1.5, state.depthFt * 0.3048);
  const h = Math.max(2.2, state.heightFt * 0.3048);

  const controlsRef = useRef<any>(null);
  const draggingItemId = useRef<string | null>(null);
  const draggingOpeningId = useRef<string | null>(null);
  const [hoveredWall, setHoveredWall] = useState<{ idx: number; offset: number } | null>(null);

  const [osposFloorTexture, setOsposFloorTexture] = useState<any>(null);
  const [osposWallTextures, setOsposWallTextures] = useState<Record<string, any>>({});

  const catalogItems = useDesignerStore((s) => s.catalogItems);

  useEffect(() => {
    if (state.floorTextureUrl) {
      new THREE.TextureLoader().load(state.floorTextureUrl, (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        const tileItem = state.floorTileItem || catalogItems.find(i => i.imageUrl && state.floorTextureUrl?.includes(i.imageUrl));
        const dims = parseTileDimensions(tileItem);
        tex.repeat.set(w / dims.widthM, d / dims.heightM);
        setOsposFloorTexture(tex);
      });
    } else {
      setOsposFloorTexture(null);
    }
  }, [state.floorTextureUrl, state.floorTileItem, catalogItems, w, d]);

  useEffect(() => {
    const urlsToLoad = new Set<string>();
    if (state.wallTextureUrl) urlsToLoad.add(state.wallTextureUrl);
    state.wallDesigns?.forEach(wd => {
      if (wd.textureUrl) urlsToLoad.add(wd.textureUrl);
    });

    const newMap: Record<string, any> = {};
    let loadedCount = 0;

    if (urlsToLoad.size === 0) {
      setOsposWallTextures({});
      return;
    }

    urlsToLoad.forEach(url => {
      new THREE.TextureLoader().load(url, (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        // Don't set repeat here, we will clone and set it per-wall segment
        newMap[url] = tex;
        loadedCount++;
        if (loadedCount === urlsToLoad.size) {
          setOsposWallTextures({ ...newMap });
        }
      }, undefined, (err) => {
        console.error('Failed to load texture:', url, err);
        loadedCount++;
        if (loadedCount === urlsToLoad.size) {
          setOsposWallTextures({ ...newMap });
        }
      });
    });
  }, [state.wallTextureUrl, state.wallDesigns, w, h]);

  // Room polygon (x, z) world space
  const polygon = useMemo((): [number, number][] => {
    if (state.shape === 'square') {
      const s = Math.min(w, d);
      return [[-s / 2, -s / 2], [s / 2, -s / 2], [s / 2, s / 2], [-s / 2, s / 2]];
    }
    if (state.shape === 'l-shape') {
      return [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, 0],
        [0, 0],
        [0, d / 2],
        [-w / 2, d / 2]
      ];
    }
    if (state.shape === 't-shape') {
      return [
        [-w / 4, -d / 2],
        [w / 4, -d / 2],
        [w / 4, 0],
        [w / 2, 0],
        [w / 2, d / 2],
        [-w / 2, d / 2],
        [-w / 2, 0],
        [-w / 4, 0]
      ];
    }
    if (state.shape === 'u-shape') {
      return [
        [-w / 2, -d / 2],
        [-w / 4, -d / 2],
        [-w / 4, 0],
        [w / 4, 0],
        [w / 4, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2]
      ];
    }
    if (state.shape === 'custom') {
      return [
        [-w / 2, -d / 2],
        [w / 4, -d / 2],
        [w / 2, -d / 4],
        [w / 2, d / 2],
        [-w / 2, d / 2]
      ];
    }
    return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  }, [state.shape, w, d]);

  // Floor geometry
  const floorGeom = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(polygon[0][0], -polygon[0][1]);
    for (let i = 1; i < polygon.length; i++) shape.lineTo(polygon[i][0], -polygon[i][1]);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 3);
  }, [polygon]);

  // Wall segments from polygon edges
  const walls = useMemo(() => {
    return polygon.map((p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      const dx = q[0] - p[0];
      const dz = q[1] - p[1];
      const len = Math.sqrt(dx * dx + dz * dz);
      return {
        p1: p, p2: q,
        cx: (p[0] + q[0]) / 2,
        cz: (p[1] + q[1]) / 2,
        len,
        rotY: Math.atan2(-dz, dx),
      };
    });
  }, [polygon]);

  // Dynamic wall and ceiling visibility refs and state
  const [ceilingVisible, setCeilingVisible] = useState(true);
  const dirLightRef = useRef<any>(null);
  const wallGroupsRef = useRef<any[]>([]);
  const openingGroupsRef = useRef<Record<string, any>>({});

  useFrame(() => {
    // Keep directional light position aligned with camera to avoid pitch-black unlit areas during rotation
    if (dirLightRef.current) {
      dirLightRef.current.position.copy(camera.position);
    }

    // Hide ceiling in top view or when camera position Y goes above ceiling height h
    const shouldCeilingBeVisible = !topView && camera.position.y < h;
    if (shouldCeilingBeVisible !== ceilingVisible) {
      setCeilingVisible(shouldCeilingBeVisible);
    }

    const camX = camera.position.x;
    const camZ = camera.position.z;

    walls.forEach((wall, i) => {
      let isVisible = true;
      if (!topView) {
        const dx = wall.p2[0] - wall.p1[0];
        const dz = wall.p2[1] - wall.p1[1];
        const nx = -dz / wall.len;
        const nz = dx / wall.len;
        const dot = (camX - wall.cx) * nx + (camZ - wall.cz) * nz;
        isVisible = dot > 0;
      }
      const opacityVal = isVisible ? 1.0 : 0.0;

      const group = wallGroupsRef.current[i];
      if (group) {
        group.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            const isSelectionTarget = child.name === 'selection-target';
            const meshVisible = isSelectionTarget && activeCategory === 'wall_tiles' ? true : isVisible;
            child.castShadow = meshVisible;
            child.receiveShadow = meshVisible;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat: any) => {
              if (mat) {
                if (mat.userData.originalOpacity === undefined) {
                  mat.userData.originalOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
                }
                if (mat.userData.originalTransparent === undefined) {
                  mat.userData.originalTransparent = mat.transparent !== undefined ? mat.transparent : false;
                }
                if (isSelectionTarget) {
                  mat.transparent = true;
                  mat.opacity = selectedWallIdx === i ? 0.25 : 0;
                  mat.depthWrite = false;
                } else {
                  mat.transparent = opacityVal < 1.0 || mat.userData.originalTransparent;
                  mat.opacity = mat.userData.originalOpacity * opacityVal;
                  mat.depthWrite = isVisible;
                }
                child.visible = meshVisible;
              }
            });
          }
        });
      }
    });

    state.wallOpenings?.forEach((opening) => {
      const wallIdx = opening.wallIndex;
      const wall = walls[wallIdx];
      if (!wall) return;

      let isVisible = true;
      if (!topView) {
        const dx = wall.p2[0] - wall.p1[0];
        const dz = wall.p2[1] - wall.p1[1];
        const nx = -dz / wall.len;
        const nz = dx / wall.len;
        const dot = (camX - wall.cx) * nx + (camZ - wall.cz) * nz;
        isVisible = dot > 0;
      }
      const opacityVal = isVisible ? 1.0 : 0.0;

      const group = openingGroupsRef.current[opening.id];
      if (group) {
        group.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = isVisible;
            child.receiveShadow = isVisible;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat: any) => {
              if (mat) {
                if (mat.userData.originalOpacity === undefined) {
                  mat.userData.originalOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
                }
                if (mat.userData.originalTransparent === undefined) {
                  mat.userData.originalTransparent = mat.transparent !== undefined ? mat.transparent : false;
                }
                mat.transparent = opacityVal < 1.0 || mat.userData.originalTransparent;
                mat.opacity = mat.userData.originalOpacity * opacityVal;
                mat.depthWrite = isVisible;
                child.visible = isVisible;
              }
            });
          }
        });
      }
    });
  });

  useEffect(() => { setNumWalls(walls.length); }, [walls.length, setNumWalls]);

  const raycasterRef = useMemo(() => new THREE.Raycaster(), []);
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  const getFloorHit = useCallback((e: PointerEvent): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.setFromCamera(new THREE.Vector2(mx, my), camera);
    const pt = new THREE.Vector3();
    return raycasterRef.ray.intersectPlane(floorPlane, pt) ? pt : null;
  }, [camera, gl, raycasterRef, floorPlane]);

  // Pointer drag logic
  useEffect(() => {
    let hasMovedInScene = false;

    const onMove = (e: PointerEvent) => {
      if (draggingOpeningId.current) {
        const opId = draggingOpeningId.current;
        const op = state.wallOpenings.find(o => o.id === opId);
        if (!op) return;
        const pt = getFloorHit(e);
        if (!pt) return;

        // Find closest wall segment for the opening
        let closestWallIdx = 0;
        let closestDist = Infinity;
        let closestOffset = 0;

        walls.forEach((w, idx) => {
          const dx = w.p2[0] - w.p1[0];
          const dz = w.p2[1] - w.p1[1];
          const ux = pt.x - w.p1[0];
          const uz = pt.z - w.p1[1];
          const wallLenSq = w.len * w.len;
          const t = Math.max(0, Math.min(1, wallLenSq > 0 ? (ux * dx + uz * dz) / wallLenSq : 0));
          const projX = w.p1[0] + t * dx;
          const projZ = w.p1[1] + t * dz;
          const dist = Math.hypot(pt.x - projX, pt.z - projZ);
          if (dist < closestDist) {
            closestDist = dist;
            closestWallIdx = idx;
            closestOffset = t * w.len;
          }
        });

        const closestWall = walls[closestWallIdx];
        const halfW = op.width / 2;
        const min = halfW + 0.02;
        const max = closestWall.len - halfW - 0.02;
        let clamped = closestOffset;
        if (max > min) {
          clamped = Math.max(min, Math.min(max, closestOffset));
        } else {
          clamped = Math.max(halfW, Math.min(closestWall.len - halfW, closestOffset));
        }

        setState(prev => ({
          ...prev,
          wallOpenings: prev.wallOpenings.map(o => o.id === opId ? { ...o, wallIndex: closestWallIdx, positionOffset: clamped } : o)
        }));
        return;
      }

      const activeId = draggingItemId.current || (isPlacingItem ? isPlacingItem.id : null);
      if (!activeId || walls.length === 0) return;
      const pt = getFloorHit(e);
      if (!pt) return;

      if (isPlacingItem) {
        hasMovedInScene = true;
      }

      const itemToMove = placedItems.find(i => i.id === activeId) || isPlacingItem;
      if (!itemToMove) return;

      let itemD = 0.5; // fallback
      let itemW = 0.5; // fallback
      const dims = globalItemDimensions.get(itemToMove.id);
      if (dims) {
        itemD = dims.depth;
        itemW = dims.width;
      } else {
        const fallback = getItemDimensions(itemToMove.type);
        itemD = fallback.depth;
        itemW = fallback.width;
      }

      // Calculate rotated dimensions based on custom rotation offset to prevent clipping into walls
      const rotOffset = itemToMove.rotationOffset || 0;
      const cosR = Math.abs(Math.cos(rotOffset));
      const sinR = Math.abs(Math.sin(rotOffset));
      const rotatedDepth = itemD * cosR + itemW * sinR;
      const rotatedWidth = itemW * cosR + itemD * sinR;

      let posX = pt.x;
      let posZ = pt.z;
      let rotY = itemToMove.rotation || 0;

      if (selectedRoomType === 'bathroom') {
        // Snap to nearest wall (All items in BathroomScene for Bathroom designer)
        let closestWallIdx = 0;
        let closestDist = Infinity;
        let closestOffset = 0;

        walls.forEach((wall, idx) => {
          const dx = wall.p2[0] - wall.p1[0];
          const dz = wall.p2[1] - wall.p1[1];
          const ux = pt.x - wall.p1[0];
          const uz = pt.z - wall.p1[1];
          const wallLenSq = wall.len * wall.len;
          const t = Math.max(0.1, Math.min(0.9, wallLenSq > 0 ? (ux * dx + uz * dz) / wallLenSq : 0));
          const projX = wall.p1[0] + t * dx;
          const projZ = wall.p1[1] + t * dz;
          const dist = Math.hypot(pt.x - projX, pt.z - projZ);
          if (dist < closestDist) { closestDist = dist; closestWallIdx = idx; closestOffset = t * wall.len; }
        });

        const wall = walls[closestWallIdx];
        const dx = wall.p2[0] - wall.p1[0];
        const dz = wall.p2[1] - wall.p1[1];
        const ux = dx / wall.len, uz = dz / wall.len;
        let nx = -uz, nz = ux;

        const polyCorners = walls.map(w => [w.p1[0], w.p1[1]] as [number, number]);
        const testX = wall.cx + nx * 0.1;
        const testZ = wall.cz + nz * 0.1;
        rotY = wall.rotY;
        if (!isPointIn2DPolygon(testX, testZ, polyCorners)) {
          nx = -nx;
          nz = -nz;
          rotY += Math.PI;
        }

        // Limit offset so the item's width never extends past the wall corners
        const buffer = Math.max(0.1, rotatedWidth / 2 + 0.05);
        const snappedOffset = Math.max(buffer, Math.min(wall.len - buffer, closestOffset));

        // Snap to touch wall flush: Z-center offset is exactly half of the rotated depth
        const bias = rotatedDepth / 2;
        posX = wall.p1[0] + ux * snappedOffset + nx * bias;
        posZ = wall.p1[1] + uz * snappedOffset + nz * bias;
      } else {
        // Free movement inside boundaries (Normal room designer)
        const polyCorners = walls.map(w => [w.p1[0], w.p1[1]] as [number, number]);
        const snapped = clampItemToPolygon(
          { x: pt.x, z: pt.z },
          itemW,
          itemD,
          itemToMove.rotation || 0,
          polyCorners,
          state.shape,
          w,
          d,
          itemToMove.position ? { x: itemToMove.position[0], z: itemToMove.position[2] } : undefined
        );
        posX = snapped.x;
        posZ = snapped.z;
      }

      let heightY = 0;
      const isBathtubItem = isBathtub(itemToMove.type, itemToMove.name);
      const isShowerItem = isShower(itemToMove.type, itemToMove.name);
      const isWallMounted = isBathtubItem ? false : checkIsWallMounted(itemToMove);

      if (isWallMounted) {
        const wallIdx = selectedRoomType === 'bathroom' ? undefined : undefined;
        let nx = 0, nz = 1, wallCx = 0, wallCz = 0;

        if (selectedRoomType === 'bathroom') {
          // snaps along wall
          let closestWallIdx = 0;
          let closestDist = Infinity;
          walls.forEach((wall, idx) => {
            const dx = wall.p2[0] - wall.p1[0];
            const dz = wall.p2[1] - wall.p1[1];
            const ux = pt.x - wall.p1[0];
            const uz = pt.z - wall.p1[1];
            const wallLenSq = wall.len * wall.len;
            const t = Math.max(0.1, Math.min(0.9, wallLenSq > 0 ? (ux * dx + uz * dz) / wallLenSq : 0));
            const projX = wall.p1[0] + t * dx;
            const projZ = wall.p1[1] + t * dz;
            const dist = Math.hypot(pt.x - projX, pt.z - projZ);
            if (dist < closestDist) { closestDist = dist; closestWallIdx = idx; }
          });
          const wall = walls[closestWallIdx];
          const dx = wall.p2[0] - wall.p1[0];
          const dz = wall.p2[1] - wall.p1[1];
          const ux = dx / wall.len, uz = dz / wall.len;
          nx = -uz;
          nz = ux;
          wallCx = wall.cx;
          wallCz = wall.cz;
        }

        const wallPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          new THREE.Vector3(nx, 0, nz).normalize(),
          new THREE.Vector3(wallCx, 0, wallCz)
        );
        const wallPt = new THREE.Vector3();
        let itemHeight = 0.35; // fallback item height
        const nameLower = (itemToMove.name || '').toLowerCase();
        const isColumnShower = isShowerItem && (nameLower.includes('column') || nameLower.includes('riser') || nameLower.includes('system') || nameLower.includes('exposed') || nameLower.includes('thermostatic'));

        if (isShowerItem && (nameLower.includes('enclosure') || nameLower.includes('box') || nameLower.includes('cabin'))) {
          itemHeight = 2.0;
        } else if (isColumnShower) {
          itemHeight = 1.15;
        } else if (dims && dims.height) {
          itemHeight = dims.height;
        }

        const minH = 0.1;
        const maxH = Math.max(minH, h - (isColumnShower ? (itemHeight + 0.10) : 0.15));
        heightY = getDefaultMountHeight(itemToMove.type, itemToMove.name);
        if (raycasterRef.ray.intersectPlane(wallPlane, wallPt)) {
          heightY = Math.max(minH, Math.min(maxH, wallPt.y));
        }
      }

      // Check collision against all other items (oriented bounding boxes)
      const candidateCorners = getItemCorners(posX, posZ, itemW, itemD, rotY + rotOffset);
      let collides = false;
      if (true) {
        for (const other of placedItems) {
          if (other.id === activeId) continue;

          let otherW = 0.5, otherD = 0.5;
          const otherDims = globalItemDimensions.get(other.id);
          if (otherDims) {
            otherW = otherDims.width;
            otherD = otherDims.depth;
          } else {
            const fallback = getItemDimensions(other.type);
            otherW = fallback.width;
            otherD = fallback.depth;
          }

          const otherCorners = getItemCorners(other.position[0], other.position[2], otherW, otherD, other.rotation);
          if (rectsIntersect(candidateCorners, otherCorners)) {
            collides = true;
            break;
          }
        }
      }

      if (!collides) {
        const updateItem = (prev: PlacedItem) => ({
          ...prev,
          position: [posX, heightY, posZ] as [number, number, number],
          rotation: rotY + rotOffset,
        });

        if (draggingItemId.current) {
          setPlacedItems(prev => prev.map(item => item.id === activeId ? updateItem(item) : item));
        } else if (isPlacingItem) {
          setIsPlacingItem(updateItem(isPlacingItem));
        }
      }
    };

    const onUp = () => {
      if (draggingItemId.current) {
        draggingItemId.current = null;
        setOrbitEnabled(true);
      }
      if (draggingOpeningId.current) {
        draggingOpeningId.current = null;
        setOrbitEnabled(true);
      }
      if (isPlacingItem && hasMovedInScene) {
        const store = useDesignerStore.getState();
        const currentList = store.placedItems.length > 0 ? store.placedItems : placedItems;
        const exists = currentList.some(i => String(i.id) === String(isPlacingItem.id));
        if (!exists) {
          const next = [...currentList, isPlacingItem];
          recordHistory(next);
          setPlacedItems(next);
          store.setPlacedItems(next);
        }
        setIsPlacingItem(null);
        setOrbitEnabled(true);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [getFloorHit, walls, h, w, d, placedItems, isPlacingItem, setPlacedItems, setIsPlacingItem, raycasterRef, setOrbitEnabled, state.wallOpenings, setState]);

  // Top-view camera
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

  // Side-view jump
  useEffect(() => {
    if (activeSideView === null || !controlsRef.current || walls.length === 0) return;
    const controls = controlsRef.current;
    const wall = walls[activeSideView];
    if (!wall) return;
    const dx = wall.p2[0] - wall.p1[0];
    const dz = wall.p2[1] - wall.p1[1];
    const nx = -(dz / wall.len);
    const nz = (dx / wall.len);
    const viewDist = Math.max(w, d) * 0.8;
    camera.position.set(wall.cx + nx * viewDist, h * 0.5, wall.cz + nz * viewDist);
    controls.target.set(wall.cx, h * 0.5, wall.cz);
    controls.update();
    setActiveSideView(null);
  }, [activeSideView, walls, w, d, h, camera, setActiveSideView]);

  // Zoom triggers
  useEffect(() => {
    if (!zoomTrigger || !controlsRef.current) return;
    const target = controlsRef.current.target;
    const dir = new THREE.Vector3().subVectors(camera.position, target);
    dir.multiplyScalar(zoomTrigger === 'in' ? 0.8 : 1.25);
    camera.position.addVectors(target, dir);
    controlsRef.current.update();
    setZoomTrigger(null);
  }, [zoomTrigger, camera, setZoomTrigger]);

  const floorTexture: any = useMemo(() => getTileTexture(state.floorColor, 8, 8), [state.floorColor]);
  const woodTexture: any = useMemo(() => getWoodTexture('#b88b5c', 8, 8), []);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.65} />
      <directionalLight ref={dirLightRef} position={[5, 10, 5]} intensity={1.0} castShadow />
      <spotLight position={[-w * 0.2, h - 0.2, -d * 0.2]} angle={Math.PI / 3} penumbra={0.8} intensity={2.0} castShadow />
      <spotLight position={[w * 0.2, h - 0.2, d * 0.2]} angle={Math.PI / 3} penumbra={0.8} intensity={2.0} castShadow />

      {/* Floor */}
      <mesh
        geometry={floorGeom}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={(e) => {
          if (isMeasuring && setSavedMeasurements && setMeasureStartPoint && setIsMeasuring) {
            e.stopPropagation();
            const pt = e.point;
            if (!measureStartPoint) {
              setMeasureStartPoint(pt);
            } else {
              setSavedMeasurements(prev => [...prev, {
                point_a_x: measureStartPoint.x,
                point_a_y: measureStartPoint.y,
                point_a_z: measureStartPoint.z,
                point_b_x: pt.x,
                point_b_y: pt.y,
                point_b_z: pt.z,
                distance: measureStartPoint.distanceTo(pt)
              }]);
              setMeasureStartPoint(null);
              setIsMeasuring(false);
            }
            return;
          }
          remoteLog("FLOOR CLICKED, designType:", state.designType);
          if (state.designType === 'bathroom') {
            e.stopPropagation();
            setSelectedWallIdx(null);
          }
        }}
        onPointerMove={(e) => {
          if (isMeasuring && measureStartPoint && setMeasureTempEndPoint) {
            e.stopPropagation();
            setMeasureTempEndPoint(e.point);
          }
        }}
      >
        <meshStandardMaterial
          map={osposFloorTexture || (state.designType === 'room' ? woodTexture : floorTexture)}
          roughness={state.designType === 'room' ? 0.95 : 0.7}
          metalness={state.designType === 'room' ? 0.02 : 0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Ceiling */}
      <mesh geometry={floorGeom} rotation={[-Math.PI / 2, 0, 0]} position={[0, h, 0]} visible={ceilingVisible}>
        <meshStandardMaterial color="#f0eeeb" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Walls */}
      {walls.map((wall, i) => {
        const design = state.wallDesigns[i] || INITIAL_WALL_DESIGN;
        const split = design.splitMode;
        const thickness = 0.08;

        const getMat = (color: string, w: number, y: number) => {
          const texUrl = state.designType === 'bathroom' ? design.textureUrl : state.wallTextureUrl;
          if (texUrl && osposWallTextures[texUrl]) {
            const roundedW = Math.round(w * 100) / 100;
            const roundedY = Math.round(y * 100) / 100;
            const tileItem = (state.designType === 'bathroom' ? design.tileItem : state.wallTileItem) || catalogItems.find(i => (i.imageUrl && texUrl.includes(i.imageUrl)) || (design?.tileAssetId && String(i.itemId) === String(design.tileAssetId)));
            const dims = parseTileDimensions(tileItem);
            const key = `${texUrl}_${roundedW}_${roundedY}_${dims.widthM}_${dims.heightM}`;
            let clonedTex = clonedTextureCache.get(key);
            if (!clonedTex) {
              clonedTex = osposWallTextures[texUrl].clone();
              clonedTex.repeat.set(roundedW / dims.widthM, roundedY / dims.heightM);
              clonedTex.needsUpdate = true;
              clonedTextureCache.set(key, clonedTex);
            }
            return { map: clonedTex, roughness: 0.4, side: THREE.DoubleSide, transparent: true };
          }
          if (state.designType === 'room') {
            return { color, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide, transparent: true };
          }
          return { map: getTileTexture(color, Math.max(1, Math.round(w * 0.8)), Math.max(1, Math.round(y * 0.8))), roughness: 0.4, side: THREE.DoubleSide, transparent: true };
        };

        const renderTilePlanes = (segStart: number, segEnd: number, yMin: number, yMax: number, keySuffix: string) => {
          const segLen = segEnd - segStart;
          if (segLen <= 0.001) return null;
          const segCenter = (segStart + segEnd) / 2;
          const localOffset = segCenter - wall.len / 2;
          const yHeight = yMax - yMin;
          const posY = yMin + yHeight / 2;

          if (split === 'full') {
            const hasCoverageHeight = design.textureCoverageHeight !== undefined && design.textureCoverageHeight !== null;
            if (hasCoverageHeight && design.textureCoverageHeight! < yMax) {
              const ch = Math.max(yMin, design.textureCoverageHeight!);
              const bottomHeight = ch - yMin;
              const topHeight = yMax - ch;
              return (
                <group key={`tile-full-${keySuffix}`}>
                  {bottomHeight > 0.01 && (
                    <mesh position={[localOffset, yMin + bottomHeight / 2, 0.001]} raycast={() => null}>
                      <planeGeometry args={[segLen, bottomHeight]} />
                      <meshStandardMaterial {...getMat(design.tileColorBottom, segLen, bottomHeight)} />
                    </mesh>
                  )}
                  {topHeight > 0.01 && (
                    <mesh position={[localOffset, ch + topHeight / 2, 0.001]} raycast={() => null}>
                      <planeGeometry args={[segLen, topHeight]} />
                      <meshStandardMaterial color={design.tileColorTop || "#ffffff"} roughness={0.9} side={THREE.DoubleSide} />
                    </mesh>
                  )}
                </group>
              );
            }

            return (
              <mesh key={`tile-full-${keySuffix}`} position={[localOffset, posY, 0.001]} raycast={() => null}>
                <planeGeometry args={[segLen, yHeight]} />
                <meshStandardMaterial {...getMat(design.tileColorBottom, segLen, yHeight)} />
              </mesh>
            );
          }

          if (split === 'horizontal') {
            const hBot = 1.07;
            const results = [];

            // Bottom tile overlap
            const botOverlap = getOverlap(yMin, yMax, 0, hBot);
            if (botOverlap) {
              const [y1, y2] = botOverlap;
              const hOverlap = y2 - y1;
              const posOverlapY = y1 + hOverlap / 2;
              results.push(
                <mesh key={`tile-horiz-bot-${keySuffix}`} position={[localOffset, posOverlapY, 0.001]} raycast={() => null}>
                  <planeGeometry args={[segLen, hOverlap]} />
                  <meshStandardMaterial {...getMat(design.tileColorBottom, segLen, hOverlap)} />
                </mesh>
              );
            }

            // Top tile overlap
            const topOverlap = getOverlap(yMin, yMax, hBot, h);
            if (topOverlap) {
              const [y1, y2] = topOverlap;
              const hOverlap = y2 - y1;
              const posOverlapY = y1 + hOverlap / 2;
              results.push(
                <mesh key={`tile-horiz-top-${keySuffix}`} position={[localOffset, posOverlapY, 0.001]} raycast={() => null}>
                  <planeGeometry args={[segLen, hOverlap]} />
                  <meshStandardMaterial {...getMat(design.tileColorTop, segLen, hOverlap)} />
                </mesh>
              );
            }

            // Skirting strip
            if (hBot >= yMin && hBot <= yMax) {
              results.push(
                <mesh key={`skirting-${keySuffix}`} position={[localOffset, hBot, 0.005]} raycast={() => null}>
                  <planeGeometry args={[segLen, 0.12]} />
                  <meshStandardMaterial color="#6B4E31" roughness={0.8} />
                </mesh>
              );
            }

            return <group key={`group-horiz-${keySuffix}`}>{results}</group>;
          }

          if (split === 'vertical') {
            const wCenter = 0.73;
            const wSides = (wall.len - wCenter) / 2;
            const cStart = wSides;
            const cEnd = wSides + wCenter;

            const results = [];

            // Left side overlap
            const leftOverlap = getOverlap(segStart, segEnd, 0, cStart);
            if (leftOverlap) {
              const [oStart, oEnd] = leftOverlap;
              const oLen = oEnd - oStart;
              const oOffset = (oStart + oEnd) / 2 - wall.len / 2;
              results.push(
                <mesh key={`tile-vert-left-${keySuffix}`} position={[oOffset, posY, 0.001]} raycast={() => null}>
                  <planeGeometry args={[oLen, yHeight]} />
                  <meshStandardMaterial {...getMat(design.tileColorSides, oLen, yHeight)} />
                </mesh>
              );
            }

            // Center overlap
            const centerOverlap = getOverlap(segStart, segEnd, cStart, cEnd);
            if (centerOverlap) {
              const [oStart, oEnd] = centerOverlap;
              const oLen = oEnd - oStart;
              const oOffset = (oStart + oEnd) / 2 - wall.len / 2;
              results.push(
                <mesh key={`tile-vert-center-${keySuffix}`} position={[oOffset, posY, 0.002]} raycast={() => null}>
                  <planeGeometry args={[oLen, yHeight]} />
                  <meshStandardMaterial {...getMat(design.tileColorCenter, oLen, yHeight)} />
                </mesh>
              );
            }

            // Right side overlap
            const rightOverlap = getOverlap(segStart, segEnd, cEnd, wall.len);
            if (rightOverlap) {
              const [oStart, oEnd] = rightOverlap;
              const oLen = oEnd - oStart;
              const oOffset = (oStart + oEnd) / 2 - wall.len / 2;
              results.push(
                <mesh key={`tile-vert-right-${keySuffix}`} position={[oOffset, posY, 0.001]} raycast={() => null}>
                  <planeGeometry args={[oLen, yHeight]} />
                  <meshStandardMaterial {...getMat(design.tileColorSides, oLen, yHeight)} />
                </mesh>
              );
            }

            return <group key={`group-vert-${keySuffix}`}>{results}</group>;
          }

          return null;
        };

        const segments = getWallSegments(wall.len, i, state.wallOpenings);

        return (
          <group key={`w-${i}`} ref={el => { wallGroupsRef.current[i] = el; }} position={[wall.cx, 0, wall.cz]} rotation={[0, wall.rotY, 0]}>
            {segments.map((seg, segIdx) => {
              const segLen = seg.end - seg.start;
              const segCenter = (seg.start + seg.end) / 2;
              const localOffset = segCenter - wall.len / 2;
              const boxZ = -thickness / 2;

              if (seg.type === 'solid') {
                return (
                  <group key={`seg-${segIdx}`}>
                    {/* Wall structure box */}
                    <mesh position={[localOffset, h / 2, boxZ]} castShadow receiveShadow raycast={() => null}>
                      <boxGeometry args={[segLen, h, thickness]} />
                      <meshStandardMaterial
                        color="#ffffff"
                        roughness={0.9}
                      />
                    </mesh>
                    {/* Tiles on the inside face */}
                    {renderTilePlanes(seg.start, seg.end, 0, h, `${segIdx}`)}
                  </group>
                );
              } else {
                const op = seg.opening!;
                const topH = h - (op.sillHeight + op.height);
                const results = [];

                if (topH > 0.01) {
                  const posY = (op.sillHeight + op.height) + topH / 2;
                  results.push(
                    <group key={`seg-top-${segIdx}`}>
                      {/* Top structure box */}
                      <mesh position={[localOffset, posY, boxZ]} castShadow receiveShadow raycast={() => null}>
                        <boxGeometry args={[segLen, topH, thickness]} />
                        <meshStandardMaterial
                          color="#ffffff"
                          roughness={0.9}
                        />
                      </mesh>
                      {/* Tiles on top structure */}
                      {renderTilePlanes(seg.start, seg.end, op.sillHeight + op.height, h, `${segIdx}-top`)}
                    </group>
                  );
                }

                if (op.sillHeight > 0.01) {
                  const posY = op.sillHeight / 2;
                  results.push(
                    <group key={`seg-bot-${segIdx}`}>
                      {/* Bottom structure box */}
                      <mesh position={[localOffset, posY, boxZ]} castShadow receiveShadow raycast={() => null}>
                        <boxGeometry args={[segLen, op.sillHeight, thickness]} />
                        <meshStandardMaterial
                          color="#ffffff"
                          roughness={0.9}
                        />
                      </mesh>
                      {/* Tiles on bottom structure */}
                      {renderTilePlanes(seg.start, seg.end, 0, op.sillHeight, `${segIdx}-bot`)}
                    </group>
                  );
                }

                return <group key={`seg-opening-group-${segIdx}`}>{results}</group>;
              }
            })}

            {/* Click/hover target for placing openings on this wall */}
            {activePlacement && (
              <mesh
                position={[0, h / 2, -thickness / 2]}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  const dx = wall.p2[0] - wall.p1[0];
                  const dz = wall.p2[1] - wall.p1[1];
                  const hitPoint = e.point;
                  const proj = (hitPoint.x - wall.p1[0]) * (dx / wall.len) + (hitPoint.z - wall.p1[1]) * (dz / wall.len);
                  const halfW = activePlacement.width / 2;
                  const min = halfW + 0.02;
                  const max = wall.len - halfW - 0.02;
                  const clamped = max > min ? Math.max(min, Math.min(max, proj)) : Math.max(halfW, Math.min(wall.len - halfW, proj));
                  setHoveredWall({ idx: i, offset: clamped });
                }}
                onPointerOut={() => {
                  setHoveredWall(null);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const dx = wall.p2[0] - wall.p1[0];
                  const dz = wall.p2[1] - wall.p1[1];
                  const hitPoint = e.point;
                  const proj = (hitPoint.x - wall.p1[0]) * (dx / wall.len) + (hitPoint.z - wall.p1[1]) * (dz / wall.len);
                  const halfW = activePlacement.width / 2;
                  const min = halfW + 0.02;
                  const max = wall.len - halfW - 0.02;
                  const clamped = max > min ? Math.max(min, Math.min(max, proj)) : Math.max(halfW, Math.min(wall.len - halfW, proj));

                  setState(prev => ({
                    ...prev,
                    wallOpenings: [
                      ...prev.wallOpenings,
                      {
                        id: `opening_${Date.now()}`,
                        type: activePlacement.type,
                        style: activePlacement.style,
                        name: activePlacement.name,
                        wallIndex: i,
                        positionOffset: clamped,
                        width: activePlacement.width,
                        height: activePlacement.height,
                        sillHeight: activePlacement.sillHeight,
                      }
                    ]
                  }));
                  setActivePlacement(null);
                  setHoveredWall(null);
                }}
              >
                <boxGeometry args={[wall.len, h, thickness + 0.02]} />
                <meshStandardMaterial
                  color={hoveredWall?.idx === i ? '#22c55e' : '#ffffff'}
                  transparent
                  opacity={hoveredWall?.idx === i ? 0.25 : 0}
                  depthWrite={false}
                />
              </mesh>
            )}

            {/* Wall Selection Target */}
            {activeCategory === 'wall_tiles' && !activePlacement && state.designType === 'bathroom' && (
              <mesh
                name="selection-target"
                position={[0, h / 2, 0.005]}
                onClick={(e) => {
                  remoteLog("WALL TARGET CLICKED index:", i);
                  e.stopPropagation();
                  setSelectedWallIdx(i);
                }}
              >
                <planeGeometry args={[wall.len, h]} />
                <meshStandardMaterial
                  color={selectedWallIdx === i ? '#22c55e' : '#ffffff'}
                  transparent
                  opacity={selectedWallIdx === i ? 0.25 : 0}
                  depthWrite={false}
                  side={THREE.FrontSide}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Ghost placement preview in Step 5 */}
      {hoveredWall && activePlacement && (() => {
        const wall = walls[hoveredWall.idx];
        if (!wall) return null;
        const dx = wall.p2[0] - wall.p1[0];
        const dz = wall.p2[1] - wall.p1[1];
        const ux = dx / wall.len;
        const uz = dz / wall.len;
        const nx = -uz;
        const nz = ux;

        const thickness = 0.08;
        const x = wall.p1[0] + ux * hoveredWall.offset - nx * (thickness / 2);
        const z = wall.p1[1] + uz * hoveredWall.offset - nz * (thickness / 2);
        return (
          <group position={[x, activePlacement.sillHeight, z]} rotation={[0, wall.rotY, 0]}>
            {activePlacement.type === 'door' ? (
              <Door3D style={activePlacement.style} width={activePlacement.width} height={activePlacement.height} depth={thickness} />
            ) : (
              <Window3D style={activePlacement.style} width={activePlacement.width} height={activePlacement.height} depth={thickness} />
            )}
            <mesh position={[0, activePlacement.height / 2, 0]}>
              <boxGeometry args={[activePlacement.width, activePlacement.height, thickness + 0.02]} />
              <meshBasicMaterial color="#22c55e" wireframe transparent opacity={0.5} />
            </mesh>
          </group>
        );
      })()}

      {/* Placed Doors & Windows */}
      {state.wallOpenings?.map((opening) => {
        const wall = walls[opening.wallIndex];
        if (!wall) return null;

        const thickness = 0.08;
        const dx = wall.p2[0] - wall.p1[0];
        const dz = wall.p2[1] - wall.p1[1];
        const ux = dx / wall.len;
        const uz = dz / wall.len;
        const nx = -uz;
        const nz = ux;

        const x = wall.p1[0] + ux * opening.positionOffset - nx * (thickness / 2);
        const z = wall.p1[1] + uz * opening.positionOffset - nz * (thickness / 2);

        const isSelected = selectedItemId === opening.id;

        return (
          <group
            key={opening.id}
            ref={el => { openingGroupsRef.current[opening.id] = el; }}
            position={[x, opening.sillHeight, z]}
            rotation={[0, wall.rotY, 0]}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelectedItemId(opening.id);
              draggingOpeningId.current = opening.id;
              setOrbitEnabled(false);
            }}
          >
            {opening.type === 'door' ? (
              <Door3D style={opening.style} width={opening.width} height={opening.height} depth={thickness} />
            ) : (
              <Window3D style={opening.style} width={opening.width} height={opening.height} depth={thickness} />
            )}
            {isSelected && (
              <mesh position={[0, opening.height / 2, 0]}>
                <boxGeometry args={[opening.width + 0.05, opening.height + 0.05, thickness + 0.02]} />
                <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.6} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Placed items */}
      {placedItems.map(item => {
        const isSelected = !readOnly && selectedItemId === item.id;
        return (
          <group
            key={item.id}
            position={item.position}
            rotation={[0, item.rotation, 0]}
            scale={[0.3048, 0.3048, 0.3048]}
            onPointerDown={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              draggingItemId.current = item.id;
              setOrbitEnabled(false);
            }}
            onDoubleClick={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              setSelectedItemId(item.id);
            }}
          >
            {item.model ? (
              <DynamicFurnitureModel item={item} selected={isSelected} CustomFurniture={CustomFurniture} />
            ) : (
              <>
                {item.type === 'sink' && <SinkModel selected={isSelected} />}
                {item.type === 'bathtub' && <BathtubModel selected={isSelected} />}
                {item.type === 'shower' && <ShowerModel selected={isSelected} />}
                {item.type === 'toilet' && <ToiletModel selected={isSelected} />}
                {item.type === 'towel_rail' && <TowelRailModel selected={isSelected} />}
                {item.type === 'washing_machine' && <WashingMachineModel selected={isSelected} />}
                {item.type === 'light' && <WallLightModel selected={isSelected} />}
                {item.type === 'plant' && <PlantModel selected={isSelected} />}
                {!['sink', 'bathtub', 'shower', 'toilet', 'towel_rail', 'washing_machine', 'light', 'plant'].includes(item.type) && (
                  <DynamicFurnitureModel item={item} selected={isSelected} CustomFurniture={CustomFurniture} />
                )}
              </>
            )}
          </group>
        );
      })}

      {/* Placing-item ghost */}
      {isPlacingItem && (
        <group position={isPlacingItem.position} rotation={[0, isPlacingItem.rotation, 0]} scale={[0.3048, 0.3048, 0.3048]}>
          {isPlacingItem.model ? (
            <DynamicFurnitureModel item={isPlacingItem} selected={true} CustomFurniture={CustomFurniture} />
          ) : (
            <>
              {isPlacingItem.type === 'sink' && <SinkModel selected />}
              {isPlacingItem.type === 'bathtub' && <BathtubModel selected />}
              {isPlacingItem.type === 'shower' && <ShowerModel selected />}
              {isPlacingItem.type === 'toilet' && <ToiletModel selected />}
              {isPlacingItem.type === 'towel_rail' && <TowelRailModel selected />}
              {isPlacingItem.type === 'washing_machine' && <WashingMachineModel selected />}
              {isPlacingItem.type === 'light' && <WallLightModel selected />}
              {!['sink', 'bathtub', 'shower', 'toilet', 'towel_rail', 'washing_machine', 'light', 'plant'].includes(isPlacingItem.type) && (
                <DynamicFurnitureModel item={isPlacingItem} selected={true} CustomFurniture={CustomFurniture} />
              )}
            </>
          )}
        </group>
      )}

      {measurementSettings && (
        <MeasurementOverlay
          settings={measurementSettings}
          walls={walls}
          placedItems={placedItems}
          selectedItemId={selectedItemId}
        />
      )}

      <OrbitControls
        ref={controlsRef}
        enabled={orbitEnabled}
        target={[0, h * 0.28, 0]}
        enablePan={true}
        enableRotate={!topView}
        minDistance={3}
        maxDistance={Math.max(w, d) * 1.8}
        maxPolarAngle={topView ? 0 : Math.PI * 0.48}
        minPolarAngle={topView ? 0 : Math.PI * 0.05}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
      />
    </>
  );
}

// ─── CUSTOMISE ROOM DRAWER ───────────────────────────────────────────────────

function CustomiseRoomDrawer({
  state,
  numWalls,
  onChange,
  onClose,
}: {
  state: DesignState;
  numWalls: number;
  onChange: (s: Partial<DesignState>) => void;
  onClose: () => void;
}) {
  const { unit, widthFt, depthFt, heightFt, floorColor, wallDesigns } = state;
  const [selectedWallIdx, setSelectedWallIdx] = useState(0);

  const updateWallDesign = (idx: number, updates: Partial<WallSplitDesign>) => {
    const next = [...wallDesigns];
    next[idx] = { ...next[idx], ...updates };
    onChange({ wallDesigns: next });
  };

  const wallCount = Math.max(4, numWalls);

  return (
    <div className="absolute inset-y-0 left-0 w-80 bg-white shadow-2xl z-40 border-r border-gray-100 flex flex-col font-sans overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-[#1A1A1A] text-white">
        <h2 className="font-semibold text-sm tracking-wider uppercase">Customise Room</h2>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Unit system */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Unit System</label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-full">
            {(['feet', 'cm'] as UnitSystem[]).map(u => (
              <button
                key={u}
                onClick={() => onChange({ unit: u })}
                className={`py-1.5 text-xs font-semibold tracking-wider uppercase rounded-full transition-all ${unit === u ? 'bg-white shadow text-[#1A1A1A]' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {u === 'feet' ? 'Feet' : 'Metric'}
              </button>
            ))}
          </div>
        </div>

        {/* Dimensions */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-400 uppercase border-b border-gray-100 pb-1.5">Room Dimensions</h3>
          {[
            { label: 'Width', val: widthFt, key: 'widthFt' as const },
            { label: 'Depth', val: depthFt, key: 'depthFt' as const },
            { label: 'Height', val: heightFt, key: 'heightFt' as const },
          ].map(({ label, val, key }) => {
            const isHeight = key === 'heightFt';
            const minLimit = isHeight ? (unit === 'feet' ? 7.2 : 220) : (unit === 'feet' ? 5.0 : 150);
            const maxLimit = isHeight ? (unit === 'feet' ? 13.0 : 400) : (unit === 'feet' ? 33.0 : 1000);
            const stepVal = unit === 'feet' ? 0.5 : 10;
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-gray-500 uppercase">{label}</span>
                <input
                  type="number"
                  value={unit === 'feet' ? val : feetToCm(val)}
                  step={stepVal}
                  min={minLimit}
                  max={maxLimit}
                  onChange={e => {
                    const v = parseFloat(e.target.value) || 0;
                    onChange({ [key]: unit === 'feet' ? v : fromCm(v) });
                  }}
                  onBlur={e => {
                    let v = parseFloat(e.target.value) || 0;
                    v = Math.max(minLimit, Math.min(maxLimit, v));
                    onChange({ [key]: unit === 'feet' ? v : fromCm(v) });
                  }}
                  className="w-full bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-[#1A1A1A] font-mono focus:outline-none focus:border-[#1A1A1A] rounded"
                />
              </div>
            );
          })}
        </div>

        {/* Room shape */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-400 uppercase border-b border-gray-100 pb-1.5">Room Shape</h3>
          <div className="grid grid-cols-2 gap-2">
            {(['rectangular', 'l-shape', 't-shape', 'u-shape', 'custom'] as RoomShape[]).map(s => (
              <button
                key={s}
                onClick={() => onChange({ shape: s })}
                className={`py-2 text-[10px] font-bold border rounded uppercase tracking-wider transition-all ${state.shape === s ? 'bg-[#1A1A1A] text-white border-transparent' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              >
                {s === 'rectangular' ? 'Rectangle' : s === 'l-shape' ? 'L-Shape' : s === 't-shape' ? 'T-Shape' : s === 'u-shape' ? 'U-Shape' : 'Cut Corner'}
              </button>
            ))}
          </div>
        </div>

        {/* Floor tiles */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-400 uppercase border-b border-gray-100 pb-1.5">Floor Tiles</h3>
          <div className="grid grid-cols-4 gap-2">
            {FLOOR_TILES.map(ft => (
              <button
                key={ft.id}
                onClick={() => onChange({ floorColor: ft.hex })}
                style={{ background: ft.hex }}
                className={`h-9 w-full rounded border-2 transition-all ${floorColor === ft.hex ? 'border-[#1A1A1A] scale-105 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
                title={ft.name}
              />
            ))}
          </div>
        </div>

        {/* Wall split & tiles */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold tracking-widest text-gray-400 uppercase border-b border-gray-100 pb-1.5">Wall Splits & Tiles</h3>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Select Wall</span>
            <select
              value={selectedWallIdx}
              onChange={e => setSelectedWallIdx(Number(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-[#1A1A1A] rounded focus:outline-none"
            >
              {Array.from({ length: wallCount }).map((_, i) => (
                <option key={i} value={i}>
                  Wall {i + 1} ({i === 0 ? 'Back' : i === 1 ? 'Right' : i === 2 ? 'Left' : 'Front'})
                </option>
              ))}
            </select>
          </div>

          {/* Split mode */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {[
              { id: 'full' as const, label: 'Single' },
              { id: 'horizontal' as const, label: 'Horiz.' },
              { id: 'vertical' as const, label: 'Vert.' },
            ].map(mode => {
              const active = (wallDesigns[selectedWallIdx]?.splitMode || 'full') === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => updateWallDesign(selectedWallIdx, { splitMode: mode.id })}
                  className={`py-2 text-[10px] font-bold border rounded transition-all uppercase tracking-wider ${active ? 'bg-[#1A1A1A] text-white border-transparent' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          {/* Color pickers per split mode */}
          {wallDesigns[selectedWallIdx]?.splitMode === 'full' && (
            <div className="space-y-2">
              <span className="text-[9px] text-gray-400 block font-semibold">Tile Color</span>
              <div className="grid grid-cols-4 gap-2">
                {TILE_COLORS.map(tc => (
                  <button
                    key={tc.id}
                    onClick={() => updateWallDesign(selectedWallIdx, { tileColorBottom: tc.hex })}
                    style={{ background: tc.hex }}
                    className={`h-8 w-full rounded border-2 transition-all ${wallDesigns[selectedWallIdx]?.tileColorBottom === tc.hex ? 'border-[#1A1A1A] scale-105' : 'border-gray-200'}`}
                    title={tc.name}
                  />
                ))}
              </div>
            </div>
          )}

          {wallDesigns[selectedWallIdx]?.splitMode === 'horizontal' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[9px] text-gray-400 block font-semibold">Bottom Tile</span>
                <div className="grid grid-cols-4 gap-2">
                  {TILE_COLORS.map(tc => (
                    <button key={tc.id} onClick={() => updateWallDesign(selectedWallIdx, { tileColorBottom: tc.hex })} style={{ background: tc.hex }}
                      className={`h-8 w-full rounded border-2 transition-all ${wallDesigns[selectedWallIdx]?.tileColorBottom === tc.hex ? 'border-[#1A1A1A] scale-105' : 'border-gray-200'}`} title={tc.name} />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] text-gray-400 block font-semibold">Top Tile</span>
                <div className="grid grid-cols-4 gap-2">
                  {TILE_COLORS.map(tc => (
                    <button key={tc.id} onClick={() => updateWallDesign(selectedWallIdx, { tileColorTop: tc.hex })} style={{ background: tc.hex }}
                      className={`h-8 w-full rounded border-2 transition-all ${wallDesigns[selectedWallIdx]?.tileColorTop === tc.hex ? 'border-[#1A1A1A] scale-105' : 'border-gray-200'}`} title={tc.name} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {wallDesigns[selectedWallIdx]?.splitMode === 'vertical' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[9px] text-gray-400 block font-semibold">Center Accent</span>
                <div className="grid grid-cols-4 gap-2">
                  {TILE_COLORS.map(tc => (
                    <button key={tc.id} onClick={() => updateWallDesign(selectedWallIdx, { tileColorCenter: tc.hex })} style={{ background: tc.hex }}
                      className={`h-8 w-full rounded border-2 transition-all ${wallDesigns[selectedWallIdx]?.tileColorCenter === tc.hex ? 'border-[#1A1A1A] scale-105' : 'border-gray-200'}`} title={tc.name} />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[9px] text-gray-400 block font-semibold">Sides Tile</span>
                <div className="grid grid-cols-4 gap-2">
                  {TILE_COLORS.map(tc => (
                    <button key={tc.id} onClick={() => updateWallDesign(selectedWallIdx, { tileColorSides: tc.hex })} style={{ background: tc.hex }}
                      className={`h-8 w-full rounded border-2 transition-all ${wallDesigns[selectedWallIdx]?.tileColorSides === tc.hex ? 'border-[#1A1A1A] scale-105' : 'border-gray-200'}`} title={tc.name} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ICONS ───────────────────────────────────────────────────────────

const SINK_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6z" />
    <path d="M12 2v4M10 2h4" />
  </svg>
);
const BATHTUB_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 10h20v8a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4v-8z" />
    <path d="M4 6v4M2 14c4-4 16-4 20 0M6 22v1M18 22v1" />
  </svg>
);
const TOWEL_RAIL_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M6 3v18M18 3v18M6 7h12M6 12h12M6 17h12" />
  </svg>
);
const SHOWER_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 4h16M12 4v8" />
    <path d="M8 12a4 4 0 0 1 8 0" />
    <path d="M10 16v1M12 16v2M14 16v1" />
  </svg>
);
const TOILET_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 3h6v8H5zM8 11v8a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-8H8z" />
  </svg>
);
const WASHING_MACHINE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <circle cx="12" cy="13" r="4" />
    <circle cx="12" cy="13" r="2" />
    <path d="M7 6h2M15 6h2" />
  </svg>
);
const LIGHT_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="9" r="4" />
    <path d="M9 13h6M12 17v4M10 21h4" />
  </svg>
);
const ACCESSORIES_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M8 22h8v-6a4 4 0 0 0-4-4H12a4 4 0 0 0-4 4v6z" />
    <path d="M12 12V3M10 4l4 4" />
  </svg>
);

// Helper to offset a 2D polygon path (tangent offset)
function getOffsetPolygon(vertices: [number, number][], offset: number): [number, number][] {
  const n = vertices.length;
  const result: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];

    // Edge 1 (prev -> curr)
    const dx1 = curr[0] - prev[0];
    const dy1 = curr[1] - prev[1];
    const len1 = Math.hypot(dx1, dy1) || 1;
    const nx1 = -dy1 / len1;
    const ny1 = dx1 / len1;

    // Edge 2 (curr -> next)
    const dx2 = next[0] - curr[0];
    const dy2 = next[1] - curr[1];
    const len2 = Math.hypot(dx2, dy2) || 1;
    const nx2 = -dy2 / len2;
    const ny2 = dx2 / len2;

    // Average normal at vertex i
    let nx = (nx1 + nx2) / 2;
    let ny = (ny1 + ny2) / 2;
    const len = Math.hypot(nx, ny);
    if (len > 0.0001) {
      nx /= len;
      ny /= len;
    }

    // Scale offset to keep wall thickness constant (miter limit)
    const cosHalfTheta = nx * nx1 + ny * ny1;
    const factor = cosHalfTheta > 0.1 ? 1 / cosHalfTheta : 1.0;
    const clampedFactor = Math.min(2.5, factor);

    result.push([
      curr[0] + nx * offset * clampedFactor,
      curr[1] + ny * offset * clampedFactor
    ]);
  }
  return result;
}

// Generates a 2D shape representing a hollow room outline with rounded corners
function createWallShape(polygon: [number, number][], thickness: number, smoothCorners: boolean): THREE.Shape {
  // Map vertices to shape space: x_s = x, y_s = -z
  const shapePolygon = polygon.map(p => [p[0], -p[1]] as [number, number]);

  // Outer boundary (offsets outwards: offset = thickness/2 since shapePolygon is clockwise)
  const outerVerts = getOffsetPolygon(shapePolygon, thickness / 2);
  // Inner boundary (offsets inwards: offset = -thickness/2)
  const innerVerts = getOffsetPolygon(shapePolygon, -thickness / 2);

  // Outer CCW, inner CW
  const outerVertsCCW = [...outerVerts].reverse();
  const innerVertsCW = innerVerts;

  const outerRadius = smoothCorners ? 0.15 : 0.12;
  const innerRadius = smoothCorners ? 0.07 : 0.04;

  const shape = new THREE.Shape();

  const drawRoundedPath = (path: THREE.Path | THREE.Shape, verts: [number, number][], rad: number, isHole: boolean) => {
    const n = verts.length;
    if (n < 3) return;

    const getMidpoint = (p1: [number, number], p2: [number, number]): [number, number] => [
      (p1[0] + p2[0]) / 2,
      (p1[1] + p2[1]) / 2
    ];

    const startPt = getMidpoint(verts[0], verts[1]);
    if (isHole) {
      path.moveTo(startPt[0], startPt[1]);
    } else {
      (path as THREE.Shape).moveTo(startPt[0], startPt[1]);
    }

    for (let i = 0; i < n; i++) {
      const pPrev = verts[i];
      const pCurr = verts[(i + 1) % n];
      const pNext = verts[(i + 2) % n];

      const dx1 = pCurr[0] - pPrev[0];
      const dy1 = pCurr[1] - pPrev[1];
      const len1 = Math.hypot(dx1, dy1) || 1;

      const dx2 = pNext[0] - pCurr[0];
      const dy2 = pNext[1] - pCurr[1];
      const len2 = Math.hypot(dx2, dy2) || 1;

      const r = Math.min(rad, len1 / 2, len2 / 2);
      const startX = pCurr[0] - (dx1 / len1) * r;
      const startY = pCurr[1] - (dy1 / len1) * r;

      const endX = pCurr[0] + (dx2 / len2) * r;
      const endY = pCurr[1] + (dy2 / len2) * r;

      path.lineTo(startX, startY);
      path.quadraticCurveTo(pCurr[0], pCurr[1], endX, endY);
    }
    path.closePath();
  };

  drawRoundedPath(shape, outerVertsCCW, outerRadius, false);

  const hole = new THREE.Path();
  drawRoundedPath(hole, innerVertsCW, innerRadius, true);
  shape.holes.push(hole);

  return shape;
}

// Camera controller to transition wizard steps smoothly
function CameraController({ wizardStep, controlsRef }: { wizardStep: number; controlsRef: React.RefObject<any> }) {
  const { camera } = useThree();
  const [prevStep, setPrevStep] = useState(wizardStep);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const targetPos = useMemo(() => {
    if (wizardStep === 2) return new THREE.Vector3(0, 6.5, 0);
    if (wizardStep === 1) return new THREE.Vector3(0, 4, 6);
    return new THREE.Vector3(0, 6, 7);
  }, [wizardStep]);

  useEffect(() => {
    if (wizardStep !== prevStep) {
      setPrevStep(wizardStep);
      setIsTransitioning(true);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  }, [wizardStep, prevStep, controlsRef]);

  useFrame(() => {
    if (isTransitioning) {
      camera.position.lerp(targetPos, 0.15);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
      if (camera.position.distanceTo(targetPos) < 0.05) {
        setIsTransitioning(false);
      }
    } else if (wizardStep === 2) {
      // Lock camera rotation to flat top-down looking straight down at origin (0, 0, 0)
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
      camera.position.x = 0;
      camera.position.z = 0;
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
}

// ─── ROOM PREVIEW 3D (WIZARD) ──────────────────────────────────────────────────

function RoomPreview3D({
  shape,
  width,
  length,
  height,
  unit,
  rotate,
  onStartDrag,
  onEndDrag,
  onVertexDrag,
  onWallDrag,
  previewZoomTrigger,
  setPreviewZoomTrigger,
  selectedRoomType,
  wizardStep,
  wallOpenings,
  onAddWallOpening,
  onUpdateWallOpeningOffset,
  onRemoveWallOpening,
  activePlacement,
  setActivePlacement,
  placedItems = [],
  setPlacedItems,
  isPlacingItem,
  setIsPlacingItem,
  selectedItemId,
  setSelectedItemId,
  recordHistory,
  setOrbitEnabled,
  CustomFurniture,
  measurementSettings,
  isMeasuring,
  setIsMeasuring,
  savedMeasurements,
  setSavedMeasurements,
  measureStartPoint,
  setMeasureStartPoint,
  measureTempEndPoint,
  setMeasureTempEndPoint,
  readOnly = false,
  roomOffset = { x: 0, z: 0 },
}: {
  shape: RoomShape;
  width: number;
  length: number;
  height: number;
  unit: 'cm' | 'm';
  rotate: boolean;
  onStartDrag: () => void;
  onEndDrag: () => void;
  onVertexDrag: (idx: number, hitX: number, hitZ: number) => void;
  onWallDrag: (idx: number, hitX: number, hitZ: number) => void;
  previewZoomTrigger: 'in' | 'out' | null;
  setPreviewZoomTrigger: (t: 'in' | 'out' | null) => void;
  selectedRoomType: 'room' | 'bathroom';
  wizardStep: number;
  wallOpenings: WallOpening[];
  onAddWallOpening: (op: WallOpening) => void;
  onUpdateWallOpeningOffset: (id: string, offset: number, wallIndex?: number) => void;
  onRemoveWallOpening: (id: string) => void;
  activePlacement: { type: 'door' | 'window'; style: string; name: string; width: number; height: number; sillHeight: number } | null;
  setActivePlacement: (ap: any) => void; placedItems?: any[]; setPlacedItems?: any; isPlacingItem?: any; setIsPlacingItem?: any; selectedItemId?: string | null; setSelectedItemId?: any; recordHistory?: any; setOrbitEnabled?: any; CustomFurniture?: any;
  measurementSettings?: any;
  isMeasuring?: boolean;
  setIsMeasuring?: (v: boolean) => void;
  savedMeasurements?: any[];
  setSavedMeasurements?: React.Dispatch<React.SetStateAction<any[]>>;
  measureStartPoint?: THREE.Vector3 | null;
  setMeasureStartPoint?: (p: THREE.Vector3 | null) => void;
  measureTempEndPoint?: THREE.Vector3 | null;
  setMeasureTempEndPoint?: (p: THREE.Vector3 | null) => void;
  readOnly?: boolean;
  roomOffset?: { x: number; z: number };
}) {
  const ref = useRef<any>(null);
  const { camera, gl } = useThree();
  const { selectedWallIdx, setSelectedWallIdx } = useDesignerStore();
  const [draggingVertexIdx, setDraggingVertexIdx] = useState<number | null>(null);
  const [draggingWallIdx, setDraggingWallIdx] = useState<number | null>(null);
  const [draggingOpeningId, setDraggingOpeningId] = useState<string | null>(null);
  const [hoveredWall, setHoveredWall] = useState<{ idx: number; offset: number } | null>(null);
  const draggingItemIdRef = useRef<string | null>(null);

  const isDraggingSomething = draggingVertexIdx !== null || draggingWallIdx !== null || draggingOpeningId !== null;

  // Logical steps controls
  const showResizing = wizardStep === 2;
  const isFloorMapped = wizardStep >= 3;
  const showOpeningsEditor = wizardStep === 4;

  const polygon = useMemo((): [number, number][] => {
    const w = Math.max(1.5, width);
    const d = Math.max(1.5, length);
    if (shape === 'square') {
      const s = Math.min(w, d);
      return [[-s / 2, -s / 2], [s / 2, -s / 2], [s / 2, s / 2], [-s / 2, s / 2]];
    }
    if (shape === 'l-shape') {
      return [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, 0],
        [0, 0],
        [0, d / 2],
        [-w / 2, d / 2]
      ];
    }
    if (shape === 't-shape') {
      return [
        [-w / 4, -d / 2],
        [w / 4, -d / 2],
        [w / 4, 0],
        [w / 2, 0],
        [w / 2, d / 2],
        [-w / 2, d / 2],
        [-w / 2, 0],
        [-w / 4, 0]
      ];
    }
    if (shape === 'u-shape') {
      return [
        [-w / 2, -d / 2],
        [-w / 4, -d / 2],
        [-w / 4, 0],
        [w / 4, 0],
        [w / 4, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2]
      ];
    }
    if (shape === 'custom') {
      return [
        [-w / 2, -d / 2],
        [w / 4, -d / 2],
        [w / 2, -d / 4],
        [w / 2, d / 2],
        [-w / 2, d / 2]
      ];
    }
    return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  }, [shape, width, length]);

  const floorGeom = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(polygon[0][0], -polygon[0][1]);
    for (let i = 1; i < polygon.length; i++) {
      s.lineTo(polygon[i][0], -polygon[i][1]);
    }
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, [polygon]);

  const walls = useMemo(() => {
    return polygon.map((p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      const dx = q[0] - p[0];
      const dz = q[1] - p[1];
      const len = Math.sqrt(dx * dx + dz * dz);
      return {
        p1: p,
        p2: q,
        cx: (p[0] + q[0]) / 2,
        cz: (p[1] + q[1]) / 2,
        len,
        rotY: Math.atan2(-dz, dx),
        dx,
        dz,
      };
    });
  }, [polygon]);

  const wallShape = useMemo(() => {
    const thickness = wizardStep < 4 ? 0.08 : 0.18;
    return createWallShape(polygon, thickness, wizardStep < 4);
  }, [polygon, wizardStep]);

  const extrudeSettings = useMemo(() => ({
    depth: wizardStep < 4 ? 0.05 : Math.max(2.2, height),
    bevelEnabled: false,
  }), [height, wizardStep]);

  const floorTexture: any = useMemo(() => getTileTexture('#ffffff', 8, 8), []);
  const woodTexture: any = useMemo(() => getWoodTexture('#b88b5c', 8, 8), []);

  const previewWallGroupsRef = useRef<any[]>([]);
  const previewOpeningGroupsRef = useRef<Record<string, any>>({});

  useFrame((state, delta) => {
    if (previewZoomTrigger === 'in') {
      camera.position.multiplyScalar(0.9);
      setPreviewZoomTrigger(null);
    } else if (previewZoomTrigger === 'out') {
      camera.position.multiplyScalar(1.1);
      setPreviewZoomTrigger(null);
    }

    if (rotate && ref.current) {
      ref.current.rotation.y += delta * 0.15;
    } else if (!rotate && ref.current) {
      ref.current.rotation.y = 0;
    }

    const camX = camera.position.x;
    const camZ = camera.position.z;

    walls.forEach((wall, wallIdx) => {
      let isVisible = true;
      if (!rotate) {
        const dx = wall.p2[0] - wall.p1[0];
        const dz = wall.p2[1] - wall.p1[1];
        const nx = -dz / wall.len;
        const nz = dx / wall.len;
        const dot = (camX - wall.cx) * nx + (camZ - wall.cz) * nz;
        isVisible = dot > 0;
      }
      const opacityVal = isVisible ? 1.0 : 0.0;

      const group = previewWallGroupsRef.current[wallIdx];
      if (group) {
        group.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = isVisible;
            child.receiveShadow = isVisible;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat: any) => {
              if (mat) {
                if (mat.userData.originalOpacity === undefined) {
                  mat.userData.originalOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
                }
                if (mat.userData.originalTransparent === undefined) {
                  mat.userData.originalTransparent = mat.transparent !== undefined ? mat.transparent : false;
                }
                mat.transparent = opacityVal < 1.0 || mat.userData.originalTransparent;
                mat.opacity = mat.userData.originalOpacity * opacityVal;
                mat.depthWrite = isVisible;
                child.visible = isVisible;
              }
            });
          }
        });
      }
    });

    wallOpenings.forEach((opening) => {
      const wallIdx = opening.wallIndex;
      const wall = walls[wallIdx];
      if (!wall) return;

      let isVisible = true;
      if (!rotate) {
        const dx = wall.p2[0] - wall.p1[0];
        const dz = wall.p2[1] - wall.p1[1];
        const nx = -dz / wall.len;
        const nz = dx / wall.len;
        const dot = (camX - wall.cx) * nx + (camZ - wall.cz) * nz;
        isVisible = dot > 0;
      }
      const opacityVal = isVisible ? 1.0 : 0.0;

      const group = previewOpeningGroupsRef.current[opening.id];
      if (group) {
        group.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = isVisible;
            child.receiveShadow = isVisible;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat: any) => {
              if (mat) {
                if (mat.userData.originalOpacity === undefined) {
                  mat.userData.originalOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
                }
                if (mat.userData.originalTransparent === undefined) {
                  mat.userData.originalTransparent = mat.transparent !== undefined ? mat.transparent : false;
                }
                mat.transparent = opacityVal < 1.0 || mat.userData.originalTransparent;
                mat.opacity = mat.userData.originalOpacity * opacityVal;
                mat.depthWrite = isVisible;
                child.visible = isVisible;
              }
            });
          }
        });
      }
    });
  });

  const raycasterRef = useMemo(() => new THREE.Raycaster(), []);
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  const getFloorHit = useCallback((e: PointerEvent): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.setFromCamera(new THREE.Vector2(mx, my), camera);
    const pt = new THREE.Vector3();
    return raycasterRef.ray.intersectPlane(floorPlane, pt) ? pt : null;
  }, [camera, gl, raycasterRef, floorPlane]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      let hit = getFloorHit(e);
      if (hit) {
        const activeId = draggingItemIdRef.current;
        const itemToMove = activeId ? placedItems.find((i: any) => i.id === activeId) : isPlacingItem;

        if (itemToMove) {
          const t = itemToMove.type;
          let itemW = 1.0;
          let itemD = 1.0;
          const dims = globalItemDimensions.get(itemToMove.id);
          if (dims) {
            itemW = dims.width;
            itemD = dims.depth;
          } else {
            const fallback = getItemDimensions(t);
            itemW = fallback.width;
            itemD = fallback.depth;
          }

          const snapped = clampItemToPolygon(
            hit,
            itemW,
            itemD,
            itemToMove.rotation || 0,
            polygon,
            shape,
            Math.max(1.5, width),
            Math.max(1.5, length),
            itemToMove.position ? { x: itemToMove.position[0], z: itemToMove.position[2] } : undefined
          );
          hit.x = snapped.x;
          hit.z = snapped.z;

          // Collision checking
          let collides = false;
          const candidateCorners = getItemCorners(hit.x, hit.z, itemW, itemD, itemToMove.rotation || 0);
          const currentActiveId = activeId || (isPlacingItem ? isPlacingItem.id : null);

          for (const other of placedItems) {
            if (other.id === currentActiveId) continue;

            let otherW = 1.0, otherD = 1.0;
            const otherDims = globalItemDimensions.get(other.id);
            if (otherDims) {
              otherW = otherDims.width;
              otherD = otherDims.depth;
            } else {
              const ot = other.type;
              if (ot === 'beds' || ot === 'bed') { otherW = 2.1; otherD = 2.1; }
              else if (ot === 'wardrobes' || ot === 'wardrobe') { otherW = 1.25; otherD = 1.25; }
              else if (ot === 'sofa' || ot === 'sofas') { otherW = 2.15; otherD = 2.15; }
              else if (ot === 'table' || ot === 'dressing_table') { otherW = 1.55; otherD = 1.55; }
              else if (ot === 'chair' || ot === 'chairs') { otherW = 0.65; otherD = 0.65; }
              else if (ot === 'tv_cabinet') { otherW = 1.55; otherD = 1.55; }
              else if (ot === 'coffee_table') { otherW = 1.1; otherD = 1.1; }
            }

            const otherCorners = getItemCorners(other.position[0], other.position[2], otherW, otherD, other.rotation || 0);
            if (rectsIntersect(candidateCorners, otherCorners)) {
              collides = true;
              break;
            }
          }

          // Do not allow movement if it causes collision (collision lock)
          if (!collides) {
            if (isPlacingItem) {
              setIsPlacingItem({ ...isPlacingItem, position: [hit.x, 0, hit.z] });
            } else if (draggingItemIdRef.current) {
              setPlacedItems(placedItems.map(item =>
                item.id === draggingItemIdRef.current
                  ? { ...item, position: [hit.x, 0, hit.z] }
                  : item
              ));
            }
          }
        }
      }
    };
    const onUp = () => {
      if (draggingItemIdRef.current) {
        draggingItemIdRef.current = null;
        if (onEndDrag) onEndDrag();
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isPlacingItem, setIsPlacingItem, draggingItemIdRef, placedItems, setPlacedItems, getFloorHit, onEndDrag]);

  return (
    <group ref={ref} position={[roomOffset?.x || 0, 0, roomOffset?.z || 0]}>
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow={wizardStep !== 2}
        position={[0, -0.01, 0]}
        onClick={(e) => {
          if (isMeasuring && setSavedMeasurements && setMeasureStartPoint && setIsMeasuring) {
            e.stopPropagation();
            const pt = e.point;
            if (!measureStartPoint) {
              setMeasureStartPoint(pt);
            } else {
              setSavedMeasurements(prev => [...prev, {
                point_a_x: measureStartPoint.x,
                point_a_y: measureStartPoint.y,
                point_a_z: measureStartPoint.z,
                point_b_x: pt.x,
                point_b_y: pt.y,
                point_b_z: pt.z,
                distance: measureStartPoint.distanceTo(pt)
              }]);
              setMeasureStartPoint(null);
              setIsMeasuring(false);
            }
            return;
          }
          if (isPlacingItem) {
            e.stopPropagation();
            const currentList = useDesignerStore.getState().placedItems;
            const exists = currentList.some((i: any) => String(i.id) === String(isPlacingItem.id));
            if (!exists) {
              const next = [...currentList, isPlacingItem];
              setPlacedItems(next);
              recordHistory(next);
            }
            setSelectedItemId(isPlacingItem.id);
            setIsPlacingItem(null);
          } else if (selectedRoomType === 'bathroom') {
            setSelectedWallIdx(null);
          }
        }}
        onPointerMove={(e) => {
          if (isMeasuring && measureStartPoint && setMeasureTempEndPoint) {
            e.stopPropagation();
            setMeasureTempEndPoint(e.point);
          }
        }}
      >
        <primitive object={floorGeom} />
        <meshStandardMaterial
          map={rotate ? undefined : (selectedRoomType === 'room' ? woodTexture : floorTexture)}
          color={rotate ? "#D4C5B9" : "#ffffff"}
          roughness={selectedRoomType === 'room' ? 0.95 : 0.7}
        />
      </mesh>

      {/* Grid - Only in Step 2 */}
      {!rotate && showResizing && (
        <gridHelper args={[20, 20, '#d1d5db', '#e5e7eb']} position={[0, 0, 0]} />
      )}

      {/* Invisible plane to capture dragging on floor (XZ plane) */}
      {isDraggingSomething && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onPointerMove={(e) => {
            if (draggingVertexIdx !== null) {
              onVertexDrag(draggingVertexIdx, e.point.x, e.point.z);
            } else if (draggingWallIdx !== null) {
              onWallDrag(draggingWallIdx, e.point.x, e.point.z);
            }
          }}
          onPointerUp={() => {
            setDraggingVertexIdx(null);
            setDraggingWallIdx(null);
            setDraggingOpeningId(null);
            onEndDrag();
          }}
          onPointerMissed={() => {
            setDraggingVertexIdx(null);
            setDraggingWallIdx(null);
            setDraggingOpeningId(null);
            onEndDrag();
          }}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Segmented 3D Walls */}
      {(rotate || wizardStep === 2) ? (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.001, 0]}
          castShadow={false}
          receiveShadow={false}
        >
          <extrudeGeometry args={[wallShape, extrudeSettings]} />
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.9}

          />
        </mesh>
      ) : (
        walls.map((wall, wallIdx) => {
          const thickness = 0.08;
          const segments = getWallSegments(wall.len, wallIdx, rotate ? [] : wallOpenings);

          return (
            <group key={`preview-wall-seg-${wallIdx}`} ref={el => { previewWallGroupsRef.current[wallIdx] = el; }} position={[wall.cx, 0, wall.cz]} rotation={[0, wall.rotY, 0]}>
              {segments.map((seg, segIdx) => {
                const segLen = seg.end - seg.start;
                const segCenter = (seg.start + seg.end) / 2;
                const localOffset = segCenter - wall.len / 2;
                const boxZ = -thickness / 2;

                if (seg.type === 'solid') {
                  const boxH = rotate ? 0.02 : height;
                  const posY = rotate ? 0.01 : boxH / 2;
                  return (
                    <mesh key={`seg-${segIdx}`} position={[localOffset, posY, boxZ]} castShadow={!rotate && wizardStep !== 2} receiveShadow={!rotate && wizardStep !== 2} raycast={() => null}>
                      <boxGeometry args={[segLen, boxH, thickness]} />
                      <meshStandardMaterial
                        color="#ffffff"
                        roughness={0.9}
                      />
                    </mesh>
                  );
                } else {
                  const op = seg.opening!;
                  const topH = height - (op.sillHeight + op.height);
                  const results = [];
                  if (topH > 0.01 && !rotate) {
                    const posY = (op.sillHeight + op.height) + topH / 2;
                    results.push(
                      <mesh key={`seg-top-${segIdx}`} position={[localOffset, posY, boxZ]} castShadow={wizardStep !== 2} receiveShadow={wizardStep !== 2} raycast={() => null}>
                        <boxGeometry args={[segLen, topH, thickness]} />
                        <meshStandardMaterial
                          color="#ffffff"
                          roughness={0.9}
                        />
                      </mesh>
                    );
                  }
                  if (op.sillHeight > 0.01 && !rotate) {
                    const posY = op.sillHeight / 2;
                    results.push(
                      <mesh key={`seg-bot-${segIdx}`} position={[localOffset, posY, boxZ]} castShadow={wizardStep !== 2} receiveShadow={wizardStep !== 2} raycast={() => null}>
                        <boxGeometry args={[segLen, op.sillHeight, thickness]} />
                        <meshStandardMaterial
                          color="#ffffff"
                          roughness={0.9}
                        />
                      </mesh>
                    );
                  }
                  return <group key={`seg-opening-group-${segIdx}`}>{results}</group>;
                }
              })}
            </group>
          );
        })
      )}

      {/* Placed Doors & Windows */}
      {!rotate && wallOpenings.map((opening) => {
        const wall = walls[opening.wallIndex];
        if (!wall) return null;

        const thickness = 0.08;
        const dx = wall.p2[0] - wall.p1[0];
        const dz = wall.p2[1] - wall.p1[1];
        const ux = dx / wall.len;
        const uz = dz / wall.len;
        const nx = -uz;
        const nz = ux;

        const x = wall.p1[0] + ux * opening.positionOffset - nx * (thickness / 2);
        const z = wall.p1[1] + uz * opening.positionOffset - nz * (thickness / 2);

        const isThisDragged = draggingOpeningId === opening.id;
        const isSelected = selectedItemId === opening.id || isThisDragged;

        return (
          <group
            key={opening.id}
            ref={el => { previewOpeningGroupsRef.current[opening.id] = el; }}
            position={[x, opening.sillHeight, z]}
            rotation={[0, wall.rotY, 0]}
            onPointerDown={(e) => {
              if (!showOpeningsEditor) return;
              e.stopPropagation();
              setSelectedItemId?.(opening.id);
              try {
                if (e.nativeEvent?.target && 'setPointerCapture' in (e.nativeEvent.target as any)) {
                  (e.nativeEvent.target as any).setPointerCapture(e.pointerId);
                }
              } catch (_) { }
              setDraggingOpeningId(opening.id);
              onStartDrag();
            }}
            onPointerMove={(e) => {
              if (draggingOpeningId === opening.id) {
                e.stopPropagation();
                const hit = getFloorHit(e.nativeEvent);
                if (hit) {
                  let closestWallIdx = 0;
                  let closestDist = Infinity;
                  let closestOffset = 0;

                  walls.forEach((w, idx) => {
                    const dx = w.p2[0] - w.p1[0];
                    const dz = w.p2[1] - w.p1[1];
                    const ux = hit.x - w.p1[0];
                    const uz = hit.z - w.p1[1];
                    const wallLenSq = w.len * w.len;
                    const t = Math.max(0, Math.min(1, wallLenSq > 0 ? (ux * dx + uz * dz) / wallLenSq : 0));
                    const projX = w.p1[0] + t * dx;
                    const projZ = w.p1[1] + t * dz;
                    const dist = Math.hypot(hit.x - projX, hit.z - projZ);
                    if (dist < closestDist) {
                      closestDist = dist;
                      closestWallIdx = idx;
                      closestOffset = t * w.len;
                    }
                  });

                  const closestWall = walls[closestWallIdx];
                  const halfW = opening.width / 2;
                  const min = halfW + 0.02;
                  const max = closestWall.len - halfW - 0.02;
                  let clamped = closestOffset;
                  if (max > min) {
                    clamped = Math.max(min, Math.min(max, closestOffset));
                  } else {
                    clamped = Math.max(halfW, Math.min(closestWall.len - halfW, closestOffset));
                  }
                  onUpdateWallOpeningOffset(opening.id, clamped, closestWallIdx);
                }
              }
            }}
            onPointerUp={(e) => {
              if (draggingOpeningId === opening.id) {
                e.stopPropagation();
                try {
                  if (e.target && 'releasePointerCapture' in (e.target as any)) {
                    (e.target as any).releasePointerCapture(e.pointerId);
                  }
                } catch (_) { }
                setDraggingOpeningId(null);
                onEndDrag();
              }
            }}
          >
            {opening.type === 'door' ? (
              <Door3D style={opening.style} width={opening.width} height={opening.height} depth={thickness} />
            ) : (
              <Window3D style={opening.style} width={opening.width} height={opening.height} depth={thickness} />
            )}
            {isSelected && (
              <mesh position={[0, opening.height / 2, 0]}>
                <boxGeometry args={[opening.width + 0.05, opening.height + 0.05, thickness + 0.02]} />
                <meshBasicMaterial color="#4ade80" wireframe transparent opacity={0.6} />
              </mesh>
            )}

            {/* Step 4: Interactive sliding handles & delete button (shown ONLY when selected) */}
            {showOpeningsEditor && isSelected && (
              <>
                <Html position={[0, opening.height / 2, 0.05]} center distanceFactor={10}>
                  <div
                    className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center cursor-ew-resize shadow-2xl transition-all select-none ${isThisDragged ? 'bg-green-500 scale-110' : 'bg-black/70 hover:scale-105 active:scale-95'
                      }`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      try {
                        if (e.target && 'setPointerCapture' in (e.target as any)) {
                          (e.target as any).setPointerCapture(e.pointerId);
                        }
                      } catch (_) { }
                      setDraggingOpeningId(opening.id);
                      onStartDrag();
                    }}
                    onPointerMove={(e) => {
                      if (draggingOpeningId === opening.id) {
                        e.stopPropagation();
                        const hit = getFloorHit(e.nativeEvent);
                        if (hit) {
                          let closestWallIdx = 0;
                          let closestDist = Infinity;
                          let closestOffset = 0;

                          walls.forEach((w, idx) => {
                            const dx = w.p2[0] - w.p1[0];
                            const dz = w.p2[1] - w.p1[1];
                            const ux = hit.x - w.p1[0];
                            const uz = hit.z - w.p1[1];
                            const wallLenSq = w.len * w.len;
                            const t = Math.max(0, Math.min(1, wallLenSq > 0 ? (ux * dx + uz * dz) / wallLenSq : 0));
                            const projX = w.p1[0] + t * dx;
                            const projZ = w.p1[1] + t * dz;
                            const dist = Math.hypot(hit.x - projX, hit.z - projZ);
                            if (dist < closestDist) {
                              closestDist = dist;
                              closestWallIdx = idx;
                              closestOffset = t * w.len;
                            }
                          });

                          const closestWall = walls[closestWallIdx];
                          const halfW = opening.width / 2;
                          const min = halfW + 0.02;
                          const max = closestWall.len - halfW - 0.02;
                          let clamped = closestOffset;
                          if (max > min) {
                            clamped = Math.max(min, Math.min(max, closestOffset));
                          } else {
                            clamped = Math.max(halfW, Math.min(closestWall.len - halfW, closestOffset));
                          }
                          onUpdateWallOpeningOffset(opening.id, clamped, closestWallIdx);
                        }
                      }
                    }}
                    onPointerUp={(e) => {
                      if (draggingOpeningId === opening.id) {
                        e.stopPropagation();
                        try {
                          if (e.target && 'releasePointerCapture' in (e.target as any)) {
                            (e.target as any).releasePointerCapture(e.pointerId);
                          }
                        } catch (_) { }
                        setDraggingOpeningId(null);
                        onEndDrag();
                      }
                    }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  </div>
                </Html>

                {/* Delete & Resize buttons */}
                <Html position={[0, opening.height + 0.25, 0.05]} center distanceFactor={10}>
                  <div className="flex items-center gap-1.5">
                    {opening.type === 'door' && (selectedRoomType === 'bathroom' || useDesignerStore.getState().state.designType === 'bathroom') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          useDesignerStore.getState().setDoorSizeModal({
                            isOpen: true,
                            target: 'existing',
                            openingId: opening.id,
                            doorStyle: opening.style,
                            doorName: opening.name || 'Door',
                            currentWidth: opening.width,
                            currentHeight: opening.height,
                          });
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full flex items-center gap-1 shadow-lg transition-all border border-white/20 hover:scale-105 text-[9px] font-bold uppercase tracking-wider select-none whitespace-nowrap"
                        title="Resize Door"
                      >
                        <span>📐</span> Resize
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveWallOpening(opening.id);
                      }}
                      className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all border border-white/20 hover:scale-105"
                      title="Delete element"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </Html>
              </>
            )}
          </group>
        );
      })}

      {/* Ghost placement preview in Step 4 */}
      {showOpeningsEditor && hoveredWall && activePlacement && (() => {
        const wall = walls[hoveredWall.idx];
        if (!wall) return null;
        const dx = wall.p2[0] - wall.p1[0];
        const dz = wall.p2[1] - wall.p1[1];
        const x = wall.p1[0] + (dx / wall.len) * hoveredWall.offset;
        const z = wall.p1[1] + (dz / wall.len) * hoveredWall.offset;
        return (
          <group position={[x, activePlacement.sillHeight, z]} rotation={[0, wall.rotY, 0]}>
            {activePlacement.type === 'door' ? (
              <Door3D style={activePlacement.style} width={activePlacement.width} height={activePlacement.height} />
            ) : (
              <Window3D style={activePlacement.style} width={activePlacement.width} height={activePlacement.height} />
            )}
            <mesh position={[0, activePlacement.height / 2, 0.05]}>
              <boxGeometry args={[activePlacement.width, activePlacement.height, 0.1]} />
              <meshBasicMaterial color="#22c55e" wireframe transparent opacity={0.5} />
            </mesh>
          </group>
        );
      })()}

      {/* Interactive wall drag targets & click placement targets */}
      {walls.map((wall, idx) => {
        const normalX = wall.dz / wall.len;
        const normalZ = -wall.dx / wall.len;
        const offset = 0.65;
        const labelX = wall.cx + normalX * offset;
        const labelZ = wall.cz + normalZ * offset;

        const displayVal =
          unit === 'cm'
            ? Math.round(wall.len * 100) + ' cm'
            : wall.len.toFixed(2) + ' m';

        const isThisWallDragged = draggingWallIdx === idx;

        return (
          <group key={idx}>
            <mesh
              position={[wall.cx, (rotate || wizardStep === 2) ? 0.01 : height / 2, wall.cz]}
              rotation={[0, wall.rotY, 0]}
              onPointerDown={(e) => {
                if (rotate || isDraggingSomething) return;
                if (!showResizing) return;
                e.stopPropagation();
                try {
                  if (e.nativeEvent?.target && 'setPointerCapture' in (e.nativeEvent.target as any)) {
                    (e.nativeEvent.target as any).setPointerCapture(e.pointerId);
                  }
                } catch (_) { }
                setDraggingWallIdx(idx);
                onStartDrag();
              }}
              onPointerUp={(e) => {
                if (draggingWallIdx === idx) {
                  e.stopPropagation();
                  try {
                    if (e.nativeEvent?.target && 'releasePointerCapture' in (e.nativeEvent.target as any)) {
                      (e.nativeEvent.target as any).releasePointerCapture(e.pointerId);
                    }
                  } catch (_) { }
                  setDraggingWallIdx(null);
                  onEndDrag();
                }
              }}
              onPointerMove={(e) => {
                if (showOpeningsEditor && activePlacement) {
                  e.stopPropagation();
                  const dx = wall.p2[0] - wall.p1[0];
                  const dz = wall.p2[1] - wall.p1[1];
                  const hitPoint = e.point;
                  const proj = (hitPoint.x - wall.p1[0]) * (dx / wall.len) + (hitPoint.z - wall.p1[1]) * (dz / wall.len);
                  const halfW = activePlacement.width / 2;
                  const min = halfW + 0.02;
                  const max = wall.len - halfW - 0.02;
                  const clamped = max > min ? Math.max(min, Math.min(max, proj)) : Math.max(halfW, Math.min(wall.len - halfW, proj));
                  setHoveredWall({ idx, offset: clamped });
                }
              }}
              onPointerOut={() => {
                if (showOpeningsEditor) setHoveredWall(null);
              }}
              onClick={(e) => {
                if (showOpeningsEditor && activePlacement) {
                  e.stopPropagation();
                  const dx = wall.p2[0] - wall.p1[0];
                  const dz = wall.p2[1] - wall.p1[1];
                  const hitPoint = e.point;
                  const proj = (hitPoint.x - wall.p1[0]) * (dx / wall.len) + (hitPoint.z - wall.p1[1]) * (dz / wall.len);
                  const halfW = activePlacement.width / 2;
                  const min = halfW + 0.02;
                  const max = wall.len - halfW - 0.02;
                  const clamped = max > min ? Math.max(min, Math.min(max, proj)) : Math.max(halfW, Math.min(wall.len - halfW, proj));

                  onAddWallOpening({
                    id: `opening_${Date.now()}`,
                    type: activePlacement.type,
                    style: activePlacement.style,
                    name: activePlacement.name,
                    wallIndex: idx,
                    positionOffset: clamped,
                    width: activePlacement.width,
                    height: activePlacement.height,
                    sillHeight: activePlacement.sillHeight,
                  });
                  setActivePlacement(null);
                  setHoveredWall(null);
                } else if (selectedRoomType === 'bathroom') {
                  e.stopPropagation();
                  setSelectedWallIdx(idx);
                }
              }}
            >
              <boxGeometry args={[wall.len, (rotate || wizardStep === 2) ? 0.02 : height, 0.08]} />
              <meshStandardMaterial
                color={isThisWallDragged ? '#4ade80' : ((showOpeningsEditor && activePlacement) || (selectedRoomType === 'bathroom' && selectedWallIdx === idx) ? '#22c55e' : '#ffffff')}
                transparent
                opacity={isThisWallDragged ? 0.7 : ((showOpeningsEditor && activePlacement && hoveredWall?.idx === idx) || (selectedRoomType === 'bathroom' && selectedWallIdx === idx) ? 0.25 : 0)}
                depthWrite={false}
              />
            </mesh>

            {!rotate && showResizing && (
              <>
                {/* Architectural dimension text embedded in line */}
                <Html
                  position={[wall.cx + normalX * 0.35, 0.05, wall.cz + normalZ * 0.35]}
                  center
                  zIndexRange={[100, 0]}
                >
                  <div
                    className="bg-[#F4F4F5] text-[#333333] px-2 text-[14px] font-sans select-none flex items-center justify-center whitespace-nowrap"
                    style={{
                      transform: `rotate(${Math.abs(wall.rotY) > Math.PI / 2 + 0.1 ? (wall.rotY - Math.PI) * (-180 / Math.PI) : wall.rotY * (-180 / Math.PI)}deg)`
                    }}
                  >
                    {displayVal}
                  </div>
                </Html>

                {/* Main dimension line (thin) */}
                <mesh position={[wall.cx + normalX * 0.35, 0.01, wall.cz + normalZ * 0.35]} rotation={[0, wall.rotY, 0]}>
                  <boxGeometry args={[wall.len, 0.003, 0.003]} />
                  <meshBasicMaterial color="#71717a" />
                </mesh>

                {/* Start slash tick at 45 degrees */}
                <mesh position={[wall.p1[0] + normalX * 0.35, 0.01, wall.p1[1] + normalZ * 0.35]} rotation={[0, wall.rotY + Math.PI / 4, 0]}>
                  <boxGeometry args={[0.003, 0.003, 0.12]} />
                  <meshBasicMaterial color="#52525b" />
                </mesh>

                {/* End slash tick at 45 degrees */}
                <mesh position={[wall.p2[0] + normalX * 0.35, 0.01, wall.p2[1] + normalZ * 0.35]} rotation={[0, wall.rotY + Math.PI / 4, 0]}>
                  <boxGeometry args={[0.003, 0.003, 0.12]} />
                  <meshBasicMaterial color="#52525b" />
                </mesh>

                {/* Extension guide lines */}
                <mesh position={[wall.p1[0] + normalX * 0.175, 0.01, wall.p1[1] + normalZ * 0.175]} rotation={[0, wall.rotY + Math.PI / 2, 0]}>
                  <boxGeometry args={[0.35, 0.001, 0.001]} />
                  <meshBasicMaterial color="#d4d4d8" transparent opacity={0.6} />
                </mesh>
                <mesh position={[wall.p2[0] + normalX * 0.175, 0.01, wall.p2[1] + normalZ * 0.175]} rotation={[0, wall.rotY + Math.PI / 2, 0]}>
                  <boxGeometry args={[0.35, 0.001, 0.001]} />
                  <meshBasicMaterial color="#d4d4d8" transparent opacity={0.6} />
                </mesh>
              </>
            )}
          </group>
        );
      })}

      {/* Placed items inside RoomPreview3D */}
      {placedItems && placedItems.map((item: any) => {
        const isSelected = !readOnly && selectedItemId === item.id;
        return (
          <group
            key={item.id}
            position={item.position}
            rotation={[0, item.rotation, 0]}
            scale={[0.3048, 0.3048, 0.3048]}
            onPointerDown={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              draggingItemIdRef.current = item.id;
              if (onStartDrag) onStartDrag();
            }}
            onDoubleClick={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              if (setSelectedItemId) setSelectedItemId(item.id);
            }}
          >
            {item.model ? (
              <DynamicFurnitureModel item={item} selected={isSelected} CustomFurniture={CustomFurniture} />
            ) : (
              <>
                {item.type === 'sink' && <SinkModel selected={isSelected} />}
                {item.type === 'bathtub' && <BathtubModel selected={isSelected} />}
                {item.type === 'shower' && <ShowerModel selected={isSelected} />}
                {item.type === 'toilet' && <ToiletModel selected={isSelected} />}
                {item.type === 'towel_rail' && <TowelRailModel selected={isSelected} />}
                {item.type === 'washing_machine' && <WashingMachineModel selected={isSelected} />}
                {item.type === 'light' && <WallLightModel selected={isSelected} />}
                {item.type === 'plant' && <PlantModel selected={isSelected} />}
                {!['sink', 'bathtub', 'shower', 'toilet', 'towel_rail', 'washing_machine', 'light', 'plant'].includes(item.type) && (
                  <DynamicFurnitureModel item={item} selected={isSelected} CustomFurniture={CustomFurniture} />
                )}
              </>
            )}
          </group>
        );
      })}

      {/* Placing-item ghost inside RoomPreview3D */}
      {isPlacingItem && (
        <group position={isPlacingItem.position} rotation={[0, isPlacingItem.rotation, 0]} scale={[0.3048, 0.3048, 0.3048]}>
          {isPlacingItem.model ? (
            <DynamicFurnitureModel item={isPlacingItem} selected={true} CustomFurniture={CustomFurniture} />
          ) : (
            <>
              {isPlacingItem.type === 'sink' && <SinkModel selected={true} />}
              {isPlacingItem.type === 'bathtub' && <BathtubModel selected={true} />}
              {isPlacingItem.type === 'shower' && <ShowerModel selected={true} />}
              {isPlacingItem.type === 'toilet' && <ToiletModel selected={true} />}
              {isPlacingItem.type === 'towel_rail' && <TowelRailModel selected={true} />}
              {isPlacingItem.type === 'washing_machine' && <WashingMachineModel selected={true} />}
              {isPlacingItem.type === 'light' && <WallLightModel selected={true} />}
              {!['sink', 'bathtub', 'shower', 'toilet', 'towel_rail', 'washing_machine', 'light', 'plant'].includes(isPlacingItem.type) && (
                <DynamicFurnitureModel item={isPlacingItem} selected={true} CustomFurniture={CustomFurniture} />
              )}
            </>
          )}
        </group>
      )}

      {selectedRoomType === 'bathroom' && measurementSettings && (
        <MeasurementOverlay
          settings={measurementSettings}
          walls={walls}
          placedItems={placedItems}
          selectedItemId={selectedItemId}
        />
      )}

    </group>
  );
}

const MemoizedCanvas = React.memo(({
  state,
  setState,
  topView,
  activeSideView,
  setActiveSideView,
  zoomTrigger,
  setZoomTrigger,
  setNumWalls,
  placedItems,
  setPlacedItems,
  selectedItemId,
  setSelectedItemId,
  isPlacingItem,
  setIsPlacingItem,
  orbitEnabled,
  setOrbitEnabled,
  activePlacement,
  setActivePlacement,
  CustomFurniture,
  measurementSettings,
  isMeasuring,
  setIsMeasuring,
  savedMeasurements,
  setSavedMeasurements,
  measureStartPoint,
  setMeasureStartPoint,
  measureTempEndPoint,
  setMeasureTempEndPoint,
  activeCategory,
  readOnly = false
}: any) => {
  return (
    <div className={`h-full overflow-hidden transition-all duration-300 ${activeCategory === 'bathware_products' ? 'w-[calc(100%-420px)] flex-none' : 'flex-1 w-full'}`}>
      <Canvas
        camera={{ position: [6, 5, 8], fov: 45 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
        shadows
      >
        <color attach="background" args={["#ececec"]} />
        <Suspense fallback={null}>
          <BathroomScene
            state={state}
            setState={setState}
            topView={topView}
            activeSideView={activeSideView}
            setActiveSideView={setActiveSideView}
            zoomTrigger={zoomTrigger}
            setZoomTrigger={setZoomTrigger}
            setNumWalls={setNumWalls}
            placedItems={placedItems}
            setPlacedItems={setPlacedItems}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            isPlacingItem={isPlacingItem}
            setIsPlacingItem={setIsPlacingItem}
            orbitEnabled={orbitEnabled}
            setOrbitEnabled={setOrbitEnabled}
            activePlacement={activePlacement}
            setActivePlacement={setActivePlacement}
            CustomFurniture={CustomFurniture}
            measurementSettings={measurementSettings}
            isMeasuring={isMeasuring}
            setIsMeasuring={setIsMeasuring}
            savedMeasurements={savedMeasurements}
            setSavedMeasurements={setSavedMeasurements}
            measureStartPoint={measureStartPoint}
            setMeasureStartPoint={setMeasureStartPoint}
            measureTempEndPoint={measureTempEndPoint}
            setMeasureTempEndPoint={setMeasureTempEndPoint}
            readOnly={readOnly}
          />
        </Suspense>
      </Canvas>
    </div>
  );
});
MemoizedCanvas.displayName = 'MemoizedCanvas';

// ─── DOOR & WINDOW SIZE MODAL ──────────────────────────────────────────────────────────

function DoorSizeModalComponent() {
  const {
    doorSizeModal, setDoorSizeModal,
    setActivePlacement, setState, setWizardWallOpenings,
    activeCategory, setActiveCategory, selectedRoomType, state
  } = useDesignerStore();

  const [widthInput, setWidthInput] = useState<string>('');
  const [heightInput, setHeightInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (doorSizeModal?.isOpen) {
      setWidthInput(String(doorSizeModal.currentWidth));
      setHeightInput(String(doorSizeModal.currentHeight));
      setErrorMsg(null);
    }
  }, [doorSizeModal]);

  if (!doorSizeModal?.isOpen) return null;

  const isWindow = doorSizeModal.openingType === 'window' || doorSizeModal.doorStyle?.includes('window');

  const handleApply = (customW?: number, customH?: number) => {
    const w = customW !== undefined ? customW : parseFloat(widthInput);
    const h = customH !== undefined ? customH : parseFloat(heightInput);

    if (isNaN(w) || w < 0.3 || w > 3.5) {
      setErrorMsg('Width must be between 0.3m and 3.5m');
      return;
    }
    if (isNaN(h) || h < 0.3 || h > 3.5) {
      setErrorMsg('Height must be between 0.3m and 3.5m');
      return;
    }

    const roundedW = Math.round(w * 100) / 100;
    const roundedH = Math.round(h * 100) / 100;

    if (doorSizeModal.target === 'placement') {
      setActivePlacement({
        type: isWindow ? 'window' : 'door',
        style: doorSizeModal.doorStyle || (isWindow ? 'bathroom_window' : 'single_door'),
        name: doorSizeModal.doorName || (isWindow ? 'Window' : 'Door'),
        width: roundedW,
        height: roundedH,
        sillHeight: isWindow ? 1.6 : 0,
      });
      if (activeCategory === 'openings') setActiveCategory(null);
    } else if (doorSizeModal.target === 'existing' && doorSizeModal.openingId) {
      setState(prev => ({
        ...prev,
        wallOpenings: prev.wallOpenings.map(op =>
          op.id === doorSizeModal.openingId
            ? { ...op, width: roundedW, height: roundedH }
            : op
        )
      }));
      setWizardWallOpenings(prev =>
        prev.map(op =>
          op.id === doorSizeModal.openingId
            ? { ...op, width: roundedW, height: roundedH }
            : op
        )
      );
    }

    setDoorSizeModal(null);
  };

  const currentWVal = parseFloat(widthInput) || 0;
  const currentHVal = parseFloat(heightInput) || 0;

  const presets = isWindow ? [
    { label: 'Bath Privacy (0.60m × 0.60m)', w: 0.60, h: 0.60 },
    { label: 'Small Awning (0.80m × 0.60m)', w: 0.80, h: 0.60 },
    { label: 'Standard Window (1.00m × 1.20m)', w: 1.00, h: 1.20 },
    { label: 'Double Window (1.60m × 1.20m)', w: 1.60, h: 1.20 },
  ] : [
    { label: 'Compact Bath (0.75m × 2.0m)', w: 0.75, h: 2.0 },
    { label: 'Standard Door (0.90m × 2.0m)', w: 0.90, h: 2.0 },
    { label: 'Wide Door (1.20m × 2.1m)', w: 1.20, h: 2.1 },
    { label: 'Double Door (1.60m × 2.1m)', w: 1.60, h: 2.1 },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-gray-100 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg border border-emerald-200/60 shadow-sm">
              {isWindow ? '🪟' : '🚪'}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1A1A1A] tracking-tight">
                Specify {isWindow ? 'Window' : 'Door'} Dimensions
              </h3>
              <p className="text-xs text-gray-500 font-medium">
                {doorSizeModal.doorName || (isWindow ? 'Bathroom Window' : 'Bathroom Door')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDoorSizeModal(null)}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1.5 uppercase tracking-wider">
                Width (Meters)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  min="0.3"
                  max="3.5"
                  value={widthInput}
                  onChange={(e) => setWidthInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">m</span>
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block font-medium">
                ≈ {currentWVal > 0 ? (currentWVal * 3.28084).toFixed(2) : '0'} ft
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-600 block mb-1.5 uppercase tracking-wider">
                Height (Meters)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.05"
                  min="0.3"
                  max="3.5"
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                />
                <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">m</span>
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block font-medium">
                ≈ {currentHVal > 0 ? (currentHVal * 3.28084).toFixed(2) : '0'} ft
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
              Quick Presets
            </span>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setWidthInput(String(preset.w));
                    setHeightInput(String(preset.h));
                  }}
                  className="px-2.5 py-2 text-[11px] font-semibold border border-gray-200 rounded-xl hover:border-black hover:bg-gray-50 transition-all text-gray-700 text-left"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setDoorSizeModal(null)}
            className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleApply()}
            className="px-5 py-2.5 bg-black hover:bg-gray-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95"
          >
            {doorSizeModal.target === 'placement' ? `Set & Place ${isWindow ? 'Window' : 'Door'}` : `Update ${isWindow ? 'Window' : 'Door'} Size`}
          </button>
        </div>
      </div>
    </div>
  );
}

function BathroomPlannerPageInner({ catalog, categories, CustomFurniture, readOnly = false }: { catalog: any[], categories: any[], CustomFurniture?: any, readOnly?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const loadedDesignId = searchParams.get('id');
  const loadedPackageId = searchParams.get('package');
  const [wizardCategory, setWizardCategory] = useState<string | null>(null);
  const [wizardDynamicItems, setWizardDynamicItems] = useState<any[]>([]);
  const [isWizardLoading, setIsWizardLoading] = useState(false);

  useEffect(() => {
    if (wizardCategory && wizardCategory !== 'openings') {
      setIsWizardLoading(true);
      fetch(`/api/furniture?category=${wizardCategory}`)
        .then(res => res.json())
        .then(data => {
          setWizardDynamicItems(data.items || []);
          setIsWizardLoading(false);
        })
        .catch(err => {
          console.error(err);
          setWizardDynamicItems([]);
          setIsWizardLoading(false);
        });
    } else {
      setWizardDynamicItems([]);
    }
  }, [wizardCategory]);

  const { state, setState, topView, setTopView, activeSideView, setActiveSideView, zoomTrigger, setZoomTrigger, numWalls, setNumWalls, wizardStep, setWizardStep, fadeState, setFadeState, selectedRoomType, setSelectedRoomType, subRoomType, setSubRoomType, projectName, setProjectName, selectedShape, setSelectedShape, dimensionsUnit, setDimensionsUnit, widthInput, setWidthInput, lengthInput, setLengthInput, heightInput, setHeightInput, projectId, setProjectId, validationErrors, setValidationErrors, isSubmitting, setIsSubmitting, previewZoomTrigger, setPreviewZoomTrigger, activePlacement, setActivePlacement, wizardWallOpenings, setWizardWallOpenings, placedItems, setPlacedItems, selectedItemId, setSelectedItemId, isPlacingItem, setIsPlacingItem, activeCategory, setActiveCategory, showRoomCustomizer, setShowRoomCustomizer, showSummaryModal, setShowSummaryModal, showRoomTypeModal, setShowRoomTypeModal, orbitEnabled, setOrbitEnabled, undoStack, setUndoStack, redoStack, setRedoStack, recordHistory, handleUndo, handleRedo, alertMessage, showAlert, hideAlert, doorSizeModal, setDoorSizeModal } = useDesignerStore();

  // ─── MEASUREMENT TOOL STATES ───
  const [showMeasurementPanel, setShowMeasurementPanel] = useState(false);
  const [measurementSettings, setMeasurementSettings] = useState({
    productDimensions: false,
    productSpacing: false,
    roomDimensions: false,
    unit: 'ft' as 'ft' | 'cm',
  });
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [savedMeasurements, setSavedMeasurements] = useState<any[]>([]);
  const [measureStartPoint, setMeasureStartPoint] = useState<THREE.Vector3 | null>(null);
  const [measureTempEndPoint, setMeasureTempEndPoint] = useState<THREE.Vector3 | null>(null);
  const [customiseFromWorkspace, setCustomiseFromWorkspace] = useState(false);
  const [roomOffset, setRoomOffset] = useState<{ x: number; z: number }>({ x: 0, z: 0 });

  useEffect(() => {
    setRoomOffset({ x: 0, z: 0 });
  }, [selectedShape, selectedRoomType]);

  const openCustomiseFromWorkspace = () => {
    const wCm = Math.round(state.widthFt * 30.48);
    const lCm = Math.round(state.depthFt * 30.48);
    const hCm = Math.round(state.heightFt * 30.48);

    if (dimensionsUnit === 'm') {
      setWidthInput((wCm / 100).toFixed(1));
      setLengthInput((lCm / 100).toFixed(1));
      setHeightInput((hCm / 100).toFixed(1));
    } else {
      setWidthInput(wCm.toString());
      setLengthInput(lCm.toString());
      setHeightInput(hCm.toString());
    }

    setCustomiseFromWorkspace(true);
    setWizardStep(2);
  };



  // ─── WIZARD ONBOARDING STATE ───
  const { user, isAuthenticated } = useAuth();
  const wizardControlsRef = useRef<any>(null);
  const transitionToStep = (nextStep: number) => {
    setFadeState('out');
    setTimeout(() => {
      setWizardStep(nextStep);
      setFadeState('in');
    }, 200);
  };

  // Auto-fetch catalog items on mount so tile pricing and summary calculations are available immediately
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    fetch(`${apiUrl}/items`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          useDesignerStore.getState().setCatalogItems(data);
        }
      })
      .catch(err => console.error("Auto-fetch catalog items error:", err));
  }, []);


  useEffect(() => {
    if (!loadedDesignId) return;

    const fetchSavedDesign = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const [response, itemsResponse] = await Promise.all([
          fetch(`${apiUrl}/designer/layout/${loadedDesignId}`, { cache: 'no-store' }),
          fetch(`${apiUrl}/items`).catch(() => null)
        ]);

        let itemsData: any[] = [];
        if (itemsResponse && itemsResponse.ok) {
          const resJson = await itemsResponse.json();
          if (Array.isArray(resJson)) {
            itemsData = resJson;
            useDesignerStore.getState().setCatalogItems(itemsData);
          }
        }

        if (!response.ok) throw new Error('Failed to load layout');
        const data = await response.json();
        remoteLog("LOADED DESIGN DATA:", data);

        // Load project metadata
        setProjectId(data.id);
        setProjectName(data.name);
        setSelectedShape(data.shape);
        setSelectedRoomType(data.type);
        const localSubRoomType = localStorage.getItem(`project_subRoomType_${data.id}`);
        if (data.subRoomType) {
          setSubRoomType(data.subRoomType);
        } else if (localSubRoomType) {
          setSubRoomType(localSubRoomType as any);
        }

        const loadedWidth = data.width > 0.1 ? data.width : 3.0;
        const loadedLength = data.length > 0.1 ? data.length : 2.4;
        const loadedHeight = data.height > 0.1 ? data.height : 2.5;

        // Set dimensions inputs
        if (dimensionsUnit === 'cm') {
          setWidthInput(Math.round(loadedWidth * 100).toString());
          setLengthInput(Math.round(loadedLength * 100).toString());
          setHeightInput(Math.round(loadedHeight * 100).toString());
        } else {
          setWidthInput(loadedWidth.toString());
          setLengthInput(loadedLength.toString());
          setHeightInput(loadedHeight.toString());
        }

        // Set state dimensions
        const wFt = cmToFeet(loadedWidth * 100);
        const dFt = cmToFeet(loadedLength * 100);
        const hFt = cmToFeet(loadedHeight * 100);

        // Map wall split designs (from database walls)
        const mappedWallDesigns = Array(8).fill(null).map((_, idx) => {
          const dbWall = data.walls?.find((w: any) => w.sequence === idx);
          if (dbWall) {
            return {
              splitMode: 'full' as const,
              tileColorBottom: dbWall.color === '#63666A' ? '#ffffff' : (dbWall.color || '#ffffff'),
              tileColorTop: '#ffffff',
              tileColorCenter: '#ffffff',
              tileColorSides: '#ffffff',
              textureUrl: dbWall.textureUrl || data.wallTextureUrl || undefined,
              textureCoverageHeight: dbWall.tileCoverageHeight !== undefined && dbWall.tileCoverageHeight !== null ? dbWall.tileCoverageHeight : undefined,
              tileAssetId: dbWall.tileAssetId || undefined,
            };
          }
          return { ...INITIAL_WALL_DESIGN };
        });

        // Map openings (doors / windows)
        const mappedOpenings = (data.walls || []).flatMap((w: any) =>
          (w.openings || []).map((op: any) => ({
            id: op.id,
            type: op.type,
            style: op.style,
            name: op.type === 'door' ? 'Door' : 'Window',
            wallIndex: w.sequence,
            positionOffset: op.position_x,
            width: op.width,
            height: op.height,
            sillHeight: op.position_y
          }))
        );

        // Map placed items with live catalog price resolution
        const catalogList = (Array.isArray(itemsData) && itemsData.length > 0)
          ? itemsData
          : (useDesignerStore.getState().catalogItems || []);

        const mappedItems = (data.items || []).map((it: any) => {
          const type = it.type || 'sink';
          const name = it.name || '';
          const isBathtubItem = isBathtub(type, name);
          const isWallMounted = isBathtubItem ? false : (it.position && it.position[1] > 0.5);
          const posY = isBathtubItem ? 0 : (it.position ? it.position[1] : 0);
          const position = it.position ? [it.position[0], posY, it.position[2]] : [0, posY, 0];

          // Cross-reference live catalog to get live OSPOS product price & details
          const matchedCatalogItem = catalogList.find((ci: any) => {
            if (ci.name && name && ci.name.toLowerCase().trim() === name.toLowerCase().trim()) return true;
            if (ci.category && type && ci.category.toLowerCase().trim() === type.toLowerCase().trim()) return true;
            if (ci.type && type && ci.type.toLowerCase().trim() === type.toLowerCase().trim()) return true;
            return false;
          });

          const livePrice = matchedCatalogItem ? Number(matchedCatalogItem.price || matchedCatalogItem.cost || 0) : 0;
          const rawCost = Number(it.cost !== undefined && it.cost !== null ? it.cost : (it.price !== undefined && it.price !== null ? it.price : 0));
          const finalCost = livePrice > 0 ? livePrice : (rawCost > 0 && rawCost !== 250 ? rawCost : (matchedCatalogItem ? Number(matchedCatalogItem.price || 0) : 0));

          return {
            id: it.id || `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            type,
            name: it.name || (matchedCatalogItem?.name) || (it.type ? (it.type.toUpperCase() + ' UNIT') : 'Unit'),
            model: it.modelUrl || matchedCatalogItem?.glbUrl || matchedCatalogItem?.modelUrl,
            cost: finalCost,
            position,
            rotation: (it.rotation && Array.isArray(it.rotation)) ? it.rotation[1] : (it.rotation_y || 0),
            isWallMounted,
            scale: it.scale ? { x: Number(it.scale.x || 1), y: Number(it.scale.y || 1), z: Number(it.scale.z || 1) } : undefined
          };
        });

        setState({
          widthFt: wFt,
          depthFt: dFt,
          heightFt: hFt,
          shape: data.shape,
          unit: 'cm',
          floorColor: '#ffffff',
          floorTextureUrl: data.floorTextureUrl || undefined,
          wallTextureUrl: data.wallTextureUrl || undefined,
          wallDesigns: mappedWallDesigns,
          designType: data.type,
          subRoomType: data.subRoomType || localSubRoomType || (data.type === 'room' ? 'living_room' : undefined),
          wallOpenings: mappedOpenings
        });

        setWizardWallOpenings(mappedOpenings);
        setPlacedItems(mappedItems);
        if (data.measurements) {
          setSavedMeasurements(data.measurements);
        }

        // Go straight to the workspace step (Step 5)!
        setWizardStep(5);
      } catch (err) {
        console.error("Load design error:", err);
        showAlert("Failed to load saved design from the database.");
      }
    };

    fetchSavedDesign();
  }, [loadedDesignId]);

  // Load package visual layouts dynamically from database
  useEffect(() => {
    if (!loadedPackageId) return;

    const fetchPackageData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const STATIC_BASE = apiUrl.replace('/api', '');

        const formatUrl = (url?: string | null) => {
          if (!url) return undefined;
          if (url.startsWith('http://') || url.startsWith('https://')) return url;
          return `${STATIC_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
        };

        // 1. Fetch all unified items to resolve images and GLB URLs
        const itemsRes = await fetch(`${apiUrl}/items?includeHidden=true`);
        if (!itemsRes.ok) throw new Error('Failed to fetch items catalog');
        const allItems = await itemsRes.json();
        const itemsMap = new Map(allItems.map((item: any) => [item.itemId, item]));

        // 2. Fetch the package details
        const pkgRes = await fetch(`${apiUrl}/packages/${loadedPackageId}`);
        if (!pkgRes.ok) throw new Error('Failed to fetch package details');
        const pkgData = await pkgRes.json();

        // Standard pre-designed bathroom dimensions: 12ft x 9ft x 8.5ft
        const wFt = 12.0;
        const dFt = 9.0;
        const hFt = 8.5;

        // Set dimensions inputs (matches wizard config state)
        const loadedWidth = wFt * 0.3048;
        const loadedLength = dFt * 0.3048;
        const loadedHeight = hFt * 0.3048;

        if (dimensionsUnit === 'cm') {
          setWidthInput(Math.round(loadedWidth * 100).toString());
          setLengthInput(Math.round(loadedLength * 100).toString());
          setHeightInput(Math.round(loadedHeight * 100).toString());
        } else {
          setWidthInput(loadedWidth.toString());
          setLengthInput(loadedLength.toString());
          setHeightInput(loadedHeight.toString());
        }

        // Apply tiles
        let floorTexUrl: string | undefined = undefined;
        let wallTexUrl: string | undefined = undefined;

        // Map items
        const mappedItems: any[] = [];
        let sinkCount = 0;
        let toiletCount = 0;
        let bathCount = 0;
        let showerCount = 0;

        pkgData.items.forEach((pi: any) => {
          const matchedItem = itemsMap.get(pi.osposItemId) as any;
          if (!matchedItem) return;

          const category = (matchedItem.category || '').toLowerCase();
          const name = (matchedItem.name || '').toLowerCase();

          const isTile = category.includes('tile') || category.includes('mosaic') || name.includes('tile') || name.includes('mosaic');

          if (isTile) {
            const isFloor = [4, 6, 17, 18, 20].includes(matchedItem.itemId) || name.includes('floor') || category.includes('floor');
            if (isFloor) {
              floorTexUrl = formatUrl(matchedItem.imageUrl);
            } else {
              wallTexUrl = formatUrl(matchedItem.imageUrl);
            }
          } else {
            // Determine designer item type from POS category/name
            let type = 'sink';
            let position: [number, number, number] = [0, 0, 0];
            let rotation = 0;
            let isWallMounted = false;

            if (category.includes('basin') || category.includes('sink') || name.includes('basin') || name.includes('sink') || name.includes('vanity')) {
              type = 'sink';
              position = [-0.6 + (sinkCount * 1.2), 0, -1.0];
              rotation = 0;
              sinkCount++;
            } else if (category.includes('closet') || category.includes('toilet') || category.includes('wc') || name.includes('closet') || name.includes('toilet') || name.includes('wc') || name.includes('commode')) {
              type = 'toilet';
              position = [-1.3, 0, -0.2 + (toiletCount * 0.8)];
              rotation = Math.PI / 2;
              toiletCount++;
            } else if (category.includes('bath') || name.includes('bath') || name.includes('tub')) {
              type = 'bathtub';
              position = [1.1, 0, 0.2 + (bathCount * 0.9)];
              rotation = -Math.PI / 2;
              bathCount++;
            } else if (category.includes('shower') || name.includes('shower')) {
              type = 'shower';
              position = [1.1, 0, -1.0 + (showerCount * 0.9)];
              rotation = -Math.PI / 2;
              showerCount++;
            } else if (category.includes('mirror') || name.includes('mirror') || category.includes('light')) {
              type = 'light';
              position = [0, 1.6, -1.3];
              rotation = 0;
              isWallMounted = true;
            } else {
              type = 'plant';
              position = [-1.3, 0, 0.8];
              rotation = 0;
            }

            const randId = 'item_' + Math.random().toString(36).substring(2, 9);
            mappedItems.push({
              id: randId,
              type,
              name: matchedItem.name,
              model: formatUrl(matchedItem.glbUrl) || null,
              cost: matchedItem.price || 150.00,
              position,
              rotation,
              isWallMounted
            });
          }
        });

        // If stored designData exists on package, load exact saved room designs, colors, textures and 3D item positions
        if (pkgData.designData) {
          const dd = pkgData.designData;
          setState({
            widthFt: dd.widthFt || wFt,
            depthFt: dd.depthFt || dFt,
            heightFt: dd.heightFt || hFt,
            shape: dd.shape || 'rectangular',
            unit: 'cm',
            floorColor: dd.floorColor || '#ffffff',
            floorTextureUrl: formatUrl(dd.floorTextureUrl) || undefined,
            wallTextureUrl: formatUrl(dd.wallTextureUrl) || undefined,
            wallDesigns: (dd.wallDesigns || []).map((wd: any) => ({
              ...wd,
              textureUrl: formatUrl(wd.textureUrl) || undefined,
            })),
            wallOpenings: dd.wallOpenings || [],
            designType: 'bathroom',
            subRoomType: undefined,
          });
          setWizardWallOpenings(dd.wallOpenings || []);
          if (dd.placedItems && dd.placedItems.length > 0) {
            setPlacedItems(
              dd.placedItems.map((item: any) => ({
                ...item,
                model: formatUrl(item.model) || null,
                image: formatUrl(item.image) || null,
              }))
            );
          } else {
            setPlacedItems(mappedItems);
          }
          setProjectName(pkgData.name || 'Curated Package Layout');
          setWizardStep(5);
          return;
        }

        const mappedWallDesigns = Array(8).fill(null).map(() => ({
          splitMode: 'full' as const,
          tileColorBottom: '#ffffff',
          tileColorTop: '#ffffff',
          tileColorCenter: '#ffffff',
          tileColorSides: '#ffffff',
          textureUrl: wallTexUrl || undefined
        }));

        setState({
          widthFt: wFt,
          depthFt: dFt,
          heightFt: hFt,
          shape: 'rectangular',
          unit: 'cm',
          floorColor: '#ffffff',
          floorTextureUrl: floorTexUrl || undefined,
          wallTextureUrl: wallTexUrl || undefined,
          wallDesigns: mappedWallDesigns,
          designType: 'bathroom',
          subRoomType: undefined,
          wallOpenings: []
        });

        setWizardWallOpenings([]);
        setPlacedItems(mappedItems);
        setProjectName(pkgData.name || 'Curated Package Layout');

        // Skip setup steps and load straight to Step 5 (Workspace Canvas)
        setWizardStep(5);
      } catch (err: any) {
        console.error("Load package layout error:", err);
        showAlert("Failed to load pre-designed package layout: " + err.message);
      }
    };

    fetchPackageData();
  }, [loadedPackageId]);

  // Sync project ID to URL query parameters for page refreshes
  useEffect(() => {
    if (projectId && loadedDesignId !== projectId) {
      const url = new URL(window.location.href);
      url.searchParams.set('id', projectId);
      window.history.replaceState(null, '', url.toString());
    }
  }, [projectId, loadedDesignId]);

  const handleAddWallOpening = (op: WallOpening) => {
    setWizardWallOpenings(prev => [...prev, op]);
  };

  const handleUpdateWallOpeningOffset = (id: string, offset: number, wallIndex?: number) => {
    setWizardWallOpenings(prev =>
      prev.map(op => (op.id === id ? { ...op, positionOffset: offset, wallIndex: wallIndex !== undefined ? wallIndex : op.wallIndex } : op))
    );
  };

  const handleRemoveWallOpening = (id: string) => {
    setWizardWallOpenings(prev => prev.filter(op => op.id !== id));
  };

  // ─── WIZARD HANDLERS ───
  const validateInputs = (wStr: string, lStr: string, hStr: string, unit: 'cm' | 'm') => {
    const w = parseFloat(wStr) || 0;
    const l = parseFloat(lStr) || 0;
    const h = parseFloat(hStr) || 0;
    const errors: { width?: string; length?: string; height?: string } = {};

    if (unit === 'm') {
      if (w < 1.0 || w > 10.0) errors.width = 'Width must be between 1.0m and 10.0m';
      if (l < 1.0 || l > 10.0) errors.length = 'Length must be between 1.0m and 10.0m';
      if (h < 2.2 || h > 4.0) errors.height = 'Height must be between 2.2m and 4.0m';
    } else {
      if (w < 100 || w > 1000) errors.width = 'Width must be between 100cm and 1000cm';
      if (l < 100 || l > 1000) errors.length = 'Length must be between 100cm and 1000cm';
      if (h < 220 || h > 400) errors.height = 'Height must be between 220cm and 400cm';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDimensionInputChange = (key: string, val: string) => {
    let nextW = widthInput;
    let nextL = lengthInput;
    let nextH = heightInput;

    if (key === 'width') {
      nextW = val;
      if (selectedShape === 'square') {
        nextL = val;
      }
    } else if (key === 'length') {
      nextL = val;
      if (selectedShape === 'square') {
        nextW = val;
      }
    } else if (key === 'height') {
      nextH = val;
    }

    setWidthInput(nextW);
    setLengthInput(nextL);
    setHeightInput(nextH);
    setRoomOffset({ x: 0, z: 0 });

    validateInputs(nextW, nextL, nextH, dimensionsUnit);
  };

  const handleVertexDrag = (idx: number, hitX: number, hitZ: number) => {
    let newW = Math.max(1.0, Math.min(10.0, Math.abs(hitX) * 2));
    let newD = Math.max(1.0, Math.min(10.0, Math.abs(hitZ) * 2));
    newW = Math.round(newW / 0.05) * 0.05;
    newD = Math.round(newD / 0.05) * 0.05;

    if (selectedShape === 'square') {
      const s = Math.max(newW, newD);
      newW = s;
      newD = s;
    }

    setRoomOffset({ x: 0, z: 0 });

    if (dimensionsUnit === 'cm') {
      const wCm = Math.round(newW * 100).toString();
      const lCm = Math.round(newD * 100).toString();
      if (wCm !== widthInput || lCm !== lengthInput) {
        setWidthInput(wCm);
        setLengthInput(lCm);
        validateInputs(wCm, lCm, heightInput, 'cm');
      }
    } else {
      const wM = newW.toFixed(1);
      const lM = newD.toFixed(1);
      if (wM !== widthInput || lM !== lengthInput) {
        setWidthInput(wM);
        setLengthInput(lM);
        validateInputs(wM, lM, heightInput, 'm');
      }
    }
  };

  const handleWallDrag = (idx: number, hitX: number, hitZ: number) => {
    let newW = widthInMeters;
    let newD = lengthInMeters;

    if (idx === 0 || idx === 2) {
      newD = Math.max(1.0, Math.min(10.0, Math.abs(hitZ) * 2));
      newD = Math.round(newD / 0.05) * 0.05;
    } else {
      newW = Math.max(1.0, Math.min(10.0, Math.abs(hitX) * 2));
      newW = Math.round(newW / 0.05) * 0.05;
    }

    if (selectedShape === 'square') {
      const s = Math.max(newW, newD);
      newW = s;
      newD = s;
    }

    setRoomOffset({ x: 0, z: 0 });

    if (dimensionsUnit === 'cm') {
      const wCm = Math.round(newW * 100).toString();
      const lCm = Math.round(newD * 100).toString();
      if (wCm !== widthInput || lCm !== lengthInput) {
        setWidthInput(wCm);
        setLengthInput(lCm);
        validateInputs(wCm, lCm, heightInput, 'cm');
      }
    } else {
      const wM = newW.toFixed(1);
      const lM = newD.toFixed(1);
      if (wM !== widthInput || lM !== lengthInput) {
        setWidthInput(wM);
        setLengthInput(lM);
        validateInputs(wM, lM, heightInput, 'm');
      }
    }
  };

  const handleUnitChange = (newUnit: 'cm' | 'm') => {
    if (newUnit === dimensionsUnit) return;

    let nextW = widthInput;
    let nextL = lengthInput;
    let nextH = heightInput;

    const wNum = parseFloat(widthInput) || 0;
    const lNum = parseFloat(lengthInput) || 0;
    const hNum = parseFloat(heightInput) || 0;

    if (newUnit === 'm') {
      nextW = (wNum / 100).toFixed(1);
      nextL = (lNum / 100).toFixed(1);
      nextH = (hNum / 100).toFixed(1);
    } else {
      nextW = Math.round(wNum * 100).toString();
      nextL = Math.round(lNum * 100).toString();
      nextH = Math.round(hNum * 100).toString();
    }

    setDimensionsUnit(newUnit);
    setWidthInput(nextW);
    setLengthInput(nextL);
    setHeightInput(nextH);

    validateInputs(nextW, nextL, nextH, newUnit);
  };

  const widthInMeters = useMemo(() => {
    if (wizardStep >= 3 && !customiseFromWorkspace && state.widthFt) return state.widthFt * 0.3048;
    const val = parseFloat(widthInput) || 0;
    return dimensionsUnit === 'cm' ? val / 100 : val;
  }, [widthInput, dimensionsUnit, wizardStep, customiseFromWorkspace, state.widthFt]);

  const lengthInMeters = useMemo(() => {
    if (wizardStep >= 3 && !customiseFromWorkspace && state.depthFt) return state.depthFt * 0.3048;
    const val = parseFloat(lengthInput) || 0;
    return dimensionsUnit === 'cm' ? val / 100 : val;
  }, [lengthInput, dimensionsUnit, wizardStep, customiseFromWorkspace, state.depthFt]);

  const heightInMeters = useMemo(() => {
    if (wizardStep >= 3 && !customiseFromWorkspace && state.heightFt) return state.heightFt * 0.3048;
    const val = parseFloat(heightInput) || 0;
    return dimensionsUnit === 'cm' ? val / 100 : val;
  }, [heightInput, dimensionsUnit, wizardStep, customiseFromWorkspace, state.heightFt]);

  const handleWizardNext = async () => {
    if (wizardStep === 1) {
      transitionToStep(2);
    } else if (wizardStep === 2) {
      if (!validateInputs(widthInput, lengthInput, heightInput, dimensionsUnit)) return;

      // Update state locally first so that the floor texturing is responsive immediately in step 3
      const wFt = cmToFeet(widthInMeters * 100);
      const dFt = cmToFeet(lengthInMeters * 100);
      const hFt = cmToFeet(heightInMeters * 100);

      setState((prev) => ({
        ...prev,
        widthFt: wFt,
        depthFt: dFt,
        heightFt: hFt,
        shape: selectedShape,
        unit: 'cm',
      }));

      transitionToStep(3);
    } else if (wizardStep === 3) {
      setIsSubmitting(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

        // 1. Create project
        const resProject = await fetch(`${apiUrl}/designer/project`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: projectName || (selectedRoomType === 'room' ? 'My Living Room Plan' : 'My Bathroom Plan'),
            shape: selectedShape,
            userId: user?.id || undefined,
            designType: selectedRoomType,
          }),
        });

        let pId = projectId;
        if (resProject.ok) {
          const project = await resProject.json();
          pId = project.id;
          setProjectId(pId);
        }

        if (pId && subRoomType) {
          localStorage.setItem(`project_subRoomType_${pId}`, subRoomType);
        }

        // 2. Update dimensions
        const widthM = widthInMeters;
        const lengthM = lengthInMeters;
        const heightM = heightInMeters;

        if (pId) {
          await fetch(`${apiUrl}/designer/project/${pId}/dimensions`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              width: widthM,
              length: lengthM,
              height: heightM,
            }),
          });
        }

        const wFt = cmToFeet(widthM * 100);
        const dFt = cmToFeet(lengthM * 100);
        const hFt = cmToFeet(heightM * 100);

        setState((prev) => ({
          ...prev,
          widthFt: wFt,
          depthFt: dFt,
          heightFt: hFt,
          shape: selectedShape,
          unit: 'cm',
          designType: selectedRoomType,
          subRoomType: subRoomType,
        }));

        if (selectedRoomType === 'bathroom') {
          setState((prev) => ({
            ...prev,
            wallOpenings: wizardWallOpenings,
          }));
          transitionToStep(5); // Skip Add Items step
        } else {
          transitionToStep(4); // Move to Doors & Windows
        }
      } catch (err) {
        console.error(err);
        console.warn('Proceeding offline');

        const wFt = cmToFeet(widthInMeters * 100);
        const dFt = cmToFeet(lengthInMeters * 100);
        const hFt = cmToFeet(heightInMeters * 100);

        setState((prev) => ({
          ...prev,
          widthFt: wFt,
          depthFt: dFt,
          heightFt: hFt,
          shape: selectedShape,
          unit: 'cm',
          designType: selectedRoomType,
          subRoomType: subRoomType,
        }));

        if (selectedRoomType === 'bathroom') {
          setState((prev) => ({
            ...prev,
            wallOpenings: wizardWallOpenings,
          }));
          transitionToStep(5);
        } else {
          transitionToStep(4);
        }
      } finally {
        setIsSubmitting(false);
      }
    } else if (wizardStep === 4) {
      // Step 4 is adding doors & windows. We copy the wizard openings to state and launch!
      setState((prev) => ({
        ...prev,
        wallOpenings: wizardWallOpenings,
      }));
      transitionToStep(5);
    }
  };

  const handleSaveDesign = async () => {
    if (!isAuthenticated && !user) {
      showAlert("Please log in to your account before saving your 3D room design.");
      return;
    }

    if (!projectId) {
      showAlert("No active project ID found. Please complete the wizard setup first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

      // 1. Compute vertices from layout footprint (based on active state dimensions in meters)
      const wVal = state.widthFt * 0.3048;
      const dVal = state.depthFt * 0.3048;
      const hVal = state.heightFt * 0.3048;

      let poly: [number, number][] = [];
      if (state.shape === 'square') {
        const s = Math.min(wVal, dVal);
        poly = [[-s / 2, -s / 2], [s / 2, -s / 2], [s / 2, s / 2], [-s / 2, s / 2]];
      } else if (state.shape === 'l-shape') {
        poly = [
          [-wVal / 2, -dVal / 2],
          [wVal / 2, -dVal / 2],
          [wVal / 2, 0],
          [0, 0],
          [0, dVal / 2],
          [-wVal / 2, dVal / 2]
        ];
      } else if (state.shape === 't-shape') {
        poly = [
          [-wVal / 4, -dVal / 2],
          [wVal / 4, -dVal / 2],
          [wVal / 4, 0],
          [wVal / 2, 0],
          [wVal / 2, dVal / 2],
          [-wVal / 2, dVal / 2],
          [-wVal / 2, 0],
          [-wVal / 4, 0]
        ];
      } else if (state.shape === 'u-shape') {
        poly = [
          [-wVal / 2, -dVal / 2],
          [-wVal / 4, -dVal / 2],
          [-wVal / 4, 0],
          [wVal / 4, 0],
          [wVal / 4, -dVal / 2],
          [wVal / 2, -dVal / 2],
          [wVal / 2, dVal / 2],
          [-wVal / 2, dVal / 2]
        ];
      } else if (state.shape === 'custom') {
        poly = [
          [-wVal / 2, -dVal / 2],
          [wVal / 4, -dVal / 2],
          [wVal / 2, -dVal / 4],
          [wVal / 2, dVal / 2],
          [-wVal / 2, dVal / 2]
        ];
      } else {
        poly = [[-wVal / 2, -dVal / 2], [wVal / 2, -dVal / 2], [wVal / 2, dVal / 2], [-wVal / 2, dVal / 2]];
      }

      const vertices = poly.map((p, idx) => ({
        x: p[0],
        y: 0,
        z: p[1],
        sequence_order: idx
      }));

      // 2. Prepare walls
      const walls = poly.map((p, i) => {
        const q = poly[(i + 1) % poly.length];
        const dx = q[0] - p[0];
        const dz = q[1] - p[1];
        const len = Math.sqrt(dx * dx + dz * dz);
        const design = state.wallDesigns[i] || INITIAL_WALL_DESIGN;
        return {
          wall_label: `Wall ${i + 1}`,
          wall_sequence: i,
          wall_length: len,
          wall_height: hVal,
          wall_color: design.tileColorBottom,
          tile_asset_id: design.tileAssetId || null,
          tile_texture_url: design.textureUrl || null,
          tile_coverage_height: design.textureCoverageHeight || null,
        };
      });

      // 3. Prepare openings (doors and windows)
      const openings = state.wallOpenings.map(op => ({
        type: op.type,
        style: op.style,
        width: op.width,
        height: op.height,
        wall_sequence: op.wallIndex,
        position_x: op.positionOffset,
        position_y: op.sillHeight
      }));

      // 4. Prepare items (furniture / fixtures placed)
      const items = placedItems.map(item => ({
        type: item.type,
        name: item.name,
        cost: item.cost,
        position_x: item.position[0],
        position_y: isBathtub(item.type, item.name) ? 0 : item.position[1],
        position_z: item.position[2],
        rotation_y: item.rotation,
        modelUrl: item.model
      }));

      const response = await fetch(`${apiUrl}/designer/layout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: projectId,
          userId: user?.id || undefined,
          name: projectName,
          shape: state.shape,
          width: wVal,
          length: dVal,
          height: hVal,
          designType: state.designType,
          vertices,
          walls,
          openings,
          items,
          floorTextureUrl: state.floorTextureUrl,
          wallTextureUrl: state.wallTextureUrl,
          measurements: savedMeasurements
        })
      });

      if (response.ok) {
        showAlert("Design successfully saved to the database!");
      } else {
        const errText = await response.text();
        console.error("Save layout failed:", errText);
        showAlert("Failed to save design to database. Check console for details.");
      }
    } catch (err) {
      console.error(err);
      showAlert("Network error. Design saved offline.");
    } finally {
      setIsSubmitting(false);
    }
  };



  // ── orbit enable lives in parent so both Scene + UI can toggle it ──


  // ─── CLAMP OPENINGS HELPERS ───
  const getPolygonVertices = (shape: string, w: number, d: number): [number, number][] => {
    if (shape === 'square') {
      const s = Math.min(w, d);
      return [[-s / 2, -s / 2], [s / 2, -s / 2], [s / 2, s / 2], [-s / 2, s / 2]];
    }
    if (shape === 'l-shape') {
      return [
        [-w / 2, -d / 2],
        [0, -d / 2],
        [0, 0],
        [w / 2, 0],
        [w / 2, d / 2],
        [-w / 2, d / 2]
      ];
    }
    if (shape === 't-shape') {
      return [
        [-w / 4, -d / 2],
        [w / 4, -d / 2],
        [w / 4, 0],
        [w / 2, 0],
        [w / 2, d / 2],
        [-w / 2, d / 2],
        [-w / 2, 0],
        [-w / 4, 0]
      ];
    }
    if (shape === 'u-shape') {
      return [
        [-w / 2, -d / 2],
        [-w / 4, -d / 2],
        [-w / 4, 0],
        [w / 4, 0],
        [w / 4, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2]
      ];
    }
    if (shape === 'custom') {
      return [
        [-w / 2, -d / 2],
        [w / 4, -d / 2],
        [w / 2, -d / 4],
        [w / 2, d / 2],
        [-w / 2, d / 2]
      ];
    }
    return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  };

  const getWallLengths = (shape: string, w: number, d: number): number[] => {
    const poly = getPolygonVertices(shape, w, d);
    return poly.map((p, i) => {
      const q = poly[(i + 1) % poly.length];
      const dx = q[0] - p[0];
      const dz = q[1] - p[1];
      return Math.sqrt(dx * dx + dz * dz);
    });
  };

  const clampOpenings = (openings: WallOpening[], shape: string, wFt: number, dFt: number): WallOpening[] => {
    const wM = Math.max(1.5, wFt * 0.3048);
    const dM = Math.max(1.5, dFt * 0.3048);
    const wallLengths = getWallLengths(shape, wM, dM);

    return openings.map(op => {
      const wallLen = wallLengths[op.wallIndex];
      if (wallLen === undefined) return op;

      // Keep opening fully inside wall: [width / 2 + 0.1, wallLen - width / 2 - 0.1]
      const minOffset = op.width / 2 + 0.1;
      const maxOffset = Math.max(minOffset, wallLen - op.width / 2 - 0.1);
      const clampedOffset = Math.max(minOffset, Math.min(maxOffset, op.positionOffset));

      return {
        ...op,
        positionOffset: parseFloat(clampedOffset.toFixed(2))
      };
    });
  };

  const update = (p: Partial<DesignState>) => {
    // Sync wizard inputs with Workspace state changes
    if (p.unit !== undefined) {
      setDimensionsUnit(p.unit === 'feet' ? 'm' : 'cm');
      const currentUnit = p.unit;
      const wFt = p.widthFt !== undefined ? p.widthFt : state.widthFt;
      const dFt = p.depthFt !== undefined ? p.depthFt : state.depthFt;
      const hFt = p.heightFt !== undefined ? p.heightFt : state.heightFt;
      setWidthInput(currentUnit === 'cm' ? Math.round(wFt * 0.3048 * 100).toString() : parseFloat(wFt.toFixed(2)).toString());
      setLengthInput(currentUnit === 'cm' ? Math.round(dFt * 0.3048 * 100).toString() : parseFloat(dFt.toFixed(2)).toString());
      setHeightInput(currentUnit === 'cm' ? Math.round(hFt * 0.3048 * 100).toString() : parseFloat(hFt.toFixed(2)).toString());
    } else {
      if (p.widthFt !== undefined) {
        setWidthInput(dimensionsUnit === 'cm' ? Math.round(p.widthFt * 0.3048 * 100).toString() : parseFloat(p.widthFt.toFixed(2)).toString());
      }
      if (p.depthFt !== undefined) {
        setLengthInput(dimensionsUnit === 'cm' ? Math.round(p.depthFt * 0.3048 * 100).toString() : parseFloat(p.depthFt.toFixed(2)).toString());
      }
      if (p.heightFt !== undefined) {
        setHeightInput(dimensionsUnit === 'cm' ? Math.round(p.heightFt * 0.3048 * 100).toString() : parseFloat(p.heightFt.toFixed(2)).toString());
      }
    }

    setState(prev => {
      const next = { ...prev, ...p };
      if (
        p.widthFt !== undefined ||
        p.depthFt !== undefined ||
        p.shape !== undefined ||
        p.wallOpenings !== undefined
      ) {
        next.wallOpenings = clampOpenings(
          next.wallOpenings || [],
          next.shape,
          next.widthFt,
          next.depthFt
        );
      }
      return next;
    });
  };

  const selectedItem = useMemo(() => {
    const item = placedItems.find(i => i.id === selectedItemId);
    if (item) return { ...item, isOpening: false };
    const opening = state.wallOpenings.find(op => op.id === selectedItemId);
    if (opening) return { ...opening, isOpening: true };
    return null;
  }, [placedItems, state.wallOpenings, selectedItemId]);
  const isBathroom = state.designType === 'bathroom' || selectedRoomType === 'bathroom';
  const totalPrice = useMemo(() => isBathroom ? placedItems.reduce((s, i) => s + i.cost, 0) : 0, [placedItems, isBathroom]);

  const handleAddItem = (type: string) => {
    const catalogToUse = catalog;
    const cat = catalogToUse.find(i => i.type === type);
    if (!cat) return;
    const isWallMounted = checkIsWallMounted(cat);
    const defaultY = isWallMounted ? getDefaultMountHeight(type, cat.name) : 0;
    setIsPlacingItem({
      id: `${type}_${Date.now()}`,
      type,
      name: cat.name,
      cost: cat.cost,
      position: [0, defaultY, 0],
      rotation: 0,
      isWallMounted,
    });
    setActiveCategory(null);
  };

  const confirmPlacement = () => {
    if (!isPlacingItem) return;
    const currentList = useDesignerStore.getState().placedItems;
    const exists = currentList.some((i: any) => String(i.id) === String(isPlacingItem.id));
    if (!exists) {
      const next = [...currentList, isPlacingItem];
      setPlacedItems(next);
      recordHistory(next);
    }
    setSelectedItemId(isPlacingItem.id);
    setIsPlacingItem(null);
  };

  const cancelPlacement = () => setIsPlacingItem(null);

  const handleDeleteItem = () => {
    const store = useDesignerStore.getState();
    const targetId = store.selectedItemId || selectedItemId;
    if (!targetId) return;

    const targetIdStr = String(targetId);
    const currentPlaced = store.placedItems.length > 0 ? store.placedItems : placedItems;
    const currentOpenings = store.state?.wallOpenings || state.wallOpenings || [];

    const isPlaced = currentPlaced.some(i => String(i.id) === targetIdStr);
    const isOpening = currentOpenings.some(op => String(op.id) === targetIdStr);

    if (isPlaced || !isOpening) {
      const nextPlaced = currentPlaced.filter(i => String(i.id) !== targetIdStr);
      recordHistory(nextPlaced);
      setPlacedItems(nextPlaced);
      store.setPlacedItems(nextPlaced);
    }

    if (isOpening || !isPlaced) {
      const nextOpenings = currentOpenings.filter((op: any) => String(op.id) !== targetIdStr);
      setState((prev: any) => ({ ...prev, wallOpenings: nextOpenings }));
      store.setState({ wallOpenings: nextOpenings });
    }

    store.setSelectedItemId(null);
    setSelectedItemId(null);
  };

  const handleRotateItem = () => {
    if (!selectedItemId) return;
    recordHistory(
      placedItems.map(item =>
        item.id === selectedItemId
          ? { ...item, rotation: (item.rotation + Math.PI / 2) % (Math.PI * 2) }
          : item
      )
    );
  };



  if (wizardStep < 5) {
    return (
      <div className="flex h-full w-full bg-[#F0EFEB] font-sans overflow-hidden select-none relative">
        {/* Left Column: Form/Steps */}
        <div className="w-[380px] bg-white border-r border-gray-100 flex flex-col h-full relative z-25">
          {/* Header */}
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-black tracking-widest text-[#1A1A1A] font-mono">TILE VISTA</span>
            <button
              onClick={() => { window.location.href = '/designer'; }}
              className="text-[10px] font-bold text-gray-400 hover:text-black tracking-widest uppercase transition-colors"
            >
              Exit
            </button>
          </div>

          {/* Wizard content */}
          <div className="flex-1 overflow-y-auto">
            <div className={`p-6 space-y-6 transition-all duration-200 transform ${fadeState === 'in' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
              }`}>





              {/* step 1 */}




              {wizardStep === 1 ? (
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-bold tracking-widest text-[#D4C5B9] uppercase block">Step 1 of 4</span>
                    <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A] mt-1">
                      Choose your room shape
                    </h1>
                    <p className="text-xs text-gray-500 font-light mt-1 max-w-sm leading-relaxed">
                      Select a layout preset for your room. You can adjust the dimensions and drag the walls directly in the 3D scene in the next step.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block">Select Layout Preset</span>
                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        {
                          id: 'rectangular',
                          name: 'Rectangular',
                          description: 'Simple 4-wall layout',
                          svg: (
                            <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#1A1A1A] opacity-80">
                              <rect x="15" y="25" width="70" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
                              <circle cx="15" cy="25" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="85" cy="25" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="15" cy="75" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="85" cy="75" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            </svg>
                          )
                        },
                        {
                          id: 'l-shape',
                          name: 'L-Shape',
                          description: 'Modern 6-wall layout',
                          svg: (
                            <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#1A1A1A] opacity-80">
                              <path d="M 20 20 L 55 20 L 55 55 L 80 55 L 80 80 L 20 80 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                              <circle cx="20" cy="20" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="55" cy="20" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="55" cy="55" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="80" cy="55" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="80" cy="80" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="20" cy="80" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            </svg>
                          )
                        },
                        {
                          id: 't-shape',
                          name: 'T-Shape',
                          description: 'Classic 8-wall layout',
                          svg: (
                            <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#1A1A1A] opacity-80">
                              <path d="M 35 80 L 65 80 L 65 45 L 85 45 L 85 20 L 15 20 L 15 45 L 35 45 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                              <circle cx="35" cy="80" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="65" cy="80" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="65" cy="45" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="85" cy="45" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="85" cy="20" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="15" cy="20" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="15" cy="45" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="35" cy="45" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            </svg>
                          )
                        },
                        {
                          id: 'u-shape',
                          name: 'U-Shape',
                          description: 'Spacious 8-wall layout',
                          svg: (
                            <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#1A1A1A] opacity-80">
                              <path d="M 20 80 L 40 80 L 40 45 L 60 45 L 60 80 L 80 80 L 80 20 L 20 20 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                              <circle cx="20" cy="80" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="40" cy="80" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="40" cy="45" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="60" cy="45" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="60" cy="80" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="80" cy="80" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="80" cy="20" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="20" cy="20" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            </svg>
                          )
                        },
                        {
                          id: 'custom',
                          name: 'Cut Corner',
                          description: 'Custom 5-wall layout',
                          svg: (
                            <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#1A1A1A] opacity-80">
                              <path d="M 20 20 L 60 20 L 80 40 L 80 80 L 20 80 Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                              <circle cx="20" cy="20" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="60" cy="20" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="80" cy="40" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="80" cy="80" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              <circle cx="20" cy="80" r="4" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                            </svg>
                          )
                        }
                      ].map((shapeOption) => (
                        <button
                          key={shapeOption.id}
                          onClick={() => setSelectedShape(shapeOption.id as any)}
                          className={`p-3 rounded-xl border text-left flex flex-col items-center justify-center gap-2 transition-all duration-300 ${selectedShape === shapeOption.id
                            ? 'border-black bg-black/[0.02] ring-2 ring-black/5 shadow-sm scale-[1.01]'
                            : 'border-gray-250 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                        >
                          {shapeOption.svg}
                          <span className="text-[10px] font-bold block text-[#1A1A1A]">{shapeOption.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>






                /* step 2 */






              ) : wizardStep === 2 ? (
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-bold tracking-widest text-[#D4C5B9] uppercase block">
                      {customiseFromWorkspace ? 'Room Customizer' : 'Step 2 of 4'}
                    </span>
                    <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A] mt-1">
                      {customiseFromWorkspace ? 'Room Dimensions' : 'Adjust your dimensions'}
                    </h1>
                    <p className="text-xs text-gray-500 font-light mt-1 max-w-sm leading-relaxed">
                      {customiseFromWorkspace ? 'Drag the walls/corners in the 2D floor plan, or type in the inputs below to resize your room.' : "Edit the floor plan on the right to match your room's wall dimensions."}
                    </p>
                  </div>

                  {/* Animated illustration of hand drag */}
                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 flex items-center justify-center relative overflow-hidden select-none">
                    <svg viewBox="0 0 200 120" className="w-48 h-32 text-gray-400">
                      <rect x="30" y="25" width="140" height="70" rx="6" fill="none" stroke="#e4e4e7" strokeWidth="2.5" />
                      <line x1="30" y1="25" x2="30" y2="95" stroke="#FFDA1A" strokeWidth="3.5" strokeLinecap="round" className="animate-pulse" />
                      <circle cx="30" cy="25" r="4.5" fill="white" stroke="#a1a1aa" strokeWidth="2" />
                      <circle cx="30" cy="95" r="4.5" fill="white" stroke="#a1a1aa" strokeWidth="2" />
                      <circle cx="170" cy="25" r="4.5" fill="white" stroke="#e4e4e7" strokeWidth="2" />
                      <circle cx="170" cy="95" r="4.5" fill="white" stroke="#e4e4e7" strokeWidth="2" />
                      <path d="M 22 60 L 14 60 M 14 60 L 17 56 M 14 60 L 17 64 M 38 60 L 46 60 M 46 60 L 43 56 M 46 60 L 43 64" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <g>
                        <path
                          d="M 30 60 L 32 78 L 39 74 L 44 82 L 48 80 L 43 72 L 49 70 Z"
                          fill="white"
                          stroke="#111111"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                          style={{ animation: 'ikeaHandMove 3s ease-in-out infinite' }}
                        />
                      </g>
                    </svg>
                    <style dangerouslySetInnerHTML={{
                      __html: `
                    @keyframes ikeaHandMove {
                      0%, 100% { transform: translateX(0); }
                      50% { transform: translateX(8px); }
                    }
                  `}} />
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Unit System</span>
                      <div className="flex border border-gray-250 bg-gray-50 p-0.5 rounded-full w-full">
                        <button
                          onClick={() => handleUnitChange('cm')}
                          className={`flex-1 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded-full transition-all duration-300 ${dimensionsUnit === 'cm' ? 'bg-black text-white shadow-sm' : 'text-gray-400 hover:text-gray-700'
                            }`}
                        >
                          Centimetres
                        </button>
                        <button
                          onClick={() => handleUnitChange('m')}
                          className={`flex-1 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded-full transition-all duration-300 ${dimensionsUnit === 'm' ? 'bg-black text-white shadow-sm' : 'text-gray-400 hover:text-gray-700'
                            }`}
                        >
                          Meters
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      {[
                        { label: 'Width', val: widthInput, setVal: setWidthInput, err: validationErrors.width, key: 'width' },
                        { label: 'Length', val: lengthInput, setVal: setLengthInput, err: validationErrors.length, key: 'length', disabled: selectedShape === 'square' },
                        { label: 'Height', val: heightInput, setVal: setHeightInput, err: validationErrors.height, key: 'height' },
                      ].map((inputOpt) => (
                        <div key={inputOpt.key} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-bold tracking-wider text-gray-500 uppercase">
                              {inputOpt.label}
                            </label>
                            {inputOpt.disabled && (
                              <span className="text-[8px] px-2 py-0.5 rounded bg-gray-150 text-gray-500 uppercase">Locked (Square)</span>
                            )}
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              step={dimensionsUnit === 'm' ? '0.1' : '10'}
                              value={inputOpt.val}
                              disabled={inputOpt.disabled}
                              onChange={(e) => handleDimensionInputChange(inputOpt.key, e.target.value)}
                              className={`w-full bg-gray-50 border px-3.5 py-2.5 text-xs font-semibold text-[#1A1A1A] focus:outline-none focus:border-black rounded-xl transition-all ${inputOpt.err ? 'border-red-400 bg-red-50/20' : 'border-gray-250'
                                } ${inputOpt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 font-mono">
                              {dimensionsUnit}
                            </span>
                          </div>
                          {inputOpt.err && (
                            <span className="text-[9px] text-red-500 block font-light leading-tight mt-0.5">{inputOpt.err}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>


                /* step 3 */


              ) : wizardStep === 3 ? (
                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-bold tracking-widest text-[#D4C5B9] uppercase block">Step 3 of 4</span>
                    <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A] mt-1">
                      Choose your room type
                    </h1>
                    <p className="text-xs text-gray-500 font-light mt-1 max-w-sm leading-relaxed">
                      Select the type of room you want to design. We will load appropriate tiles, textures, and fixtures depending on your choice.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block">Room Type</span>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => {
                          setSelectedRoomType('bathroom');
                          setProjectName('My Bathroom Plan');
                          setShowRoomTypeModal(false);
                        }}
                        className={`p-5 rounded-xl border text-left flex items-start gap-4 transition-all duration-300 ${selectedRoomType === 'bathroom'
                          ? 'border-black bg-black/[0.02] ring-2 ring-black/5 shadow-sm scale-[1.01]'
                          : 'border-gray-255 hover:border-gray-400 hover:bg-gray-50'
                          }`}
                      >
                        <div className="p-3 bg-gray-100 rounded-lg text-black mt-0.5">
                          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M4 4h16v13a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V4z" />
                            <circle cx="12" cy="9" r="2" />
                          </svg>
                        </div>
                        <div>
                          <span className="text-sm font-bold block text-[#1A1A1A]">Bathroom Planner</span>
                          <span className="text-[10px] text-gray-400 block font-light mt-1 leading-relaxed">
                            Design custom bathrooms with tiles, bathtubs, vanities, toilets, and wet fixtures.
                          </span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedRoomType('room');
                          setProjectName('My Living Room Plan');
                          setShowRoomTypeModal(true);
                        }}
                        className={`p-5 rounded-xl border text-left flex items-start gap-4 transition-all duration-300 ${selectedRoomType === 'room'
                          ? 'border-black bg-black/[0.02] ring-2 ring-black/5 shadow-sm scale-[1.01]'
                          : 'border-gray-255 hover:border-gray-400 hover:bg-gray-50'
                          }`}
                      >
                        <div className="p-3 bg-gray-100 rounded-lg text-black mt-0.5">
                          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 9 9M5 12h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7z" />
                          </svg>
                        </div>
                        <div>
                          <span className="text-sm font-bold block text-[#1A1A1A]">Normal Room Planner</span>
                          <span className="text-[10px] text-gray-400 block font-light mt-1 leading-relaxed">
                            Design bedrooms, living rooms, and custom layouts with warm wood floors, matte painted walls, sofas, and beds.
                          </span>
                        </div>
                      </button>


                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block">Project Name</span>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 px-4 py-3.5 text-xs font-semibold text-[#1A1A1A] focus:outline-none focus:border-black rounded-xl transition-all"
                      placeholder="My Room Plan"
                    />
                  </div>
                </div>
              ) : (






                /* step 4 */





                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-bold tracking-widest text-[#D4C5B9] uppercase block">Step 4 of 4</span>
                    <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A] mt-1">
                      {wizardCategory ? 'Select Item' : 'Add Items'}
                    </h1>
                    <p className="text-xs text-gray-500 font-light mt-1 max-w-sm leading-relaxed">
                      {wizardCategory
                        ? 'Select an item below to place it in the room.'
                        : 'Choose a category below to add doors, windows, and furniture to your room.'}
                    </p>
                  </div>

                  {activePlacement && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between text-xs text-green-800 animate-pulse">
                      <div className="flex items-center gap-2 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        Placing: {activePlacement.name}
                      </div>
                      <button
                        onClick={() => setActivePlacement(null)}
                        className="text-green-500 hover:text-green-700 font-bold uppercase tracking-wider text-[9px]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {isPlacingItem && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-2 font-medium text-xs text-green-800 animate-pulse mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        Selected: {isPlacingItem.name}
                      </div>







                      {/* 3D preview */}







                      <ItemSidebarPreview item={isPlacingItem} />

                      <p className="text-[10px] text-green-700 text-center font-medium opacity-80 leading-tight">
                        Drag the item in the room to place it, then click Confirm.
                      </p>

                      <div className="flex gap-2 w-full mt-1">
                        <button
                          onClick={() => {
                            if (!isPlacingItem) return;
                            const currentList = useDesignerStore.getState().placedItems;
                            const exists = currentList.some((i: any) => String(i.id) === String(isPlacingItem.id));
                            if (!exists) {
                              const next = [...currentList, isPlacingItem];
                              setPlacedItems(next);
                              recordHistory(next);
                            }
                            setSelectedItemId(isPlacingItem.id);
                            setIsPlacingItem(null);
                          }}
                          className="flex-1 bg-[#4ade80] hover:bg-[#22c55e] text-white text-[10px] font-bold tracking-wider uppercase rounded-lg py-2 shadow-sm transition-all"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setIsPlacingItem(null)}
                          className="flex-1 bg-red-400 hover:bg-red-500 text-white text-[10px] font-bold tracking-wider uppercase rounded-lg py-2 shadow-sm transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                      <span className="text-[9px] text-green-600 text-center font-medium mt-1">
                        (Or click anywhere on the floor to place)
                      </span>
                    </div>
                  )}

                  <div className="space-y-5 h-[50vh] overflow-y-auto pr-2">
                    {!wizardCategory ? (
                      <>
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block">Categories</span>
                          <div className="grid grid-cols-2 gap-2.5">
                            {categories
                              .filter((cat) => {
                                if (selectedRoomType === 'room') {
                                  return cat.id !== 'wall_colours' && cat.id !== 'ospos_tiles' && cat.id !== 'wall_tiles' && cat.id !== 'floor_tiles';
                                }
                                return true;
                              })
                              .map((cat) => (
                                <button
                                  key={cat.id}
                                  onClick={() => setWizardCategory(cat.id)}
                                  className="p-3 rounded-xl border border-gray-255 hover:border-gray-400 hover:bg-gray-50 flex flex-col items-center justify-center gap-2 transition-all duration-300"
                                >
                                  <div className="h-10 flex items-center justify-center text-black">
                                    {cat.icon}
                                  </div>
                                  <span className="text-[9px] font-bold block text-[#1A1A1A] text-center leading-tight">
                                    {cat.label}
                                  </span>
                                </button>
                              ))}
                          </div>
                        </div>
                      </>


                      /* door and windows*/

                    ) : wizardCategory === 'openings' ? (
                      <>
                        <button
                          onClick={() => setWizardCategory(null)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black text-white hover:bg-gray-800 font-extrabold text-[10px] tracking-wider uppercase transition-all shadow-sm mb-4 cursor-pointer active:scale-95"
                        >
                          <ArrowLeft size={13} />
                          <span>Back to Categories</span>
                        </button>
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block">Doors</span>
                          <div className="grid grid-cols-2 gap-2.5">
                            {DOOR_STYLES.map((door) => {
                              const isSelected = activePlacement?.style === door.id;
                              return (
                                <button
                                  key={door.id}
                                  onClick={() => setActivePlacement({
                                    type: 'door',
                                    style: door.id,
                                    name: door.name,
                                    width: door.width,
                                    height: door.height,
                                    sillHeight: door.sillHeight,
                                  })}
                                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all duration-300 ${isSelected
                                    ? 'border-black bg-black/[0.02] ring-2 ring-black/5 shadow-sm'
                                    : 'border-gray-255 hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                                >
                                  <div className="h-14 flex items-center justify-center">
                                    {renderDoorIcon(door.id)}
                                  </div>
                                  <span className="text-[9px] font-bold block text-[#1A1A1A] text-center leading-tight">
                                    {door.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2 pt-3 border-t border-gray-100">
                          <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase block">Window styles</span>
                          <div className="grid grid-cols-2 gap-2.5">
                            {WINDOW_STYLES.map((win) => {
                              const isSelected = activePlacement?.style === win.id;
                              return (
                                <button
                                  key={win.id}
                                  onClick={() => setActivePlacement({
                                    type: 'window',
                                    style: win.id,
                                    name: win.name,
                                    width: win.width,
                                    height: win.height,
                                    sillHeight: win.sillHeight,
                                  })}
                                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all duration-300 ${isSelected
                                    ? 'border-black bg-black/[0.02] ring-2 ring-black/5 shadow-sm'
                                    : 'border-gray-255 hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                                >
                                  <div className="h-10 flex items-center justify-center">
                                    {renderDoorIcon(win.id)}
                                  </div>
                                  <span className="text-[9px] font-bold block text-[#1A1A1A] text-center leading-tight">
                                    {win.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setWizardCategory(null)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black text-white hover:bg-gray-800 font-extrabold text-[10px] tracking-wider uppercase transition-all shadow-sm mb-4 cursor-pointer active:scale-95"
                        >
                          <ArrowLeft size={13} />
                          <span>Back to Categories</span>
                        </button>

                        {isWizardLoading ? (
                          <div className="text-xs text-gray-400">Loading items...</div>
                        ) : wizardDynamicItems.length === 0 ? (
                          <div className="text-xs text-gray-400">No items found in this category.</div>
                        ) : (
                          <div className="grid grid-cols-1 gap-2">
                            {wizardDynamicItems.map((item: any, idx: number) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setIsPlacingItem({
                                    id: `${item.type}_${Date.now()}`,
                                    type: item.type,
                                    name: item.name,
                                    cost: item.cost,
                                    position: [0, 0, 0],
                                    rotation: 0,
                                    isWallMounted: item.isWallMounted || false,
                                    color: '#FFFFFF',
                                    model: item.model,
                                    image: item.image
                                  });
                                }}
                                className="w-full text-left p-3 border border-gray-100 rounded-xl hover:border-black hover:bg-gray-50 transition-all flex items-center gap-4"
                              >
                                {item.image && (
                                  <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-white border border-gray-100 flex items-center justify-center">
                                    <img src={item.image} alt={item.name} className="max-w-full max-h-full object-contain" />
                                  </div>
                                )}
                                <div className="flex flex-col gap-1.5 flex-1">
                                  <span className="text-xs font-bold text-[#1A1A1A] line-clamp-2">{item.name}</span>
                                  <div className="flex justify-between items-center w-full">
                                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                                      {item.isWallMounted ? 'Wall Snap' : 'Floor Placement'}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 flex gap-3 bg-white">
            {wizardStep > 1 && !customiseFromWorkspace && (
              <button
                onClick={() => transitionToStep(wizardStep - 1)}
                className="flex-1 py-3.5 bg-white border border-black hover:bg-black hover:text-white text-black text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all shadow-sm text-center"
              >
                Go Back
              </button>
            )}
            {customiseFromWorkspace ? (
              <button
                onClick={() => {
                  if (Object.keys(validationErrors).some((k) => !!(validationErrors as any)[k])) return;
                  const wFt = cmToFeet(widthInMeters * 100);
                  const dFt = cmToFeet(lengthInMeters * 100);
                  const hFt = cmToFeet(heightInMeters * 100);
                  setState((prev) => ({
                    ...prev,
                    widthFt: wFt,
                    depthFt: dFt,
                    heightFt: hFt,
                  }));
                  setWizardStep(5);
                  setCustomiseFromWorkspace(false);
                }}
                disabled={Object.keys(validationErrors).some((k) => !!(validationErrors as any)[k])}
                className={`flex-1 py-3.5 bg-black hover:bg-[#222] text-white text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-2 ${Object.keys(validationErrors).some((k) => !!(validationErrors as any)[k])
                  ? 'opacity-40 cursor-not-allowed bg-gray-400 shadow-none'
                  : ''
                  }`}
              >
                Done
              </button>
            ) : (
              <button
                onClick={handleWizardNext}
                disabled={
                  (wizardStep === 1 && !selectedShape) ||
                  (wizardStep === 2 && Object.keys(validationErrors).some((k) => !!(validationErrors as any)[k])) ||
                  isSubmitting
                }
                className={`flex-1 py-3.5 bg-black hover:bg-[#222] text-white text-[10px] font-bold tracking-widest uppercase rounded-xl transition-all shadow-md flex items-center justify-center gap-2 ${((wizardStep === 1 && !selectedShape) ||
                  (wizardStep === 2 && Object.keys(validationErrors).some((k) => !!(validationErrors as any)[k])) ||
                  isSubmitting)
                  ? 'opacity-40 cursor-not-allowed bg-gray-400 shadow-none'
                  : ''
                  }`}
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                ) : (
                  wizardStep === 4 ? 'Enter Workspace' : 'Next'
                )}
              </button>
            )}
          </div>
        </div>



        {/*  step 5  */}



        {/* 3D Preview */}

        {/*   Living Room , Bedroom , Dinning Room  */}






        {/* RIGHT COLUMN: 3D Preview */}
        <div className="flex-1 h-full bg-[#ececec] relative overflow-hidden">

          {/* Room Type Modal Overlay */}
          {showRoomTypeModal && (
            <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-md flex items-center justify-center p-8">
              <div className="max-w-4xl w-full">
                <div className="text-center mb-12">
                  <h2 className="text-4xl font-bold text-[#1A1A1A] mb-4 tracking-tight">Choose Your Room</h2>
                  <p className="text-gray-500 font-light">Select a room type to customize your default items and layout.</p>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { id: 'living_room', label: 'Living Room', image: 'livingroom.jpg.avif' },
                    { id: 'bed_room', label: 'Bedroom', image: 'bedroom.jpg' },
                    { id: 'dining_room', label: 'Dining Room', image: 'dinningroom.jpg' },
                  ].map((rt) => (
                    <div
                      key={rt.id}
                      onClick={() => {
                        setSubRoomType(rt.id as any);
                        setShowRoomTypeModal(false);
                      }}
                      className={`group relative h-80 overflow-hidden rounded-[24px] cursor-pointer transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl border-4 ${subRoomType === rt.id ? 'border-black ring-4 ring-black/10 shadow-2xl scale-[1.02]' : 'border-white bg-white shadow-lg'
                        }`}
                    >
                      {/* Image Background */}
                      <div className="absolute inset-0 z-0 bg-gray-100 overflow-hidden">
                        <img
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                          src={`/images/${rt.image}`}
                          alt={rt.label}
                        />
                        {/* Lighter gradient just enough for text readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
                      </div>

                      {/* Content */}
                      <div className="relative z-10 h-full flex flex-col justify-end p-6">
                        <div className="transform group-hover:-translate-y-2 transition-transform duration-500">
                          <h3 className="text-2xl font-bold text-white tracking-wide drop-shadow-md">{rt.label}</h3>
                          <div className={`h-1 w-12 rounded-full mt-4 transition-all duration-500 ${subRoomType === rt.id ? 'bg-white' : 'bg-white/40 group-hover:w-20'}`} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedShape ? (
            <div className="w-full h-full relative">
              {wizardStep === 4 && <ProductPanel />}
              <Canvas
                camera={wizardStep === 1 || wizardStep === 2 ? { position: [0, 4, 6], fov: 42 } : { position: [0, 6, 7], fov: 38 }}
                gl={{ antialias: true, preserveDrawingBuffer: true }}
                style={{ width: '100%', height: '100%' }}
                shadows={wizardStep !== 2}
              >
                <color attach="background" args={["#ececec"]} />
                <ambientLight intensity={0.65} />
                <directionalLight position={[5, 10, 5]} intensity={1.0} castShadow={wizardStep !== 2} />
                <Suspense fallback={null}>
                  <CameraController wizardStep={wizardStep} controlsRef={wizardControlsRef} />
                  <RoomPreview3D
                    shape={selectedShape}
                    width={widthInMeters}
                    length={lengthInMeters}
                    height={heightInMeters}
                    unit={dimensionsUnit}
                    rotate={wizardStep === 1}
                    onStartDrag={() => setOrbitEnabled(false)}
                    onEndDrag={() => setOrbitEnabled(true)}
                    onVertexDrag={handleVertexDrag}
                    onWallDrag={handleWallDrag}
                    previewZoomTrigger={previewZoomTrigger}
                    setPreviewZoomTrigger={setPreviewZoomTrigger}
                    selectedRoomType={selectedRoomType}
                    wizardStep={wizardStep}
                    wallOpenings={wizardWallOpenings}
                    onAddWallOpening={handleAddWallOpening}
                    onUpdateWallOpeningOffset={handleUpdateWallOpeningOffset}
                    onRemoveWallOpening={handleRemoveWallOpening}
                    activePlacement={activePlacement}
                    setActivePlacement={setActivePlacement}
                    placedItems={placedItems}
                    setPlacedItems={setPlacedItems}
                    isPlacingItem={isPlacingItem}
                    setIsPlacingItem={setIsPlacingItem}
                    selectedItemId={selectedItemId}
                    setSelectedItemId={setSelectedItemId}
                    recordHistory={recordHistory}
                    measurementSettings={measurementSettings}
                    isMeasuring={isMeasuring}
                    setIsMeasuring={setIsMeasuring}
                    savedMeasurements={savedMeasurements}
                    setSavedMeasurements={setSavedMeasurements}
                    measureStartPoint={measureStartPoint}
                    setMeasureStartPoint={setMeasureStartPoint}
                    measureTempEndPoint={measureTempEndPoint}
                    setMeasureTempEndPoint={setMeasureTempEndPoint}
                    roomOffset={roomOffset}
                  />
                  <OrbitControls ref={wizardControlsRef} enabled={orbitEnabled} enableRotate={wizardStep !== 2} enableDamping dampingFactor={0.05} maxPolarAngle={Math.PI / 2.1} />
                </Suspense>
              </Canvas>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 rounded-full bg-white/40 flex items-center justify-center mb-4 text-[#D4C5B9]">
                <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[#1A1A1A]">Select a Shape</h3>
              <p className="text-xs text-gray-500 font-light mt-1.5 max-w-xs leading-relaxed">
                Choose one of the presets on the left to visualize it in 3D and customize dimensions.
              </p>
            </div>
          )}

          {/* Floating Zoom Controls for Preview */}
          {selectedShape && (
            <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20">
              <button
                onClick={() => setPreviewZoomTrigger('in')}
                className="w-10 h-10 bg-white hover:bg-gray-50 border border-gray-255 shadow-md rounded-full flex items-center justify-center text-[#1A1A1A] transition-all hover:scale-105 active:scale-95"
                title="Zoom In"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <button
                onClick={() => setPreviewZoomTrigger('out')}
                className="w-10 h-10 bg-white hover:bg-gray-50 border border-gray-255 shadow-md rounded-full flex items-center justify-center text-[#1A1A1A] transition-all hover:scale-105 active:scale-95"
                title="Zoom Out"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }










  return (
    <div className="flex h-full w-full bg-[#F0EFEB] font-sans overflow-hidden select-none relative">





      {/* ── HEADER ── */}
      <DesignerToolbar onSave={handleSaveDesign} readOnly={readOnly} />



      <ProductPanel readOnly={readOnly} />



      {/* ── 3D CANVAS ── */}
      <MemoizedCanvas
        state={state}
        setState={setState}
        topView={topView}
        activeSideView={activeSideView}
        setActiveSideView={setActiveSideView}
        zoomTrigger={zoomTrigger}
        setZoomTrigger={setZoomTrigger}
        setNumWalls={setNumWalls}
        placedItems={placedItems}
        setPlacedItems={setPlacedItems}
        selectedItemId={selectedItemId}
        setSelectedItemId={setSelectedItemId}
        isPlacingItem={isPlacingItem}
        setIsPlacingItem={setIsPlacingItem}
        orbitEnabled={orbitEnabled}
        setOrbitEnabled={setOrbitEnabled}
        activePlacement={activePlacement}
        setActivePlacement={setActivePlacement}
        CustomFurniture={CustomFurniture}
        measurementSettings={measurementSettings}
        isMeasuring={isMeasuring}
        setIsMeasuring={setIsMeasuring}
        savedMeasurements={savedMeasurements}
        setSavedMeasurements={setSavedMeasurements}
        measureStartPoint={measureStartPoint}
        setMeasureStartPoint={setMeasureStartPoint}
        measureTempEndPoint={measureTempEndPoint}
        setMeasureTempEndPoint={setMeasureTempEndPoint}
        activeCategory={activeCategory}
        readOnly={readOnly}
      />




      {/* ── BOTTOM CONTROL BAR ── */}




      {!readOnly && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/85 backdrop-blur-md border border-gray-200/80 shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-4 z-20">
          {/* Dollhouse view */}
          <button
            id="btn-dollhouse"
            onClick={() => setTopView(false)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 ${!topView ? 'bg-[#1A1A1A] text-white shadow-md' : 'text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100/50'
              }`}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            Dollhouse
          </button>

          {/* Top view */}
          <button
            id="btn-topview"
            onClick={() => setTopView(true)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all duration-300 ${topView ? 'bg-[#1A1A1A] text-white shadow-md' : 'text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100/50'
              }`}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            Top View
          </button>

          <div className="w-[1px] h-5 bg-gray-200" />

          {/* Customise room */}
          <button
            id="btn-customise"
            onClick={openCustomiseFromWorkspace}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-full tracking-wider transition-all ${wizardStep === 2 && customiseFromWorkspace ? 'bg-black text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Customise Room
          </button>

          {/* Add Items */}
          {state.designType !== 'bathroom' && (
            <button
              onClick={() => setWizardStep(4)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase rounded-full tracking-wider transition-all bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Items
            </button>
          )}

          <div className="w-[1px] h-5 bg-gray-200" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              id="btn-zoom-in"
              onClick={() => setZoomTrigger('in')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100/50 transition-all"
              title="Zoom In"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <button
              id="btn-zoom-out"
              onClick={() => setZoomTrigger('out')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100/50 transition-all"
              title="Zoom Out"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /></svg>
            </button>
          </div>

          <div className="w-[1px] h-5 bg-gray-200" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-1">
            <button
              id="btn-undo"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${undoStack.length === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100/50'}`}
              title="Undo"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
            </button>
            <button
              id="btn-redo"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${redoStack.length === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-[#1A1A1A] hover:bg-gray-100/50'}`}
              title="Redo"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
              </svg>
            </button>
          </div>

          {selectedRoomType === 'bathroom' && (
            <>
              <div className="w-[1px] h-5 bg-gray-200" />





              {/* Measurement tool button & popup panel */}




              <div className="relative">
                <button
                  id="btn-measurement"
                  onClick={() => setShowMeasurementPanel(!showMeasurementPanel)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showMeasurementPanel ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  title="Measurement Options"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21.3 8.24 15.76 2.7a1 1 0 0 0-1.41 0L3.27 13.78a1 1 0 0 0 0 1.41l5.54 5.54a1 1 0 0 0 1.41 0L21.3 9.66a1 1 0 0 0 0-1.42ZM7.5 17.5l1.5-1.5M10.5 14.5l1.5-1.5M13.5 11.5l1.5-1.5M16.5 8.5l1.5-1.5" />
                  </svg>
                </button>

                {showMeasurementPanel && (
                  <div className="absolute bottom-full mb-3 right-0 bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 flex flex-col gap-4 min-w-[240px] z-50">
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-xs font-bold text-gray-700">Product spacing</span>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={measurementSettings.productSpacing}
                          onChange={(e) => setMeasurementSettings(prev => ({ ...prev, productSpacing: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                      </label>
                    </div>

                    <div className="flex justify-between items-center gap-4">
                      <span className="text-xs font-bold text-gray-700">Room dimensions</span>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={measurementSettings.roomDimensions}
                          onChange={(e) => setMeasurementSettings(prev => ({ ...prev, roomDimensions: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                      </label>
                    </div>

                    <div className="h-[1px] bg-gray-100" />

                    <div className="flex justify-between items-center gap-4">
                      <span className="text-xs font-bold text-gray-700">Unit</span>
                      <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200/50">
                        <button
                          type="button"
                          onClick={() => setMeasurementSettings(prev => ({ ...prev, unit: 'ft' }))}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${measurementSettings.unit === 'ft' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
                        >
                          ft
                        </button>
                        <button
                          type="button"
                          onClick={() => setMeasurementSettings(prev => ({ ...prev, unit: 'cm' }))}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${measurementSettings.unit === 'cm' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}
                        >
                          cm
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}




      {/* ── SAVE DESIGN MODAL ── */}
      <SaveDesignModal />
      <DoorSizeModalComponent />




      {/* ── CUSTOM ALERT MODAL ── */}


      {alertMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 border border-gray-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#D4C5B9] mb-4">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-[#1A1A1A] tracking-tight">Notification</h3>
            <p className="text-xs text-gray-500 font-light mt-2 leading-relaxed">
              {alertMessage}
            </p>
            <button
              onClick={() => {
                const shouldReload = alertMessage?.includes("saved");
                hideAlert();
                if (shouldReload) {
                  window.location.reload();
                }
              }}
              className="mt-6 w-full py-3 bg-[#1A1A1A] hover:bg-[#333] text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export function ItemSidebarPreview({ item, heightClass = "h-40" }: { item: any, heightClass?: string }) {
  const modelUrl = item.glbUrl || item.model || undefined;
  const STATIC_BASE = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : 'http://localhost:4000';
  const fullUrl = modelUrl && modelUrl.startsWith('/uploads') ? `${STATIC_BASE}${modelUrl}` : modelUrl;
  const previewItem = { ...item, model: fullUrl };
  return (
    <div className={`w-full ${heightClass} bg-white rounded-lg overflow-hidden border border-gray-200 shadow-inner relative`}>
      <Canvas camera={{ position: [0, 1.8, 4.6], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} />
        <OrbitControls autoRotate autoRotateSpeed={2.0} enableZoom={true} enablePan={false} target={[0, 0.6, 0]} />
        <group position={[0, -0.9, 0]}>
          <DynamicFurnitureModel item={previewItem} selected={false} />
        </group>
      </Canvas>
      <div className="absolute top-2 left-2 bg-black/50 text-white text-[9px] px-2 py-0.5 rounded backdrop-blur-sm font-medium tracking-wide">
        3D PREVIEW
      </div>
    </div>
  );
}

export default function SharedDesignerEngine({ catalog, categories, CustomFurniture, readOnly = false }: { catalog: any[], categories: any[], CustomFurniture?: any, readOnly?: boolean }) {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-[#FAF9F6] text-xs font-semibold text-gray-500 uppercase tracking-widest">
        Loading TileVista Planner...
      </div>
    }>
      <BathroomPlannerPageInner catalog={catalog} categories={categories} CustomFurniture={CustomFurniture} readOnly={readOnly} />
    </Suspense>
  );
}
