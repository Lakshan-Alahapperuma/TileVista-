'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Box,
  CheckCircle,
  XCircle,
  Save,
  Loader2,
  Edit2,
  Search,
  RefreshCw,
  X,
  FileImage,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { formatCurrency } from '../../utils';

interface UnifiedItem {
  itemId: number;
  name: string;
  category: string;
  categoryId: number | null;
  subcategoryId: number | null;
  sku: string;
  description: string | null;
  price: number;
  quantity: number;
  imageUrl: string | null;
  glbUrl: string | null;
  scale: { x: number; y: number; z: number };
  rotationY: number;
  tags: string[];
  material: string | null;
  finish: string | null;
  size?: string | null;
  dimensions?: { width: number; height: number; depth: number; unit: string } | null;
  isEnabled: boolean;
  notes: string | null;
  hasAssetEntry: boolean;
}

export const ItemAssetCatalogTable: React.FC = () => {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'ALL'>('ALL');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | 'ALL'>('ALL');

  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [appliedCategoryId, setAppliedCategoryId] = useState<number | 'ALL'>('ALL');
  const [appliedSubcategoryId, setAppliedSubcategoryId] = useState<number | 'ALL'>('ALL');
  const [categories, setCategories] = useState<any[]>([]);

  // Drawer Editing State
  const [editingItem, setEditingItem] = useState<UnifiedItem | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [imageUploading, setImageUploading] = useState<boolean>(false);
  const [glbUploading, setGlbUploading] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Form fields
  const [scaleX, setScaleX] = useState<number>(1);
  const [scaleY, setScaleY] = useState<number>(1);
  const [scaleZ, setScaleZ] = useState<number>(1);
  const [rotationY, setRotationY] = useState<number>(0);
  const [width, setWidth] = useState<number>(60);
  const [height, setHeight] = useState<number>(60);
  const [depth, setDepth] = useState<number>(1);
  const [unit, setUnit] = useState<'cm' | 'm'>('cm');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [material, setMaterial] = useState<string>('');
  const [finish, setFinish] = useState<string>('');
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const glbInputRef = useRef<HTMLInputElement>(null);

  const API_BASE = 'http://localhost:4000/api';
  const STATIC_BASE = 'http://localhost:4000';

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('tilevista_admin_token');
      const [itemsResponse, catsResponse] = await Promise.all([
        fetch(`${API_BASE}/admin/items`, { headers: { 'Authorization': `Bearer ${token || ''}` } }),
        fetch(`${API_BASE}/categories`)
      ]);

      if (!itemsResponse.ok) {
        throw new Error(`Failed to fetch items (${itemsResponse.status})`);
      }

      const data = await itemsResponse.json();
      setItems(data);

      if (catsResponse.ok) {
        const catData = await catsResponse.json();
        setCategories(catData);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openEditDrawer = (item: UnifiedItem) => {
    setEditingItem(item);
    setScaleX(item.scale?.x ?? 1);
    setScaleY(item.scale?.y ?? 1);
    setScaleZ(item.scale?.z ?? 1);
    setRotationY(item.rotationY ?? 0);

    // Auto-fill default size from item.dimensions, item.size string, or standard 60x60 cm default
    let defaultW = 60;
    let defaultH = 60;
    let defaultD = 1;
    let defaultUnit: 'cm' | 'm' = 'cm';

    if (item.dimensions?.width && item.dimensions?.height) {
      defaultW = item.dimensions.width;
      defaultH = item.dimensions.height;
      defaultD = item.dimensions.depth || 1;
      defaultUnit = (item.dimensions.unit as 'cm' | 'm') || 'cm';
    } else if (item.size) {
      const match = item.size.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/);
      if (match) {
        defaultW = parseFloat(match[1]);
        defaultH = parseFloat(match[2]);
        if (item.size.toLowerCase().includes('mm')) {
          defaultW /= 10;
          defaultH /= 10;
        }
      }
    }

    setWidth(defaultW);
    setHeight(defaultH);
    setDepth(defaultD);
    setUnit(defaultUnit);

    setTagsInput(item.tags?.join(', ') ?? '');
    setMaterial(item.material || (item.category.toLowerCase().includes('tile') ? 'Ceramic' : 'Porcelain'));
    setFinish(item.finish ?? '');
    setIsEnabled(item.isEnabled ?? true);
    setNotes(item.notes ?? '');
    setSaveSuccess(null);
  };

  const closeEditDrawer = () => {
    setEditingItem(null);
    setSaveSuccess(null);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSaving(true);
    setSaveSuccess(null);
    try {
      const token = localStorage.getItem('tilevista_admin_token');
      const response = await fetch(`${API_BASE}/admin/items/${editingItem.itemId}/asset`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          scaleX,
          scaleY,
          scaleZ,
          rotationY,
          width,
          height,
          depth,
          unit,
          tags: tagsInput,
          material: material || null,
          finish: finish || null,
          isEnabled,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save asset configuration');
      }

      const updatedItem = await response.json();
      setItems((prev) => prev.map((item) => item.itemId === updatedItem.itemId ? updatedItem : item));
      setEditingItem(updatedItem);
      setSaveSuccess('Asset settings saved successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Error saving assets');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingItem) return;

    setImageUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('tilevista_admin_token');
      const response = await fetch(`${API_BASE}/admin/items/${editingItem.itemId}/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to upload image');
      }

      const { imageUrl } = await response.json();
      const updatedItem = { ...editingItem, imageUrl };
      setEditingItem(updatedItem);
      setItems((prev) => prev.map((item) => item.itemId === updatedItem.itemId ? updatedItem : item));
      setSaveSuccess('Image uploaded successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Error uploading image');
    } finally {
      setImageUploading(false);
    }
  };

  const handleGlbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingItem) return;

    setGlbUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('tilevista_admin_token');
      const response = await fetch(`${API_BASE}/admin/items/${editingItem.itemId}/upload-glb`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to upload 3D model');
      }

      const { glbUrl } = await response.json();
      const updatedItem = { ...editingItem, glbUrl };
      setEditingItem(updatedItem);
      setItems((prev) => prev.map((item) => item.itemId === updatedItem.itemId ? updatedItem : item));
      setSaveSuccess('3D Model GLB uploaded successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Error uploading GLB file');
    } finally {
      setGlbUploading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategoryId === 'ALL' ? true : item.categoryId === selectedCategoryId;
    const matchesSubcategory = selectedSubcategoryId === 'ALL' ? true : item.subcategoryId === selectedSubcategoryId;

    return matchesSearch && matchesCategory && matchesSubcategory;
  });

  const activeCategory = categories.find(c => c.id === selectedCategoryId);

  return (
    <div className="relative flex flex-col lg:flex-row gap-6">

      {/* Left / Main Table Section */}
      <div className="flex-1 bg-white border border-gray-200 p-8 shadow-sm">

        {/* Header with Search and Category filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-[#1A1A1A] tracking-wider uppercase">Item Visual Assets</h3>
            <p className="text-[10px] text-gray-400 font-light mt-0.5">Enrich POS-synced showroom articles with image files and 3D GLB canvas elements.</p>
          </div>

          <button
            onClick={fetchItems}
            disabled={loading}
            className="border border-gray-300 hover:border-[#1A1A1A] text-[#1A1A1A] font-semibold text-[10px] tracking-wider uppercase px-4 py-2.5 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Reload Items</span>
          </button>
        </div>

        {/* Search Input and Filter Row */}
        <div className="flex flex-col mb-6 bg-[#F9F9F7] border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by name, SKU, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-gray-200 px-4 py-2.5 pl-9 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
              />
              <Search size={13} className="text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>

            <select
              value={selectedCategoryId}
              onChange={(e) => {
                const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setSelectedCategoryId(val);
                setSelectedSubcategoryId('ALL');
              }}
              className="bg-white border border-gray-200 px-4 py-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] min-w-[160px]"
            >
              <option value="ALL">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={selectedSubcategoryId}
              onChange={(e) => {
                const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setSelectedSubcategoryId(val);
              }}
              disabled={selectedCategoryId === 'ALL' || !activeCategory?.subcategories?.length}
              className="bg-white border border-gray-200 px-4 py-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] min-w-[160px] disabled:opacity-50"
            >
              <option value="ALL">All Subcategories</option>
              {activeCategory?.subcategories?.map((sub: any) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>

            <button
              onClick={() => {
                setAppliedSearch(search);
                setAppliedCategoryId(selectedCategoryId);
                setAppliedSubcategoryId(selectedSubcategoryId);
              }}
              className="px-6 py-2.5 text-[10px] bg-[#1A1A1A] hover:bg-black text-white font-bold tracking-widest uppercase transition-colors whitespace-nowrap"
            >
              Apply Filter
            </button>

            <button
              onClick={() => {
                setSearch('');
                setSelectedCategoryId('ALL');
                setSelectedSubcategoryId('ALL');
                setAppliedSearch('');
                setAppliedCategoryId('ALL');
                setAppliedSubcategoryId('ALL');
              }}
              className="px-6 py-2.5 text-[10px] bg-white border border-gray-200 text-gray-500 hover:text-[#1A1A1A] hover:bg-gray-50 font-bold tracking-widest uppercase transition-colors whitespace-nowrap"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Items Listing Table */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 className="animate-spin text-[#D4C5B9]" size={28} />
            <span className="text-xs font-light tracking-wider uppercase">Loading asset matrix...</span>
          </div>
        ) : error ? (
          <div className="py-12 border border-dashed border-red-200 bg-red-50/20 text-center text-red-600 px-6 rounded-sm">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={fetchItems}
              className="mt-4 px-4 py-2 text-[10px] bg-red-600 hover:bg-red-700 text-white uppercase font-bold tracking-widest"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-gray-200 bg-[#F9F9F7]">
            <p className="text-gray-400 font-light text-xs uppercase tracking-wider">No showroom items located</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600 border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-2">ID</th>
                  <th className="py-4 px-2">SKU Code</th>
                  <th className="py-4 px-2">Item Name</th>
                  <th className="py-4 px-2">Category</th>
                  <th className="py-4 px-2 text-center">Image status</th>
                  <th className="py-4 px-2 text-center">GLB status</th>
                  <th className="py-4 px-2 text-center">Status</th>
                  <th className="py-4 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((item) => (
                  <tr key={item.itemId} className="hover:bg-[#F9F9F7]/85 transition-colors">
                    <td className="py-4 px-2 font-mono text-gray-400">{item.itemId}</td>
                    <td className="py-4 px-2 font-mono font-medium text-red-600">{item.sku}</td>
                    <td className="py-4 px-2 font-semibold text-[#1A1A1A] max-w-xs truncate">{item.name}</td>
                    <td className="py-4 px-2">
                      <span className="px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase bg-gray-50 border border-gray-150 text-gray-500">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-4 px-2 text-center">
                      {item.imageUrl ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 uppercase tracking-widest">
                          <CheckCircle size={10} className="fill-emerald-100" />
                          <span>Ready</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          <XCircle size={10} className="fill-gray-100" />
                          <span>Missing</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-2 text-center">
                      {item.glbUrl ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 uppercase tracking-widest">
                          <Box size={11} className="text-emerald-600" />
                          <span>3D Model</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          <XCircle size={10} />
                          <span>No GLB</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-2 text-center">
                      {!item.hasAssetEntry ? (
                        <span className="px-2 py-0.5 text-[8.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full uppercase tracking-wider">
                          Pending
                        </span>
                      ) : item.isEnabled ? (
                        <span className="px-2 py-0.5 text-[8.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full uppercase tracking-wider">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[8.5px] font-bold bg-gray-100 text-gray-400 border border-gray-200 rounded-full uppercase tracking-wider">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-2 text-right">
                      <button
                        onClick={() => openEditDrawer(item)}
                        className={`text-[9px] font-bold tracking-widest uppercase px-3 py-1.5 transition-all flex items-center gap-1 ml-auto border ${editingItem?.itemId === item.itemId
                            ? 'bg-[#D4C5B9] text-[#1A1A1A] border-[#D4C5B9]'
                            : 'bg-[#1A1A1A] hover:bg-[#D4C5B9] text-white border-[#1A1A1A] hover:border-[#D4C5B9]'
                          }`}
                      >
                        <Edit2 size={10} />
                        <span>Manage</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Centered Modal Overlay (instead of split screen) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 w-full max-w-2xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">

            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
              <div>
                <span className="text-[9px] font-bold tracking-widest text-[#D4C5B9] uppercase font-mono">Enrichment Hub / ID {editingItem.itemId}</span>
                <h3 className="text-xl font-semibold text-[#1A1A1A] tracking-tight mt-0.5">{editingItem.name}</h3>
                <p className="text-xs text-gray-400 font-light mt-0.5">{editingItem.sku} • {formatCurrency(editingItem.price)}</p>
              </div>
              <button
                onClick={closeEditDrawer}
                className="p-1.5 hover:bg-gray-50 border border-transparent hover:border-gray-200 text-gray-400 hover:text-black transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Notification Bar */}
            {saveSuccess && (
              <div className="mb-6 p-3 bg-emerald-50 border border-emerald-150 text-emerald-800 text-[11px] font-medium flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            {/* Asset Upload Segment */}
            <div className="space-y-6 mb-8 border-b border-gray-100 pb-6">

              {/* Media Asset Preview Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Image upload preview */}
                <div className="border border-gray-200 p-3 flex flex-col items-center justify-center text-center bg-[#F9F9F7] relative h-36">
                  {editingItem.imageUrl ? (
                    <>
                      <img
                        src={`${STATIC_BASE}${editingItem.imageUrl}`}
                        alt="Product preview"
                        className="w-full h-full object-contain absolute inset-0 p-2"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-2">
                        <button
                          onClick={() => imageInputRef.current?.click()}
                          className="px-2 py-1.5 bg-white text-[9.5px] font-bold text-black uppercase tracking-wider"
                        >
                          Replace Image
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-1.5">
                      <FileImage size={24} className="text-gray-400 mx-auto" />
                      <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase block">No Image Asset</span>
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="text-[9px] text-[#D4C5B9] font-bold uppercase underline hover:text-[#1A1A1A] block mx-auto"
                      >
                        Upload Image
                      </button>
                    </div>
                  )}
                  {imageUploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <Loader2 className="animate-spin text-[#1A1A1A]" size={20} />
                    </div>
                  )}
                  <input
                    type="file"
                    ref={imageInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {/* GLB model preview status */}
                <div className="border border-gray-200 p-3 flex flex-col items-center justify-center text-center bg-[#F9F9F7] relative h-36">
                  {editingItem.glbUrl ? (
                    <div className="space-y-2">
                      <Box size={28} className="text-emerald-600 mx-auto animate-pulse" />
                      <span className="text-[9px] font-bold text-emerald-800 tracking-widest uppercase block">3D GLB Model Ready</span>
                      <span className="text-[7.5px] font-mono text-gray-400 truncate max-w-[140px] block">{editingItem.glbUrl.split('/').pop()}</span>
                      <button
                        onClick={() => glbInputRef.current?.click()}
                        className="text-[9px] text-gray-500 font-bold uppercase underline hover:text-black block mx-auto"
                      >
                        Replace GLB
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Layers size={24} className="text-gray-400 mx-auto" />
                      <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase block">No 3D Model</span>
                      <button
                        onClick={() => glbInputRef.current?.click()}
                        className="text-[9px] text-[#D4C5B9] font-bold uppercase underline hover:text-[#1A1A1A] block mx-auto"
                      >
                        Upload Model
                      </button>
                    </div>
                  )}
                  {glbUploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <Loader2 className="animate-spin text-[#1A1A1A]" size={20} />
                    </div>
                  )}
                  <input
                    type="file"
                    ref={glbInputRef}
                    onChange={handleGlbUpload}
                    accept=".glb"
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Asset Metadata Configuration Form */}
            <form onSubmit={handleSaveAsset} className="space-y-5">

              {/* Scale configuration */}
              <div>
                <label className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block mb-2">3D Scale Multipliers (X, Y, Z)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase font-mono block mb-1">X Width</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-[#F9F9F7] border border-gray-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-mono"
                      value={scaleX}
                      onChange={(e) => setScaleX(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase font-mono block mb-1">Y Height</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-[#F9F9F7] border border-gray-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-mono"
                      value={scaleY}
                      onChange={(e) => setScaleY(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase font-mono block mb-1">Z Depth</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-[#F9F9F7] border border-gray-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-mono"
                      value={scaleZ}
                      onChange={(e) => setScaleZ(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Physical 3D Bounding Dimensions */}
              <div className="bg-[#F9F9F7] p-3 border border-gray-200/80 rounded-sm">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block">Physical Room Dimensions (Virtual Designer)</label>
                  <select
                    className="bg-white border border-gray-200 px-2 py-0.5 text-[10px] text-[#1A1A1A] font-bold uppercase"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as 'cm' | 'm')}
                  >
                    <option value="cm">cm (centimeters)</option>
                    <option value="m">m (meters)</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Width ({unit})</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full bg-white border border-gray-200 px-2.5 py-1.5 text-xs text-[#1A1A1A] font-mono"
                      value={width}
                      onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Height ({unit})</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full bg-white border border-gray-200 px-2.5 py-1.5 text-xs text-[#1A1A1A] font-mono"
                      value={height}
                      onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Thickness ({unit})</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full bg-white border border-gray-200 px-2.5 py-1.5 text-xs text-[#1A1A1A] font-mono"
                      value={depth}
                      onChange={(e) => setDepth(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Rotation Y and Material / Finish dropdowns */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block mb-1.5">Rotation (Y-Axis °)</label>
                  <input
                    type="number"
                    className="w-full bg-[#F9F9F7] border border-gray-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-mono"
                    value={rotationY}
                    onChange={(e) => setRotationY(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block mb-1.5">Finish Type</label>
                  <select
                    className="w-full bg-[#F9F9F7] border border-gray-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9]"
                    value={finish}
                    onChange={(e) => setFinish(e.target.value)}
                  >
                    <option value="">(None)</option>
                    <option value="GLOSSY">Glossy Polished</option>
                    <option value="MATTE">Matte Silk</option>
                    <option value="SATIN">Satin Velvet</option>
                    <option value="ROUGH">Rough Anti-Slip</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block mb-1.5">Material Composition</label>
                  <input
                    type="text"
                    placeholder="e.g. Ceramic, Brass"
                    className="w-full bg-[#F9F9F7] border border-gray-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9]"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block mb-1.5">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. wall, black, premium"
                    className="w-full bg-[#F9F9F7] border border-gray-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9]"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </div>
              </div>

              {/* Status toggles & Notes */}
              <div className="flex items-center justify-between border-y border-gray-100 py-3 my-2">
                <div>
                  <span className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block">Enable Catalog Sync</span>
                  <span className="text-[8.5px] text-gray-400">Whether this item shows in the consumer portal.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEnabled(!isEnabled)}
                  className="text-gray-600 focus:outline-none transition-colors"
                >
                  {isEnabled ? (
                    <ToggleRight size={32} className="text-[#1A1A1A]" />
                  ) : (
                    <ToggleLeft size={32} className="text-gray-300" />
                  )}
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-widest text-[#1A1A1A] uppercase block mb-1.5">Showroom Staff Notes</label>
                <textarea
                  rows={2}
                  placeholder="Internal notes regarding scale references or supplier specifics..."
                  className="w-full bg-[#F9F9F7] border border-gray-200 px-3 py-2 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={closeEditDrawer}
                  className="flex-1 border border-gray-300 text-gray-500 hover:border-[#1A1A1A] hover:text-[#1A1A1A] font-semibold text-xs tracking-wider uppercase py-3 transition-colors text-center"
                >
                  Close Panel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-semibold text-xs tracking-wider uppercase py-3 transition-all duration-300 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={13} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={13} />
                      <span>Save Asset</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

        </div>
      )}

    </div>
  );
};
export default ItemAssetCatalogTable;
