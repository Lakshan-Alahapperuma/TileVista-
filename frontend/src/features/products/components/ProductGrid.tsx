import React from 'react';
import { ProductCard } from './ProductCard';
import { UnifiedItem } from '../types';

interface ProductGridProps {
  products: UnifiedItem[];
}

export const ProductGrid: React.FC<ProductGridProps> = ({ products }) => {
  if (products.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed border-gray-200 bg-[#F9F9F7]">
        <p className="text-gray-500 font-light text-sm">No items found matching your search criteria.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product) => (
        <ProductCard key={product.itemId} product={product} />
      ))}
    </div>
  );
};
