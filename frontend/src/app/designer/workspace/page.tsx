'use client';

import DesignerCanvas from '../../../components/designer/DesignerCanvas';
import BathroomPlanner from '../../../components/designer/BathroomPlanner';
import { useDesignerStore } from '../../../store/designer.store';

export default function DesignerPage() {
  const { state } = useDesignerStore();
  
  return (
    <div className="w-screen h-screen overflow-hidden">
      {state.designType === 'bathroom' ? <BathroomPlanner /> : <DesignerCanvas />}
    </div>
  );
}
