import React, { Suspense } from "react";
import SharedDesignerEngine from "./SharedDesignerEngine";
import { useDesignerStore } from "../../store/designer.store";
import { getActiveCatalog, getActiveCategories } from "./catalog";
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

// ─── BATHROOM SCENE ──────────────────────────────────────────────────────────


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

export function DesignerCustomFurniture({ item, selected }: { item: any, selected: boolean }) {
  const t = item.type;
  if (t === "beds" || t === "bed") return <BedModel selected={selected} />;
  if (t === "wardrobes" || t === "wardrobe") return <WardrobeModel selected={selected} />;
  if (t === "sofa" || t === "sofas") return <SofaModel selected={selected} />;
  if (t === "table" || t === "dressing_table") return <TableModel selected={selected} />;
  if (t === "chair" || t === "chairs") return <ChairModel selected={selected} />;
  if (t === "tv_cabinet") return <TvCabinetModel selected={selected} />;
  if (t === "coffee_table") return <CoffeeTableModel selected={selected} />;
  if (t === "mirror" || t === "mirrors") return <MirrorModel selected={selected} />;
  if (t === "runners_and_small_rugs" || t === "rug" || t === "runner") return <RugModel selected={selected} />;
  return null;
}

export default function DesignerCanvas() {
  const { state } = useDesignerStore();
  const catalog = getActiveCatalog(state.designType, state.subRoomType);
  const categories = getActiveCategories(state.designType, state.subRoomType);

  return (
    <SharedDesignerEngine 
      catalog={catalog} 
      categories={categories} 
      CustomFurniture={DesignerCustomFurniture} 
    />
  );
}
