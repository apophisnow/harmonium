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
  frequentEmoji: string[];
  // Privacy settings (only on full User, not PublicUser, along with frequentEmoji)
  allowDmsFromServerMembers: boolean;
  friendRequestFromEveryone: boolean;
  friendRequestFromFof: boolean;
  friendRequestFromServerMembers: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

// User without sensitive fields (for public display)
// frequentEmoji is included as optional — present on own profile, absent on other users
export type PublicUser = Omit<User, 'email' | 'frequentEmoji' | 'allowDmsFromServerMembers' | 'friendRequestFromEveryone' | 'friendRequestFromFof' | 'friendRequestFromServerMembers'> & {
  frequentEmoji?: string[];
};

export interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  avatarUrl: string | null;
  aboutMe: string | null;
  status: UserStatus;
  customStatus: string | null;
}
