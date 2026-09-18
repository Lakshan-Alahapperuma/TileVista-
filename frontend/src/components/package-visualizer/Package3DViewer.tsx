'use client';

import React, { Suspense } from 'react';
import BathroomPlanner from '../designer/BathroomPlanner';
import { Loader2 } from 'lucide-react';

import { Package } from '../../types/package';
import { useDesignerStore } from '../../store/designer.store';

interface Package3DViewerProps {
  readOnly?: boolean;
  pkg?: Package | null;
}

export const Package3DViewer: React.FC<Package3DViewerProps> = ({ readOnly = false, pkg }) => {
  React.useEffect(() => {
    if (!pkg) return;

    const STATIC_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace('/api', '');

    const formatUrl = (url?: string | null) => {
      if (!url) return undefined;
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      return `${STATIC_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    if (pkg.designData) {
      const dd = pkg.designData;
      const store = useDesignerStore.getState();
      store.setWizardStep(5);
      store.setState({
        widthFt: dd.widthFt || 12.0,
        depthFt: dd.depthFt || 9.0,
        heightFt: dd.heightFt || 8.5,
        shape: 'rectangular',
        unit: 'cm',
        floorColor: dd.floorColor || '#ffffff',
        floorTextureUrl: formatUrl(dd.floorTextureUrl) || undefined,
        wallTextureUrl: formatUrl(dd.wallTextureUrl) || undefined,
        wallDesigns: (dd.wallDesigns || []).map((wd: any) => ({
          ...wd,
          textureUrl: formatUrl(wd.textureUrl) || undefined,
        })),
        wallOpenings: dd.wallOpenings || [],
        designType: 'bathroom',
      });
      if (dd.placedItems && dd.placedItems.length > 0) {
        store.setPlacedItems(
          dd.placedItems.map((item: any) => ({
            ...item,
            model: formatUrl(item.model) || null,
            image: formatUrl(item.image) || null,
          }))
        );
      }
      return;
    }

    // Fallback loading for legacy packages without stored designData
    let floorTexUrl: string | undefined = undefined;
    let wallTexUrl: string | undefined = undefined;

    const mappedItems: any[] = [];
    let sinkCount = 0;
    let toiletCount = 0;
    let bathCount = 0;
    let showerCount = 0;

    (pkg.items || []).forEach((pi: any) => {
      const category = (pi.category || '').toLowerCase();
      const name = (pi.name || '').toLowerCase();
      const isTile = category.includes('tile') || category.includes('mosaic') || name.includes('tile') || name.includes('mosaic');

      if (isTile) {
        const isFloor = [4, 6, 17, 18, 20].includes(pi.osposItemId) || name.includes('floor') || category.includes('floor');
        if (isFloor) {
          floorTexUrl = formatUrl(pi.imageUrl);
        } else {
          wallTexUrl = formatUrl(pi.imageUrl);
        }
      } else {
        let type = 'sink';
        let position: [number, number, number] = [0, 0, 0];
        let rotation = 0;
        let isWallMounted = false;

        if (category.includes('basin') || category.includes('sink') || name.includes('basin') || name.includes('sink') || name.includes('vanity')) {
          type = 'sink';
          position = [-0.6 + (sinkCount * 1.2), 0, -1.0];
          rotation = 0;
          sinkCount++;
        } else if (category.includes('closet') || category.includes('toilet') || category.includes('wc') || name.includes('closet') || name.includes('toilet') || name.includes('wc') || name.includes('commode')) {
          type = 'toilet';
          position = [-1.3, 0, -0.2 + (toiletCount * 0.8)];
          rotation = Math.PI / 2;
          toiletCount++;
        } else if (category.includes('bath') || name.includes('bath') || name.includes('tub')) {
          type = 'bathtub';
          position = [1.1, 0, 0.2 + (bathCount * 0.9)];
          rotation = -Math.PI / 2;
          bathCount++;
        } else if (category.includes('shower') || name.includes('shower')) {
          type = 'shower';
          position = [1.1, 0, -1.0 + (showerCount * 0.9)];
          rotation = -Math.PI / 2;
          showerCount++;
        } else if (category.includes('mirror') || name.includes('mirror') || category.includes('light')) {
          type = 'light';
          position = [0, 1.6, -1.3];
          rotation = 0;
          isWallMounted = true;
        } else {
          type = 'plant';
          position = [-1.3, 0, 0.8];
          rotation = 0;
        }

        mappedItems.push({
          id: 'pkg_viewer_item_' + (pi.osposItemId || pi.productId),
          type,
          name: pi.name,
          model: formatUrl(pi.glbUrl) || null,
          cost: pi.price || 150.00,
          position,
          rotation,
          isWallMounted,
        });
      }
    });

    const mappedWallDesigns = Array(8).fill(null).map(() => ({
      splitMode: 'full' as const,
      tileColorBottom: '#ffffff',
      tileColorTop: '#ffffff',
      tileColorCenter: '#ffffff',
      tileColorSides: '#ffffff',
      textureUrl: wallTexUrl || undefined,
    }));

    const store = useDesignerStore.getState();
    store.setWizardStep(5);
    store.setState({
      widthFt: 12.0,
      depthFt: 9.0,
      heightFt: 8.5,
      shape: 'rectangular',
      unit: 'cm',
      floorColor: '#ffffff',
      floorTextureUrl: floorTexUrl || undefined,
      wallTextureUrl: wallTexUrl || undefined,
      wallDesigns: mappedWallDesigns,
      designType: 'bathroom',
    });
    store.setPlacedItems(mappedItems);
  }, [pkg]);

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
