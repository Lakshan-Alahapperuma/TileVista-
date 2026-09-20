const fs = require('fs');
const file = 'src/components/designer/DesignerCanvas.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldStart = 'function clampItemToPolygon(pt: {x: number, z: number}, width: number, depth: number, rotation: number, polygon: [number, number][]): {x: number, z: number} {';
const oldEnd = '  return clampedPt;\n}';
const startIdx = code.indexOf(oldStart);
const endIdx = code.indexOf(oldEnd, startIdx) + oldEnd.length;

if (startIdx !== -1 && endIdx !== -1) {
  const newFunc = `function clampItemToPolygon(pt: {x: number, z: number}, width: number, depth: number, rotation: number, polygon: [number, number][], shape: string = 'rectangular', roomW: number = 10, roomD: number = 10): {x: number, z: number} {
  const r = Math.max(width, depth) / 2;
  
  const clampToRects = (rects: any[]) => {
    let closestPt = { x: pt.x, z: pt.z };
    let minDist = Infinity;
    for (const rect of rects) {
      const minX = rect.minX + r;
      const maxX = rect.maxX - r;
      const minZ = rect.minZ + r;
      const maxZ = rect.maxZ - r;
      const cx = minX > maxX ? (rect.minX + rect.maxX) / 2 : Math.max(minX, Math.min(maxX, pt.x));
      const cz = minZ > maxZ ? (rect.minZ + rect.maxZ) / 2 : Math.max(minZ, Math.min(maxZ, pt.z));
      const dist = Math.hypot(pt.x - cx, pt.z - cz);
      if (dist < minDist) {
        minDist = dist;
        closestPt = { x: cx, z: cz };
      }
    }
    return closestPt;
  };

  if (shape === 'l-shape') {
    return clampToRects([
      { minX: -roomW/2, maxX: 0, minZ: -roomD/2, maxZ: roomD/2 },
      { minX: -roomW/2, maxX: roomW/2, minZ: 0, maxZ: roomD/2 }
    ]);
  }
  if (shape === 't-shape') {
    return clampToRects([
      { minX: -roomW/2, maxX: roomW/2, minZ: -roomD/2, maxZ: 0 },
      { minX: -roomW/4, maxX: roomW/4, minZ: 0, maxZ: roomD/2 }
    ]);
  }
  if (shape === 'u-shape') {
    return clampToRects([
      { minX: -roomW/2, maxX: roomW/2, minZ: 0, maxZ: roomD/2 },
      { minX: -roomW/2, maxX: -roomW/4, minZ: -roomD/2, maxZ: 0 },
      { minX: roomW/4, maxX: roomW/2, minZ: -roomD/2, maxZ: 0 }
    ]);
  }
  if (shape === 'rectangular' || shape === 'square') {
    return clampToRects([
      { minX: -roomW/2, maxX: roomW/2, minZ: -roomD/2, maxZ: roomD/2 }
    ]);
  }

  return clampToRects([
    { minX: -roomW/2, maxX: roomW/2, minZ: -roomD/2, maxZ: roomD/2 }
  ]);
}`;

  code = code.substring(0, startIdx) + newFunc + code.substring(endIdx);
  
  // Now replace the call sites
  code = code.replace(/const snapped = clampItemToPolygon\(\s*pt,\s*itemW,\s*itemD,\s*itemToMove\.rotation \|\| 0,\s*polygon\s*\);/g, 'const snapped = clampItemToPolygon(pt, itemW, itemD, itemToMove.rotation || 0, polygon, state.shape, w, d);');
  
  code = code.replace(/const snapped = clampItemToPolygon\(pt, 1\.0, 1\.0, 0, polygon\);/g, 'const snapped = clampItemToPolygon(pt, 1.0, 1.0, 0, polygon, state.shape, w, d);');
  
  fs.writeFileSync(file, code);
  console.log('Successfully patched DesignerCanvas.tsx');
} else {
  console.log('Failed to find function bounds!');
}
