import { Injectable, BadRequestException } from '@nestjs/common';
import { OsposIntegrationService } from '../integrations/ospos/ospos.service';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CartService {
  constructor(
    private readonly osposService: OsposIntegrationService,
    private readonly prisma: PrismaService,
  ) {}

  private async mergeGuestCartIfNeeded(sessionId: string, userId: string) {
    if (!sessionId || !userId) return;

    const guestCart = await this.prisma.carts.findFirst({
      where: { session_id: sessionId, user_id: null, status: 'active' },
      include: { cart_items: true },
    });

    // Only merge if active guest cart exists with user_id == null and contains items
    if (!guestCart || guestCart.cart_items.length === 0) {
      return;
    }

    const userCart = await this.prisma.carts.findFirst({
      where: { user_id: userId, status: 'active' },
      include: { cart_items: true },
      orderBy: { updated_at: 'desc' },
    });

    // Scenario A: Customer has NO active user cart -> convert guest cart to user cart & clear session_id
    if (!userCart) {
      await this.prisma.carts.update({
        where: { cart_id: guestCart.cart_id },
        data: { user_id: userId, session_id: null, status: 'active' },
      });
      return;
    }

    // Scenario B: Customer ALREADY has an active user cart -> merge guest items into user cart
    const allOsposItems = await this.osposService.fetchAllItems();
    const osposItemMap = new Map(allOsposItems.map((i) => [i.item_id, i]));

    const osposItemIds = [...new Set([
      ...guestCart.cart_items.map((i) => i.ospos_item_id),
      ...userCart.cart_items.map((i) => i.ospos_item_id),
    ])];

    const activeReservations = await this.prisma.inventory_reservations.findMany({
      where: {
        ospos_item_id: { in: osposItemIds },
        status: 'active',
        expires_at: { gte: new Date() },
      },
    });

    const reservedMap = new Map<number, number>();
    for (const res of activeReservations) {
      reservedMap.set(res.ospos_item_id, (reservedMap.get(res.ospos_item_id) || 0) + res.quantity);
    }

    for (const guestItem of guestCart.cart_items) {
      const osposItem = osposItemMap.get(guestItem.ospos_item_id);
      const physicalStock = osposItem ? osposItem.quantity : 0;
      const reservedQty = reservedMap.get(guestItem.ospos_item_id) || 0;
      const effectiveAvailable = Math.max(0, physicalStock - reservedQty);

      const existingUserItem = userCart.cart_items.find(
        (ui) => ui.ospos_item_id === guestItem.ospos_item_id
      );

      const currentQty = existingUserItem ? existingUserItem.quantity : 0;
      const desiredQty = currentQty + guestItem.quantity;
      const finalQty = Math.min(desiredQty, effectiveAvailable);

      if (existingUserItem) {
        if (finalQty > 0) {
          await this.prisma.cart_items.update({
            where: { cart_item_id: existingUserItem.cart_item_id },
            data: { quantity: finalQty },
          });
        }
      } else {
        if (finalQty > 0) {
          await this.prisma.cart_items.create({
            data: {
              cart_item_id: uuidv4(),
              cart_id: userCart.cart_id,
              ospos_item_id: guestItem.ospos_item_id,
              quantity: finalQty,
              unit_price_snapshot: guestItem.unit_price_snapshot,
            },
          });
        }
      }
    }

    // Mark guest cart as converted and detach guest session_id
    await this.prisma.carts.update({
      where: { cart_id: guestCart.cart_id },
      data: { status: 'converted', session_id: null },
    });
  }

  private async getOrCreateCart(sessionId: string, userId?: string) {
    if (userId) {
      if (sessionId) {
        await this.mergeGuestCartIfNeeded(sessionId, userId);
      }

      let userCart = await this.prisma.carts.findFirst({
        where: { user_id: userId, status: 'active' },
        orderBy: { updated_at: 'desc' },
      });

      if (!userCart) {
        userCart = await this.prisma.carts.create({
          data: {
            cart_id: uuidv4(),
            user_id: userId,
            session_id: null,
            status: 'active',
          },
        });
      }
      return userCart;
    }

    // Unauthenticated guest flow ΓÇö strictly requires user_id: null
    let guestCart = await this.prisma.carts.findFirst({
      where: { session_id: sessionId, user_id: null, status: 'active' },
    });

    if (!guestCart) {
      guestCart = await this.prisma.carts.create({
        data: {
          cart_id: uuidv4(),
          session_id: sessionId,
          user_id: null,
          status: 'active',
        },
      });
    }
    return guestCart;
  }

  async getCart(sessionId: string, userId?: string) {
    if (userId && sessionId) {
      await this.mergeGuestCartIfNeeded(sessionId, userId);
    }

    let cart = null;
    if (userId) {
      cart = await this.prisma.carts.findFirst({
        where: { user_id: userId, status: 'active' },
        include: { cart_items: true },
        orderBy: { updated_at: 'desc' },
      });
    } else if (sessionId) {
      // Unauthenticated guest lookup: MUST NOT return customer-owned cart
      cart = await this.prisma.carts.findFirst({
        where: { session_id: sessionId, user_id: null, status: 'active' },
        include: { cart_items: true },
      });
    }

    const items = cart?.cart_items || [];
    if (items.length === 0) return [];

    // Fetch all OSPOS items in one call to avoid N+1
    const allOsposItems = await this.osposService.fetchAllItems();
    const osposItemMap = new Map(allOsposItems.map((i) => [i.item_id, i]));

    // Pre-fetch all local products to check visibility gate
    const localProducts = await this.prisma.products.findMany({
      where: { ospos_item_id: { in: items.map(i => i.ospos_item_id) } },
      include: { product_assets: true }
    });
    const localProductMap = new Map(localProducts.map(p => [p.ospos_item_id, p]));

    return items
      .map((item) => {
        const osposItem = osposItemMap.get(item.ospos_item_id);
        const localProduct = localProductMap.get(item.ospos_item_id);
        const hasAssetEntry = !!localProduct?.product_assets;
        const isVisible = localProduct?.product_assets?.is_visible ?? localProduct?.is_active ?? true;
        
        if (!osposItem || !localProduct || !hasAssetEntry || !isVisible) {
          return {
            osposItemId: item.ospos_item_id,
            item: {
              ...(osposItem ?? { name: 'Unknown Item', price: 0, item_id: item.ospos_item_id, category: '', sku: '' }),
              imageUrl: localProduct?.product_assets?.image_url ?? null,
            },
            quantity: item.quantity,
            lineTotal: 0,
            isAvailable: false,
          };
        }

        return {
          osposItemId: item.ospos_item_id,
          item: {
            ...osposItem,
            imageUrl: localProduct?.product_assets?.image_url ?? null,
          },
          quantity: item.quantity,
          lineTotal: osposItem.price * item.quantity,
          isAvailable: true,
        };
      })
      .filter(Boolean);
  }

  async addToCart(sessionId: string, osposItemId: number, quantity: number, userId?: string) {
    const allItems = await this.osposService.fetchAllItems();
    const osposItem = allItems.find((i) => i.item_id === osposItemId);

    if (!osposItem) {
      throw new BadRequestException(`Item not available.`);
    }

    const localProduct = await this.prisma.products.findUnique({
      where: { ospos_item_id: osposItemId },
      include: { product_assets: true }
    });
    
    const hasAssetEntry = !!localProduct?.product_assets;
    const isVisible = localProduct?.product_assets?.is_visible ?? localProduct?.is_active ?? true;
    if (!localProduct || !hasAssetEntry || !isVisible) {
      throw new BadRequestException(`Item not available.`);
    }

    const cart = await this.getOrCreateCart(sessionId, userId);

    const existingItem = await this.prisma.cart_items.findFirst({
      where: { cart_id: cart.cart_id, ospos_item_id: osposItemId },
    });

    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newQuantity = currentQuantity + quantity;

    const activeReservations = await this.prisma.inventory_reservations.aggregate({
      _sum: { quantity: true },
      where: {
        ospos_item_id: osposItemId,
        status: 'active',
        expires_at: { gte: new Date() },
      },
    });

    const reservedQuantity = activeReservations._sum.quantity || 0;
    const effectiveAvailable = Math.max(0, osposItem.quantity - reservedQuantity);

    if (effectiveAvailable < newQuantity) {
      throw new BadRequestException(
        `Insufficient available stock for "${osposItem.name}". Available to order: ${effectiveAvailable}.`,
      );
    }

    if (existingItem) {
      await this.prisma.cart_items.update({
        where: { cart_item_id: existingItem.cart_item_id },
        data: { quantity: newQuantity },
      });
    } else {
      await this.prisma.cart_items.create({
        data: {
          cart_item_id: uuidv4(),
          cart_id: cart.cart_id,
          ospos_item_id: osposItemId,
          quantity: newQuantity,
          unit_price_snapshot: osposItem.price,
        },
      });
    }

    return this.getCart(sessionId, userId);
  }

  async updateQuantity(sessionId: string, osposItemId: number, quantity: number, userId?: string) {
    if (quantity < 1) {
      return this.removeFromCart(sessionId, osposItemId, userId);
    }

    const cart = await this.getOrCreateCart(sessionId, userId);

    const existingItem = await this.prisma.cart_items.findFirst({
      where: { cart_id: cart.cart_id, ospos_item_id: osposItemId },
    });

    if (!existingItem) {
      throw new BadRequestException('Item not found in cart');
    }

    const allItems = await this.osposService.fetchAllItems();
    const osposItem = allItems.find((i) => i.item_id === osposItemId);

    if (!osposItem || osposItem.quantity < quantity) {
      throw new BadRequestException(
        `Insufficient stock for "${osposItem?.name || 'Item'}". Available: ${osposItem?.quantity || 0}.`,
      );
    }

    await this.prisma.cart_items.update({
      where: { cart_item_id: existingItem.cart_item_id },
      data: { quantity },
    });

    return this.getCart(sessionId, userId);
  }

  async removeFromCart(sessionId: string, osposItemId: number, userId?: string) {
    const cart = await this.getOrCreateCart(sessionId, userId);

    const existingItem = await this.prisma.cart_items.findFirst({
      where: { cart_id: cart.cart_id, ospos_item_id: osposItemId },
    });

    if (existingItem) {
      await this.prisma.cart_items.delete({
        where: { cart_item_id: existingItem.cart_item_id },
      });
    }

    return this.getCart(sessionId, userId);
  }

  async clearCart(sessionId: string, userId?: string) {
    let cart = null;
    if (userId) {
      cart = await this.prisma.carts.findFirst({
        where: { user_id: userId, status: 'active' },
        orderBy: { updated_at: 'desc' },
      });
    } else if (sessionId) {
      cart = await this.prisma.carts.findFirst({
        where: { session_id: sessionId, user_id: null, status: 'active' },
      });
    }

    if (cart) {
      await this.prisma.cart_items.deleteMany({
        where: { cart_id: cart.cart_id },
      });
    }
  }
}


