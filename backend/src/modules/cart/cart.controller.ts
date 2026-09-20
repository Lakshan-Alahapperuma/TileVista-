import { Controller, Get, Post, Delete, Patch, Body, Param, Req, UseGuards, Injectable } from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      return null;
    }
    return user;
  }
}

@Controller('cart')
@UseGuards(OptionalJwtAuthGuard)
export class CartController {
  constructor(private cartService: CartService) {}

  @Get(':sessionId')
  async getCart(@Param('sessionId') sessionId: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.cartService.getCart(sessionId, userId);
  }

  @Post(':sessionId')
  async add(
    @Param('sessionId') sessionId: string,
    @Body() body: { osposItemId: number; quantity: number },
    @Req() req: any
  ) {
    const userId = req.user?.id;
    return this.cartService.addToCart(sessionId, Number(body.osposItemId), body.quantity, userId);
  }

  @Patch(':sessionId/:osposItemId')
  async updateQuantity(
    @Param('sessionId') sessionId: string,
    @Param('osposItemId') osposItemId: string,
    @Body() body: { quantity: number },
    @Req() req: any
  ) {
    const userId = req.user?.id;
    return this.cartService.updateQuantity(sessionId, Number(osposItemId), body.quantity, userId);
  }

  @Delete(':sessionId/:osposItemId')
  async remove(
    @Param('sessionId') sessionId: string,
    @Param('osposItemId') osposItemId: string,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    return this.cartService.removeFromCart(sessionId, Number(osposItemId), userId);
  }

  @Delete(':sessionId')
  async clearCart(@Param('sessionId') sessionId: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.cartService.clearCart(sessionId, userId);
  }
}

