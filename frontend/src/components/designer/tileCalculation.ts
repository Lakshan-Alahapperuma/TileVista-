import { DesignState } from '../../types/designer';

export interface TileUsageBreakdown {
  type: 'floor' | 'wall';
  wallIndex?: number;
  wallIndices?: number[];
  wallLabel?: string;
  tileKey?: string;
  id?: number;
  osposItemId?: number;
  name: string;
  imageUrl?: string;
  pricePerTile: number;
  dimensions: { widthM: number; heightM: number };
  tileAreaM2: number;
  surfaceAreaM2: number;
  surfaceAreaWithWastageM2: number;
  wastagePercent: number;
  baseTileCount: number;
  wastageTileCount: number;
  tileCount: number; // total required tiles with wastage
  tilesPerBox: number;
  boxCount: number;
  totalCost: number;
}

export function parseTileDimensions(tileItem?: any): { widthM: number; heightM: number } {
  const defaultSize = { widthM: 0.6, heightM: 0.6 }; // Default 60cm x 60cm
  if (!tileItem) return defaultSize;

  // 1. Check explicit dimensions object
  if (tileItem.dimensions && tileItem.dimensions.width && tileItem.dimensions.height) {
    const unit = (tileItem.dimensions.unit || 'cm').toLowerCase();
    const factor = unit === 'm' ? 1 : 0.01;
    return {
      widthM: Math.max(0.05, Number(tileItem.dimensions.width) * factor),
      heightM: Math.max(0.05, Number(tileItem.dimensions.height) * factor),
    };
  }

  // 2. Check direct widthCm / heightCm
  if (tileItem.widthCm && tileItem.heightCm) {
    return {
      widthM: Math.max(0.05, Number(tileItem.widthCm) / 100),
      heightM: Math.max(0.05, Number(tileItem.heightCm) / 100),
    };
  }

  // 3. Search for size or name strings matching patterns like "60x60", "30x60", "120x60"
  const strToMatch = `${tileItem.size || ''} ${tileItem.name || ''}`;
  const match = strToMatch.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/);
  if (match) {
    let w = parseFloat(match[1]);
    let h = parseFloat(match[2]);
    // If numbers are given in cm (e.g. 60x60), convert to meters
    if (w > 5 || h > 5) {
      w /= 100;
      h /= 100;
    }
    if (w > 0 && h > 0) {
      return { widthM: w, heightM: h };
    }
  }

  return defaultSize;
}

export function getRoomPolygon(shape: string, w: number, d: number): [number, number][] {
  if (shape === 'square') {
    const s = Math.min(w, d);
    return [[-s / 2, -s / 2], [s / 2, -s / 2], [s / 2, s / 2], [-s / 2, s / 2]];
  }
  if (shape === 'l-shape') {
    return [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, 0],
      [0, 0],
      [0, d / 2],
      [-w / 2, d / 2]
    ];
  }
  if (shape === 't-shape') {
    return [
      [-w / 4, -d / 2],
      [w / 4, -d / 2],
      [w / 4, 0],
      [w / 2, 0],
      [w / 2, d / 2],
      [-w / 2, d / 2],
      [-w / 2, 0],
      [-w / 4, 0]
    ];
  }
  if (shape === 'u-shape') {
    return [
      [-w / 2, -d / 2],
      [-w / 4, -d / 2],
      [-w / 4, 0],
      [w / 4, 0],
      [w / 4, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2]
    ];
  }
  if (shape === 'custom') {
    return [
      [-w / 2, -d / 2],
      [w / 4, -d / 2],
      [w / 2, -d / 4],
      [w / 2, d / 2],
      [-w / 2, d / 2]
    ];
  }
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
}

export function getPolygonArea(polygon: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }
  return Math.abs(area / 2);
}

export function getWallSegments(polygon: [number, number][]) {
  return polygon.map((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    const len = Math.sqrt(dx * dx + dz * dz);
    return { p1: p, p2: q, len };
  });
}

