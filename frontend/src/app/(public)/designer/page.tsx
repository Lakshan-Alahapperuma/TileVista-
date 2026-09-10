'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../../features/auth/AuthContext';

function DesignerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const packageId = searchParams.get('package');
  const { user } = useAuth();
  const [savedDesigns, setSavedDesigns] = React.useState<any[]>([]);
  const [loadingDesigns, setLoadingDesigns] = React.useState(true);

  React.useEffect(() => {
    if (packageId) {
      router.replace(`designer/workspace?package=${packageId}`);
    }
  }, [packageId, router]);

  React.useEffect(() => {
    const fetchDesigns = async () => {
      try {
        if (!user) {
          setSavedDesigns([]);
          setLoadingDesigns(false);
          return;
        }
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const targetUserId = user.id;
        const response = await fetch(`${apiUrl}/designer/customer/${targetUserId}`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          setSavedDesigns(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDesigns(false);
      }
    };
    fetchDesigns();
  }, [user]);

  const goToWorkspace = () => {
    router.push('designer/workspace');
  };

  const loadSavedDesign = (designId: string) => {
    router.push(`designer/workspace?id=${designId}`);
  };

  if (packageId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4 font-sans">
        <span className="w-8 h-8 border-2 border-[#1a1a1a]/30 border-t-[#1a1a1a] rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-light">Redirecting to 3D Customizer...</p>
      </div>
    );
  }

  return (
    <div className="py-8 font-sans max-w-7xl mx-auto px-4 md:px-8 space-y-12 select-none">

      {/* Header */}
      <div className="border-b border-gray-100 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-[0.3em] text-[#D4C5B9] uppercase block mb-2">
            DESIGN YOUR ROOM
          </span>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1A1A1A]">
            Create Your Space
          </h1>
          <p className="text-sm text-gray-500 font-light mt-1.5 max-w-xl leading-relaxed">
            Select one of our planner customizers or resume work on one of your saved projects in the dashboard below.
          </p>
        </div>
      </div>

      {/* Cards Container - Simplified to One Premium Widescreen Card */}
      <div className="max-w-4xl mx-auto">
        <div
          onClick={goToWorkspace}
          className="flex flex-col md:flex-row bg-white border border-gray-100 shadow-lg hover:shadow-2xl hover:scale-[1.01] transition-all duration-500 cursor-pointer group rounded-2xl overflow-hidden"
        >
          {/* Left Widescreen Image */}
          <div className="relative w-full md:w-1/2 aspect-[4/3] md:aspect-auto bg-gray-50 overflow-hidden min-h-[260px]">
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-[1000ms] group-hover:scale-[1.05]"
              style={{
                backgroundImage: `url('https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=1200')`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/40 to-transparent" />
          </div>

          {/* Right Text Description */}
          <div className="flex-1 bg-[#1A1A1A] p-8 md:p-10 flex flex-col justify-between text-white min-h-[260px]">
            <div className="space-y-3">
              <span className="text-[9px] font-bold tracking-[0.25em] text-[#D4C5B9] uppercase block">
                Interactive 3D Customizer
              </span>
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight leading-snug">
                Customize a Design
              </h3>
              <p className="text-xs text-gray-400 font-light leading-relaxed max-w-sm">
                Begin our step-by-step room builder. Choose your layout preset, customize wall dimensions dynamically, and design your space with premium tiles and fixtures.
              </p>
            </div>

            <div className="flex items-center gap-4 mt-6">
              <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center group-hover:bg-white group-hover:text-[#1A1A1A] transition-all duration-300">
                <ArrowRight size={18} />
              </div>
              <span className="text-xs font-bold tracking-widest uppercase text-gray-300 group-hover:text-white transition-colors">
                Start Planning
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Saved Designs Section */}
      <div className="border-t border-gray-100 pt-10 space-y-6">
        <div>
          <span className="text-[10px] font-bold tracking-[0.3em] text-[#D4C5B9] uppercase block mb-2">
            YOUR SAVED DESIGNS
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">
            Recent Projects
          </h2>
          <p className="text-xs text-gray-500 font-light mt-1.5">
            Pick up right where you left off. Click on any design to open it in the 3D Customizer workspace.
          </p>
        </div>

        {loadingDesigns ? (
          <div className="flex justify-center items-center py-12">
            <span className="w-6 h-6 border-2 border-[#1a1a1a]/30 border-t-[#1a1a1a] rounded-full animate-spin" />
          </div>
        ) : savedDesigns.length === 0 ? (
          <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-2xl p-12 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <h4 className="text-sm font-semibold text-[#1A1A1A]">No designs saved yet</h4>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
              Create a new room shape and add products in the customizer workspace to save your first plan here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedDesigns.map((design) => (
              <div
                key={design.id}
                onClick={() => loadSavedDesign(design.id)}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-[160px]"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-sm font-bold text-[#1A1A1A] group-hover:text-black line-clamp-1">
                      {design.name || 'Untitled Plan'}
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                      design.type === 'room' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {design.type === 'room' ? 'Normal Room' : (design.type || 'bathroom').replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mt-1">
                    Shape: {design.shape}
                  </p>
                  <p className="text-[11px] text-gray-500 font-mono mt-3">
                    {Math.round(design.width * 100)}cm × {Math.round(design.length * 100)}cm × {Math.round(design.height * 100)}cm
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-gray-150 pt-3 mt-4 text-[10px] font-bold text-gray-400 group-hover:text-black transition-colors uppercase tracking-widest">
                  Open Project
                  <ArrowRight size={12} className="transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DesignerPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-gray-400 font-light">Loading designer configurations...</div>}>
      <DesignerPageContent />
    </Suspense>
  );
}
