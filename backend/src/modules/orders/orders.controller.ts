import { Controller, Post, Get, Body, Param, UseGuards, Req, UnauthorizedException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post('webhook/ospos-completion')
  async handleOsposCompletionWebhook(
    @Req() req: any,
    @Body() body: { event: string; reference: string; ospos_sale_id: number; completed_at?: string }
  ) {
    const authHeader = req.headers['x-webhook-secret'] || req.headers['authorization'];
    const expectedSecret = process.env.POS_SYNC_WEBHOOK_SECRET || process.env.OSPOS_API_TOKEN;

    if (!authHeader || (authHeader !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`)) {
      throw new UnauthorizedException('Invalid webhook security credentials');
    }

    return this.ordersService.processOsposCompletionWebhook(body);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(
    @Req() req: any,
    @Body()
    body: {
      items: { osposItemId: number; quantity: number }[];
      shippingAddress?: string;
      paymentMethod?: string;
    }
  ) {
    return this.ordersService.createOrder(req.user.id, body);
  }

  @Post('process-expirations')
  @UseGuards(JwtAuthGuard)
  async processExpirations() {
    return this.ordersService.processExpiredReservations();
  }

  @Get('my-orders/summary')
  @UseGuards(JwtAuthGuard)
  async getMyOrdersSummary(@Req() req: any) {
    return this.ordersService.getMyOrdersSummary(req.user.id);
  }

  @Get('my-orders')
  @UseGuards(JwtAuthGuard)
  async getMyOrdersList(@Req() req: any) {
    const statusFilter = req.query?.status as string | undefined;
    const search = req.query?.search as string | undefined;
    return this.ordersService.getMyOrdersList(req.user.id, statusFilter, search);
  }

  @Get('my-orders/:orderId')
  @UseGuards(JwtAuthGuard)
  async getMyOrderDetail(@Req() req: any, @Param('orderId') orderId: string) {
    return this.ordersService.getMyOrderDetail(req.user.id, orderId);
  }

  @Get('admin/summary-counts')
  @UseGuards(JwtAuthGuard)
  async getAdminOrdersSummary() {
    return this.ordersService.getAdminOrdersSummary();
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard)
  async getAdminOrdersList(
    @Req() req: any,
  ) {
    const statusFilter = req.query?.status as string | undefined;
    const search = req.query?.search as string | undefined;
    return this.ordersService.getAdminOrdersList(statusFilter, search);
  }

  @Post('admin/:id/approve')
  @UseGuards(JwtAuthGuard)
  async approveOrder(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.ordersService.approvePendingShowroomOrder(id, req.user?.id);
  }

  @Post('admin/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.ordersService.rejectOrder(id, body.reason, req.user?.id);
  }

  @Get('customer/:userId')
  @UseGuards(JwtAuthGuard)
  async getCustomerOrders(@Param('userId') userId: string) {
    return this.ordersService.getCustomerOrders(userId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.ordersService.getOrder(id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAll() {
    return this.ordersService.getAllOrders();
  }
}