export function calculateDesignTileSummary(
  state: DesignState,
  catalogItems: any[] = [],
  overrideWastagePercent?: number,
  customWastageTiles?: Record<string, number>
): {
  floorTileSummary: TileUsageBreakdown | null;
  wallTileSummaries: TileUsageBreakdown[];
  totalTileCost: number;
} {
  const w = Math.max(1.5, (state.widthFt || 10) * 0.3048);
  const d = Math.max(1.5, (state.depthFt || 10) * 0.3048);
  const h = Math.max(2.2, (state.heightFt || 8) * 0.3048);

  const polygon = getRoomPolygon(state.shape || 'rectangular', w, d);
  const floorAreaM2 = getPolygonArea(polygon);
  const walls = getWallSegments(polygon);

  let floorTileSummary: TileUsageBreakdown | null = null;
  const wallTileSummaries: TileUsageBreakdown[] = [];

  const findItemForUrl = (url?: string, assetId?: string) => {
    if (!url && !assetId) return null;
    return catalogItems.find(i => {
      if (assetId && String(i.itemId) === String(assetId)) return true;
      if (url && i.imageUrl && url.includes(i.imageUrl)) return true;
      return false;
    });
  };

  // 1. Floor Tile Summary
  if (state.floorTextureUrl) {
    const tileItem = state.floorTileItem || findItemForUrl(state.floorTextureUrl);
    const dims = parseTileDimensions(tileItem);
    const tileArea = dims.widthM * dims.heightM;
    const baseTileCount = tileArea > 0 ? Math.ceil(floorAreaM2 / tileArea) : 0;
    
    // Default 10% wastage tiles
    const isCustomWastageSet = customWastageTiles && customWastageTiles['floor'] !== undefined;
    const effWastagePercent = overrideWastagePercent !== undefined ? overrideWastagePercent : 10;
    const defaultWastageTiles = Math.ceil(baseTileCount * (effWastagePercent / 100));

    const wastageTileCount = isCustomWastageSet
      ? customWastageTiles['floor']
      : defaultWastageTiles;

    const tileCount = baseTileCount + wastageTileCount;
    const wastage = isCustomWastageSet
      ? (baseTileCount > 0 ? (wastageTileCount / baseTileCount) * 100 : 0)
      : effWastagePercent;
    const surfaceWithWastage = floorAreaM2 * (1 + wastage / 100);
    const tilesPerBox = Number(tileItem?.tilesPerBox || tileItem?.boxSize || 10);
    const boxCount = Math.ceil(tileCount / tilesPerBox);
    const price = Number(tileItem?.price || 0);
    const cost = tileCount * price;

    floorTileSummary = {
      type: 'floor',
      name: tileItem?.name || 'Floor Tile',
      imageUrl: state.floorTextureUrl,
      pricePerTile: price,
      dimensions: dims,
      tileAreaM2: tileArea,
      surfaceAreaM2: floorAreaM2,
      surfaceAreaWithWastageM2: surfaceWithWastage,
      wastagePercent: Math.round(wastage * 10) / 10,
      baseTileCount,
      wastageTileCount,
      tileCount,
      tilesPerBox,
      boxCount,
      totalCost: cost,
    };
  }

  // 2. Wall Tiles Summary
  if (state.designType === 'bathroom') {
    interface WallGroupData {
      groupKey: string;
      tileItem: any;
      dims: { widthM: number; heightM: number };
      textureUrl: string;
      wallIndices: number[];
      totalNetArea: number;
    }

    const groupsMap = new Map<string, WallGroupData>();

    walls.forEach((wall, idx) => {
      const design = state.wallDesigns?.[idx];
      if (design && design.textureUrl) {
        const tileItem = design.tileItem || findItemForUrl(design.textureUrl, design.tileAssetId);
        const dims = parseTileDimensions(tileItem || state.wallTileItem);

        const wallH = (design.textureCoverageHeight !== undefined && design.textureCoverageHeight !== null)
          ? Math.min(h, Math.max(0, design.textureCoverageHeight))
          : h;

        const wallOpenings = (state.wallOpenings || []).filter(op => op.wallIndex === idx);
        const openingsArea = wallOpenings.reduce((acc, op) => acc + ((op.width || 0) * (op.height || 0)), 0);

        const netWallArea = Math.max(0, (wall.len * wallH) - openingsArea);
        const groupKey = design.tileAssetId || design.textureUrl || tileItem?.name || `wall_${idx}`;

        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, {
            groupKey,
            tileItem,
            dims,
            textureUrl: design.textureUrl,
            wallIndices: [idx],
            totalNetArea: netWallArea,
          });
        } else {
          const grp = groupsMap.get(groupKey)!;
          grp.wallIndices.push(idx);
          grp.totalNetArea += netWallArea;
        }
      }
    });

    const activeWallsCount = walls.filter((_, i) => state.wallDesigns?.[i]?.textureUrl).length;

    groupsMap.forEach((group) => {
      const tileItem = group.tileItem;
      const dims = group.dims;
      const tileArea = dims.widthM * dims.heightM;
      const netWallArea = group.totalNetArea;

      const baseTileCount = tileArea > 0 ? Math.ceil(netWallArea / tileArea) : 0;
      const isSingleWall = group.wallIndices.length === 1;
      const tileKey = isSingleWall
        ? `wall_${group.wallIndices[0]}`
        : `wall_group_${group.groupKey.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const customVal = (customWastageTiles && customWastageTiles[tileKey] !== undefined)
        ? customWastageTiles[tileKey]
        : (customWastageTiles && isSingleWall && customWastageTiles[`wall_${group.wallIndices[0]}`] !== undefined)
          ? customWastageTiles[`wall_${group.wallIndices[0]}`]
          : undefined;

      const isCustomWastageSet = customVal !== undefined;
      const effWastagePercent = overrideWastagePercent !== undefined ? overrideWastagePercent : 10;
      const defaultWastageTiles = Math.ceil(baseTileCount * (effWastagePercent / 100));

      const wastageTileCount = isCustomWastageSet ? customVal : defaultWastageTiles;

      const tileCount = baseTileCount + wastageTileCount;
      const wastage = isCustomWastageSet
        ? (baseTileCount > 0 ? (wastageTileCount / baseTileCount) * 100 : 0)
        : effWastagePercent;
      const surfaceWithWastage = netWallArea * (1 + wastage / 100);
      const tilesPerBox = Number(tileItem?.tilesPerBox || tileItem?.boxSize || 10);
      const boxCount = Math.ceil(tileCount / tilesPerBox);
      const price = Number(tileItem?.price || 0);
      const cost = tileCount * price;

      let wallLabel = 'Wall Tile';
      if (group.wallIndices.length === activeWallsCount && activeWallsCount > 1) {
        wallLabel = 'Wall Tile (All Walls)';
      } else if (group.wallIndices.length > 1) {
        const wallNums = group.wallIndices.map(i => i + 1).join(', ');
        wallLabel = `Wall ${wallNums} Tile`;
      } else if (group.wallIndices.length === 1) {
        wallLabel = `Wall ${group.wallIndices[0] + 1} Tile`;
      }

      const osposItemId = Number(tileItem?.ospos_item_id || tileItem?.osposItemId || tileItem?.item_id || tileItem?.id || 0);

      wallTileSummaries.push({
        type: 'wall',
        wallIndex: group.wallIndices[0],
        wallIndices: group.wallIndices,
        wallLabel,
        tileKey,
        id: osposItemId,
        osposItemId: osposItemId,
        name: tileItem?.name || wallLabel,
        imageUrl: group.textureUrl,
        pricePerTile: price,
        dimensions: dims,
        tileAreaM2: tileArea,
        surfaceAreaM2: netWallArea,
        surfaceAreaWithWastageM2: surfaceWithWastage,
        wastagePercent: Math.round(wastage * 10) / 10,
        baseTileCount,
        wastageTileCount,
        tileCount,
        tilesPerBox,
        boxCount,
        totalCost: cost,
      });
    });
  } else {
    // Normal room mode (wallTextureUrl applies to all walls)
    if (state.wallTextureUrl) {
      const tileItem = state.wallTileItem || findItemForUrl(state.wallTextureUrl);
      const dims = parseTileDimensions(tileItem);
      const tileArea = dims.widthM * dims.heightM;

      let totalNetWallArea = 0;
      walls.forEach((wall, idx) => {
        const wallOpenings = (state.wallOpenings || []).filter(op => op.wallIndex === idx);
        const openingsArea = wallOpenings.reduce((acc, op) => acc + ((op.width || 0) * (op.height || 0)), 0);
        totalNetWallArea += Math.max(0, (wall.len * h) - openingsArea);
      });

      const baseTileCount = tileArea > 0 ? Math.ceil(totalNetWallArea / tileArea) : 0;
      const isCustomWastageSet = customWastageTiles && customWastageTiles['wall'] !== undefined;
      const effWastagePercent = overrideWastagePercent !== undefined ? overrideWastagePercent : 10;
      const defaultWastageTiles = Math.ceil(baseTileCount * (effWastagePercent / 100));

      const wastageTileCount = isCustomWastageSet
        ? customWastageTiles['wall']
        : defaultWastageTiles;

      const tileCount = baseTileCount + wastageTileCount;
      const wastage = isCustomWastageSet
        ? (baseTileCount > 0 ? (wastageTileCount / baseTileCount) * 100 : 0)
        : effWastagePercent;
      const surfaceWithWastage = totalNetWallArea * (1 + wastage / 100);
      const tilesPerBox = Number(tileItem?.tilesPerBox || tileItem?.boxSize || 10);
      const boxCount = Math.ceil(tileCount / tilesPerBox);
      const price = Number(tileItem?.price || 0);
      const cost = tileCount * price;

      wallTileSummaries.push({
        type: 'wall',
        name: tileItem?.name || 'Wall Tile',
        imageUrl: state.wallTextureUrl,
        pricePerTile: price,
        dimensions: dims,
        tileAreaM2: tileArea,
        surfaceAreaM2: totalNetWallArea,
        surfaceAreaWithWastageM2: surfaceWithWastage,
        wastagePercent: Math.round(wastage * 10) / 10,
        baseTileCount,
        wastageTileCount,
        tileCount,
        tilesPerBox,
        boxCount,
        totalCost: cost,
      });
    }
  }

  const totalTileCost = (floorTileSummary?.totalCost || 0) + wallTileSummaries.reduce((sum, wts) => sum + wts.totalCost, 0);

  return { floorTileSummary, wallTileSummaries, totalTileCost };
}
