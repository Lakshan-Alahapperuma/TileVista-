'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center } from '@react-three/drei';
import { Loader2, AlertCircle } from 'lucide-react';

interface GeneratedModelProps {
  modelUrl: string;
}

function GeneratedModel({ modelUrl }: GeneratedModelProps) {
  // Try loading GLTF model
  const model = useGLTF(modelUrl);

  // Auto-center model and set standard sizing
  return (
    <Center>
      <primitive 
        object={model.scene} 
        scale={1.5} 
        castShadow 
        receiveShadow
      />
    </Center>
  );
}

// Simple error-boundary style fallback for R3F Canvas errors
export default function GlbModelViewer({ modelUrl }: GeneratedModelProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset error when URL changes
    setHasError(false);
  }, [modelUrl]);

  if (hasError) {
    return (
      <div className="h-[500px] w-full flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-slate-950 text-red-400 p-6 font-outfit">
        <AlertCircle className="w-12 h-12 mb-3 text-red-500 animate-pulse" />
        <h4 className="font-bold text-lg">Error Loading 3D Model</h4>
        <p className="text-sm text-slate-400 mt-1 text-center max-w-md">
          The generated GLB file could not be parsed. This can happen if the reconstruction output has invalid topology or texturing.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[500px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 relative shadow-2xl">
      {/* Loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm pointer-events-none z-10 opacity-0 transition-opacity duration-300 dynamic-loader">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>

      <Canvas 
        camera={{ position: [0, 1.5, 4], fov: 45 }}
        shadows
        onError={() => setHasError(true)}
      >
        <color attach="background" args={['#090d16']} />
        
        {/* Modern Studio Lighting System */}
        <ambientLight intensity={1.2} />
        <directionalLight 
          position={[5, 8, 5]} 
          intensity={1.8} 
          castShadow 
          shadow-mapSize={[2048, 2048]} 
        />
        <directionalLight position={[-5, 5, -5]} intensity={0.6} />
        <pointLight position={[0, -4, 0]} intensity={0.4} />

        <Suspense fallback={null}>
          <GeneratedModel modelUrl={modelUrl} />
        </Suspense>

        {/* Floor grid helper for size context */}
        <gridHelper args={[20, 20, '#4f46e5', '#1e293b']} position={[0, -1, 0]} />

        <OrbitControls 
          makeDefault 
          enableDamping 
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2 + 0.1} // Prevent going below floor grid
          minDistance={1}
          maxDistance={10}
        />
      </Canvas>
    </div>
  );
}
