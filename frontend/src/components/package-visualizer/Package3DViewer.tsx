'use client';

import React, { Suspense } from 'react';
import BathroomPlanner from '../designer/BathroomPlanner';
import { Loader2 } from 'lucide-react';

interface Package3DViewerProps {
  readOnly?: boolean;
}

export const Package3DViewer: React.FC<Package3DViewerProps> = ({ readOnly = false }) => {
  return (
    <div className="w-full h-full min-h-[550px] bg-gray-50 border border-gray-200 rounded-xl overflow-hidden relative shadow-sm">
      <Suspense fallback={
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4C5B9]" />
          <p className="text-sm text-gray-500 font-light font-sans">Initializing 3D designer environment...</p>
        </div>
      }>
        <BathroomPlanner readOnly={readOnly} />
      </Suspense>
    </div>
  );
};

export default Package3DViewer;
