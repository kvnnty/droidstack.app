import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Verifies the JWT (access token) and returns the Supabase user.
   * Use this for server-side auth. The token comes from the frontend
   * after sign-in (e.g. via signInWithOAuth for Google).
   */
  async getUserFromToken(token: string): Promise<User> {
    const {
      data: { user },
      error,
    } = await this.supabase.getClient().auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException(error?.message ?? 'Invalid or expired token');
    }

    return user;
  }
}
