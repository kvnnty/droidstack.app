import { Injectable } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';

/** User profile as returned by the API (matches @droidstack/shared User) */
export interface UserProfile {
  id: string;
  email: string;
  createdAt?: string;
  displayName?: string;
  avatarUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Build user profile from Supabase Auth user.
   * Optionally extends with public.profiles if that table exists.
   */
  async getProfile(authUser: User): Promise<UserProfile> {
    const profile: UserProfile = {
      id: authUser.id,
      email: authUser.email ?? '',
      createdAt: authUser.created_at,
      displayName:
        authUser.user_metadata?.full_name ??
        authUser.user_metadata?.name ??
        authUser.email?.split('@')[0],
      avatarUrl: authUser.user_metadata?.avatar_url ?? authUser.user_metadata?.picture,
    };

    // Optionally fetch from public.profiles for extended fields (if table exists)
    const { data: dbProfile } = await this.supabase
      .getClient()
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', authUser.id)
      .maybeSingle();

    if (dbProfile) {
      if (dbProfile.display_name) profile.displayName = dbProfile.display_name;
      if (dbProfile.avatar_url) profile.avatarUrl = dbProfile.avatar_url;
    }

    return profile;
  }

  /**
   * Update user profile in public.profiles.
   * Requires the profiles table (run supabase/migrations/..._profiles.sql).
   */
  async updateProfile(
    userId: string,
    updates: { displayName?: string; avatarUrl?: string },
  ): Promise<UserProfile> {
    const { error } = await this.supabase
      .getClient()
      .from('profiles')
      .upsert(
        {
          id: userId,
          display_name: updates.displayName,
          avatar_url: updates.avatarUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select()
      .single();

    if (error) {
      throw new Error(
        `Failed to update profile: ${error.message}. Ensure the profiles table exists.`,
      );
    }

    const { data: authData } = await this.supabase
      .getClient()
      .auth.admin.getUserById(userId);

    if (!authData?.user) {
      throw new Error('User not found');
    }

    return this.getProfile(authData.user);
  }
}
