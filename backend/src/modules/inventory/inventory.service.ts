import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OsposIntegrationService } from '../integrations/ospos/ospos.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { config } from '../../config';

/**
 * InventoryService now delegates all stock data to OSPOS.
 * Stock levels, SKUs, and item names are authoritative in OSPOS.
 * Effective available quantity is calculated by subtracting active reservations.
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly osposService: OsposIntegrationService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Scheduled cron job running every 5 minutes to evaluate effective stock thresholds
   * and issue state-aware, deduplicated admin notifications for low-stock and out-of-stock items.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async evaluateStockThresholds() {
    try {
      this.logger.log('[Stock Threshold Evaluator] Starting periodic inventory evaluation...');

      // 1. Fetch live OSPOS items
      const items = await this.osposService.fetchAllItems();

      // 2. Safety Check: If OSPOS is unreachable or returned no items, log warning & exit safely
      if (!items || items.length === 0) {
        this.logger.warn('[Stock Threshold Evaluator] OSPOS returned empty or unreachable inventory data. Skipping threshold evaluation to prevent false alerts.');
        return;
      }

      // 3. Fetch all local products to read their per-product configured stock thresholds
      const localProducts = await this.prisma.products.findMany({
        select: {
          ospos_item_id: true,
          stock_thresholds: {
            select: { threshold_value: true },
          },
        },
      });
      const thresholdMap = new Map<number, number>(
        localProducts.map((p) => [p.ospos_item_id, p.stock_thresholds?.threshold_value ?? config.lowStockThreshold])
      );

      // 4. Fetch active reservations that haven't expired
      const activeReservations = await this.prisma.inventory_reservations.findMany({
        where: {
          status: 'active',
          expires_at: { gte: new Date() },
        },
        select: {
          ospos_item_id: true,
          quantity: true,
        },
      });

      const reservedQuantities = new Map<number, number>();
      for (const res of activeReservations) {
        reservedQuantities.set(
          res.ospos_item_id,
          (reservedQuantities.get(res.ospos_item_id) || 0) + res.quantity
        );
      }

      // 5. Evaluate state transitions for each OSPOS item
      for (const item of items) {
        const threshold = thresholdMap.get(item.item_id) ?? config.lowStockThreshold;
        const reservedQty = reservedQuantities.get(item.item_id) || 0;
        const effectiveAvailable = Math.max(0, item.quantity - reservedQty);
        const itemKey = `[Item: ${item.item_id}]`;

        // Retrieve the most recent stock notification record for this item to determine previous recorded state
        const lastNotification = await this.notificationsService.getLatestStockNotificationForProduct(item.item_id);
        const lastState = lastNotification ? lastNotification.type : 'NORMAL';

        if (effectiveAvailable <= 0) {
          // Current State: OUT_OF_STOCK
          if (lastState !== 'out_of_stock') {
            this.logger.log(`[Stock Threshold Evaluator] Item "${item.name}" (${item.item_id}) transitioned to OUT_OF_STOCK. Dispatching admin alert...`);
            await this.notificationsService.notifyAdminsDeduplicated(
              'Out of Stock Alert',
              `Product "${item.name}" is out of stock. 0 units currently available. ${itemKey}`,
              'out_of_stock',
              itemKey
            );
          }
        } else if (effectiveAvailable <= threshold) {
          // Current State: LOW_STOCK
          if (lastState !== 'low_stock') {
            this.logger.log(`[Stock Threshold Evaluator] Item "${item.name}" (${item.item_id}) transitioned to LOW_STOCK (${effectiveAvailable} pcs <= threshold ${threshold}). Dispatching admin alert...`);
            await this.notificationsService.notifyAdminsDeduplicated(
              'Low Stock Alert',
              `Product "${item.name}" is low on stock. ${effectiveAvailable} units are currently available (threshold: ${threshold}). ${itemKey}`,
              'low_stock',
              itemKey
            );
          }
        } else {
          // Current State: NORMAL
          if (lastState === 'low_stock' || lastState === 'out_of_stock') {
            this.logger.log(`[Stock Threshold Evaluator] Item "${item.name}" (${item.item_id}) recovered to NORMAL stock level (${effectiveAvailable} pcs > threshold ${threshold}). Recording state transition...`);
            // Insert internal state transition marker so subsequent drops to low stock will re-trigger alert
            await this.notificationsService.notifyAdminsDeduplicated(
              'Stock Recovered',
              `Product "${item.name}" stock level has recovered to ${effectiveAvailable} units. ${itemKey}`,
              'stock_recovered',
              itemKey
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`[Stock Threshold Evaluator] Error during threshold evaluation: ${error.message}`, error.stack);
    }
  }

  /**
   * Returns all OSPOS items as inventory level entries, adjusted by active reservations.
   */
  async getInventoryLevels() {
    const items = await this.osposService.fetchAllItems();

    // Fetch all active reservations that haven't expired
    const activeReservations = await this.prisma.inventory_reservations.findMany({
      where: {
        status: 'active',
        expires_at: { gte: new Date() },
      },
    });

    // Group active reservations by ospos_item_id
    const reservedQuantities = new Map<number, number>();
    for (const res of activeReservations) {
      reservedQuantities.set(
        res.ospos_item_id,
        (reservedQuantities.get(res.ospos_item_id) || 0) + res.quantity
      );
    }

    return items.map((item) => {
      const reservedQty = reservedQuantities.get(item.item_id) || 0;
      const quantityAvailable = Math.max(0, item.quantity - reservedQty);
      return {
        osposItemId: item.item_id,
        sku: item.sku,
        name: item.name,
        quantity: quantityAvailable, // Return effective stock
        category: item.category,
        categoryId: item.category_id,
        subcategoryId: item.subcategory_id,
        price: item.price,
      };
    });
  }

  /**
   * Returns OSPOS items whose effective quantity is at or below the configured low-stock threshold.
   */
  async getLowStockAlerts() {
    const items = await this.osposService.fetchAllItems();

    // Fetch all active reservations that haven't expired
    const activeReservations = await this.prisma.inventory_reservations.findMany({
      where: {
        status: 'active',
        expires_at: { gte: new Date() },
      },
    });

    // Group active reservations by ospos_item_id
    const reservedQuantities = new Map<number, number>();
    for (const res of activeReservations) {
      reservedQuantities.set(
        res.ospos_item_id,
        (reservedQuantities.get(res.ospos_item_id) || 0) + res.quantity
      );
    }

    return items
      .map((item) => {
        const reservedQty = reservedQuantities.get(item.item_id) || 0;
        const quantityAvailable = Math.max(0, item.quantity - reservedQty);
        return {
          osposItemId: item.item_id,
          sku: item.sku,
          name: item.name,
          quantity: quantityAvailable,
          category: item.category,
          price: item.price,
        };
      })
      .filter((item) => item.quantity <= config.lowStockThreshold);
  }

  /**
   * NOTE: Stock updates are now handled exclusively by OSPOS cashier interface.
   * This method is kept as a no-op stub to avoid breaking any callers.
   */
  async updateStock(osposItemId: number, change: number) {
    throw new NotFoundException(
      `Stock updates are managed via OSPOS. Item ${osposItemId} stock cannot be modified from TileVista.`,
    );
  }
}
