import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { OsposIntegrationService } from '../integrations/ospos/ospos.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly osposService: OsposIntegrationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Scheduled cron job running every 5 minutes to sweep and expire active reservations past their 5-day window.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCronExpiration() {
    try {
      await this.processExpiredReservations();
    } catch (error) {
      this.logger.error(`Failed to process reservation expirations: ${error.message}`, error.stack);
    }
  }

  /**
   * Processes all active reservations whose expires_at timestamp has passed.
   * Updates reservations from 'active' to 'expired'.
   * If all active reservations for an order expire, updates the order status to 'cancelled'.
   * Does NOT alter reservations that are 'released' or 'completed'.
   */
  async processExpiredReservations(): Promise<{ expiredReservationsCount: number; cancelledOrdersCount: number }> {
    const now = new Date();

    // 1. Find active reservations whose expires_at timestamp has passed
    const expiredReservations = await this.prisma.inventory_reservations.findMany({
      where: {
        status: 'active',
        expires_at: { lt: now },
      },
      select: {
        reservation_id: true,
        order_id: true,
      },
    });

    if (expiredReservations.length === 0) {
      return { expiredReservationsCount: 0, cancelledOrdersCount: 0 };
    }

    const expiredReservationIds = expiredReservations.map((r) => r.reservation_id);
    const affectedOrderIds = [...new Set(expiredReservations.map((r) => r.order_id))];

    const result = await this.prisma.$transaction(async (tx) => {
      // Batch update active reservations whose expires_at < now to 'expired'
      const updateResult = await tx.inventory_reservations.updateMany({
        where: {
          reservation_id: { in: expiredReservationIds },
          status: 'active',
        },
        data: {
          status: 'expired',
        },
      });

      // Update associated orders to 'cancelled' if all their active reservations have expired
      let cancelledOrdersCount = 0;
      const cancelledOrders: { order_id: string; order_reference: string; user_id: string }[] = [];

      for (const orderId of affectedOrderIds) {
        const remainingActiveCount = await tx.inventory_reservations.count({
          where: {
            order_id: orderId,
            status: 'active',
          },
        });

        if (remainingActiveCount === 0) {
          const order = await tx.orders.findUnique({
            where: { order_id: orderId },
            select: { order_id: true, order_reference: true, user_id: true, status: true },
          });

          if (order && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'rejected') {
            await tx.orders.update({
              where: { order_id: orderId },
              data: { status: 'cancelled' },
            });
            cancelledOrdersCount++;
            cancelledOrders.push(order);
          }
        }
      }

      this.logger.log(
        `[5-Day Expiration Worker] Expired ${updateResult.count} reservations and cancelled ${cancelledOrdersCount} orders.`
      );

      return {
        expiredReservationsCount: updateResult.count,
        cancelledOrdersCount,
        cancelledOrders,
      };
    });

    // Notify customer and admins for newly expired reservations
    for (const cancelledOrder of result.cancelledOrders) {
      const orderRef = cancelledOrder.order_reference;
      try {
        await this.notificationsService.createNotification(
          cancelledOrder.user_id,
          'Reservation Expired',
          `Your stock reservation for order ${orderRef} has expired after 5 days and the reserved stock has been released.`,
          'reservation_expired',
        );

        await this.notificationsService.notifyAdminsDeduplicated(
          'Reservation Expired',
          `Reservation for order ${orderRef} has expired after 5 days and the reserved stock has been released. [OrderRef: ${orderRef}]`,
          'reservation_expired',
          `[OrderRef: ${orderRef}]`,
        );
      } catch (err) {
        this.logger.warn(`Failed to dispatch expiration notification for order ${orderRef}: ${err.message}`);
      }
    }

    return {
      expiredReservationsCount: result.expiredReservationsCount,
      cancelledOrdersCount: result.cancelledOrdersCount,
    };
  }

  /**
   * Creates an online product purchase order.
   * Validates product names, pricing, and stock availability directly from OSPOS.
   * Incorporates active reservations to check effective available stock.
   */
  async createOrder(userId: string, data: {
    items: { osposItemId: number; quantity: number }[];
    shippingAddress?: string;
    paymentMethod?: string;
  }) {
    if (!userId) {
      throw new BadRequestException('User authentication is required to place an order');
    }

    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Checkout cart cannot be empty');
    }

    const targetUserId = userId;

    // Fetch all OSPOS items to validate quantities and prices live
    const allOsposItems = await this.osposService.fetchAllItems();
    const osposItemMap = new Map(allOsposItems.map((item) => [item.item_id, item]));

    const result = await this.prisma.$transaction(async (tx) => {
      const itemIds = data.items.map((i) => i.osposItemId);
      const sortedItemIds = [...new Set(itemIds)].sort((a, b) => a - b);

      // Lock local product records in deterministic (sorted) order to serialize concurrent
      // order requests for the same items and prevent race conditions & overbooking.
      if (sortedItemIds.length > 0) {
        await tx.$queryRaw`
          SELECT product_id FROM products 
          WHERE ospos_item_id IN (${Prisma.join(sortedItemIds)}) 
          FOR UPDATE
        `;
      }

      // Fetch active reservations for the items being ordered
      const activeReservations = await tx.inventory_reservations.findMany({
        where: {
          ospos_item_id: { in: itemIds },
          status: 'active',
          expires_at: { gte: new Date() },
        },
      });

      // Group active reservations by item ID
      const reservedQuantities = new Map<number, number>();
      for (const res of activeReservations) {
        reservedQuantities.set(
          res.ospos_item_id,
          (reservedQuantities.get(res.ospos_item_id) || 0) + res.quantity
        );
      }

      let totalAmount = 0;
      const orderItemsData = [];
      let requiresAdminApproval = false;

      for (const item of data.items) {
        const osposItem = osposItemMap.get(item.osposItemId);
        if (!osposItem) {
          throw new NotFoundException(`Item not available`);
        }

        // Validate visibility gate and fetch stock_thresholds
        const localProduct = await tx.products.findUnique({
          where: { ospos_item_id: item.osposItemId },
          include: { product_assets: true, stock_thresholds: true },
        });
        
        const hasAssetEntry = !!localProduct?.product_assets;
        const isVisible = localProduct?.product_assets?.is_visible ?? localProduct?.is_active ?? true;
        if (!localProduct || !hasAssetEntry || !isVisible) {
          throw new NotFoundException(`Item not available`);
        }

        // Section 19: Missing threshold handling
        if (!localProduct.stock_thresholds) {
          throw new BadRequestException(
            `Product "${osposItem.name}" does not have a configured order threshold and cannot be ordered.`
          );
        }

        const reservedQty = reservedQuantities.get(item.osposItemId) || 0;
        const effectiveStock = osposItem.quantity - reservedQty;

        // FIRST CHECK: Insufficient stock check (Section 7)
        if (effectiveStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${osposItem.name} (OSPOS stock: ${osposItem.quantity}, reserved: ${reservedQty}, requested: ${item.quantity})`
          );
        }

        // SECOND CHECK: Threshold comparison (Section 6 & 8)
        // Remaining after order = Effective available - New order quantity
        const remainingAfterOrder = effectiveStock - item.quantity;
        const thresholdValue = localProduct.stock_thresholds.threshold_value;

        // If remainingAfterOrder <= thresholdValue, this item requires admin approval
        if (remainingAfterOrder <= thresholdValue) {
          requiresAdminApproval = true;
        }

        const subtotal = osposItem.price * item.quantity;
        totalAmount += subtotal;

        orderItemsData.push({
          order_item_id: crypto.randomUUID(),
          ospos_item_id: item.osposItemId,
          product_name_snapshot: osposItem.name,
          quantity: item.quantity,
          unit_price: osposItem.price,
          subtotal: subtotal,
        });
      }

      const orderId = crypto.randomUUID();
      const randomRef = Math.floor(10000 + Math.random() * 90000);
      const orderRef = `QT-${randomRef}-MATARA`;

      // 5-day reservation TTL (120 hours)
      const reservationTtlHours = Number(process.env.RESERVATION_TTL_HOURS) || 120;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + reservationTtlHours);

      const orderStatus = requiresAdminApproval ? 'pending' : 'approved';
      const approvalType = requiresAdminApproval ? 'manual' : 'auto';

      const createdOrderRecord = await tx.orders.create({
        data: {
          order_id: orderId,
          order_reference: orderRef,
          user_id: targetUserId,
          total_amount: totalAmount,
          status: orderStatus,
          payment_status: 'pending',
          approval_type: approvalType,
          order_items: {
            create: orderItemsData,
          },
          inventory_reservations: {
            create: orderItemsData.map((item) => ({
              reservation_id: crypto.randomUUID(),
              ospos_item_id: item.ospos_item_id,
              quantity: item.quantity,
              expires_at: expiresAt,
              status: 'active',
            })),
          },
        },
        include: {
          order_items: true,
          inventory_reservations: true,
          users: {
            select: {
              user_id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      // Generate customer notification for order creation
      if (orderStatus === 'approved') {
        await this.notificationsService.createNotification(
          targetUserId,
          'Order Approved',
          `Your order ${orderRef} has been approved and your reserved stock is being held for showroom pickup.`,
          'order'
        );
      } else {
        await this.notificationsService.createNotification(
          targetUserId,
          'Order Received',
          `Your showroom quotation ${orderRef} has been received and is awaiting processing.`,
          'order'
        );

        // Generate persistent admin notification for order requiring manual approval
        await this.notificationsService.notifyAdminsDeduplicated(
          'Order Approval Required',
          `Order ${orderRef} requires administrator approval because the requested quantity affects available stock. [OrderRef: ${orderRef}]`,
          'order_approval_required',
          `[OrderRef: ${orderRef}]`
        );
      }

      return {
        createdOrderRecord,
        expiresAt,
      };
    });

    // Decoupled execution: Call OSPOS quote creation outside the Prisma transaction
    const { createdOrderRecord, expiresAt } = result;
    const user = createdOrderRecord.users;

    if (user) {
      const quotePayload = {
        reference: createdOrderRecord.order_reference,
        location_id: Number(process.env.OSPOS_LOCATION_ID) || 1,
        customer: {
          user_id: user.user_id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email || '',
          phone: user.phone || '',
        },
        items: createdOrderRecord.order_items.map((item) => ({
          ospos_item_id: item.ospos_item_id,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
        })),
        expires_at: expiresAt.toISOString(),
        comment: `TileVista Online Showroom Order ${createdOrderRecord.order_reference}`,
      };

      try {
        const osposRes = await this.osposService.createQuote(quotePayload);
        if (osposRes?.ospos_sale_id) {
          await this.prisma.orders.update({
            where: { order_id: createdOrderRecord.order_id },
            data: { ospos_sale_id: osposRes.ospos_sale_id },
          });
          (createdOrderRecord as any).ospos_sale_id = osposRes.ospos_sale_id;
        }
      } catch (error) {
        this.logger.warn(`Failed to sync order ${createdOrderRecord.order_reference} to OSPOS: ${error.message}`);
      }
    }

    return createdOrderRecord;
  }

  async getOrder(id: string) {
    const order = await this.prisma.orders.findUnique({
      where: { order_id: id },
      include: {
        users: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            user_addresses: true,
          },
        },
        order_items: true,
        inventory_reservations: true,
        order_status_history: {
          orderBy: { changed_at: 'desc' },
        },
      },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }
    return order;
  }

  async getCustomerOrders(userId: string) {
    return this.prisma.orders.findMany({
      where: { user_id: userId },
      include: {
        order_items: true,
        inventory_reservations: true,
        order_status_history: {
          orderBy: { changed_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Returns customer-specific order summary metrics for the logged-in customer's dashboard.
   */
  async getMyOrdersSummary(userId: string) {
    const [total, pending, approved, completed, rejected] = await Promise.all([
      this.prisma.orders.count({ where: { user_id: userId } }),
      this.prisma.orders.count({ where: { user_id: userId, status: 'pending' } }),
      this.prisma.orders.count({ where: { user_id: userId, status: 'approved' } }),
      this.prisma.orders.count({ where: { user_id: userId, status: 'completed' } }),
      this.prisma.orders.count({
        where: { user_id: userId, status: { in: ['rejected', 'cancelled'] } },
      }),
    ]);

    return {
      total,
      pending,
      approved,
      completed,
      rejected,
    };
  }

  /**
   * Returns all orders belonging exclusively to the authenticated customer.
   */
  async getMyOrdersList(userId: string, statusFilter?: string, search?: string) {
    const whereClause: any = { user_id: userId };

    if (statusFilter === 'PENDING') {
      whereClause.status = 'pending';
    } else if (statusFilter === 'APPROVED') {
      whereClause.status = 'approved';
    } else if (statusFilter === 'COMPLETED') {
      whereClause.status = 'completed';
    } else if (statusFilter === 'REJECTED') {
      whereClause.status = { in: ['rejected', 'cancelled'] };
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      whereClause.OR = [
        { order_reference: { contains: q } },
        { order_items: { some: { product_name_snapshot: { contains: q } } } },
      ];
    }

    return this.prisma.orders.findMany({
      where: whereClause,
      include: {
        order_items: true,
        inventory_reservations: true,
        order_status_history: {
          orderBy: { changed_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Returns one specific order belonging to the authenticated customer.
   * Throws ForbiddenException / NotFoundException if the order does not belong to the user.
   */
  async getMyOrderDetail(userId: string, orderId: string) {
    const order = await this.prisma.orders.findUnique({
      where: { order_id: orderId },
      include: {
        users: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            user_addresses: true,
          },
        },
        order_items: true,
        inventory_reservations: true,
        order_status_history: {
          orderBy: { changed_at: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.user_id !== userId) {
      throw new ForbiddenException('You are not authorized to view this order.');
    }

    return order;
  }

  async getAllOrders() {
    return this.prisma.orders.findMany({
      include: {
        users: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            user_addresses: true,
          },
        },
        order_items: true,
        inventory_reservations: true,
        order_status_history: {
          orderBy: { changed_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Returns database-backed order counts for the admin summary cards.
   */
  async getAdminOrdersSummary() {
    const [needsApproval, approved, active, completed, rejected, expired] = await Promise.all([
      this.prisma.orders.count({
        where: { status: 'pending', approval_type: 'manual' },
      }),
      this.prisma.orders.count({
        where: { status: 'approved' },
      }),
      this.prisma.orders.count({
        where: { status: { in: ['pending', 'approved'] } },
      }),
      this.prisma.orders.count({
        where: { status: 'completed' },
      }),
      this.prisma.orders.count({
        where: { status: { in: ['rejected', 'cancelled'] } },
      }),
      this.prisma.inventory_reservations.count({
        where: { status: 'expired' },
      }),
    ]);

    return {
      needsApproval,
      approved,
      active,
      completed,
      rejected,
      expired,
    };
  }

  /**
   * Returns full order list enriched with OSPOS live physical stock, active reservation counts,
   * stock thresholds, and threshold remaining breakdowns for admin management.
   */
  async getAdminOrdersList(statusFilter?: string, search?: string) {
    const whereClause: any = {};
    if (statusFilter === 'NEEDS_APPROVAL') {
      whereClause.status = 'pending';
      whereClause.approval_type = 'manual';
    } else if (statusFilter === 'APPROVED') {
      whereClause.status = 'approved';
    } else if (statusFilter === 'ACTIVE') {
      whereClause.status = { in: ['pending', 'approved'] };
    } else if (statusFilter === 'COMPLETED') {
      whereClause.status = 'completed';
    } else if (statusFilter === 'REJECTED') {
      whereClause.status = { in: ['rejected', 'cancelled'] };
    } else if (statusFilter === 'EXPIRED') {
      whereClause.inventory_reservations = { some: { status: 'expired' } };
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      whereClause.OR = [
        { order_reference: { contains: q } },
        { users: { first_name: { contains: q } } },
        { users: { last_name: { contains: q } } },
        { users: { email: { contains: q } } },
        { users: { phone: { contains: q } } },
      ];
    }

    const [orders, allOsposItems, activeReservations] = await Promise.all([
      this.prisma.orders.findMany({
        where: whereClause,
        include: {
          users: {
            select: {
              user_id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone: true,
              user_addresses: true,
            },
          },
          order_items: true,
          inventory_reservations: true,
          order_status_history: {
            orderBy: { changed_at: 'desc' },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.osposService.fetchAllItems(),
      this.prisma.inventory_reservations.findMany({
        where: {
          status: 'active',
          expires_at: { gte: new Date() },
        },
        select: {
          ospos_item_id: true,
          quantity: true,
        },
      }),
    ]);

    const osposMap = new Map(allOsposItems.map((i) => [i.item_id, i]));

    const reservedMap = new Map<number, number>();
    for (const res of activeReservations) {
      reservedMap.set(
        res.ospos_item_id,
        (reservedMap.get(res.ospos_item_id) || 0) + res.quantity,
      );
    }

    const allOsposItemIdsInOrders = [
      ...new Set(orders.flatMap((o) => o.order_items.map((item) => item.ospos_item_id))),
    ];

    const localProducts = await this.prisma.products.findMany({
      where: { ospos_item_id: { in: allOsposItemIdsInOrders } },
      include: { stock_thresholds: true },
    });
    const thresholdMap = new Map(
      localProducts.map((p) => [p.ospos_item_id, p.stock_thresholds?.threshold_value ?? null]),
    );

    return orders.map((order) => {
      const enrichedItems = order.order_items.map((item) => {
        const osposItem = osposMap.get(item.ospos_item_id);
        const physicalStock = osposItem ? osposItem.quantity : 0;
        const activeReserved = reservedMap.get(item.ospos_item_id) || 0;
        const effectiveAvailable = Math.max(0, physicalStock - activeReserved);
        const threshold = thresholdMap.get(item.ospos_item_id);
        const remainingAfterOrder = effectiveAvailable - Number(item.quantity);
        const approvalRequired = threshold !== null ? remainingAfterOrder <= threshold : false;

        return {
          ...item,
          physicalStock,
          activeReserved,
          effectiveAvailable,
          threshold,
          remainingAfterOrder,
          approvalRequired,
        };
      });

      const hasApprovalTrigger = enrichedItems.some((i) => i.approvalRequired);

      return {
        ...order,
        order_items: enrichedItems,
        hasApprovalTrigger,
      };
    });
  }

  /**
   * Approves a showroom order sitting in pending state.
   * Updates order status to 'approved'. Reservation remains 'active' to keep stock reserved.
   */
  async approvePendingShowroomOrder(orderId: string, adminUserId?: string): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({
        where: { order_id: orderId },
        include: {
          order_items: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      if (order.status !== 'pending') {
        throw new BadRequestException(`Order cannot be approved from current state: ${order.status}`);
      }

      // Pessimistic row locking on products table for concurrency protection
      const itemIds = order.order_items.map((i) => i.ospos_item_id);
      const sortedItemIds = [...new Set(itemIds)].sort((a, b) => a - b);
      if (sortedItemIds.length > 0) {
        await tx.$queryRaw`
          SELECT product_id FROM products 
          WHERE ospos_item_id IN (${Prisma.join(sortedItemIds)}) 
          FOR UPDATE
        `;
      }

      // Update local database order status to 'approved'
      // Note: Reservation status remains 'active' until physical showroom purchase / reconciliation.
      const updatedOrder = await tx.orders.update({
        where: { order_id: order.order_id },
        data: {
          status: 'approved',
          confirmed_at: new Date(),
        },
        include: {
          order_items: true,
          inventory_reservations: true,
        },
      });

      // Record status history
      await tx.order_status_history.create({
        data: {
          history_id: crypto.randomUUID(),
          order_id: orderId,
          status: 'approved',
          changed_by: adminUserId || null,
          remarks: 'Order manually approved by administrator.',
        },
      });

      // Generate customer notification for manual order approval
      await this.notificationsService.createNotification(
        order.user_id,
        'Order Approved',
        `Your order ${order.order_reference} has been approved and your reserved stock is being held for showroom pickup.`,
        'order'
      );

      return updatedOrder;
    });
  }

  /**
   * Rejects an order with a mandatory rejection reason, releasing all active stock reservations to 'released'.
   */
  async rejectOrder(orderId: string, reason: string, adminUserId?: string): Promise<any> {
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('A valid rejection reason is required before rejecting an order.');
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({
        where: { order_id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      if (order.status === 'completed' || order.status === 'rejected' || order.status === 'cancelled') {
        throw new BadRequestException(`Order has already been finalized as ${order.status}`);
      }

      // Release associated active reservations
      await tx.inventory_reservations.updateMany({
        where: { order_id: orderId, status: 'active' },
        data: { status: 'released' as any },
      });

      const orderRecord = await tx.orders.update({
        where: { order_id: orderId },
        data: {
          status: 'rejected',
        },
        include: {
          order_items: true,
          inventory_reservations: true,
        },
      });

      // Log rejection reason in order_status_history for future customer notifications
      await tx.order_status_history.create({
        data: {
          history_id: crypto.randomUUID(),
          order_id: orderId,
          status: 'rejected',
          changed_by: adminUserId || null,
          remarks: reason.trim(),
        },
      });

      // Generate customer notification for order rejection
      await this.notificationsService.createNotification(
        order.user_id,
        'Order Rejected',
        `Your order ${order.order_reference} has been rejected. Reason: ${reason.trim()}`,
        'order'
      );

      return orderRecord;
    });

    // Decoupled execution: Cancel quote in OSPOS outside transaction
    try {
      await this.osposService.cancelQuote(updatedOrder.order_reference);
    } catch (error) {
      this.logger.warn(`Failed to cancel OSPOS quote for ${updatedOrder.order_reference}: ${error.message}`);
    }

    return updatedOrder;
  }

  /**
   * Cancels an order, releasing any active stock reservations.
   */
  async cancelOrder(orderId: string, adminUserId?: string): Promise<any> {
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({
        where: { order_id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      if (order.status === 'completed' || order.status === 'rejected' || order.status === 'cancelled') {
        throw new BadRequestException(`Order has already been finalized as ${order.status}`);
      }

      // Release associated active reservations
      await tx.inventory_reservations.updateMany({
        where: { order_id: orderId, status: 'active' },
        data: { status: 'released' as any },
      });

      const orderRecord = await tx.orders.update({
        where: { order_id: orderId },
        data: {
          status: 'cancelled',
        },
        include: {
          order_items: true,
          inventory_reservations: true,
        },
      });

      await tx.order_status_history.create({
        data: {
          history_id: crypto.randomUUID(),
          order_id: orderId,
          status: 'cancelled',
          changed_by: adminUserId || null,
          remarks: 'Order cancelled.',
        },
      });

      // Generate customer notification for order cancellation
      await this.notificationsService.createNotification(
        order.user_id,
        'Order Cancelled',
        `Your order ${order.order_reference} has been cancelled.`,
        'order'
      );

      return orderRecord;
    });

    // Decoupled execution: Cancel quote in OSPOS outside transaction
    try {
      await this.osposService.cancelQuote(updatedOrder.order_reference);
    } catch (error) {
      this.logger.warn(`Failed to cancel OSPOS quote for ${updatedOrder.order_reference}: ${error.message}`);
    }

    return updatedOrder;
  }

  /**
   * Processes incoming completion webhook events from OSPOS (tilevista.order.completed).
   * Idempotently transitions order status to 'completed' and inventory_reservations to 'completed'.
   * Does NOT deduct physical inventory.
   */
  async processOsposCompletionWebhook(payload: {
    event: string;
    reference: string;
    ospos_sale_id: number;
    completed_at?: string;
  }) {
    if (!payload || payload.event !== 'tilevista.order.completed') {
      throw new BadRequestException(`Invalid event type: ${payload?.event}`);
    }

    if (!payload.reference) {
      throw new BadRequestException('Order reference is required');
    }

    if (!payload.ospos_sale_id) {
      throw new BadRequestException('OSPOS sale ID is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({
        where: { order_reference: payload.reference },
        include: {
          inventory_reservations: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with reference ${payload.reference} not found`);
      }

      // Check stored ospos_sale_id if present
      if (order.ospos_sale_id && order.ospos_sale_id !== payload.ospos_sale_id) {
        throw new BadRequestException(
          `Mismatched OSPOS sale ID. Expected ${order.ospos_sale_id}, received ${payload.ospos_sale_id}`,
        );
      }

      // Cancelled/rejected/expired orders cannot be completed
      if (order.status === 'cancelled' || order.status === 'rejected') {
        throw new BadRequestException(`Order ${order.order_reference} is already ${order.status} and cannot be completed`);
      }

      // Idempotency check: if order is already completed
      const allReservationsCompleted = order.inventory_reservations.every((r) => r.status === 'completed');
      if (order.status === 'completed' && allReservationsCompleted) {
        this.logger.log(`Webhook received for already completed order ${order.order_reference}. Returning idempotent success.`);
        return {
          success: true,
          message: 'Order already completed (idempotent)',
          orderReference: order.order_reference,
          osposSaleId: payload.ospos_sale_id,
        };
      }

      const completedTimestamp = payload.completed_at ? new Date(payload.completed_at) : new Date();

      // Transition order status to 'completed' and set completed_at & ospos_sale_id
      const updatedOrder = await tx.orders.update({
        where: { order_id: order.order_id },
        data: {
          status: 'completed',
          completed_at: completedTimestamp,
          ospos_sale_id: payload.ospos_sale_id,
        },
        include: {
          order_items: true,
          inventory_reservations: true,
        },
      });

      // Transition active inventory reservations to 'completed'
      await tx.inventory_reservations.updateMany({
        where: {
          order_id: order.order_id,
          status: 'active',
        },
        data: {
          status: 'completed' as any,
        },
      });

      // Record in status history
      await tx.order_status_history.create({
        data: {
          history_id: crypto.randomUUID(),
          order_id: order.order_id,
          status: 'completed',
          remarks: `Completed via OSPOS POS showroom sale reconciliation (Sale #${payload.ospos_sale_id})`,
        },
      });

      // Notify customer
      await this.notificationsService.createNotification(
        order.user_id,
        'Purchase Completed',
        `Your showroom order ${order.order_reference} purchase has been completed at the Matara POS counter.`,
        'order',
      );

      this.logger.log(`Successfully completed order ${order.order_reference} via OSPOS webhook reconciliation.`);

      return {
        success: true,
        message: 'TileVista order finalized successfully',
        orderReference: order.order_reference,
        osposSaleId: payload.ospos_sale_id,
      };
    });
  }
}
