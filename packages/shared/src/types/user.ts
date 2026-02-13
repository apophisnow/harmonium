export interface User {
  id: string;          // snowflake as string
  username: string;
  discriminator: string;
  email: string;
  avatarUrl: string | null;
  aboutMe: string | null;
  status: UserStatus;
  customStatus: string | null;
  theme?: string | null;
  mode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

// User without sensitive fields (for public display)
export type PublicUser = Omit<User, 'email'>;

export interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  avatarUrl: string | null;
  aboutMe: string | null;
  status: UserStatus;
  customStatus: string | null;
}
