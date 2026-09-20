#!/bin/bash
TARGET="frontend/src/components/designer/DesignerCanvas.tsx"
BAK="frontend/src/components/designer/DesignerCanvas.bak"

echo "import React, { Suspense } from 'react';" > $TARGET
echo "import SharedDesignerEngine from './SharedDesignerEngine';" >> $TARGET
echo "import { useDesignerStore } from '../../store/designer.store';" >> $TARGET

sed -n '372,463p' $BAK >> $TARGET
sed -n '465,499p' $BAK >> $TARGET
sed -n '1632,1903p' $BAK >> $TARGET
sed -n '684,773p' $BAK >> $TARGET

cat << 'INNER_EOF' >> $TARGET

export function DesignerCustomFurniture({ item, selected }: { item: any, selected: boolean }) {
  const t = item.type;
  if (t === 'beds' || t === 'bed') return <BedModel selected={selected} />;
  if (t === 'wardrobes' || t === 'wardrobe') return <WardrobeModel selected={selected} />;
  if (t === 'sofa' || t === 'sofas') return <SofaModel selected={selected} />;
  if (t === 'table' || t === 'dressing_table') return <TableModel selected={selected} />;
  if (t === 'chair' || t === 'chairs') return <ChairModel selected={selected} />;
  if (t === 'tv_cabinet') return <TvCabinetModel selected={selected} />;
  if (t === 'coffee_table') return <CoffeeTableModel selected={selected} />;
  if (t === 'mirror' || t === 'mirrors') return <MirrorModel selected={selected} />;
  if (t === 'runners_and_small_rugs' || t === 'rug' || t === 'runner') return <RugModel selected={selected} />;
  return null;
}

export default function DesignerCanvas() {
  const { state } = useDesignerStore();
  const catalog = getActiveCatalog(state.designType, state.subRoomType);
  const categories = getActiveCategories(state.designType, state.subRoomType);

  return (
    <SharedDesignerEngine 
      catalog={catalog} 
      categories={categories} 
      CustomFurniture={DesignerCustomFurniture} 
    />
  );
}
INNER_EOF
chmod +x generate.sh
./generate.sh
