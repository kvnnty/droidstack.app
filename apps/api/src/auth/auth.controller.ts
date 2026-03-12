import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import type { User } from '@supabase/supabase-js';

@Controller('auth')
export class AuthController {

  /**
   * Returns the current authenticated user.
   * Requires: Authorization: Bearer <access_token>
   *
   * The access token is obtained from the frontend after sign-in:
   * - Google: supabase.auth.signInWithOAuth({ provider: 'google' })
   * - User is redirected to Google, returns with session
   * - session.access_token is sent in Authorization header
   */
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async me(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email ?? undefined,
      email_verified: user.email_confirmed_at != null,
      created_at: user.created_at,
      user_metadata: user.user_metadata,
    };
  }
}
