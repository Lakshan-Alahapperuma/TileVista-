const fs = require('fs');

const sourcePath = 'src/app/(public)/designer/bathroom/page.tsx';
const lines = fs.readFileSync(sourcePath, 'utf8').split('\n');

function extractLines(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

// Extracting different chunks
const importsAndHelpers = extractLines(1, 474);
const modelsAndCanvas = extractLines(475, 2759);
const roomPreview = extractLines(2760, 3426);
const summaryModal = extractLines(3427, 3475);
const mainPageInner = extractLines(3476, 5335);

// Write to DesignerCanvas.tsx
const designerCanvasContent = `
import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useDesignerStore } from '../../store/designer.store';

${importsAndHelpers}
${modelsAndCanvas}
${roomPreview}
`;
fs.writeFileSync('src/components/designer/DesignerCanvas.tsx', designerCanvasContent);

console.log("Extraction step 1 complete.");
