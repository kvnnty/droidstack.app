import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UsersService, type UserProfile } from './users.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: User): Promise<UserProfile> {
    return this.usersService.getProfile(user);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: User,
    @Body() body: { displayName?: string; avatarUrl?: string },
  ): Promise<UserProfile> {
    return this.usersService.updateProfile(user.id, {
      displayName: body.displayName,
      avatarUrl: body.avatarUrl,
    });
  }
}
