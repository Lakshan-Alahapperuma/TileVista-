import { Controller, Get, Patch, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMyProfile(@Req() req: any) {
    return this.usersService.findOne(req.user.id);
  }

  @Patch('me')
  async updateMyProfile(
    @Req() req: any,
    @Body() body: { firstName?: string; lastName?: string; phone?: string }
  ) {
    return this.usersService.updateProfile(req.user.id, body);
  }

  @Post('me/change-password')
  async changeMyPassword(
    @Req() req: any,
    @Body() body: { currentPassword: string; newPassword: string }
  ) {
    return this.usersService.changePassword(req.user.id, body.currentPassword, body.newPassword);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ADMINISTRATOR')
  async getAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}

