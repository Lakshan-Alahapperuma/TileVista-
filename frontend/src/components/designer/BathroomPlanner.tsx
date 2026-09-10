import React, { Suspense } from "react";
import SharedDesignerEngine from "./SharedDesignerEngine";
import { useDesignerStore } from "../../store/designer.store";
import { getActiveCatalog, getActiveCategories } from "./catalog";
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


export function BathroomCustomFurniture({ item, selected }: { item: any, selected: boolean }) {
  const t = item.type;
  if (t === "sink") return <SinkModel selected={selected} />;
  if (t === "bathtub") return <BathtubModel selected={selected} />;
  if (t === "shower") return <ShowerModel selected={selected} />;
  if (t === "toilet") return <ToiletModel selected={selected} />;
  if (t === "towel_rail") return <TowelRailModel selected={selected} />;
  if (t === "washing_machine") return <WashingMachineModel selected={selected} />;
  if (t === "light") return <WallLightModel selected={selected} />;
  if (t === "plant") return <PlantModel selected={selected} />;
  return null;
}

export default function BathroomPlanner({ readOnly = false }: { readOnly?: boolean }) {
  const { state } = useDesignerStore();
  const catalog = getActiveCatalog("bathroom");
  const categories = getActiveCategories("bathroom");

  return (
    <SharedDesignerEngine 
      catalog={catalog} 
      categories={categories} 
      CustomFurniture={BathroomCustomFurniture}
      readOnly={readOnly}
    />
  );
}
