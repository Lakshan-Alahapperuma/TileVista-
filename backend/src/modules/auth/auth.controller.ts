import { Controller, Post, Body, UnauthorizedException, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto & { sessionId?: string }) {
    const password = body.password || body.pass;
    if (!password) {
      throw new UnauthorizedException('Password is required');
    }
    const user = await this.authService.validateUser(body.email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const result = await this.authService.login(user);
    if (body.sessionId) {
      await this.authService.linkCart(user.id, body.sessionId);
    }
    return result;
  }

  @Post('register')
  async register(@Body() body: RegisterDto & { sessionId?: string }) {
    const result = await this.authService.register(body);
    if (body.sessionId && result.user) {
      await this.authService.linkCart(result.user.id, body.sessionId);
    }
    return result;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}


