# Task 13: Voice Module (mediasoup SFU)

## Objective
Implement WebRTC voice channels using mediasoup as an SFU. This includes worker pool management, room lifecycle, transport creation, producer/consumer management, and the signaling protocol over REST endpoints + WebSocket events.

## Dependencies
- Task 6 (WebSocket gateway) - for broadcasting voice state events
- Task 9 (channel module) - voice channels must exist

## Pre-existing Files to Read
- `server/src/config.ts` - MEDIASOUP_ANNOUNCED_IP config
- `server/src/db/schema/voice-states.ts` - voiceStates table
- `server/src/db/schema/channels.ts` - channels table (type: 'voice')
- `server/src/utils/permissions.ts` - requireChannelPermission (CONNECT, SPEAK)
- `server/src/utils/errors.ts` - Error classes
- `server/src/ws/pubsub.ts` - PubSubManager for VOICE_STATE_UPDATE
- `server/src/ws/index.ts` - ConnectionManager
- `packages/shared/src/types/voice.ts` - VoiceState type
- `packages/shared/src/ws-events.ts` - VOICE_STATE_UPDATE event

## Files to Create

### 1. `server/src/voice/mediasoup-config.ts`
mediasoup configuration constants:

```typescript
import type { WorkerSettings, RouterOptions, WebRtcTransportOptions } from 'mediasoup/node/lib/types.js';
import os from 'os';
import { getConfig } from '../config.js';

export const workerSettings: WorkerSettings = {
  rtcMinPort: 40000,
  rtcMaxPort: 40100,  // Narrow range for Docker port mapping
  logLevel: 'warn',
  logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
};

export const mediaCodecs: RouterOptions['mediaCodecs'] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
];

export function getTransportOptions(): WebRtcTransportOptions {
  const config = getConfig();
  return {
    listenInfos: [
      { protocol: 'udp', ip: '0.0.0.0', announcedAddress: config.MEDIASOUP_ANNOUNCED_IP },
      { protocol: 'tcp', ip: '0.0.0.0', announcedAddress: config.MEDIASOUP_ANNOUNCED_IP },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  };
}

export const NUM_WORKERS = Math.min(os.cpus().length, 4); // Cap at 4
```

### 2. `server/src/voice/voice-server.ts` - Worker Pool + Room Management
```typescript
import * as mediasoup from 'mediasoup';

export class VoiceServer {
  private workers: mediasoup.types.Worker[] = [];
  private rooms: Map<string, VoiceRoom> = new Map(); // channelId -> room
  private nextWorkerIdx = 0;

  async initialize(): Promise<void> {
    // Create NUM_WORKERS workers
    // Assign event handlers (worker died -> recreate)
  }

  async getOrCreateRoom(channelId: string): Promise<VoiceRoom> {
    // Get existing room or create new one with next worker (round-robin)
  }

  async removeRoom(channelId: string): Promise<void> {
    // Close router, clean up
  }

  getRoom(channelId: string): VoiceRoom | undefined {
    return this.rooms.get(channelId);
  }

  private getNextWorker(): mediasoup.types.Worker {
    // Round-robin worker selection
  }

  async shutdown(): Promise<void> {
    // Close all workers
  }
}
```

### 3. `server/src/voice/voice-room.ts` - Single Voice Room
```typescript
export class VoiceRoom {
  private router: mediasoup.types.Router;
  // Per-user: their send transport, recv transport, producers, consumers
  private peers: Map<string, VoicePeer> = new Map();

  constructor(router: mediasoup.types.Router) {
    this.router = router;
  }

  get rtpCapabilities() { return this.router.rtpCapabilities; }
  get peerCount() { return this.peers.size; }
  get isEmpty() { return this.peers.size === 0; }

  async addPeer(userId: string): Promise<{
    sendTransportOptions: TransportOptions;
    recvTransportOptions: TransportOptions;
  }> {
    // Create send and recv WebRtcTransport for this user
    // Store in peers map
    // Return transport connection info (id, iceParameters, iceCandidates, dtlsParameters)
  }

  async connectTransport(userId: string, transportId: string, dtlsParameters: DtlsParameters): Promise<void> {
    // Find the transport, call transport.connect()
  }

  async produce(userId: string, transportId: string, kind: string, rtpParameters: RtpParameters): Promise<string> {
    // Call sendTransport.produce()
    // Return producer.id
    // Notify other peers about new producer (caller should handle this)
  }

  async consume(userId: string, producerId: string, rtpCapabilities: RtpCapabilities): Promise<{
    id: string;
    producerId: string;
    kind: string;
    rtpParameters: RtpParameters;
  }> {
    // Check router.canConsume()
    // Create consumer on recv transport
    // Return consumer info
  }

  async removePeer(userId: string): Promise<void> {
    // Close all transports, producers, consumers for this user
    // Remove from peers map
  }

  getOtherProducerIds(excludeUserId: string): Array<{ producerId: string; userId: string }> {
    // Return all active producer IDs from other peers (for the newly joined user to consume)
  }

  close(): void {
    // Close router and all transports
  }
}

interface VoicePeer {
  userId: string;
  sendTransport: mediasoup.types.WebRtcTransport;
  recvTransport: mediasoup.types.WebRtcTransport;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
}
```

