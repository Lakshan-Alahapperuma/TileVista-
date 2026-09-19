export const formatLKR = (num: number) => {
  return `LKR ${num.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
};

export const getBrand = (product: { name?: string; brand?: string | null; category?: string | null }) => {
  if (product.brand && product.brand.trim() !== '' && product.brand.toLowerCase() !== 'unknown') {
    return product.brand;
  }
  
  const lowerName = (product.name || '').toLowerCase();
  const lowerCat = (product.category || '').toLowerCase();
  const strToMatch = `${lowerName} ${lowerCat}`;

  if (strToMatch.includes('lanka')) return 'Lanka Tiles';
  if (strToMatch.includes('grohe')) return 'Grohe';
  if (strToMatch.includes('kohler')) return 'Kohler';
  if (strToMatch.includes('toto')) return 'TOTO';
  if (strToMatch.includes('bravat')) return 'Bravat';
  if (strToMatch.includes('hansgrohe')) return 'Hansgrohe';

  // Rocell is the primary Sri Lanka bathware & tile brand for products like Giuly, Kube, Milano, Nexus, Orvito, Akansas, etc.
  return 'Rocell';
};

export const getFallbackImage = (category: string) => {
  return '/images/placeholder.png';
};

export const getProductSlug = (product: { itemId: number; name: string }) => {
  const cleanName = product.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${product.itemId}-${cleanName}`;
};
