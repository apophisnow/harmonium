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
  // Privacy settings (only on full User, not PublicUser)
  allowDmsFromServerMembers: boolean;
  friendRequestFromEveryone: boolean;
  friendRequestFromFof: boolean;
  friendRequestFromServerMembers: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

// User without sensitive fields (for public display)
export type PublicUser = Omit<User, 'email' | 'allowDmsFromServerMembers' | 'friendRequestFromEveryone' | 'friendRequestFromFof' | 'friendRequestFromServerMembers'>;

export interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  avatarUrl: string | null;
  aboutMe: string | null;
  status: UserStatus;
  customStatus: string | null;
}
