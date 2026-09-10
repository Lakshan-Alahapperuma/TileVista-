'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Loader2, AlertCircle, Eye, Check } from 'lucide-react';
import { useProduct } from './hooks/useProduct';
import { formatLKR, getBrand, getFallbackImage, getProductSlug } from './utils';
import { STATIC_BASE } from './constants';
import { useCart } from '../cart/hooks/useCart';
import { ProductCard } from './components/ProductCard';

interface ProductDetailsProps {
  id: number | null;
  slug: string;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({ id, slug }) => {
  const router = useRouter();
  const { product, relatedItems, loading, error, reload } = useProduct(id);

  const [quantity, setQuantity] = useState<number>(1);
  const [mounted, setMounted] = useState<boolean>(false);
  const [addedToCart, setAddedToCart] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const { addItem } = useCart();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setAddedToCart(false);
    setQuantity(1);
  }, [product]);

  useEffect(() => {
    if (product && mounted) {
      const expectedSlug = getProductSlug(product);
      if (slug !== expectedSlug) {
        router.replace(`/products/${expectedSlug}`);
      }
    }
  }, [product, slug, mounted, router]);

  if (loading) {
    return (
      <div className="py-40 flex flex-col items-center justify-center text-gray-400 gap-3">
        <Loader2 className="animate-spin text-[#D4C5B9]" size={36} />
        <span className="text-xs font-light tracking-widest uppercase font-mono">Loading item records...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="py-20 text-center max-w-lg mx-auto p-8 border border-dashed border-red-200 bg-red-50/20 my-10">
        <AlertCircle className="text-red-500 mx-auto mb-4" size={32} />
        <h2 className="text-base font-bold text-[#1A1A1A] mb-2">Failed to load Product</h2>
        <p className="text-red-650 font-light text-xs mb-6">{error || 'Product ID could not be matched.'}</p>
        <div className="flex justify-center gap-4">
          <Link
            href="/products"
            className="border border-gray-300 hover:border-[#1A1A1A] text-[#1A1A1A] font-semibold text-xs tracking-wider uppercase px-5 py-3 transition-colors"
          >
            Back to Shop
          </Link>
          <button
            onClick={reload}
            className="bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-semibold text-xs tracking-wider uppercase px-5 py-3 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleAddToCart = async () => {
    if (!product) return;
    setIsAdding(true);
    const res = await addItem(product.itemId, quantity);
    setIsAdding(false);

    if (res.success) {
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } else {
      alert(res.error || 'Failed to add item to cart');
    }
  };

  const productImageUrl = product.imageUrl ? `${STATIC_BASE}${product.imageUrl}` : getFallbackImage(product.category);

  const stockLevel = product.quantity;
  const isOutOfStock = stockLevel <= 0;
  const isLowStock = stockLevel > 0 && stockLevel <= 10;

  return (
    <div className="py-12 font-sans max-w-7xl mx-auto px-4 md:px-8 space-y-16 selection:bg-[#D4C5B9] selection:text-[#1A1A1A]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7">
          <div className="relative w-full aspect-[4/3] bg-[#F9F9F7] border border-gray-100 overflow-hidden flex items-center justify-center p-6">
            <img
              src={productImageUrl}
              alt={product.name}
              className="max-w-full max-h-full object-contain transition-transform duration-700 hover:scale-105"
            />
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="space-y-3">

            <h1 className="text-2xl md:text-3xl font-semibold text-[#1A1A1A] tracking-tight leading-tight">
              {product.name}
            </h1>

            <p className="text-sm text-gray-500 font-light leading-relaxed">
              {product.description || 'Premium selection showroom article, sourced and imported to fit contemporary architecture projects.'}
            </p>
          </div>

          {/* Product Specifications Grid */}
          <div className="bg-[#F9F9F7] border border-gray-200/80 p-4 rounded-sm space-y-3">
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Brand</span>
                <span className="font-semibold text-[#1A1A1A] mt-0.5">{getBrand(product) || 'Standard'}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Material</span>
                <span className="font-semibold text-[#1A1A1A] mt-0.5">{product.material || 'Premium Ceramic / Porcelain'}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Colour / Finish</span>
                <span className="font-semibold text-[#1A1A1A] mt-0.5">{product.finish || 'Standard Finish'}</span>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Size / Dimensions</span>
                <span className="font-semibold text-[#1A1A1A] mt-0.5 font-mono">
                  {product.size || (product.dimensions?.width && product.dimensions?.height ? `${product.dimensions.width}x${product.dimensions.height} ${product.dimensions.unit}` : 'Standard Size')}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-3xl md:text-4xl font-extrabold text-[#C8102E] tracking-tight block">
              {formatLKR(product.price)}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 border border-gray-200 px-3 py-2 bg-[#F9F9F7]">
              <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Product Code:</span>
              <span className="text-xs font-mono font-bold text-[#1A1A1A] tracking-wider">{product.sku}</span>
            </div>

            <div className={`inline-flex items-center gap-2 border px-3 py-2 ${isOutOfStock ? 'bg-red-50 border-red-200 text-red-700' : isLowStock ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
              <span className="w-2 h-2 rounded-full animate-pulse bg-current"></span>
              <span className="text-xs font-mono font-bold tracking-wider">
                {isOutOfStock ? 'Out of Stock' : `${stockLevel} Items Available`}
              </span>
            </div>
          </div>

          <hr className="border-gray-100 w-full" />

          <div className="space-y-4">
            {!isOutOfStock && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold tracking-widest text-gray-400 uppercase">Select Quantity</span>
                <div className="flex items-center w-32 border border-gray-200 bg-white">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-[#1A1A1A] font-light text-base border-r border-gray-150 disabled:opacity-30 transition-colors active:scale-90"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={stockLevel}
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setQuantity(Math.min(stockLevel, Math.max(1, val)));
                    }}
                    className="w-12 h-10 text-center font-mono text-xs text-[#1A1A1A] focus:outline-none bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setQuantity(Math.min(stockLevel, quantity + 1))}
                    disabled={quantity >= stockLevel}
                    className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-[#1A1A1A] font-light text-base border-l border-gray-150 disabled:opacity-30 transition-colors active:scale-90"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock || isAdding}
              className={`w-full font-semibold text-xs tracking-[0.15em] uppercase py-4 transition-all duration-300 shadow-sm flex items-center justify-center gap-3 disabled:opacity-30 disabled:hover:bg-[#1A1A1A] disabled:hover:text-white ${addedToCart ? 'bg-emerald-600 text-white' : 'bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white'}`}
            >
              {addedToCart ? (
                <>
                  <Check size={15} className="animate-bounce" />
                  <span>Added to Showroom Cart</span>
                </>
              ) : isAdding ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <ShoppingCart size={15} />
                  <span>{isOutOfStock ? 'OUT OF STOCK' : 'Add to Showroom Cart'}</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-start gap-2.5 pt-1">
            <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <div className="flex flex-col">
              <span className="text-xs text-gray-600 font-medium leading-relaxed">
                {isOutOfStock ? 'Currently out of stock at the showroom.' : isLowStock ? `Low stock.` : `Stock available in Alahapperuma Trade Center, Weerawila, Hambantota.`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {relatedItems.length > 0 && (
        <div className="border-t border-gray-100 pt-14 space-y-8">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-[9px] font-bold tracking-[0.25em] text-[#D4C5B9] uppercase block mb-1">
                Featured
              </span>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[#1A1A1A]">
                More From This Collection
              </h2>
            </div>
            <Link
              href={`/products/${product.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              className="text-[10px] font-bold tracking-widest text-[#1A1A1A] hover:text-[#D4C5B9] uppercase pb-1 border-b border-[#1A1A1A] hover:border-[#D4C5B9] transition-all flex items-center gap-1"
            >
              <span>View All</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {relatedItems.map((item) => (
              <ProductCard key={item.itemId} product={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
