import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, ShoppingCart, Check, X, Plus, Minus } from 'lucide-react';
import { UnifiedItem } from '../types';
import { formatLKR, getFallbackImage, getProductSlug } from '../utils';
import { STATIC_BASE } from '../constants';
import { useCart } from '../../cart/hooks/useCart';

interface ProductCardProps {
  product: UnifiedItem;
}

export const ProductCard: React.FC<ProductCardProps> = React.memo(({ product }) => {
  const imageUrl = product.imageUrl ? `${STATIC_BASE}${product.imageUrl}` : getFallbackImage(product.category);
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const handleAddToCartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setQuantity(1);
    setShowModal(true);
  };

  const handleConfirmAdd = async () => {
    setIsAdding(true);
    const res = await addItem(product.itemId, quantity);
    setIsAdding(false);
    if (res.success) {
      setJustAdded(true);
      setShowModal(false);
      setTimeout(() => setJustAdded(false), 2000);
    } else {
      alert(res.error || 'Failed to add item to cart');
    }
  };

  return (
    <>
      <div className="group relative flex flex-col bg-white border border-gray-150 hover:border-[#1A1A1A] hover:shadow-lg transition-all duration-300 overflow-hidden">
        {/* Clickable Product Image */}
        <Link href={`/products/${getProductSlug(product)}`} className="relative w-full aspect-square bg-[#F9F9F7] overflow-hidden block">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
            style={{ backgroundImage: `url('${imageUrl}')` }}
          />

          {/* Top-Left Discount or Tile Size Overlay */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 items-start">
            {(product as any).discountPercentage ? (
              <span className="bg-[#C8102E] text-white font-bold text-[8.5px] uppercase tracking-wider px-2.5 py-1 shadow-sm">
                {(product as any).discountPercentage}% OFF
              </span>
            ) : (product as any).discount ? (
              <span className="bg-[#C8102E] text-white font-bold text-[8.5px] uppercase tracking-wider px-2.5 py-1 shadow-sm">
                {(product as any).discount} OFF
              </span>
            ) : product.category.toLowerCase().includes('tile') && product.size ? (
              <span className="bg-black/90 text-white font-mono font-bold text-[7.5px] uppercase tracking-wider px-2 py-0.5 shadow-sm">
                {product.size}
              </span>
            ) : null}
          </div>

          {/* Slide-up Add to Cart button on hover */}
          <button
            onClick={handleAddToCartClick}
            disabled={product.quantity <= 0 || justAdded}
            className={`absolute bottom-0 inset-x-0 py-3 px-4 transition-transform duration-300 transform translate-y-full group-hover:translate-y-0 z-20 flex items-center justify-center gap-2 text-xs font-bold tracking-widest uppercase shadow-md ${
              justAdded ? 'bg-green-600 text-white' : 'bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white'
            }`}
            aria-label="Add to cart"
          >
            {justAdded ? (
              <>
                <Check size={14} />
                <span>Added to Cart</span>
              </>
            ) : (
              <>
                <ShoppingCart size={14} />
                <span>Add to Cart</span>
              </>
            )}
          </button>
        </Link>

        {/* Clean Minimal Card Content Section */}
        <div className="p-4 flex flex-col flex-1 justify-between gap-1.5 bg-white">
          <Link href={`/products/${getProductSlug(product)}`}>
            <h3 className="text-sm font-semibold text-[#1A1A1A] tracking-wide line-clamp-1 hover:text-[#D4C5B9] transition-colors">
              {product.name}
            </h3>
          </Link>

          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-bold text-[#C8102E]">{formatLKR(product.price)}</span>
          </div>
        </div>
      </div>

      {/* Add to Cart Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={(e) => { e.preventDefault(); setShowModal(false); }}
        >
          <div 
            className="bg-white w-full max-w-3xl shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col md:flex-row p-8 gap-8 items-center md:items-start" 
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={(e) => { e.preventDefault(); setShowModal(false); }} 
              className="absolute top-4 right-4 text-gray-400 hover:text-[#1A1A1A] transition-colors"
              aria-label="Close"
            >
              <X size={24} />
            </button>
            
            <div className="w-full md:w-1/2 aspect-square shrink-0 relative overflow-hidden flex items-center justify-center p-4">
              <img src={imageUrl} alt={product.name} className="max-w-full max-h-full object-contain" />
            </div>

            <div className="w-full md:w-1/2 flex flex-col pt-4">
              <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase font-mono mb-2 block">
                {product.category} {product.sku && `| ${product.sku}`}
              </span>
              <h3 className="text-2xl font-light text-[#4A4A4A] leading-snug mb-6">
                {product.name}
              </h3>
              
              <div className="text-2xl font-bold text-[#1A1A1A] mb-8">
                {formatLKR(product.price)}
              </div>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center bg-[#F5F5F5] h-12 w-32 border border-[#E5E5E5]">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="flex-1 h-full text-gray-500 hover:text-black hover:bg-[#EAEAEA] transition-colors flex items-center justify-center disabled:opacity-30 disabled:hover:bg-transparent"
                    disabled={quantity <= 1}
                  >
                    <Minus size={16} />
                  </button>
                  <span className="flex-1 h-full font-mono text-lg font-semibold text-[#1A1A1A] flex items-center justify-center bg-white border-x border-[#E5E5E5]">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(q => Math.min(product.quantity, q + 1))}
                    className="flex-1 h-full text-gray-500 hover:text-black hover:bg-[#EAEAEA] transition-colors flex items-center justify-center disabled:opacity-30 disabled:hover:bg-transparent"
                    disabled={quantity >= product.quantity}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mb-8">
                <button
                  onClick={handleConfirmAdd}
                  disabled={isAdding}
                  className="flex-1 bg-[#757575] hover:bg-[#5C5C5C] text-white h-12 font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAdding ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={18} />
                      <span>Add to Cart</span>
                    </>
                  )}
                </button>
              </div>

              <Link href={`/products/${getProductSlug(product)}`} className="text-sm text-gray-500 underline hover:text-[#1A1A1A] transition-colors w-fit">
                View More Details
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

ProductCard.displayName = 'ProductCard';
