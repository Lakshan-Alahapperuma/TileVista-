'use client';

import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface CategoriesProps {
  onSelectCategory: (categoryName: string) => void;
}

export const Categories: React.FC<CategoriesProps> = ({ onSelectCategory }) => {
  const categoriesList = [
    {
      id: 'tiles',
      title: 'Tiles',
      subtitle: 'Elegant Designs, Lasting Quality',
      image: '/images/categories/tiles.jpg',
      categoryTag: 'TILE'
    },
    {
      id: 'wash-basins',
      title: 'Wash Basins',
      subtitle: 'Style Meets Everyday Comfort',
      image: '/images/categories/wash-basins.jpg',
      categoryTag: 'BATHWARE'
    },
    {
      id: 'water-closets',
      title: 'Water Closets',
      subtitle: 'Modern Comfort, Reliable Performance',
      image: '/images/categories/water-closets.jpg',
      categoryTag: 'BATHWARE'
    },
    {
      id: 'accessories',
      title: 'Accessories',
      subtitle: 'Complete Your Bathroom Space',
      image: '/images/categories/accessories.png',
      categoryTag: 'BATHWARE'
    }
  ];

  return (
    <section className="bg-white py-16 md:py-24 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 md:px-12 font-sans">
        
        {/* Header and View All */}
        <div className="flex items-end justify-between mb-12">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-[0.3em] text-[#D4C5B9] uppercase mb-2 block">
              PRODUCT CATALOG
            </span>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1A1A1A]">
              Explore Collection
            </h2>
          </div>
        </div>

        {/* 4-Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categoriesList.map((cat) => (
            <div
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className="group relative h-[320px] overflow-hidden bg-gray-900 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300"
            >
              {/* Image Background */}
              <div 
                className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: `url('${cat.image}')` }}
              />
              
              {/* Dark Overlay (Gradual) */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent transition-opacity duration-300" />
              <div className="absolute inset-0 bg-[#1A1A1A]/10 group-hover:bg-[#1A1A1A]/0 transition-colors" />

              {/* Text aligned at bottom */}
              <div className="absolute inset-x-0 bottom-0 p-6 z-10 text-white flex flex-col justify-end">
                <h3 className="text-lg font-medium tracking-wide mb-1 transition-colors duration-300 group-hover:text-[#D4C5B9]">
                  {cat.title}
                </h3>
                <p className="text-xs text-gray-300 font-light tracking-wide">
                  {cat.subtitle}
                </p>
              </div>

              {/* Top accent line that grows on hover */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#D4C5B9] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
