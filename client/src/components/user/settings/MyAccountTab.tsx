import { useState, useRef, useEffect } from 'react';
import { LoadingSpinner } from '../../shared/LoadingSpinner.js';
import { UserAvatar } from '../UserAvatar.js';
import { useAuthStore } from '../../../stores/auth.store.js';
import { useToastStore } from '../../../stores/toast.store.js';
import { updateProfile, uploadAvatar, changePassword } from '../../../api/users.js';

export function MyAccountTab() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const addToast = useToastStore((s) => s.addToast);

  const [username, setUsername] = useState('');
  const [aboutMe, setAboutMe] = useState('');
  const [customStatus, setCustomStatus] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setAboutMe(user.aboutMe ?? '');
      setCustomStatus(user.customStatus ?? '');
      setAvatarFile(null);
      setAvatarPreview(null);
      setCurrentPassword('');
      setNewPassword('');
      setProfileError('');
      setPasswordError('');
    }
  }, [user?.id]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please select an image file.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setProfileError('Image must be smaller than 8MB.');
      return;
    }

    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setProfileError('');
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSavingProfile(true);
    setProfileError('');

    try {
      const profileChanged =
        username.trim() !== user.username ||
        (aboutMe.trim() || null) !== (user.aboutMe ?? null) ||
        (customStatus.trim() || null) !== (user.customStatus ?? null);

      let updatedUser = user;

      if (avatarFile) {
        updatedUser = await uploadAvatar(avatarFile);
        setAvatarFile(null);
        if (avatarPreview) {
          URL.revokeObjectURL(avatarPreview);
          setAvatarPreview(null);
        }
      }

      if (profileChanged) {
        updatedUser = await updateProfile({
          username: username.trim(),
          aboutMe: aboutMe.trim() || null,
          customStatus: customStatus.trim() || null,
        });
      }

      if (avatarFile || profileChanged) {
        setUser(updatedUser);
        addToast('success', 'Profile updated successfully.');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update profile.';
      setProfileError(message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    setIsChangingPassword(true);

    try {
      await changePassword(currentPassword, newPassword);
      addToast('success', 'Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to change password.';
      setPasswordError(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const displayAvatarUrl = avatarPreview ?? user?.avatarUrl;

  if (!user) {
    return <p className="text-th-text-secondary">Not logged in.</p>;
  }

  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-th-text-primary">My Account</h2>

      <div className="space-y-5">
        {/* Avatar Section */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleAvatarClick}
            className="group relative cursor-pointer flex-shrink-0"
            title="Change avatar"
          >
            {displayAvatarUrl ? (
              <img
                src={displayAvatarUrl}
                alt={user.username}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <UserAvatar username={user.username} size={80} showStatus={false} />
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          <div>
            <p className="text-lg font-semibold text-th-text-primary">{user.username}</p>
            <p className="text-sm text-th-text-secondary">#{user.discriminator}</p>
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase text-th-text-secondary">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded bg-th-bg-tertiary px-3 py-2 text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand"
            maxLength={32}
          />
        </div>

        {/* About Me */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase text-th-text-secondary">About Me</label>
          <textarea
            value={aboutMe}
            onChange={(e) => setAboutMe(e.target.value)}
            className="w-full resize-none rounded bg-th-bg-tertiary px-3 py-2 text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand"
            placeholder="Tell us about yourself"
            maxLength={2000}
            rows={3}
          />
          <p className="mt-1 text-right text-xs text-th-text-secondary">{aboutMe.length}/2000</p>
        </div>

        {/* Custom Status */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase text-th-text-secondary">Custom Status</label>
          <input
            type="text"
            value={customStatus}
            onChange={(e) => setCustomStatus(e.target.value)}
            className="w-full rounded bg-th-bg-tertiary px-3 py-2 text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand"
            placeholder="What are you up to?"
            maxLength={128}
          />
        </div>

        {profileError && <p className="text-sm text-th-red">{profileError}</p>}

        <button
          onClick={handleSaveProfile}
          disabled={isSavingProfile || !username.trim()}
          className="flex items-center gap-2 rounded bg-th-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSavingProfile && <LoadingSpinner size={14} />}
          Save Changes
        </button>

        {/* Password Change Section */}
        <div className="border-t border-th-border pt-5">
          <h3 className="mb-4 text-sm font-bold uppercase text-th-text-secondary">Change Password</h3>
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-th-text-secondary">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded bg-th-bg-tertiary px-3 py-2 text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase text-th-text-secondary">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded bg-th-bg-tertiary px-3 py-2 text-th-text-primary placeholder-th-text-muted outline-none focus:ring-2 focus:ring-th-brand"
                placeholder="Min. 8 characters"
              />
            </div>
            {passwordError && <p className="text-sm text-th-red">{passwordError}</p>}
            <button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !currentPassword || !newPassword}
              className="flex items-center gap-2 rounded bg-th-bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-th-bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isChangingPassword && <LoadingSpinner size={14} />}
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
