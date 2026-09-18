export class InventoryResponseDto {
  totalCurrentStock: number;
  itemsAtOrBelowReorderLevel: number;
  outOfStockItems: number;
  totalStockValue: number;
}