### 4. `server/src/modules/voice/voice.schemas.ts`
Zod schemas:
- `joinVoiceSchema`: { channelId: string }
- `connectTransportSchema`: { transportId: string, dtlsParameters: object }
- `produceSchema`: { transportId: string, kind: 'audio', rtpParameters: object }
- `consumeSchema`: { producerId: string, rtpCapabilities: object }
- `leaveVoiceSchema`: {} (no body needed, uses auth)

### 5. `server/src/modules/voice/voice.service.ts`
Functions:
- `joinVoice(userId: string, channelId: string)`:
  - Verify channel exists and is type 'voice'
  - Check CONNECT permission
  - If user is already in a voice channel, leave it first
  - Get or create VoiceRoom
  - Add peer to room (creates transports)
  - Insert/update voice_states record in DB
  - Broadcast VOICE_STATE_UPDATE via WebSocket
  - Return { rtpCapabilities, sendTransportOptions, recvTransportOptions, otherProducers }

- `connectTransport(userId: string, transportId, dtlsParameters)`:
  - Find the room the user is in
  - Call room.connectTransport()

- `produce(userId: string, transportId, kind, rtpParameters)`:
  - Find room, call room.produce()
  - Broadcast to other peers that a new producer is available (via WebSocket)
  - Return { producerId }

- `consume(userId: string, producerId, rtpCapabilities)`:
  - Find room, call room.consume()
  - Return consumer params

- `leaveVoice(userId: string)`:
  - Find current voice state from DB
  - Remove peer from room
  - Delete voice_states record
  - If room is empty, remove it
  - Broadcast VOICE_STATE_UPDATE (userId left, channelId: null)

### 6. `server/src/modules/voice/voice.routes.ts`
Plugin at prefix `/api/voice`. All require auth.

Routes:
- `POST /join` - Join voice channel
- `POST /connect-transport` - Connect a WebRTC transport
- `POST /produce` - Start producing audio
- `POST /consume` - Consume another user's audio
- `POST /leave` - Leave voice channel
- `GET /state/:serverId` - Get all voice states for a server

### 7. `server/src/ws/handlers/voice-signal.handler.ts`
Handle voice-related WebSocket events:
- `VOICE_STATE_UPDATE` from client: update mute/deaf state in DB and broadcast

### 8. Update `server/src/app.ts`
- Initialize VoiceServer on app startup (create workers)
- Register voice route module
- Shut down VoiceServer on app close

## Important Notes
- mediasoup is a native Node.js addon - it requires python3, make, g++ to compile (already in Dockerfile)
- Each Worker runs in a separate OS thread
- Transports use UDP ports in the configured range
- The MEDIASOUP_ANNOUNCED_IP must be the public/reachable IP of the server
- All mediasoup types are in `mediasoup/node/lib/types.js`

## Acceptance Criteria
- [ ] VoiceServer initializes workers successfully
- [ ] POST /join creates room and transports, returns RTP capabilities
- [ ] POST /connect-transport completes DTLS handshake
- [ ] POST /produce creates audio producer
- [ ] POST /consume creates consumer for another user's audio
- [ ] POST /leave cleans up transports, producers, consumers
- [ ] Empty rooms are automatically cleaned up
- [ ] Voice states persisted in DB
- [ ] VOICE_STATE_UPDATE broadcast to server members via WebSocket
- [ ] Mute/deaf state updates work
- [ ] Multiple users can be in the same voice channel simultaneously
- [ ] TypeScript compilation passes
