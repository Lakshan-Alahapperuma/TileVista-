import React from "react";

const OPENINGS_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M3 11h6M15 11h6M15 3v8" />
  </svg>
);

const WALL_COLORS_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="13.5" cy="6.5" r=".5" />
    <circle cx="17.5" cy="10.5" r=".5" />
    <circle cx="8.5" cy="7.5" r=".5" />
    <circle cx="6.5" cy="12.5" r=".5" />
    <path d="M12 2C6.5 2 2 6.5 2 12s5 10 10 10c1.2 0 2.2-1 2.2-2.2 0-.6-.2-1.1-.6-1.5-.3-.4-.5-.9-.5-1.4 0-1.1.9-2 2-2h1.4c3 0 5.5-2.5 5.5-5.5C22 6.5 17.5 2 12 2z" />
  </svg>
);

const OSPOS_TILES_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const WALL_TILES_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M3 15h18" />
    <path d="M9 3v6" />
    <path d="M15 9v6" />
    <path d="M9 15v6" />
  </svg>
);

const FLOOR_TILES_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="14" width="18" height="7" rx="1" />
    <path d="M9 14l-2 7" />
    <path d="M15 14l2 7" />
  </svg>
);
const SINK_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 10h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5z" />
    <path d="M12 10V4m-2 2h4" />
  </svg>
);
const TOILET_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 3h6v8H5zM8 11v8a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-8H8z" />
  </svg>
);
const WASHING_MACHINE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <circle cx="12" cy="13" r="4" />
    <circle cx="12" cy="13" r="2" />
    <path d="M7 6h2M15 6h2" />
  </svg>
);
const LIGHT_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="9" r="4" />
    <path d="M9 13h6M12 17v4M10 21h4" />
  </svg>
);
const ACCESSORIES_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M8 22h8v-6a4 4 0 0 0-4-4H12a4 4 0 0 0-4 4v6z" />
    <path d="M12 12V3M10 4l4 4" />
  </svg>
);
const SOFA_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 10V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" />
    <path d="M2 14v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4" />
    <path d="M2 14h20v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5Z" />
    <path d="M6 14v4M18 14v4" />
  </svg>
);
const BED_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 4v16M22 4v16M2 8h20M2 17h20" />
    <rect x="5" y="10" width="6" height="4" rx="1" />
    <rect x="13" y="10" width="6" height="4" rx="1" />
  </svg>
);
const TABLE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 8h18M6 8v12M18 8v12M10 8v8M14 8v8" />
  </svg>
);
const CHAIR_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M7 20V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
    <path d="M4 11h16M7 11V20M17 11V20" />
  </svg>
);
const WARDROBE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M12 3v18M9 11v2M15 11v2" />
  </svg>
);
const TV_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="5" width="18" height="11" rx="2" />
    <path d="M12 16v4M8 20h8" />
  </svg>
);
const COFFEE_TABLE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <ellipse cx="12" cy="9" rx="8" ry="3" />
    <path d="M6 10v9M18 10v9M10 12v6M14 12v6" />
  </svg>
);
const MIRROR_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <ellipse cx="12" cy="12" rx="6" ry="9" />
    <path d="M12 3v18" opacity="0.3" />
  </svg>
);
const DRESSING_TABLE_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="12" width="18" height="9" rx="1" />
    <rect x="7" y="3" width="10" height="9" rx="1" />
  </svg>
);
const RUG_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="6" width="16" height="12" rx="1" />
    <path d="M4 10h16M4 14h16" opacity="0.5" />
  </svg>
);


