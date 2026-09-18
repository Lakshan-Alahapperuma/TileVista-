import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all notifications belonging strictly to the authenticated customer.
   */
  async getUserNotifications(userId: string) {
    return this.prisma.notifications.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  /**
   * Returns the count of unread notifications for the authenticated customer.
   */
  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.prisma.notifications.count({
      where: {
        user_id: userId,
        is_read: false,
      },
    });
    return { unreadCount };
  }

  /**
   * Marks a specific notification as read, ensuring ownership verification.
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notifications.findUnique({
      where: { notification_id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (notification.user_id !== userId) {
      throw new ForbiddenException('You are not authorized to access this notification.');
    }

    return this.prisma.notifications.update({
      where: { notification_id: notificationId },
      data: { is_read: true },
    });
  }

  /**
   * Marks all notifications belonging to the authenticated customer as read.
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notifications.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true },
    });
    return { success: true };
  }

  /**
   * Helper method to generate customer notifications automatically on order events.
   */
  async createNotification(userId: string, title: string, message: string, type: string = 'order') {
    return this.prisma.notifications.create({
      data: {
        notification_id: uuidv4(),
        user_id: userId,
        title,
        message,
        type,
        is_read: false,
      },
    });
  }

  /**
   * Helper method to dispatch persistent notifications to all active administrator accounts.
   */
  async notifyAdmins(title: string, message: string, type: string = 'admin') {
    const admins = await this.prisma.users.findMany({
      where: { role: 'admin' },
      select: { user_id: true },
    });

    if (admins.length === 0) return [];

    const records = await Promise.all(
      admins.map((admin) =>
        this.prisma.notifications.create({
          data: {
            notification_id: uuidv4(),
            user_id: admin.user_id,
            title,
            message,
            type,
            is_read: false,
          },
        }),
      ),
    );

    return records;
  }

  /**
   * Dispatches notifications to all admin accounts only if no existing notification matching
   * the deduplication key exists for the admin user.
   */
  async notifyAdminsDeduplicated(
    title: string,
    message: string,
    type: string,
    deduplicationKey: string,
  ) {
    const admins = await this.prisma.users.findMany({
      where: { role: 'admin' },
      select: { user_id: true },
    });

    if (admins.length === 0) return [];

    const records = [];
    for (const admin of admins) {
      const existing = await this.prisma.notifications.findFirst({
        where: {
          user_id: admin.user_id,
          type,
          message: { contains: deduplicationKey },
        },
      });

      if (!existing) {
        const created = await this.prisma.notifications.create({
          data: {
            notification_id: uuidv4(),
            user_id: admin.user_id,
            title,
            message,
            type,
            is_read: false,
          },
        });
        records.push(created);
      }
    }

    return records;
  }

  /**
   * Queries the most recent stock alert notification ('low_stock', 'out_of_stock', 'stock_recovered')
   * for a given OSPOS item ID across admin notifications to evaluate stock threshold state transitions.
   */
  async getLatestStockNotificationForProduct(osposItemId: number) {
    const itemKey = `[Item: ${osposItemId}]`;
    return this.prisma.notifications.findFirst({
      where: {
        type: { in: ['low_stock', 'out_of_stock', 'stock_recovered'] },
        message: { contains: itemKey },
      },
      orderBy: { created_at: 'desc' },
    });
  }
}

