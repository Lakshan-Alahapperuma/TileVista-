'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

// Import landing sections (relative paths adjusted for (public) route group)
import { Hero } from '../../components/landing/Hero';
import { About } from '../../components/landing/About';
import { Categories } from '../../components/landing/Categories';
import { CuratedPackages } from '../../components/landing/CuratedPackages';
import { PlannerIntro } from '../../components/landing/PlannerIntro';
import { ExperienceCenter } from '../../components/landing/ExperienceCenter';

export default function Home() {
  const router = useRouter();

  const handleAddToCartPackage = (pkgId: string) => {
    alert(`Package additions will be enabled in the next sprint.`);
  };

  return (
    <main>
      {/* Hero Widescreen Banner */}
      <Hero 
        onLaunchDesigner={() => router.push('/designer')} 
        onExplorePackages={() => router.push('/packages')}
        onExploreTiles={() => router.push('/products/tiles')}
        onBrowseProducts={() => router.push('/products/tiles')}
      />

      {/* About Section */}
      <About />

      {/* Catalog Categories Grid */}
      <Categories onSelectCategory={(categoryId) => router.push(`/products/${categoryId}`)} />

      {/* Curated Suite Packages */}
      <CuratedPackages 
        onVisualizePackage={(pkgId) => router.push(`/designer?package=${pkgId}`)} 
        onAddToCart={handleAddToCartPackage} 
      />

      {/* 3D Blueprint CAD Workspace highlight */}
      <PlannerIntro onStartDesign={() => router.push('/designer')} />

      {/* Showroom Experience Center */}
      <ExperienceCenter />
    </main>
  );
}