const BATHTUB_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 10h20v8a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4v-8z" />
    <path d="M4 6v4M2 14c4-4 16-4 20 0M6 22v1M18 22v1" />
  </svg>
);
const TOWEL_RAIL_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M6 3v18M18 3v18M6 7h12M6 12h12M6 17h12" />
  </svg>
);
const SHOWER_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 4h16M12 4v8" />
    <path d="M8 12a4 4 0 0 1 8 0" />
    <path d="M10 16v1M12 16v2M14 16v1" />
  </svg>
);
const PACKAGES_ICON = (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

export function getActiveCatalog(designType: 'room' | 'bathroom', subRoomType?: 'dining_room' | 'bed_room' | 'living_room') {
  if (designType === 'room') {
    let items = [
      { type: 'sofa', name: 'Modern 3-Seater Sofa', cost: 499.99, isWallMounted: false },
      { type: 'bed', name: 'King Size Bed Frame', cost: 699.99, isWallMounted: false },
      { type: 'table', name: 'Wooden Dining Table', cost: 299.99, isWallMounted: false },
      { type: 'chair', name: 'Upholstered Dining Chair', cost: 89.99, isWallMounted: false },
      { type: 'wardrobe', name: 'Double Wardrobe Cabinet', cost: 399.99, isWallMounted: false },
      { type: 'tv_cabinet', name: 'Media Console & TV', cost: 249.99, isWallMounted: false },
      { type: 'coffee_table', name: 'Minimalist Coffee Table', cost: 149.99, isWallMounted: false },
      { type: 'plant', name: 'Tall Floor Fiddle Leaf', cost: 59.99, isWallMounted: false },
      { type: 'dressing_table', name: 'Vanity Dressing Table', cost: 229.99, isWallMounted: false },
      { type: 'mirror', name: 'Wall Mounted Mirror', cost: 99.99, isWallMounted: true },
      { type: 'runner', name: 'Floor Runner Rug', cost: 49.99, isWallMounted: false },
      { type: 'rug', name: 'Large Area Rug', cost: 129.99, isWallMounted: false },
      { type: 'cabinet', name: 'Display Cabinet', cost: 349.99, isWallMounted: false },
    ];
    if (subRoomType === 'dining_room') {
      return items.filter(i => ['table', 'cabinet', 'rug', 'plant'].includes(i.type));
    } else if (subRoomType === 'bed_room') {
      return items.filter(i => ['bed', 'wardrobe', 'dressing_table', 'mirror', 'runner', 'rug', 'tv_cabinet', 'plant'].includes(i.type));
    } else if (subRoomType === 'living_room') {
      return items.filter(i => ['sofa', 'tv_cabinet', 'coffee_table', 'rug', 'plant'].includes(i.type));
    }
    return items;
  }
  return [
    { type: 'sink', name: 'Vanity Cabinet Sink', cost: 249.99, isWallMounted: false },
    { type: 'bathtub', name: 'Freestanding Bath', cost: 599.99, isWallMounted: false },
    { type: 'shower', name: 'Walk-In Shower Box', cost: 449.99, isWallMounted: false },
    { type: 'toilet', name: 'Wall-Hung Toilet', cost: 199.99, isWallMounted: false },
    { type: 'towel_rail', name: 'Chrome Towel Ladder', cost: 119.99, isWallMounted: true },
    { type: 'washing_machine', name: 'Eco Wash Machine', cost: 349.99, isWallMounted: false },
    { type: 'light', name: 'Vanity Mirror Light', cost: 79.99, isWallMounted: true },
    { type: 'plant', name: 'Deco Ceramic Plant', cost: 44.99, isWallMounted: false },
  ];
}

export function getActiveCategories(designType: 'room' | 'bathroom', subRoomType?: 'dining_room' | 'bed_room' | 'living_room') {
  const common = [
    { id: 'openings', label: 'Doors & Windows', icon: OPENINGS_ICON },
    { id: 'wall_colours', label: 'Wall Colours', icon: WALL_COLORS_ICON },
  ];
  if (designType === 'room') {
    let cats = [
      { id: 'sofa', label: 'Sofa & Lounge', icon: SOFA_ICON },
      { id: 'bed', label: 'Beds', icon: BED_ICON },
      { id: 'wardrobe', label: 'Wardrobes', icon: WARDROBE_ICON },
      { id: 'dressing_table', label: 'Dressing Table', icon: DRESSING_TABLE_ICON },
      { id: 'mirror', label: 'Mirrors', icon: MIRROR_ICON },
      { id: 'runner', label: 'Runners', icon: RUG_ICON },
      { id: 'rug', label: 'Rugs', icon: RUG_ICON },
      { id: 'table', label: 'Dining Tables', icon: TABLE_ICON },
      { id: 'chair', label: 'Chairs', icon: CHAIR_ICON },
      { id: 'cabinet', label: 'Display Cabinets', icon: WARDROBE_ICON },
      { id: 'tv_cabinet', label: 'TV & Console', icon: TV_ICON },
      { id: 'coffee_table', label: 'Coffee Tables', icon: COFFEE_TABLE_ICON },
      { id: 'plant', label: 'Decor Plants', icon: ACCESSORIES_ICON },
    ];
    if (subRoomType === 'dining_room') {
      cats = cats.filter(c => ['table', 'cabinet', 'rug', 'plant'].includes(c.id));
    } else if (subRoomType === 'bed_room') {
      cats = [
        { id: 'beds', label: 'Beds', icon: BED_ICON },
        { id: 'wardrobes', label: 'Wardrobes', icon: WARDROBE_ICON },
        { id: 'dressing_table', label: 'Dressing Table', icon: DRESSING_TABLE_ICON },
        { id: 'mirror', label: 'Mirrors', icon: MIRROR_ICON },
        { id: 'runners_and_small_rugs', label: 'Runners and Small Rugs', icon: RUG_ICON },
      ];
    } else if (subRoomType === 'living_room') {
      cats = cats.filter(c => ['sofa', 'tv_cabinet', 'coffee_table', 'rug', 'plant'].includes(c.id));
    }
    return [
      ...common,
      { id: 'ospos_tiles', label: 'Load Tiles', icon: OSPOS_TILES_ICON },
      ...cats
    ];
  }
  return [
    ...common,
    { id: 'wall_tiles', label: 'Wall Tiles', icon: WALL_TILES_ICON },
    { id: 'floor_tiles', label: 'Floor Tiles', icon: FLOOR_TILES_ICON },
    { id: 'bathware_products', label: 'Add Product', icon: SINK_ICON },
    { id: 'packages', label: 'Curated Packages', icon: PACKAGES_ICON },
  ];
}