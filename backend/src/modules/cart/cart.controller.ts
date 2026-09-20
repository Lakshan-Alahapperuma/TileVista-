import { Controller, Get, Post, Delete, Patch, Body, Param } from '@nestjs/common';
import { CartService } from './cart.service';

@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @Get(':sessionId')
  async getCart(@Param('sessionId') sessionId: string) {
    return this.cartService.getCart(sessionId);
  }

  @Post(':sessionId')
  async add(@Param('sessionId') sessionId: string, @Body() body: { osposItemId: number; quantity: number }) {
    return this.cartService.addToCart(sessionId, Number(body.osposItemId), body.quantity);
  }

  @Patch(':sessionId/:osposItemId')
  async updateQuantity(
    @Param('sessionId') sessionId: string,
    @Param('osposItemId') osposItemId: string,
    @Body() body: { quantity: number }
  ) {
    return this.cartService.updateQuantity(sessionId, Number(osposItemId), body.quantity);
  }

  @Delete(':sessionId/:osposItemId')
  async remove(@Param('sessionId') sessionId: string, @Param('osposItemId') osposItemId: string) {
    return this.cartService.removeFromCart(sessionId, Number(osposItemId));
  }

  @Delete(':sessionId')
  async clearCart(@Param('sessionId') sessionId: string) {
    return this.cartService.clearCart(sessionId);
  }
}
