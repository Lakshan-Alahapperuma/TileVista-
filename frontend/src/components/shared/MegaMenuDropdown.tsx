'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Category } from '../../features/products/types';
import { fetchCategories } from '../../features/products/api/products.api';

const CATEGORY_IMAGES: Record<string, string> = {
  'Tiles': '/images/categories/tiles.jpg',
  'Wash Basins': '/images/categories/wash-basins.jpg',
  'Water Closets': '/images/categories/water-closets.jpg',
  'Accessories': '/images/categories/accessories.png',
};

export const MegaMenuDropdown: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setHidden(true);
    const onMouseMove = () => setHidden(false);
    window.addEventListener('mousemove', onMouseMove, { once: true });
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [pathname]);

  const handleDropdownClick = () => {
    setHidden(true);
    const onMouseMove = () => setHidden(false);
    window.addEventListener('mousemove', onMouseMove, { once: true });
  };

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => console.error("Failed to load categories for MegaMenu:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div 
      onClick={handleDropdownClick}
      className={`absolute left-1/2 -translate-x-1/2 top-[calc(100%-4px)] bg-white border border-gray-100 shadow-xl transition-all duration-300 transform origin-top translate-y-2 z-[60] w-screen max-w-5xl ${
        hidden ? '!hidden opacity-0 invisible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible group-hover:translate-y-0'
      }`}
    >
      <div className="p-10 grid grid-cols-4 gap-8 text-left">
        {loading ? (
          <div className="col-span-4 text-center text-sm text-gray-500 py-10">Loading categories...</div>
        ) : (
          categories.slice(0, 4).map((category) => {
            const slug = category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const imageUrl = CATEGORY_IMAGES[category.name] || '/images/categories/accessories.png';
            
            return (
              <div key={category.id} className="flex flex-col">
                <img src={imageUrl} alt={category.name} className={`w-full h-32 object-cover mb-4 ${category.name === 'Accessories' ? 'bg-gray-100' : ''}`} />
                <h3 className="font-bold text-sm uppercase tracking-widest mb-4">{category.name}</h3>
                <ul className="space-y-2.5 text-sm text-gray-500 font-light">
                  {category.subcategories?.map(sub => (
                    <li key={sub.id}>
                      <Link href={`/products/${slug}?subcategoryId=${sub.id}`} className="hover:text-[#1A1A1A] transition-colors">
                        {sub.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={`/products/${slug}`} className="mt-6 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] border-b border-[#1A1A1A] self-start inline-block pb-0.5">
                  View All {category.name}
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
