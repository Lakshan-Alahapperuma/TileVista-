import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const FRIENDLY_NAMES: Record<string, string> = {
  // Sofas & Armchairs
  '2BxFZe1wguy_ygS6NAIVH': 'Modern 3-Seater Fabric Sofa',
  'YHyJAaauWGv9RC11Btmx2': 'Luxury L-Shape Corner Sofa',
  'y1aRZRIYb3xcXkWyHKoLU': 'Minimalist Nordic Armchair',

  // Tables & Coffee Tables
  '4nbsf2qMu9udBE14HxZxu': 'Solid Oak Round Coffee Table',
  'LRXBXW_xsYDxETpf9dk7g': 'Glass Top Living Coffee Table',
  '_qAT2rx3eFmhyYAVEqFL0': 'Scandinavian Low Side Table',

  // TV & Media Consoles
  'hxQ3RhEZYG01DXwo-BwlV': 'Modern Media Console Stand',
  'tv_lg_oled_8k': 'LG OLED 8K Ultra TV & Stand',

  // Dining Tables & Sets
  '6iSxtNvbVAhU99-NmL9xW': 'Contemporary 6-Seater Dining Set',
  'EuI_ddmjQM5-VauSD3tGr': 'Wooden Extendable Dining Table',

  // Beds
  'Celeste Bed': 'Celeste King Size Upholstered Bed',
  'Full Cushion Divan Bed': 'Full Cushion Premium Divan Bed',
  'Teak Cushion Bed': 'Solid Teak Cushion Headboard Bed',

  // Cabinets & Wardrobes
  'modern_cabinet_hutch_free': 'Modern Cabinet Hutch Storage',
  'modern_wooden_wardrobe': 'Modern Wooden Double Wardrobe',
  'wardrobe': 'Classic Standing Bedroom Wardrobe',

  // Dressing Tables & Mirrors
  'dressing_table': 'Vanity Dressing Table with Mirror',
  'pbr_dressing_table__low_poly': 'Nordic Vanity Dressing Table',
  'espejo_cuerpo_entero_-__full_length_mirror': 'Full Length Standing Floor Mirror',

  // Decor & Plants
  '3d_plant_model__indoor_decorative_plant': 'Indoor Decorative Ceramic Plant',
  'majesty_palm_plant': 'Majesty Palm Potted Floor Plant',
};

function formatItemName(rawName: string): string {
  if (FRIENDLY_NAMES[rawName]) {
    return FRIENDLY_NAMES[rawName];
  }
  return rawName
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, l => l.toUpperCase());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  if (!category) {
    return NextResponse.json({ error: 'Category is required' }, { status: 400 });
  }

  // Map our UI category IDs to folder names
  let folderName = category;
  if (category === 'dressing_table') folderName = 'dressingtable';
  if (category === 'runners_rugs') folderName = 'runners_and_small_rugs';
  if (category === 'tv_cabinet') folderName = 'tv';
  if (category === 'coffee_table') folderName = 'table';
  if (category === 'table') folderName = 'dinning';

  const dirPath = path.join(process.cwd(), 'public', 'images', 'furniture', folderName);
  
  if (!fs.existsSync(dirPath)) {
    return NextResponse.json({ items: [] });
  }

  try {
    const files = fs.readdirSync(dirPath);
    
    // Group files by base name
    const itemsMap = new Map<string, any>();
    
    files.forEach(file => {
      if (file.startsWith('.')) return;
      
      const ext = path.extname(file);
      const baseName = file.replace(/\.(webp|png|jpg|jpeg|avif|glb|gltf)$/i, '');
      
      if (!itemsMap.has(baseName)) {
        itemsMap.set(baseName, {
          id: `${category}_${baseName}`,
          name: formatItemName(baseName),
          type: category,
          cost: 199.99, // default cost
          isWallMounted: category === 'mirror', // simple heuristic
          image: null,
          model: null
        });
      }
      
      const item = itemsMap.get(baseName);
      const urlPath = `/images/furniture/${folderName}/${file}`;
      
      if (['.glb', '.gltf'].includes(ext.toLowerCase())) {
        item.model = urlPath;
      } else if (['.webp', '.png', '.jpg', '.jpeg', '.avif'].includes(ext.toLowerCase()) || file.endsWith('.jpg.avif')) {
        item.image = urlPath;
      }
    });

    // Convert map to array and only include items that have at least an image or model
    const items = Array.from(itemsMap.values()).filter(i => i.image || i.model);
    
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error reading directory:', error);
    return NextResponse.json({ error: 'Failed to read directory' }, { status: 500 });
  }
}

