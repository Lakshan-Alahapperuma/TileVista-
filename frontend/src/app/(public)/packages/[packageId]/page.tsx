'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import PackageDetails from '../../../../components/package-visualizer/PackageDetails';
import PackageProductList from '../../../../components/package-visualizer/PackageProductList';
import { Package } from '../../../../types/package';
import { packageService } from '../../../../services/package.service';

const Package3DViewer = dynamic(
  () => import('../../../../components/package-visualizer/Package3DViewer'),
  { ssr: false }
);

interface PageProps {
  params: {
    packageId: string;
  };
}

export default function PackageDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { packageId } = params;
  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('package') !== packageId) {
        url.searchParams.set('package', packageId);
        window.history.replaceState(null, '', url.toString());
      }
    }

    const loadPackage = async () => {
      try {
        const data = await packageService.getPackage(packageId);
        setPkg(data);
      } catch (err: any) {
        console.error('Error loading package detail:', err);
        setError(err.message || 'Failed to load package details.');
      } finally {
        setLoading(false);
      }
    };

    loadPackage();
  }, [packageId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4 font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-[#D4C5B9]" />
        <p className="text-sm text-gray-500 font-light">Loading package details...</p>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center max-w-md mx-auto space-y-4 font-sans">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 text-lg">
          ⚠️
        </div>
        <h4 className="text-sm font-semibold text-[#1A1A1A]">Package Not Found</h4>
        <p className="text-xs text-gray-400 leading-relaxed">{error || 'The package does not exist.'}</p>
        <button 
          onClick={() => router.push('/packages')}
          className="border border-gray-300 hover:border-[#1A1A1A] hover:bg-gray-50 text-[#1A1A1A] font-semibold text-xs tracking-wider uppercase px-6 py-2.5 rounded-sm transition-colors duration-300"
        >
          Back to Packages
        </button>
      </div>
    );
  }

  return (
    <div className="py-8 font-sans max-w-7xl mx-auto px-4 md:px-8 space-y-8">
      {/* Back Header */}
      <button 
        onClick={() => router.push('/packages')}
        className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-[#1A1A1A] transition-colors group"
      >
        <ArrowLeft size={14} className="transform group-hover:-translate-x-0.5 transition-transform" />
        <span className="uppercase font-bold tracking-wider">Back to Packages</span>
      </button>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Details & Products (1/3 width) */}
        <div className="lg:col-span-1 space-y-8">
          <PackageDetails pkg={pkg} />
          <PackageProductList pkg={pkg} />
        </div>

        {/* Right Side: Immersive 3D Visualizer (2/3 width) */}
        <div className="lg:col-span-2 space-y-4 lg:sticky lg:top-8">
          <div className="flex justify-between items-center bg-white border border-gray-200 px-6 py-4 rounded-xl shadow-sm">
            <div>
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Immersive 3D Room Viewer</h3>
              <p className="text-[10px] text-gray-400 font-light mt-0.5">Explore this curated layout and customize it directly.</p>
            </div>
          </div>
          <div className="w-full h-[600px] rounded-xl overflow-hidden">
            <Package3DViewer pkg={pkg} readOnly={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
