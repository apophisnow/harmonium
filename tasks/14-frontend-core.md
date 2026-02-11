# Task 14: Frontend Core (Servers, Channels, Chat, WebSocket)

## Objective
Build the main Discord-like UI: server sidebar (vertical icon list), channel sidebar (channel list within a server), message area with infinite scroll, message input, member sidebar, and real-time WebSocket integration. This is the largest frontend task.

## Dependencies
- Task 3 (frontend scaffolding, auth UI, API client, auth store)

## Pre-existing Files to Read
- `client/src/App.tsx` - Router setup
- `client/src/api/client.ts` - Axios instance with JWT
- `client/src/stores/auth.store.ts` - Auth state
- `client/src/components/shared/Modal.tsx` - Reusable modal
- `client/src/components/shared/LoadingSpinner.tsx` - Spinner
- `client/src/lib/formatters.ts` - Date, file size formatters
- `client/tailwind.config.ts` - Discord color palette
- `packages/shared/src/types/*.ts` - All shared types
- `packages/shared/src/ws-events.ts` - WebSocket event types
- `packages/shared/src/permissions.ts` - Permission flags

## Files to Create

### API Layer
- `client/src/api/servers.ts` - Server API calls (list, create, update, delete, list members)
- `client/src/api/channels.ts` - Channel API calls (list, create, update, delete)
- `client/src/api/messages.ts` - Message API calls (list paginated, send, edit, delete)
- `client/src/api/roles.ts` - Role API calls (list)
- `client/src/api/invites.ts` - Invite API calls (create, accept, get info)
- `client/src/api/users.ts` - User API calls (get profile, update profile)

### Zustand Stores
- `client/src/stores/server.store.ts`:
  - State: servers Map<id, Server>, currentServerId
  - Actions: fetchServers, setCurrentServer, addServer, removeServer, updateServer

- `client/src/stores/channel.store.ts`:
  - State: channels Map<serverId, Channel[]>, currentChannelId
  - Actions: fetchChannels(serverId), setCurrentChannel, addChannel, removeChannel, updateChannel

- `client/src/stores/message.store.ts`:
  - State: messages Map<channelId, Message[]>, hasMore Map<channelId, boolean>
  - Actions: fetchMessages(channelId, before?), addMessage, updateMessage, deleteMessage, prependMessages

- `client/src/stores/member.store.ts`:
  - State: members Map<serverId, ServerMember[]>
  - Actions: fetchMembers(serverId), addMember, removeMember

- `client/src/stores/presence.store.ts`:
  - State: presences Map<userId, UserStatus>
  - Actions: setPresence, bulkSetPresence

- `client/src/stores/ui.store.ts`:
  - State: showMemberSidebar, activeModal, contextMenu
  - Actions: toggleMemberSidebar, openModal, closeModal, showContextMenu, hideContextMenu

### Hooks
- `client/src/hooks/useWebSocket.ts`:
  - Connects to `/ws/gateway` on mount
  - Handles IDENTIFY, HEARTBEAT, reconnection with exponential backoff
  - Dispatches events to appropriate stores (MESSAGE_CREATE -> message store, etc.)
  - Returns: { isConnected, sendEvent }

- `client/src/hooks/usePermissions.ts`:
  - Takes serverId, channelId (optional)
  - Computes effective permissions for current user
  - Returns: { hasPermission(flag), permissions }

- `client/src/hooks/useInfiniteMessages.ts`:
  - Takes channelId
  - Loads initial messages on mount
  - Returns: { messages, isLoading, hasMore, loadMore }
  - loadMore fetches older messages (before oldest ID)

- `client/src/hooks/useTypingIndicator.ts`:
  - Takes channelId
  - Tracks who is typing (from WS events, auto-expire after 10s)
  - Provides sendTyping() that debounces TYPING_START events (max 1 per 5s)
  - Returns: { typingUsers, sendTyping }

### Layout Components
- `client/src/components/layout/AppLayout.tsx`:
  Discord's signature 4-panel layout:
  ```
  +--------+--------------+---------------------------+----------------+
  |  72px  |    240px     |         flexible          |     240px      |
  | Server |   Channel    |        Chat Area          |    Members     |
  |  List  |   Sidebar    |                           |    Sidebar     |
  +--------+--------------+---------------------------+----------------+
  ```
  - Full viewport height (h-screen)
  - Flex layout with fixed-width sidebars
  - Member sidebar togglable

- `client/src/components/layout/ServerSidebar.tsx`:
  - Vertical list of server icons (circular, 48px)
  - Active server has left indicator (white pill)
  - Hover shows server name tooltip
  - "+" button at bottom to create server
  - Home button at top (Discord logo area)
  - Separator line between home and servers
  - Background: #202225

