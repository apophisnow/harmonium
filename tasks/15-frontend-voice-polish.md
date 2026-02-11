# Task 15: Frontend Voice Chat + Final Polish

## Objective
Implement the voice chat UI and WebRTC connection using mediasoup-client. Add finishing touches: loading states, error boundaries, smooth transitions, toast notifications, and responsive polish.

## Dependencies
- Task 13 (voice backend with mediasoup)
- Task 14 (frontend core UI)

## Pre-existing Files to Read
- `client/src/hooks/useWebSocket.ts` - WebSocket hook (extend for voice events)
- `client/src/stores/` - All existing stores
- `client/src/components/layout/ChannelSidebar.tsx` - Voice channels shown here
- `client/src/components/layout/AppLayout.tsx` - Voice controls bar goes here
- `client/src/api/client.ts` - API client
- `packages/shared/src/types/voice.ts` - VoiceState type
- `packages/shared/src/ws-events.ts` - VOICE_STATE_UPDATE events

## Files to Create

### 1. `client/src/stores/voice.store.ts`
```typescript
interface VoiceState {
  currentChannelId: string | null;
  currentServerId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  participants: Map<string, VoiceParticipant>; // userId -> state

  joinChannel: (channelId: string, serverId: string) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
  addParticipant: (userId: string, state: VoiceParticipant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (userId: string, update: Partial<VoiceParticipant>) => void;
}

interface VoiceParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
}
```

### 2. `client/src/hooks/useVoice.ts` - mediasoup-client Integration
Core voice hook that manages the WebRTC connection:

```typescript
export function useVoice() {
  // State
  const device = useRef<mediasoupClient.Device | null>(null);
  const sendTransport = useRef<mediasoupClient.types.Transport | null>(null);
  const recvTransport = useRef<mediasoupClient.types.Transport | null>(null);
  const producer = useRef<mediasoupClient.types.Producer | null>(null);
  const consumers = useRef<Map<string, mediasoupClient.types.Consumer>>(new Map());
  const audioElements = useRef<Map<string, HTMLAudioElement>>(new Map());

  async function join(channelId: string): Promise<void> {
    // 1. Call POST /api/voice/join -> get rtpCapabilities + transport options
    // 2. Create mediasoup Device, load rtpCapabilities
    // 3. Create sendTransport and recvTransport with device.createSend/RecvTransport()
    // 4. Set up transport 'connect' event -> POST /api/voice/connect-transport
    // 5. Set up sendTransport 'produce' event -> POST /api/voice/produce
    // 6. Get user audio: navigator.mediaDevices.getUserMedia({ audio: true })
    // 7. Produce audio: sendTransport.produce({ track: audioTrack })
    // 8. For each existing producer in the room, consume it
  }

  async function consume(producerId: string, userId: string): Promise<void> {
    // 1. POST /api/voice/consume -> get consumer params
    // 2. recvTransport.consume(params)
    // 3. Create HTMLAudioElement, set srcObject, play()
    // 4. Set up audio analysis for speaking detection
  }

  async function leave(): Promise<void> {
    // 1. POST /api/voice/leave
    // 2. Close producer, all consumers
    // 3. Close transports
    // 4. Stop audio tracks
    // 5. Clean up audio elements
  }

  function toggleMute(): void {
    // Pause/resume producer
    // Update voice state via WebSocket
  }

  function toggleDeafen(): void {
    // Mute all consumers (set volume to 0)
    // Update voice state via WebSocket
  }

  // Speaking detection using AudioContext + AnalyserNode
  function setupSpeakingDetection(stream: MediaStream, userId: string): void {
    // Create AudioContext
    // Create AnalyserNode
    // Poll getByteFrequencyData at 100ms intervals
    // If average amplitude > threshold, mark as speaking
    // Update participant state in voice store
  }

  return { join, leave, toggleMute, toggleDeafen };
}
```

### 3. `client/src/components/voice/VoiceChannel.tsx`
Voice channel entry in the channel sidebar:
- Channel name with speaker icon
- List of connected users (small avatars + names)
- Click to join
- Green accent when connected
- Show mute/deaf icons next to user names

### 4. `client/src/components/voice/VoiceControls.tsx`
Control bar at the bottom of the channel sidebar (visible when in a voice channel):
- Connected channel name + server name
- Mute button (microphone icon, red when muted)
- Deafen button (headphone icon, red when deafened)
- Disconnect button (phone with X icon, red)
- Compact bar: ~50px height, #292b2f background

### 5. `client/src/components/voice/VoiceParticipant.tsx`
User entry in the voice channel participant list:
- User avatar (small, 24px)
- Username
- Speaking indicator: green ring around avatar when speaking
- Muted icon if muted
- Deafened icon if deafened

### 6. Add `mediasoup-client` to client/package.json

### 7. Update existing components
- `ChannelSidebar.tsx`: Replace voice channel placeholders with VoiceChannel component
- `AppLayout.tsx`: Add VoiceControls bar above user area at bottom of channel sidebar

### 8. Polish Components (create/update as needed)

**Loading States:**
- `client/src/components/shared/Skeleton.tsx` - Animated loading skeleton
- Add skeletons to: server list, channel list, message list, member list

**Error Handling:**
- `client/src/components/shared/ErrorBoundary.tsx` - React error boundary with retry button
- Wrap route-level components in error boundaries

**Toast Notifications:**
- `client/src/components/shared/Toast.tsx` - Toast notification component
- `client/src/stores/toast.store.ts` - Toast state management
- Show toasts for: invite copied, server created, errors, voice connection status

**Transitions:**
- Server icon hover: smooth border-radius transition (50% -> 30%)
- Sidebar items: background-color transition 150ms
- Modal: fade-in backdrop, scale-in content
- Toast: slide-in from top-right

**Responsive Behavior:**
- Member sidebar auto-hides below 1200px width
- Channel sidebar collapsible on mobile

## mediasoup-client Setup
```typescript
import * as mediasoupClient from 'mediasoup-client';

// Create device (browser detection is automatic)
const device = new mediasoupClient.Device();

// Load server's RTP capabilities
await device.load({ routerRtpCapabilities });

// Create transports
const sendTransport = device.createSendTransport(sendTransportOptions);
const recvTransport = device.createRecvTransport(recvTransportOptions);

// Transport events (called by mediasoup-client, you must handle them)
sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
  try {
    await api.connectTransport({ transportId: sendTransport.id, dtlsParameters });
    callback();
  } catch (e) { errback(e); }
});

sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
  try {
    const { producerId } = await api.produce({ transportId: sendTransport.id, kind, rtpParameters });
    callback({ id: producerId });
  } catch (e) { errback(e); }
});
```

## Acceptance Criteria
- [ ] Click voice channel to join, see yourself in participant list
- [ ] Audio is captured from microphone and sent to server
- [ ] Other participants' audio plays through speakers
- [ ] Speaking indicator (green ring) appears when someone is talking
- [ ] Mute button stops sending audio, shows muted icon
- [ ] Deafen button mutes all incoming audio
- [ ] Disconnect button leaves voice channel, cleans up resources
- [ ] Voice controls bar appears at bottom of channel sidebar when connected
- [ ] Voice state synced across clients via WebSocket
- [ ] Microphone permission denied handled gracefully with error message
- [ ] Loading skeletons show during initial data fetch
- [ ] Error boundaries catch and display errors with retry option
- [ ] Toast notifications for key actions
- [ ] Smooth transitions on hover, modal open/close, sidebar toggle
- [ ] TypeScript compilation passes
