import React from 'react';

export const ProductHeader = React.memo(() => {
  return (
    <div className="border-b border-gray-100 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <span className="text-[10px] font-bold tracking-[0.3em] text-[#D4C5B9] uppercase block mb-2">
          TILE &amp; BATHWARE
        </span>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1A1A1A]">
          Browse Showroom Catalogue
        </h1>
        <p className="text-sm text-gray-500 font-light mt-1.5 max-w-xl leading-relaxed">
          Browse our imported range of European wall &amp; floor tiles, sleek sanitaryware, and premium shower system accessories.
        </p>
      </div>
    </div>
  );
});

ProductHeader.displayName = 'ProductHeader';