- `client/src/components/layout/ChannelSidebar.tsx`:
  - Server name header (bold, with dropdown arrow for settings)
  - Channel list grouped by category
  - Categories are collapsible
  - Text channels show # prefix
  - Voice channels show speaker icon + connected users
  - "+" button on category header for new channel (if has permission)
  - Current channel highlighted (#40444b bg)
  - Background: #2f3136

- `client/src/components/layout/MemberSidebar.tsx`:
  - Members grouped by role (highest role first)
  - Online members shown first with green dot
  - Offline members grayed out at bottom
  - Click member to show profile popout
  - Background: #2f3136

### Server Components
- `client/src/components/server/ServerIcon.tsx`: Circular icon (image or initials), hover animation (square -> rounded)
- `client/src/components/server/CreateServerModal.tsx`: Name input + optional icon upload
- `client/src/components/server/ServerSettings.tsx`: Server name, icon, delete (modal)
- `client/src/components/server/InviteModal.tsx`: Generate invite link, copy button, show existing invites

### Channel Components
- `client/src/components/channel/ChannelList.tsx`: Categories with nested channels
- `client/src/components/channel/CreateChannelModal.tsx`: Name, type (text/voice), category
- `client/src/components/channel/ChannelHeader.tsx`: Channel name, topic, member toggle button

### Chat Components
- `client/src/components/chat/MessageList.tsx`:
  - Scrollable container with messages
  - Auto-scroll to bottom on new messages (only if already at bottom)
  - Infinite scroll up to load older messages
  - Group consecutive messages from same author (within 5 min)
  - Show date separators between different days

- `client/src/components/chat/MessageItem.tsx`:
  - Avatar (left), username + timestamp (top), content (below)
  - Grouped messages show only content (no avatar/name repeat)
  - Hover: show action buttons (edit, delete, etc.)
  - Edited indicator "(edited)" next to timestamp
  - Deleted messages show "This message was deleted" in italic

- `client/src/components/chat/MessageInput.tsx`:
  - Multi-line textarea (auto-grow, max 50% viewport)
  - Send on Enter, new line on Shift+Enter
  - File attachment button (paperclip icon)
  - Placeholder: "Message #channel-name"
  - Show typing indicator below input

- `client/src/components/chat/TypingIndicator.tsx`:
  - Show "User is typing..." or "User1, User2 are typing..."
  - Animated dots (...)

- `client/src/components/chat/AttachmentPreview.tsx`:
  - Preview attached files before sending
  - Image thumbnail preview
  - File name + size for non-images
  - Remove button per attachment

### User Components
- `client/src/components/user/UserAvatar.tsx`: Circular avatar with status dot (online=green, idle=yellow, dnd=red)
- `client/src/components/user/UserProfile.tsx`: Popout card with avatar, name, about me, roles
- `client/src/components/user/StatusSelector.tsx`: Dropdown to change status

### Shared Components
- `client/src/components/shared/Tooltip.tsx`: Simple hover tooltip
- `client/src/components/shared/ContextMenu.tsx`: Right-click context menu (position at cursor)

### Pages
- `client/src/pages/AppPage.tsx`: Main authenticated page, renders AppLayout, loads servers on mount
- `client/src/pages/InvitePage.tsx`: Shows invite preview (server name, icon, member count), accept button

### Client-side Permissions
- `client/src/lib/permissions.ts`: Re-export from shared + any client-specific helpers

## Design Specifications

### Colors (from tailwind config)
- Server sidebar bg: #202225
- Channel sidebar bg: #2f3136
- Chat area bg: #36393f
- Member sidebar bg: #2f3136
- Input bg: #40444b
- Hover: #40444b (channels, messages)
- Active/selected: #40444b
- Brand: #5865f2
- Text primary: #dcddde
- Text secondary: #96989d
- Text muted: #72767d
- Online: #3ba55c
- Idle: #faa61a
- DND: #ed4245

### Typography
- Server name: 16px, bold, white, truncate with ellipsis
- Channel name: 14px, #96989d, bold #dcddde when active
- Username in chat: 16px, bold, colored by role color
- Message content: 16px, #dcddde
- Timestamp: 12px, #72767d

### Interactions
- Server icons: round -> rounded-2xl on hover, scale transition
- Channels: hover bg #40444b, 200ms transition
- Messages: hover shows action bar (top-right), subtle bg change
- Input: focus ring with brand color

## Acceptance Criteria
- [ ] 4-panel layout renders correctly at full viewport
- [ ] Server sidebar shows servers as icons with active indicator
- [ ] Create server modal works (name input)
- [ ] Channel sidebar shows channels grouped by category
- [ ] Clicking channel navigates and loads messages
- [ ] Message list shows messages with author info
- [ ] Infinite scroll loads older messages
- [ ] New messages appear in real-time via WebSocket
- [ ] Message input sends on Enter, multiline on Shift+Enter
- [ ] Edit and delete messages work
- [ ] Typing indicator shows/hides correctly
- [ ] Member sidebar shows members grouped by role/status
- [ ] Presence indicators (online/offline/idle/dnd) update in real-time
- [ ] Invite modal generates and copies invite link
- [ ] WebSocket reconnects on disconnect
- [ ] All components pass TypeScript compilation
