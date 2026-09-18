'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Info, AlertTriangle, Loader2, Search } from 'lucide-react';
import { formatCurrency } from '../../utils';

interface InventoryItem {
  osposItemId: number;
  sku: string;
  name: string;
  quantity: number;
  category: string;
  categoryId: number | null;
  subcategoryId: number | null;
  price: number;
}

export const InventoryTable: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  
  const [search, setSearch] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'ALL'>('ALL');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | 'ALL'>('ALL');

  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [appliedCategoryId, setAppliedCategoryId] = useState<number | 'ALL'>('ALL');
  const [appliedSubcategoryId, setAppliedSubcategoryId] = useState<number | 'ALL'>('ALL');

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const fetchInventory = async (isSync = false) => {
    if (isSync) {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const token = localStorage.getItem('tilevista_admin_token');
      const response = await fetch(`${API_BASE}/inventory`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load inventory (${response.status})`);
      }

      const data = await response.json();
      setInventory(data);
      if (isSync) {
        alert('Inventory successfully synchronized with showroom OSPOS center!');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading inventory levels.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleSync = () => {
    fetchInventory(true);
  };

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch = 
      item.name.toLowerCase().includes(appliedSearch.toLowerCase()) ||
      item.sku.toLowerCase().includes(appliedSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(appliedSearch.toLowerCase());
      
    const matchesCategory = appliedCategoryId === 'ALL' ? true : item.categoryId === appliedCategoryId;
    const matchesSubcategory = appliedSubcategoryId === 'ALL' ? true : item.subcategoryId === appliedSubcategoryId;
      
    return matchesSearch && matchesCategory && matchesSubcategory;
  });

  const activeCategory = categories.find(c => c.id === selectedCategoryId);

  return (
    <div className="bg-white border border-gray-200 p-8 shadow-sm">
      
      {/* Table Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
        <div>
          <h3 className="text-base font-semibold text-[#1A1A1A] tracking-wider uppercase">Stock Catalogue Levels</h3>
          <p className="text-[10px] text-gray-400 font-light mt-0.5">Live showroom items and real-time physical store quantities.</p>
        </div>
        
        <button 
          onClick={handleSync}
          disabled={syncing || loading}
          className="border border-gray-300 hover:border-[#1A1A1A] text-[#1A1A1A] font-semibold text-[10px] tracking-wider uppercase px-4 py-2.5 transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> 
          <span>{syncing ? 'Synchronizing...' : 'Synchronize POS'}</span>
        </button>
      </div>

      {/* Info notice about stock updates */}
      <div className="mb-6 p-4 bg-[#F9F9F7] border border-gray-200 flex items-start gap-3">
        <Info size={16} className="text-[#D4C5B9] shrink-0 mt-0.5" />
        <div className="text-[11px] text-gray-500 font-light leading-relaxed">
          <span className="font-bold text-[#1A1A1A]">Inventory Source of Truth:</span> Stock counts, unit prices, names, and SKU identifiers are fetched dynamically from the legacy OSPOS register system. All stock deductions, additions, and edits must be performed directly within OSPOS.
        </div>
      </div>

      {/* Search Input and Filter Row */}
      <div className="flex flex-col mb-6 bg-[#F9F9F7] border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search inventory by name, SKU code..."
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

      {/* Main Table Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
          <Loader2 className="animate-spin text-[#D4C5B9]" size={28} />
          <span className="text-xs font-light tracking-wider uppercase font-mono">Querying OSPOS database...</span>
        </div>
      ) : error ? (
        <div className="py-12 border border-dashed border-red-200 bg-red-50/20 text-center text-red-650 px-6 rounded-sm">
          <p className="text-sm font-semibold">{error}</p>
          <button 
            onClick={() => fetchInventory()}
            className="mt-4 px-4 py-2 text-[10px] bg-red-600 hover:bg-red-700 text-white uppercase font-bold tracking-widest"
          >
            Retry Sync
          </button>
        </div>
      ) : filteredInventory.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-gray-200 bg-[#F9F9F7]">
          <p className="text-gray-400 font-light text-xs uppercase tracking-wider">No matching stock items</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-4 px-2">ID</th>
                <th className="py-4 px-2">SKU Code</th>
                <th className="py-4 px-2">Name</th>
                <th className="py-4 px-2">Category</th>
                <th className="py-4 px-2">Unit Price</th>
                <th className="py-4 px-2 text-right">Available Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInventory.map((item) => {
                const isLowStock = item.quantity <= 20;
                return (
                  <tr key={item.osposItemId} className="hover:bg-[#F9F9F7]/80 transition-colors">
                    <td className="py-4 px-2 font-mono text-gray-400">{item.osposItemId}</td>
                    <td className="py-4 px-2 font-mono text-red-600 font-medium">{item.sku}</td>
                    <td className="py-4 px-2 font-bold text-[#1A1A1A]">{item.name}</td>
                    <td className="py-4 px-2">
                      <span className="px-2 py-0.5 text-[8.5px] font-bold tracking-wider uppercase bg-gray-50 border border-gray-200 text-gray-500">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-4 px-2 font-mono font-medium text-gray-500">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="py-4 px-2 text-right font-bold font-mono">
                      {isLowStock ? (
                        <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                          <AlertTriangle size={11} className="fill-red-50" />
                          <span>{item.quantity} units</span>
                        </span>
                      ) : (
                        <span className="text-gray-700">
                          {item.quantity} units
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
export default InventoryTable;
