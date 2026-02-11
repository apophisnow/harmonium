# Task 3: Frontend Scaffolding + Routing + Auth UI

## Objective
Build the authentication pages (login/register), API client with JWT interceptors, auth Zustand store, and set up the complete routing structure with auth guards.

## Dependencies
- Task 1 (project scaffolding) - COMPLETE

## Pre-existing Files to Read
- `client/package.json` - Dependencies
- `client/tsconfig.json` - TypeScript config
- `client/vite.config.ts` - Vite config with proxy
- `client/tailwind.config.ts` - Discord color palette defined
- `client/index.html` - HTML entry point
- `client/src/main.tsx` - React entry (exists)
- `client/src/App.tsx` - Router skeleton (exists, has placeholder routes)
- `client/src/styles/globals.css` - Base styles (exists)
- `packages/shared/src/types/user.ts` - User types

## Files to Create

### 1. `client/src/api/client.ts` - Axios HTTP Client
Create an axios instance with:
- Base URL: `/api` (proxied by Vite in dev, nginx in prod)
- Request interceptor: attach `Authorization: Bearer <token>` from auth store
- Response interceptor: on 401, attempt token refresh via `/api/auth/refresh`
  - If refresh succeeds, retry original request with new token
  - If refresh fails, clear auth state and redirect to /login
  - Use a queue to prevent multiple concurrent refresh attempts
- Content-Type: application/json

### 2. `client/src/api/auth.ts` - Auth API Functions
```typescript
export async function loginApi(email: string, password: string): Promise<AuthResponse>
export async function registerApi(username: string, email: string, password: string): Promise<AuthResponse>
export async function refreshTokenApi(refreshToken: string): Promise<AuthResponse>
export async function logoutApi(refreshToken: string): Promise<void>

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}
```

### 3. `client/src/stores/auth.store.ts` - Auth Zustand Store
```typescript
interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: PublicUser) => void;
  hydrate: () => void; // Load from localStorage on app start
}
```
- Store tokens in localStorage
- `hydrate()` called on app mount to restore session
- Login/register call API, store tokens + user
- Logout calls API, clears state + localStorage

### 4. `client/src/components/auth/LoginForm.tsx`
Discord-styled login form:
- Email and password fields
- "Login" button (discord brand color #5865f2)
- "Need an account? Register" link at bottom
- Form validation (email format, password not empty)
- Error display for invalid credentials
- Loading state on submit
- Dark theme matching Discord's login page aesthetic
- Centered card on dark background (#36393f card on #202225 bg)

### 5. `client/src/components/auth/RegisterForm.tsx`
Discord-styled register form:
- Username, email, password fields
- "Register" button
- "Already have an account? Login" link
- Validation: username 2-32 chars, valid email, password min 8 chars
- Same styling as login

### 6. `client/src/pages/LoginPage.tsx`
Full page wrapper for LoginForm. Centered layout with Discord-like branding.

### 7. `client/src/pages/RegisterPage.tsx`
Full page wrapper for RegisterForm.

### 8. `client/src/pages/NotFoundPage.tsx`
Simple 404 page with link back to home.

### 9. `client/src/components/shared/LoadingSpinner.tsx`
Simple SVG spinner component with configurable size.

### 10. `client/src/components/shared/Modal.tsx`
Reusable modal component:
- Dark overlay backdrop
- Centered content panel with dark background (#2f3136)
- Close button (X) in top right
- Click outside to close
- Escape key to close
- Portal-based (render into document.body)
- Props: isOpen, onClose, title, children

### 11. Update `client/src/App.tsx`
Replace placeholder routes with actual page components. Add:
- AuthGuard component that checks auth store, redirects to /login if not authenticated
- Wrap /channels/* routes in AuthGuard
- Redirect / to /channels/@me if authenticated, /login if not

### 12. `client/src/lib/formatters.ts`
Utility functions:
- `formatDate(iso: string): string` - format as "Today at 3:45 PM" or "01/15/2024"
- `formatFileSize(bytes: number): string` - "1.2 MB", "340 KB"
- `getInitials(name: string): string` - "JD" from "John Doe"

## Design Guidelines
- Background: #202225 (page bg), #36393f (card bg), #2f3136 (input bg)
- Text: #dcddde (primary), #96989d (secondary), #72767d (muted)
- Brand: #5865f2 (buttons), #4752c4 (hover)
- Inputs: #202225 bg, #dcddde text, 1px solid #040405 border, rounded
- Buttons: full width, #5865f2 bg, white text, rounded, hover #4752c4
- Font: system font stack (already in tailwind config)
- Card: max-w-md, rounded-lg, p-8, shadow

## Acceptance Criteria
- [ ] Login and Register pages render with styled forms
- [ ] Form validation shows errors inline
- [ ] Auth store manages token lifecycle (store, refresh, clear)
- [ ] API client attaches JWT and handles 401 refresh flow
- [ ] AuthGuard redirects unauthenticated users to /login
- [ ] Modal component works with portal, backdrop click, escape key
- [ ] All components pass TypeScript compilation
- [ ] Navigating to /login when already authenticated redirects to /channels/@me
