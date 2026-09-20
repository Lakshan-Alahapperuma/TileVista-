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

  private async getOrCreateCart(sessionId: string) {
    let cart = await this.prisma.carts.findUnique({
      where: { session_id: sessionId },
    });

    if (!cart) {
      cart = await this.prisma.carts.create({
        data: {
          cart_id: uuidv4(),
          session_id: sessionId,
        },
      });
    }
    return cart;
  }

  async getCart(sessionId: string) {
    const cart = await this.prisma.carts.findUnique({
      where: { session_id: sessionId },
      include: { cart_items: true },
    });

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

  async addToCart(sessionId: string, osposItemId: number, quantity: number) {
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

    const cart = await this.getOrCreateCart(sessionId);

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

    return this.getCart(sessionId);
  }

  async updateQuantity(sessionId: string, osposItemId: number, quantity: number) {
    if (quantity < 1) {
      return this.removeFromCart(sessionId, osposItemId);
    }

    const cart = await this.prisma.carts.findUnique({
      where: { session_id: sessionId },
    });
    
    if (!cart) throw new BadRequestException('Cart not found');

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

    return this.getCart(sessionId);
  }

  async removeFromCart(sessionId: string, osposItemId: number) {
    const cart = await this.prisma.carts.findUnique({
      where: { session_id: sessionId },
    });
    
    if (!cart) return this.getCart(sessionId);

    const existingItem = await this.prisma.cart_items.findFirst({
      where: { cart_id: cart.cart_id, ospos_item_id: osposItemId },
    });

    if (existingItem) {
      await this.prisma.cart_items.delete({
        where: { cart_item_id: existingItem.cart_item_id },
      });
    }

    return this.getCart(sessionId);
  }

  async clearCart(sessionId: string) {
    const cart = await this.prisma.carts.findUnique({
      where: { session_id: sessionId },
    });
    
    if (cart) {
      await this.prisma.cart_items.deleteMany({
        where: { cart_id: cart.cart_id },
      });
    }
  }
}
