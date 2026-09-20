'use client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as React from 'react';
import { BathroomShape, WallDesign } from '@tilevista/types';



export interface BathroomCanvasProps {
  width?: number;
  length?: number;
  height?: number;
  shape?: 'RECTANGLE' | 'L_SHAPE';
  cameraPosition?: [number, number, number];
}

/**
 * 3D Bathroom Canvas
 */
export const BathroomCanvas: React.FC<BathroomCanvasProps> = ({
  width = 2.4,
  length = 3,
  height = 2.7,
  shape = 'RECTANGLE',
  cameraPosition = [5, 5, 5],
}) => {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: cameraPosition }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={1} />

        <Room
  width={width}
  length={length}
  height={height}
  shape={shape}
/>

        <OrbitControls />
      </Canvas>
    </div>
  );
};

/**
 * Room Geometry (this is the important part)
 */
type RoomProps = {
  width: number;
  length: number;
  height: number;
  shape?: 'RECTANGLE' | 'L_SHAPE';
};

function Room({
  width,
  length,
  height,
  shape = 'RECTANGLE',
}: RoomProps) {
  const wallThickness = 0.1;

  // rectangle room
  if (shape === 'RECTANGLE') {
    return (
      <group>
        {/* floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, length]} />
          <meshStandardMaterial color="#d1d5db" />
        </mesh>

        {/* back wall */}
        <mesh position={[0, height / 2, -length / 2]}>
          <boxGeometry args={[width, height, wallThickness]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* front wall */}
        <mesh position={[0, height / 2, length / 2]}>
          <boxGeometry args={[width, height, wallThickness]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* left wall */}
        <mesh position={[-width / 2, height / 2, 0]}>
          <boxGeometry args={[wallThickness, height, length]} />
          <meshStandardMaterial color="white" />
        </mesh>

        {/* right wall */}
        <mesh position={[width / 2, height / 2, 0]}>
          <boxGeometry args={[wallThickness, height, length]} />
          <meshStandardMaterial color="white" />
        </mesh>
      </group>
    );
  }

  // L-shape room (two connected rectangles)
  const cutSize = width * 0.4;

  return (
    <group>
      {/* MAIN AREA */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-cutSize / 2, 0, 0]}>
        <planeGeometry args={[width - cutSize, length]} />
        <meshStandardMaterial color="#d1d5db" />
      </mesh>

      {/* EXTENSION AREA */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[width / 2 - cutSize / 2, 0, length / 2 - cutSize / 2]}
      >
        <planeGeometry args={[cutSize, length - cutSize]} />
        <meshStandardMaterial color="#d1d5db" />
      </mesh>

      {/* SIMPLE WALLS (outer boundary only) */}
      <mesh position={[0, height / 2, -length / 2]}>
        <boxGeometry args={[width, height, wallThickness]} />
        <meshStandardMaterial color="white" />
      </mesh>

      <mesh position={[0, height / 2, length / 2]}>
        <boxGeometry args={[width, height, wallThickness]} />
        <meshStandardMaterial color="white" />
      </mesh>

      <mesh position={[-width / 2, height / 2, 0]}>
        <boxGeometry args={[wallThickness, height, length]} />
        <meshStandardMaterial color="white" />
      </mesh>

      <mesh position={[width / 2, height / 2, 0]}>
        <boxGeometry args={[wallThickness, height, length]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </group>
  );
}

export interface RoomStructureProps {
  shape: BathroomShape;
  width: number;
  length: number;
  height: number;
  wallDesigns?: WallDesign[];
}

export const RoomStructure: React.FC<RoomStructureProps> = ({
  shape,
  width,
  length,
  height,
  wallDesigns = [],
}) => {
  return (
    <div id="three-room-structure" style={{ display: 'none' }}>
      {`Bathroom Shape: ${shape}, Dimensions: ${width}x${length}x${height}m, Walls: ${wallDesigns.length}`}
    </div>
  );
};

export interface TileMeshProps {
  tileSize?: string;
  color?: string;
  roughness?: number;
  textureUrl?: string;
}

export const TileMesh: React.FC<TileMeshProps> = ({
  tileSize = '600x600mm',
  color = '#ffffff',
  roughness = 0.5,
  textureUrl,
}) => {
  return (
    <div style={{ display: 'none' }}>
      {`Tile Mesh: ${tileSize}, Color: ${color}, Roughness: ${roughness}, Texture: ${textureUrl}`}
    </div>
  );
};

export interface RulerToolProps {
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
}

export const RulerTool: React.FC<RulerToolProps> = ({ start, end }) => {
  const distance = Math.sqrt(
    Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2) + Math.pow(end.z - start.z, 2)
  );

  return (
    <div style={{ color: '#ef4444', fontWeight: 'bold' }}>
      {`Distance: ${distance.toFixed(2)}m`}
    </div>
  );
};
