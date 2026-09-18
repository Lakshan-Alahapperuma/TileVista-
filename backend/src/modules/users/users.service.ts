import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private mapUserResponse(user: any) {
    const { password_hash, ...result } = user;
    return {
      id: user.user_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role ? user.role.toUpperCase() : 'CUSTOMER',
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { user_id: id },
    });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    return this.mapUserResponse(user);
  }

  async findAll() {
    const dbUsers = await this.prisma.users.findMany();
    return dbUsers.map((user) => this.mapUserResponse(user));
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string }) {
    const user = await this.prisma.users.findUnique({ where: { user_id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.users.update({
      where: { user_id: userId },
      data: {
        ...(data.firstName !== undefined && { first_name: data.firstName }),
        ...(data.lastName !== undefined && { last_name: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
    });

    return this.mapUserResponse(updated);
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    const bcrypt = await import('bcrypt');
    const user = await this.prisma.users.findUnique({ where: { user_id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(currentPass, user.password_hash);
    } catch {
      isMatch = false;
    }
    if (!isMatch && currentPass === user.password_hash) {
      isMatch = true;
    }

    if (!isMatch) {
      throw new (await import('@nestjs/common')).BadRequestException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPass, 10);
    await this.prisma.users.update({
      where: { user_id: userId },
      data: { password_hash: newHash },
    });

    return { success: true, message: 'Password updated successfully' };
  }
}
