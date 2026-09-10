'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, Loader2, Sparkles, Percent } from 'lucide-react';
import { Package } from '../../../../types/package';
import { packageService } from '../../../../services/package.service';

export default function AdminPackagesPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const data = await packageService.getPackages(true);
      setPackages(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the package "${name}"?`)) return;
    try {
      await packageService.deletePackage(id);
      setPackages(prev => prev.filter(pkg => pkg.id !== id));
      alert('Package deleted successfully.');
    } catch (err: any) {
      alert(`Error deleting package: ${err.message}`);
    }
  };

  const formatLKR = (num: number) => {
    return `LKR ${Math.round(num).toLocaleString('en-LK')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4C5B9]" />
        <p className="text-sm text-gray-500 font-light">Loading package database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-150 pb-5">
        <div>
          <span className="text-[9px] font-bold tracking-[0.25em] text-[#D4C5B9] uppercase block mb-1">
            SHOWROOM CONFIGURATOR
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">
            Package Management
          </h1>
          <p className="text-xs text-gray-400 font-light mt-0.5">
            Configure product bundles and discounts visible to showroom customers.
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/packages/create')}
          className="bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-bold text-xs tracking-wider uppercase py-3 px-5 transition-all duration-300 flex items-center gap-2 rounded-md shadow-sm"
        >
          <Plus size={14} />
          <span>Create Package</span>
        </button>
      </div>

      {error ? (
        <div className="p-8 text-center bg-red-50/50 border border-dashed border-red-200 rounded-xl text-red-500 text-xs">
          ⚠️ {error}
        </div>
      ) : packages.length === 0 ? (
        <div className="bg-gray-50/50 border border-dashed border-gray-250 rounded-2xl p-12 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4 text-gray-400">
            📦
          </div>
          <h4 className="text-sm font-semibold text-[#1A1A1A]">No packages found</h4>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
            Create your first pre-designed package bundle to display dynamic setups inside the 3D designer interface.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                  <th className="p-4">Package Details</th>
                  <th className="p-4">Items Count</th>
                  <th className="p-4">Discount</th>
                  <th className="p-4 text-right">Original Cost</th>
                  <th className="p-4 text-right">Bundle Cost</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-gray-600">
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {pkg.imageUrl ? (
                          <div 
                            className="w-12 h-12 bg-cover bg-center rounded border border-gray-150 shrink-0"
                            style={{ 
                              backgroundImage: `url('${
                                pkg.imageUrl.startsWith('/uploads')
                                  ? `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000'}${pkg.imageUrl}`
                                  : pkg.imageUrl
                              }')` 
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded border border-gray-250 bg-gray-50 flex items-center justify-center text-gray-400 font-bold shrink-0">
                            📦
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-gray-800 text-sm block">{pkg.name}</span>
                          <span className="text-[10px] text-gray-400 line-clamp-1 block mt-0.5">{pkg.description}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-semibold">
                      {(pkg.items || []).length} items
                    </td>
                    <td className="p-4">
                      <span className="bg-emerald-50 border border-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded text-[10px] inline-flex items-center gap-0.5">
                        <Percent size={10} />
                        {pkg.discountPercent}%
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono text-gray-400 line-through">
                      {formatLKR(pkg.originalPrice)}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-gray-800 text-sm">
                      {formatLKR(pkg.calculatedPrice)}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => router.push(`/admin/packages/${pkg.id}/edit`)}
                          className="p-2 border border-gray-250 hover:border-blue-500 hover:text-blue-600 rounded transition-colors"
                          title="Edit Package"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(pkg.id, pkg.name)}
                          className="p-2 border border-gray-250 hover:border-red-500 hover:text-red-600 rounded transition-colors"
                          title="Delete Package"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
