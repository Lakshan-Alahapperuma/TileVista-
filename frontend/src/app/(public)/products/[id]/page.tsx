'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ProductDetails, ProductList } from '@/features/products';

export default function ProductOrCategoryPage() {
  const params = useParams();
  const slug = (params?.id as string) || '';
  
  const isProductSlug = /^\d+(?:-|$)/.test(slug);

  if (isProductSlug) {
    const match = slug.match(/^(\d+)(?:-(.*))?$/);
    const id = match ? Number(match[1]) : null;
    return <ProductDetails id={id} slug={slug} />;
  }

  // Otherwise, it's a category slug
  return <ProductList categorySlug={slug} />;
}
