import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/services/mail.service';
import { config } from '../../config';
import * as bcrypt from 'bcrypt';
import { users_role, users_status } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}


  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.users.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (user) {
      let isMatch = false;
      try {
        isMatch = await bcrypt.compare(pass, user.password_hash);
      } catch (err) {
        isMatch = false;
      }
      if (!isMatch) {
        // Fallback for development database seed raw passwords
        isMatch = pass === user.password_hash;
      }
      if (isMatch) {
        const { password_hash, ...result } = user;
        return {
          id: user.user_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone ?? null,
          role: user.role.toUpperCase(), // Normalize role to uppercase ('CUSTOMER' / 'ADMIN')
          status: user.status ?? 'ACTIVE',
        };
      }
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    };
  }

  async register(dto: RegisterDto) {
    const { email, password, pass, firstName, first_name, lastName, last_name, phone, role, status } = dto;
    
    const resolvedPassword = password || pass;
    if (!resolvedPassword) {
      throw new BadRequestException('Password is required');
    }

    const emailLower = email.toLowerCase();
    const exists = await this.prisma.users.findUnique({
      where: { email: emailLower },
    });
    if (exists) {
      throw new BadRequestException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(resolvedPassword, 10);
    const resolvedFirstName = firstName || first_name || '';
    const resolvedLastName = lastName || last_name || '';

    let resolvedRole: users_role = users_role.customer;
    if (role) {
      const lowerRole = role.toLowerCase();
      if (lowerRole === 'admin' || lowerRole === 'administrator') {
        resolvedRole = users_role.admin;
      }
    }

    let resolvedStatus: users_status = users_status.active;
    if (status) {
      const lowerStatus = status.toLowerCase();
      if (lowerStatus === 'inactive') {
        resolvedStatus = users_status.inactive;
      }
    }

    const user = await this.prisma.users.create({
      data: {
        user_id: randomUUID(),
        email: emailLower,
        password_hash: hashedPassword,
        first_name: resolvedFirstName,
        last_name: resolvedLastName,
        phone: phone || null,
        role: resolvedRole,
        status: resolvedStatus,
      },
    });

    const result = {
      id: user.user_id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role.toUpperCase(),
    };
    return this.login(result);
  }

  async linkCart(userId: string, sessionId: string) {
    if (!sessionId || !userId) return;
    try {
      const guestCart = await this.prisma.carts.findFirst({
        where: { session_id: sessionId, user_id: null, status: 'active' },
        include: { cart_items: true },
      });

      if (!guestCart) {
        // Detach session_id if lingering on any other cart
        await this.prisma.carts.updateMany({
          where: { session_id: sessionId },
          data: { session_id: null },
        });
        return;
      }

      const userCart = await this.prisma.carts.findFirst({
        where: { user_id: userId, status: 'active' },
        include: { cart_items: true },
        orderBy: { updated_at: 'desc' },
      });

      if (!userCart) {
        await this.prisma.carts.update({
          where: { cart_id: guestCart.cart_id },
          data: { user_id: userId, session_id: null },
        });
      } else {
        for (const gItem of guestCart.cart_items) {
          const existing = userCart.cart_items.find(
            (uItem) => uItem.ospos_item_id === gItem.ospos_item_id,
          );
          if (existing) {
            await this.prisma.cart_items.update({
              where: { cart_item_id: existing.cart_item_id },
              data: { quantity: existing.quantity + gItem.quantity },
            });
          } else {
            await this.prisma.cart_items.create({
              data: {
                cart_item_id: randomUUID(),
                cart_id: userCart.cart_id,
                ospos_item_id: gItem.ospos_item_id,
                quantity: gItem.quantity,
                unit_price_snapshot: gItem.unit_price_snapshot,
              },
            });
          }
        }
        await this.prisma.carts.update({
          where: { cart_id: guestCart.cart_id },
          data: { status: 'converted', session_id: null },
        });
      }
    } catch (err) {
      console.error('Failed to link cart to user:', err);
    }
  }

  async forgotPassword(email: string) {
    const emailLower = email.toLowerCase().trim();
    const user = await this.prisma.users.findUnique({
      where: { email: emailLower },
    });

    if (!user) {
      return { message: 'If an account exists with that email, a password reset link has been sent.' };
    }

    const payload = { sub: user.user_id, email: user.email, type: 'password_reset' };
    const resetToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    const resetLink = `${config.frontendUrl}/reset-password?token=${resetToken}`;
    await this.mailService.sendPasswordResetEmail(user.email, resetLink, user.first_name);

    return { message: 'If an account exists with that email, a password reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch (err) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    if (!payload || payload.type !== 'password_reset' || !payload.sub) {
      throw new BadRequestException('Invalid password reset token.');
    }

    const user = await this.prisma.users.findUnique({
      where: { user_id: payload.sub },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.users.update({
      where: { user_id: user.user_id },
      data: { password_hash: hashedPassword },
    });

    return { message: 'Password has been successfully reset. You can now log in with your new password.' };
  }
}


