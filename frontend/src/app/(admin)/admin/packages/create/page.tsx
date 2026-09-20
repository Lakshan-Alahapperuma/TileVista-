'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save, Sparkles, Layers, Tag, Layers3, Upload, Image as ImageIcon, Camera } from 'lucide-react';
import { packageService } from '../../../../../services/package.service';
import { useDesignerStore } from '../../../../../store/designer.store';
import AdminPackage3DPreview from '../../../../../components/package-visualizer/AdminPackage3DPreview';
import CustomAlertModal from '../../../../../components/ui/CustomAlertModal';

interface UnifiedItem {
  itemId: string;
  productId?: string | null;
  name: string;
  category: string;
  price: number;
  sku: string;
  imageUrl?: string;
  glbUrl?: string;
}

export default function AdminCreatePackagePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Package metadata fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [coverImage, setCoverImage] = useState('/images/packages/essential-comfort-package.jpeg');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [capturingSnapshot, setCapturingSnapshot] = useState(false);

  const showAlert = useDesignerStore(s => s.showAlert);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const uploadedUrl = await packageService.uploadCoverImage(file);
      setCoverImage(uploadedUrl);
    } catch (err: any) {
      showAlert(`Failed to upload cover image: ${err.message}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCaptureSnapshot = async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      showAlert('Could not find 3D room canvas element. Please wait for the 3D room to finish loading.');
      return;
    }

    setCapturingSnapshot(true);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const filename = `package-3d-cover-${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });

      const uploadedUrl = await packageService.uploadCoverImage(file);
      setCoverImage(uploadedUrl);
    } catch (err: any) {
      showAlert(`Failed to capture 3D room snapshot: ${err.message}`);
    } finally {
      setCapturingSnapshot(false);
    }
  };
  
  // Catalog & Status
  const [catalogItems, setCatalogItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read 3D canvas store state reactively
  const placedItems = useDesignerStore(s => s.placedItems);
  const floorTextureUrl = useDesignerStore(s => s.state?.floorTextureUrl);
  const wallTextureUrl = useDesignerStore(s => s.state?.wallTextureUrl);
  const activeCategory = useDesignerStore(s => s.activeCategory);

  // Fetch full OSPOS catalog items & initialize 3D workspace directly
  useEffect(() => {
    const store = useDesignerStore.getState();
    store.setWizardStep(5);
    store.setSelectedShape('rectangular');

    const fetchCatalog = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const res = await fetch(`${apiUrl}/items?includeHidden=true`);
        if (!res.ok) throw new Error('Failed to fetch items catalog');
        const data = await res.json();
        setCatalogItems(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load catalog products');
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  // Compute live financials from 3D room contents
  const placedItemsTotal = (placedItems || []).reduce((sum, item) => sum + (item.cost || (item as any).price || 150), 0);
  
  // Find tile item costs from catalog matching active floor/wall texture URLs
  const floorTileItem = catalogItems.find(i => i.imageUrl && floorTextureUrl && floorTextureUrl.includes(i.imageUrl));
  const wallTileItem = catalogItems.find(i => i.imageUrl && wallTextureUrl && wallTextureUrl.includes(i.imageUrl));
  
  const rawTotal = placedItemsTotal;
  const activeDiscount = Math.min(100, Math.max(0, discountPercent || 0));
  const discountSavings = rawTotal * (activeDiscount / 100);
  const finalBundlePrice = Math.max(0, rawTotal - discountSavings);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return showAlert('Please enter a package name');
    
    // Map placed items & tiles into package items list
    const itemQuantityMap: Record<string, number> = {};

    // Helper to register item by OSPOS ID
    const addQuantity = (key?: string | number | null) => {
      if (!key) return;
      const strKey = String(key);
      itemQuantityMap[strKey] = (itemQuantityMap[strKey] || 0) + 1;
    };

    // Add 3D placed items
    (placedItems || []).forEach(placedItem => {
      const matched = catalogItems.find(i => i.name.toLowerCase() === placedItem.name?.toLowerCase());
      if (matched) {
        addQuantity(matched.itemId || (matched as any).osposItemId || matched.productId);
      } else {
        const fallbackId = placedItem.id ? placedItem.id.replace('admin_preview_', '') : null;
        if (fallbackId && !isNaN(Number(fallbackId))) {
          addQuantity(Number(fallbackId));
        }
      }
    });

    const itemsArray = Object.entries(itemQuantityMap).map(([key, quantity]) => ({
      osposItemId: !isNaN(Number(key)) ? Number(key) : undefined,
      productId: isNaN(Number(key)) ? key : undefined,
      quantity,
    }));

    if (itemsArray.length === 0) {
      return showAlert('Please add at least one product or tile to the 3D room workspace before saving.');
    }

    const designerState = useDesignerStore.getState();
    const designDataPayload = {
      wallDesigns: designerState.state?.wallDesigns || [],
      wallTextureUrl: designerState.state?.wallTextureUrl || '',
      floorTextureUrl: designerState.state?.floorTextureUrl || '',
      floorColor: designerState.state?.floorColor || '#34383C',
      widthFt: designerState.state?.widthFt || 12,
      depthFt: designerState.state?.depthFt || 9,
      heightFt: designerState.state?.heightFt || 8.5,
      placedItems: designerState.placedItems || [],
      wallOpenings: designerState.state?.wallOpenings || [],
    };

    setSaving(true);
    try {
      await packageService.createPackage({
        name,
        description,
        discountPercent: activeDiscount,
        coverImage,
        designData: designDataPayload,
        packageItems: itemsArray as any,
      });
      showAlert('Package suite created successfully!');
    } catch (err: any) {
      showAlert(`Failed to save package: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Group placed 3D items by product name with live quantities & total costs
  const groupedActiveItems = React.useMemo(() => {
    const map = new Map<string, { name: string; type: string; count: number; totalCost: number }>();
    (placedItems || []).forEach(item => {
      const nameKey = (item.name || item.type || 'Item').trim();
      const cost = item.cost || (item as any).price || 150;
      const existing = map.get(nameKey);
      if (existing) {
        existing.count += 1;
        existing.totalCost += cost;
      } else {
        map.set(nameKey, {
          name: nameKey,
          type: item.type,
          count: 1,
          totalCost: cost
        });
      }
    });
    return Array.from(map.values());
  }, [placedItems]);

  const totalUniqueItemsCount = groupedActiveItems.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4C5B9]" />
        <p className="text-sm text-gray-500 font-light">Loading 3D Suite Builder...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans max-w-[1700px] mx-auto pb-10">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-gray-150 pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/admin/packages')}
            className="p-2 border border-gray-250 hover:bg-gray-50 rounded transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <span className="text-[9px] font-bold tracking-[0.25em] text-[#D4C5B9] uppercase block mb-0.5">
              PACKAGE SUITE BUILDER
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-[#1A1A1A]">
              Create Pre-Designed Suite
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-[#1A1A1A] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-[#D4C5B9] animate-pulse" />
          <span>Interactive 3D Room Configurator</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded text-xs">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Metadata & Real-time Financial Calculator (4 / 12 Width, auto-hides when item panel is open) */}
        {!activeCategory && (
          <div className="lg:col-span-4 space-y-5 transition-all duration-300">
            {/* Metadata Card */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-4 font-sans">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-3">
                Suite Metadata
              </h3>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Package Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white text-gray-900 border border-gray-300 focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] outline-none text-xs p-2.5 rounded-md transition-colors font-sans shadow-sm"
                  placeholder="e.g. Elegant Living Suite"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Description</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-white text-gray-900 border border-gray-300 focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] outline-none text-xs p-2.5 rounded-md transition-colors resize-none font-sans shadow-sm"
                  placeholder="Provide a detailed description of this package layout..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Discount Percentage (%)</label>
                <input 
                  type="number" 
                  value={discountPercent}
                  onChange={e => setDiscountPercent(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-white text-gray-900 border border-gray-300 focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] outline-none text-xs p-2.5 rounded-md transition-colors font-mono font-semibold shadow-sm"
                  min="0"
                  max="100"
                  required
                />
              </div>

              {/* Cover Image Upload & Live Preview */}
              <div className="space-y-2 pt-1 border-t border-gray-100">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Suite Cover Image</label>
                
                {/* Preview Box */}
                <div className="relative w-full h-36 bg-gray-50 border border-gray-300 rounded-lg overflow-hidden flex flex-col items-center justify-center group shadow-inner">
                  {coverImage ? (
                    <>
                      <img 
                        src={
                          coverImage.startsWith('/uploads') 
                            ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000'}${coverImage}`
                            : coverImage
                        } 
                        alt="Cover Preview" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="bg-white text-gray-900 text-[10px] font-bold px-3 py-1.5 rounded shadow hover:bg-gray-100 flex items-center gap-1 transition-transform active:scale-95 uppercase tracking-wider"
                        >
                          <Upload size={12} /> Change Image
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center space-y-1.5 text-gray-400 p-4 text-center">
                      <ImageIcon size={24} className="text-gray-300" />
                      <span className="text-[11px] font-medium text-gray-500">No cover image uploaded</span>
                    </div>
                  )}

                  {uploadingImage && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center gap-2 text-xs font-semibold text-gray-700">
                      <Loader2 className="w-4 h-4 animate-spin text-[#D4C5B9]" />
                      <span>Uploading Image...</span>
                    </div>
                  )}
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureSnapshot}
                    disabled={capturingSnapshot || uploadingImage}
                    className="w-full bg-[#1A1A1A] hover:bg-[#333] text-white font-bold text-[10px] uppercase tracking-wider py-2 px-2.5 rounded flex items-center justify-center gap-1.5 transition-all shadow active:scale-95 disabled:opacity-50"
                  >
                    {capturingSnapshot ? <Loader2 className="w-3 h-3 animate-spin text-[#D4C5B9]" /> : <Camera size={12} className="text-[#D4C5B9]" />}
                    <span>{capturingSnapshot ? 'Capturing...' : 'Capture 3D View'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage || capturingSnapshot}
                    className="w-full bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-300 font-bold text-[10px] uppercase tracking-wider py-2 px-2.5 rounded flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Upload size={12} />
                    <span>{coverImage ? 'Upload Image' : 'Choose File'}</span>
                  </button>
                </div>

                <div className="space-y-1 pt-1">
                  <span className="text-[9px] font-semibold text-gray-400 block uppercase">Or Image Route URL</span>
                  <input 
                    type="text" 
                    value={coverImage}
                    onChange={e => setCoverImage(e.target.value)}
                    className="w-full bg-white text-gray-900 border border-gray-300 focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] outline-none text-xs p-2 rounded-md transition-colors font-mono shadow-sm"
                    placeholder="/images/packages/essential-comfort-package.jpeg"
                  />
                </div>
              </div>
            </div>

            {/* Real-Time Financial Price Summary Card */}
            <div className="bg-[#1A1A1A] text-white border border-gray-800 shadow-md rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <span className="text-[10px] font-bold tracking-widest text-[#D4C5B9] uppercase">Price Summary</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                  {activeDiscount}% Discount
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {groupedActiveItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-gray-400">
                    <span>{item.name}{item.count > 1 ? ` (x${item.count})` : ''}:</span>
                    <span className="font-mono">LKR {Math.round(item.totalCost).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-emerald-400">
                  <span>Bundle Discount Savings:</span>
                  <span className="font-mono">- LKR {Math.round(discountSavings).toLocaleString()}</span>
                </div>
                <div className="border-t border-gray-800 pt-2.5 flex justify-between items-baseline">
                  <span className="font-bold uppercase tracking-wider text-gray-200 text-xs">Final Suite Price:</span>
                  <span className="font-mono font-bold text-xl text-white">LKR {Math.round(finalBundlePrice).toLocaleString()}</span>
                </div>
              </div>
              {/* Active Items Badge List */}
              <div className="pt-2 border-t border-gray-800">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">
                  Active 3D Room Items ({totalUniqueItemsCount})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {groupedActiveItems.map((group, idx) => (
                    <span key={idx} className="bg-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded flex items-center gap-1 border border-gray-700">
                      <Tag size={10} className="text-[#D4C5B9]" /> {group.name} {group.count > 1 ? `(x${group.count})` : ''}
                    </span>
                  ))}
                </div>
              </div>

              <button 
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="w-full bg-[#D4C5B9] hover:bg-white text-[#1A1A1A] disabled:opacity-50 font-bold text-xs tracking-widest uppercase py-3.5 transition-all duration-300 flex items-center justify-center gap-2 rounded-md shadow mt-3"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={14} />}
                <span>Save Suite Package</span>
              </button>
            </div>

          </div>
        )}

        {/* RIGHT COLUMN: Full Interactive 3D Room Suite Designer Canvas & Side Menu */}
        <div className={`${activeCategory ? 'lg:col-span-12' : 'lg:col-span-8'} bg-white border border-gray-200 shadow-sm rounded-xl p-4 space-y-3 sticky top-4 transition-all duration-300`}>
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                3D Room Suite Customizer Canvas
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCaptureSnapshot}
                disabled={capturingSnapshot || uploadingImage}
                className="bg-[#1A1A1A] hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded-md flex items-center gap-1.5 shadow-sm transition-all active:scale-95 uppercase tracking-wider disabled:opacity-50"
                title="Capture current 3D room design as suite cover image"
              >
                {capturingSnapshot ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4C5B9]" /> : <Camera size={13} className="text-[#D4C5B9]" />}
                <span>{capturingSnapshot ? 'Capturing...' : 'Capture 3D Snapshot'}</span>
              </button>
              <p className="text-[10px] text-gray-400 italic hidden sm:block">
                Click <span className="font-semibold text-gray-700">≡</span> inside canvas to customize.
              </p>
            </div>
          </div>

          <div className="w-full h-[660px]">
            <AdminPackage3DPreview />
          </div>
        </div>

      </div>
      <CustomAlertModal />
    </div>
  );
}
