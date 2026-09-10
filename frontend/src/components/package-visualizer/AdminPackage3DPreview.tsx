'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const Package3DViewer = dynamic(
  () => import('./Package3DViewer'),
  { ssr: false }
);

export const AdminPackage3DPreview: React.FC = () => {
  return (
    <div className="w-full h-full min-h-[500px] border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-gray-50 relative">
      <Package3DViewer readOnly={false} />
    </div>
  );
};

export default AdminPackage3DPreview;
