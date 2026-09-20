#!/bin/bash
TARGET="frontend/src/components/designer/BathroomPlanner.tsx"
BAK="frontend/src/components/designer/DesignerCanvas.bak"

echo "import React, { Suspense } from 'react';" > $TARGET
echo "import SharedDesignerEngine from './SharedDesignerEngine';" >> $TARGET
echo "import { useDesignerStore } from '../../store/designer.store';" >> $TARGET

sed -n '51,75p' $BAK >> $TARGET
sed -n '3024,3055p' $BAK >> $TARGET

cat << 'INNER_EOF' >> $TARGET
export function getActiveCatalog(designType: 'room' | 'bathroom', subRoomType?: 'dining_room' | 'bed_room' | 'living_room') {
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
    { id: 'ospos_tiles', label: 'Load Tiles', icon: OSPOS_TILES_ICON }
  ];
  return [
    ...common,
    { id: 'sink', label: 'Wash Basin', icon: SINK_ICON },
    { id: 'bathtub', label: 'Bathtubs', icon: BATHTUB_ICON },
    { id: 'towel_rail', label: 'Towel Rails', icon: TOWEL_RAIL_ICON },
    { id: 'shower', label: 'Shower Cabin', icon: SHOWER_ICON },
    { id: 'toilet', label: 'Toilets', icon: TOILET_ICON },
    { id: 'washing_machine', label: 'Wash Machines', icon: WASHING_MACHINE_ICON },
    { id: 'light', label: 'Lighting', icon: LIGHT_ICON },
    { id: 'plant', label: 'Plants & Decor', icon: ACCESSORIES_ICON },
  ];
}
INNER_EOF

sed -n '1409,1631p' $BAK >> $TARGET

cat << 'INNER_EOF' >> $TARGET

export function BathroomCustomFurniture({ item, selected }: { item: any, selected: boolean }) {
  const t = item.type;
  if (t === 'sink') return <SinkModel selected={selected} />;
  if (t === 'bathtub') return <BathtubModel selected={selected} />;
  if (t === 'shower') return <ShowerModel selected={selected} />;
  if (t === 'toilet') return <ToiletModel selected={selected} />;
  if (t === 'towel_rail') return <TowelRailModel selected={selected} />;
  if (t === 'washing_machine') return <WashingMachineModel selected={selected} />;
  if (t === 'light') return <WallLightModel selected={selected} />;
  if (t === 'plant') return <PlantModel selected={selected} />;
  return null;
}

export default function BathroomPlanner() {
  const { state } = useDesignerStore();
  const catalog = getActiveCatalog('bathroom');
  const categories = getActiveCategories('bathroom');

  return (
    <SharedDesignerEngine 
      catalog={catalog} 
      categories={categories} 
      CustomFurniture={BathroomCustomFurniture} 
    />
  );
}
INNER_EOF
chmod +x generate_bathroom.sh
./generate_bathroom.sh
