# Harmonium over Reticulum: Architecture Design

## Overview

This document explores how to recreate Discord-like functionality using the [Reticulum](https://reticulum.network/) cryptography-based networking stack, where **everything is encrypted by default**.

Reticulum is fundamentally different from IP networking — there are no traditional addresses, no central servers, no DNS. Every concept is built on **cryptographic identities**. This requires rethinking how a chat application works from the ground up.

---

## 1. Reticulum Fundamentals

### Core Primitives

| Concept | Description |
|---------|-------------|
| **Identity** | A 512-bit EC keyset: 256-bit X25519 (encryption) + 256-bit Ed25519 (signing). The foundation of all addressing. |
| **Destination** | A network endpoint — a hash of *who you are*, not *where you are*. 128-bit (16-byte) truncated SHA-256 of the public key. |
| **Packet** | The fundamental data unit. Max 383 bytes encrypted payload (500-byte MTU). Each packet to a SINGLE destination gets a unique ephemeral encryption key. |
| **Link** | A bidirectional, verified, encrypted virtual connection with full forward secrecy via ECDH key exchange. |
| **Resource** | Large data transfer over a Link — automatic sequencing, compression, integrity verification. Up to ~1 MB per segment. |
| **Channel** | Typed message passing over a Link — define message types, register handlers. |
| **Buffer** | Stream-like I/O over a Channel — Python `io.RawIOBase` compatible. |

### Encryption Details

- **Key Exchange**: X25519 (Curve25519 ECDH)
- **Signatures**: Ed25519
- **Symmetric**: AES-256-CBC with PKCS7 padding
- **HMAC**: SHA-256
- **Key Derivation**: HKDF
- **Forward Secrecy**: Automatic on Links; optional on single packets via ratchets (rotating keys every 30 minutes)

### Transport Mediums

Reticulum works over **any** medium with ≥500 bps and ≥500-byte MTU:

| Interface | Use Case |
|-----------|----------|
| TCP/UDP | Internet, LAN |
| AutoInterface | Zero-conf local peer discovery |
| Serial | Direct wire, data radios, laser links |
| RNode (LoRa) | Long-range low-bandwidth wireless |
| KISS/AX.25 | Amateur packet radio |
| I2P | Anonymous/censorship-resistant overlay |
| Pipe | Custom transport adapters |

A single network can seamlessly combine LoRa at 300 bps with gigabit Ethernet.

### Constraints

| Constraint | Value |
|------------|-------|
| Network MTU | 500 bytes (default), up to 262 KB with link MTU discovery |
| Encrypted packet payload | 383 bytes |
| Link packet payload | 431 bytes |
| Max hops | 128 |
| Address size | 128 bits (16 bytes) |
| Minimum bandwidth | 5 bps (absolute), 500 bps (practical) |
| Path expiry | 1 week |

---

## 2. Current Harmonium Architecture (for reference)

Harmonium is a traditional client-server Discord clone:

- **Client**: React 19, Zustand, TailwindCSS, mediasoup-client
- **Server**: Fastify 5, Drizzle ORM, PostgreSQL 16, Redis 7
- **Real-time**: WebSocket gateway with Redis pub/sub for horizontal scaling
- **Voice**: mediasoup SFU (WebRTC Selective Forwarding Unit)
- **Auth**: JWT (access + refresh tokens)

### Features Implemented
- Text chat (with replies, reactions, editing, soft-delete)
- Voice chat (WebRTC via mediasoup with echo cancellation, noise suppression)
- Servers, channels (text + voice), categories
- Roles & permissions (Discord-style bitfield)
- File uploads & attachments
- Invites, bans, presence tracking, unread tracking

---

## 3. Reticulum-Based Architecture Design

### 3.1 The Fundamental Shift: No Central Server

In traditional Discord, a central server mediates everything. With Reticulum, we have three viable topologies:

#### Option A: Federated Server Nodes (Recommended)

Each "server" (in the Discord sense — a community) is hosted by a **Reticulum node** that acts as a message hub.

```
┌──────────┐     Link     ┌─────────────────┐     Link     ┌──────────┐
│  User A  │◄────────────►│  Server Node    │◄────────────►│  User B  │
│ (Identity)│              │  (Identity)      │              │ (Identity)│
└──────────┘              │                  │              └──────────┘
                          │ - Message store  │
┌──────────┐     Link     │ - Channel mgmt   │     Link     ┌──────────┐
│  User C  │◄────────────►│ - Permissions    │◄────────────►│  User D  │
│ (Identity)│              │ - Member list    │              │ (Identity)│
└──────────┘              └─────────────────┘              └──────────┘
```

**Pros**: Closest to Discord UX. Server node handles fan-out, stores history, enforces permissions. Works well over fast links (TCP/internet).

**Cons**: Single point of failure per server. Server node operator can read messages (unless additional E2E layer is added).

#### Option B: Pure P2P with LXMF Fan-Out

No server nodes. Each user sends messages directly to every group member via LXMF.

```
┌──────────┐   LXMF    ┌──────────┐
│  User A  │──────────►│  User B  │
│          │──────┐    └──────────┘
└──────────┘      │    ┌──────────┐
                  └───►│  User C  │
                       └──────────┘
```

**Pros**: No central infrastructure. True E2E encryption. Works offline via propagation nodes.

**Cons**: Bandwidth scales O(N) per message. No central history. Limited to ~295 bytes per opportunistic message. Difficult to manage permissions, channels, server state.

#### Option C: Hybrid (Recommended for Discord Parity)

Combine both: server nodes for online real-time interaction, LXMF propagation for offline/async messaging, P2P for DMs.

```
┌──────────┐           ┌─────────────────┐           ┌──────────┐
│  User A  │◄─ Link ──►│  Server Node    │◄── Link ─►│  User B  │
└──────────┘           │  (online hub)    │           └──────────┘
      │                └────────┬────────┘                 │
      │                         │                          │
      │  LXMF (offline)  ┌─────▼──────┐  LXMF (offline)  │
      └──────────────────►│ Propagation │◄─────────────────┘
                          │    Node     │
                          └────────────┘
      │                                                    │
      └────────────── Direct Link (DMs) ──────────────────┘
```

---

### 3.2 Identity & Authentication

#### Discord Equivalent → Reticulum Mapping

| Discord | Reticulum |
|---------|-----------|
| Username + email + password | RNS Identity (X25519 + Ed25519 keypair) |
| User ID | Destination hash (128-bit, derived from public key) |
| Login | Load Identity from encrypted keyfile |
| Register | Generate new Identity |
| JWT token | Link establishment (ECDH handshake = mutual auth) |

#### Design

```python
# User identity creation
user_identity = RNS.Identity()
user_identity.to_file("/path/to/identity", password="user_passphrase")

# User's message delivery destination
user_destination = RNS.Destination(
    user_identity,
    RNS.Destination.IN,
    RNS.Destination.SINGLE,
    "harmonium",    # app_name
    "user"          # aspect
)

# Announce presence with display name
user_destination.announce(app_data=msgpack.pack({
    "name": "karl",
    "discriminator": "0001",
    "status": "online",
    "avatar_hash": "abc123..."  # hash, not the image itself
}))
```

**No passwords needed for network auth** — possession of the private key *is* authentication. The ECDH handshake when establishing a Link cryptographically proves identity.

**User profiles** are carried in announce `app_data` and cached by peers.

---

### 3.3 Servers (Communities)

A "server" is a Reticulum node running the Harmonium server software with its own Identity.

```python
# Server node identity
server_identity = RNS.Identity()

# Server's main destination (for member connections)
server_destination = RNS.Destination(
    server_identity,
    RNS.Destination.IN,
    RNS.Destination.SINGLE,
    "harmonium",
    "server"
)

# Announce server existence
server_destination.announce(app_data=msgpack.pack({
    "name": "My Community",
    "icon_hash": "def456...",
    "member_count": 42,
    "channels": ["general", "voice-chat", "memes"]
}))
```

#### Server Discovery

Instead of a web URL, servers are discovered by:
1. **Announce listening** — clients listen for `harmonium.server` announces on the network
2. **Invite links** — share the server's destination hash (32 hex chars): `harmonium://a1b2c3d4e5f67890...`
3. **Propagation** — known server lists shared between peers

#### Joining a Server

1. Client establishes a Link to the server's destination
2. Server sends a challenge (or accepts based on invite token)
3. Client proves identity via the Link's ECDH handshake
4. Server adds client's destination hash to its member list
5. Server sends initial state (channels, roles, recent messages)

---

### 3.4 Channels & Messaging

#### Channel Architecture

Channels are **server-side constructs**. The server node manages channel state and enforces permissions.

```python
# On the server node, define message types using RNS Channels
class ChatMessage(RNS.MessageBase):
    MSGTYPE = 0x0100

    def pack(self):
        return msgpack.pack({
            "channel_id": self.channel_id,
            "content": self.content,
            "author_hash": self.author_hash,
            "timestamp": self.timestamp,
            "reply_to": self.reply_to,
            "attachments": self.attachment_hashes
        })

class TypingIndicator(RNS.MessageBase):
    MSGTYPE = 0x0101
    # ...

class PresenceUpdate(RNS.MessageBase):
    MSGTYPE = 0x0102
    # ...
```

#### Message Flow

```
User A                    Server Node                   User B
  │                           │                           │
  │── ChatMessage ──────────►│                           │
  │   (channel: general)     │── Permission check        │
  │                          │── Store in local DB       │
  │                          │── ChatMessage ───────────►│
  │                          │   (fan-out to members     │
  │◄── MessageAck ──────────│    subscribed to channel)  │
  │                          │                           │
```

#### Message Storage

The server node stores messages in a local database (SQLite for simplicity, since it's a single node):

```
messages/
├── server.db          # SQLite: channels, messages, members, roles
├── attachments/       # Binary files, referenced by hash
└── identity.key       # Server's encrypted identity
```

#### Offline Message Delivery

When a member is offline:
1. Server queues messages for them (up to a configurable limit)
2. When they reconnect and establish a Link, server replays missed messages
3. Optionally, server acts as an LXMF propagation node for async delivery

---

### 3.5 Permissions & Roles

Permissions work identically to the current bitfield system, but enforced by the server node:

```python
PERMISSIONS = {
    "ADMINISTRATOR":    1 << 0,
    "MANAGE_SERVER":    1 << 1,
    "MANAGE_CHANNELS":  1 << 2,
    "MANAGE_ROLES":     1 << 3,
    "MANAGE_MESSAGES":  1 << 4,
    "SEND_MESSAGES":    1 << 5,
    "READ_MESSAGES":    1 << 6,
    "CONNECT":          1 << 7,
    "SPEAK":            1 << 8,
    "CREATE_INVITE":    1 << 9,
    "KICK_MEMBERS":     1 << 10,
    "BAN_MEMBERS":      1 << 11,
    "ATTACH_FILES":     1 << 12,
    "STREAM":           1 << 13,
    "VIDEO":            1 << 14,
}
```

Members are identified by their destination hash (derived from their cryptographic identity), making impersonation cryptographically impossible.

---

### 3.6 Voice & Video

Voice and video are the most challenging features to port. They have fundamentally different bandwidth profiles and require different strategies.

#### 3.6.1 Audio Streaming via LXST

[LXST](https://github.com/markqvist/LXST) (Lightweight Extensible Streaming Transport) is a real-time streaming protocol built on Reticulum:

- End-to-end encrypted audio streaming
- Supports Codec2 (700–3200 bps for LoRa) and Opus (4.5–96 kbps for internet)
- Latency under 10ms on fast links
- Currently supports **1:1 calls** natively

For group voice, the server node acts as an SFU (Selective Forwarding Unit):

```
User A ──LXST──► Server Node ──LXST──► User B
                     │
                     └──LXST──► User C
```

The server node receives audio streams from each participant and forwards them to all others — no mixing or transcoding. This is analogous to the current mediasoup architecture.

**Audio topology options:**

| Topology | How It Works | Best For |
|----------|-------------|----------|
| **SFU (server node)** | Each user sends 1 stream to server, server fans out N-1 copies to each | Groups of any size on internet links |
| **Mesh P2P** | Each user sends directly to every other user (N-1 streams up + down) | 2-4 people, no server needed |
| **1:1 direct** | Single LXST link between two users | DM voice calls, LoRa links |

**Audio codec selection by transport:**

| Transport | Codec | Bitrate | Group Voice? |
|-----------|-------|---------|-------------|
| LoRa / packet radio | Codec2 | 700–3200 bps | No (1:1 only) |
| Internet (TCP/UDP) | Opus | 4.5–96 kbps | Yes, via SFU |

#### 3.6.2 Video Streaming

Video is a different beast entirely. Unlike audio (which fits comfortably in Reticulum's bandwidth even on slow links), video requires **link MTU discovery** over fast interfaces and is fundamentally an **internet-only feature**.

**Bandwidth requirements:**

| Stream Type | Typical Bitrate | Fits in base MTU? | With Link MTU Discovery? |
|-------------|-----------------|-------------------|--------------------------|
| Voice (Codec2) | 700–3200 bps | Yes | Yes |
| Voice (Opus) | 4.5–96 kbps | Marginal | Yes |
| Webcam 360p (H.264/VP9) | 200–500 kbps | No | Yes |
| Webcam 720p (H.264/VP9) | 1–4 Mbps | No | Yes |
| Screen share (variable) | 500 kbps–5 Mbps | No | Yes |

Without link MTU discovery, the base 500-byte MTU makes video impossible. With TCP link MTU discovery (up to 262 KB per packet), video becomes viable on internet links.

**Approach: Extend LXST for video**

Rather than designing a new protocol, LXST's streaming primitives are general enough to carry video:

1. LXST already handles multiplexed encrypted streams over RNS Links
2. Add video codec support (H.264/VP9/AV1) alongside existing Opus/Codec2
3. Each participant's Link to the server node carries both audio and video as separate stream channels
4. The server node forwards video streams SFU-style, same as audio

```python
# Conceptual — extend LXST stream types
class StreamType:
    AUDIO_OPUS    = 0x01
    AUDIO_CODEC2  = 0x02
    VIDEO_H264    = 0x10
    VIDEO_VP9     = 0x11
    VIDEO_AV1     = 0x12
    SCREEN_SHARE  = 0x20
```

**Transport-aware feature gating:**

The server node should detect each member's link quality and advertise available features:

```python
link_capabilities = {
    "audio": True,           # Always available on any link
    "video_send": False,     # Only on links with sufficient upstream bandwidth
    "video_recv": False,     # Only on links with sufficient downstream bandwidth
    "screen_share": False,   # Only on fast links
    "max_video_quality": None,  # "360p", "720p", "1080p" based on link speed
}
```

The client UI should disable video/screen share buttons when the link doesn't support it, rather than failing silently.

#### 3.6.3 Group Video Conferencing

Group video adds a multiplicative bandwidth challenge on top of basic video streaming.

**Server fan-out scaling (SFU model):**

In an SFU, each participant uploads 1 video stream and downloads N-1 streams. The server forwards N×(N-1) total streams.

| Participants | Server Fan-out Streams | Total Server Bandwidth (360p) | Total Server Bandwidth (720p) |
|---|---|---|---|
| 2 | 2 | ~0.5 Mbps | ~2 Mbps |
| 4 | 12 | ~3 Mbps | ~12 Mbps |
| 8 | 56 | ~14 Mbps | ~56 Mbps |
| 16 | 240 | ~60 Mbps | ~240 Mbps |
| 25 (Discord max) | 600 | ~150 Mbps | Not feasible |

**Practical ceiling: 4-8 participants** for video without additional optimization.

**Strategies for larger groups:**

1. **Adaptive quality / simulcast**: Each participant encodes their video at multiple quality levels (e.g., 720p + 360p + 180p). The server selects which quality to forward to each viewer based on their link speed and whether the stream is in their active/focused view. This is how Discord and Zoom work today.

   ```
   User A ──[720p + 360p + 180p]──► Server Node
                                        │
                     ┌──────────────────┤
                     │                  │
                  [720p]             [180p]
                     │                  │
                     ▼                  ▼
                  User B            User C
                (broadband)      (slow link)
   ```

   LXST would need to be extended to support multiple concurrent quality tiers per stream.

2. **Active speaker detection**: Only forward video for the active speaker (or top 2-3 speakers) at full quality. Other participants get audio only or a low-quality thumbnail. This dramatically reduces bandwidth — a 16-person call becomes 3-4 video streams instead of 240.

3. **Voice-only fallback**: Beyond a configurable participant threshold (e.g., 8), automatically switch to voice-only with optional "raise hand to share video" for the active speaker. This matches how large Discord voice channels work in practice — most participants have cameras off.

4. **MCU mode (last resort)**: The server node decodes all video streams, composites them into a single grid view, and re-encodes one stream per viewer. Each participant only downloads 1 stream regardless of group size. The trade-off is massive CPU cost on the server node and added latency from the decode/encode cycle. Not recommended for initial implementation.

**Recommended approach for group video:**

| Group Size | Strategy |
|------------|----------|
| 2 | Direct P2P LXST with video, no server needed |
| 3-4 | SFU through server node, full quality for all |
| 5-8 | SFU with active speaker detection — full video for 2-3 speakers, thumbnails or audio-only for others |
| 9+ | Voice-only by default, active speaker can share video/screen |

#### 3.6.4 Screen Sharing

Screen sharing follows the same path as webcam video but with different encoding characteristics:

- **Higher resolution** (typically 1080p+ to be legible)
- **Lower frame rate** (5-15 fps is acceptable for slides/code, 30 fps for demos)
- **Bursty bandwidth** — static content compresses heavily, rapid changes spike bandwidth

Design considerations:
- Treat screen share as a separate stream type from webcam video
- Only one participant can screen share at a time per voice channel (same as Discord)
- Server node should enforce the STREAM permission before allowing screen share
- On constrained links, offer a "screenshot mode" — periodic still frames sent as Resources instead of a live stream

#### 3.6.5 Summary: Voice & Video Feature Matrix

| Feature | LoRa / Radio | Internet (slow) | Internet (fast) |
|---------|-------------|-----------------|-----------------|
| 1:1 voice | Codec2 | Opus | Opus |
| Group voice | No | Yes (SFU) | Yes (SFU) |
| 1:1 video | No | 360p | 720p+ |
| Group video | No | 2-4 people, 360p | 4-8 people, 720p |
| Screen share | No | Low FPS, 720p | 30 FPS, 1080p |
| Large group (9+) | No | Voice only + active speaker video | Voice only + active speaker video |

---

### 3.7 Direct Messages

DMs are the simplest case — pure P2P via LXMF:

```python
# Send a DM
lxm = LXMF.LXMessage(
    recipient_destination,
    sender_destination,
    "Hey, what's up?",
    desired_method=LXMF.LXMessage.DIRECT  # Establish link for delivery
)
lxm.fields = {
    LXMF.FIELD_TITLE: "",  # DMs don't need titles
}
router.handle_outbound(lxm)
```

- **Online**: Direct Link delivery with forward secrecy
- **Offline**: Store-and-forward via propagation nodes
- **No server involved**: True end-to-end encryption, even the server node operator can't read DMs

---

### 3.8 File Uploads & Attachments

Files are transferred as Resources over Links:

```python
# Sender
resource = RNS.Resource(
    file_data,
    link,
    callback=on_transfer_complete,
    progress_callback=on_progress
)

# Or for large files, use a file handle
resource = RNS.Resource(
    open("image.png", "rb"),
    link,
    callback=on_transfer_complete
)
```

#### Design

1. User sends a ChatMessage with `attachment_hashes` (SHA-256 of file contents)
2. Server stores the file and makes it available to channel members
3. When a member wants the file, they request it by hash
4. Server sends it as a Resource over their existing Link

#### Constraints

- Resources support up to ~1 MB efficiently per segment
- Larger files can be split into multiple Resources
- On LoRa links, file transfer is impractical (a 100KB image would take ~45 minutes at 300 bps)
- The client should auto-detect link speed and disable/warn about attachments on slow links

---

### 3.9 Invites & Bans

#### Invites

An invite is simply a signed message containing the server's destination hash:

```python
invite = {
    "server_hash": server_destination.hash.hex(),
    "server_name": "My Community",
    "inviter_hash": inviter_destination.hash.hex(),
    "max_uses": 10,
    "expires": timestamp,
    "token": random_token  # Server validates this on join
}
# Sign with inviter's identity
signature = inviter_identity.sign(msgpack.pack(invite))
```

Invite links: `harmonium://invite/<base32_encoded_invite+signature>`

#### Bans

The server node maintains a ban list of destination hashes. When a banned user tries to establish a Link, the server refuses the connection. Since identities are cryptographic, **ban evasion requires generating an entirely new identity** (losing all history, reputation, and contacts).

---

### 3.10 Presence & Status

Presence is maintained via the Link connection to the server node:

| State | Mechanism |
|-------|-----------|
| **Online** | Active Link to server node |
| **Idle** | Client sends idle status after inactivity timeout |
| **DND** | Client sends DND status update |
| **Offline** | Link closed/timed out |

The server broadcasts presence updates to all connected members via Channel messages.

---

## 4. Protocol Message Types

### Client → Server

| Type ID | Name | Payload |
|---------|------|---------|
| 0x0100 | ChatMessage | channel_id, content, reply_to, attachment_hashes |
| 0x0101 | TypingStart | channel_id |
| 0x0102 | PresenceUpdate | status, custom_status |
| 0x0103 | VoiceStateUpdate | channel_id, self_mute, self_deaf |
| 0x0104 | MessageEdit | message_id, new_content |
| 0x0105 | MessageDelete | message_id |
| 0x0106 | ReactionAdd | message_id, emoji |
| 0x0107 | ReactionRemove | message_id, emoji |
| 0x0108 | MarkRead | channel_id, message_id |
| 0x0109 | RequestHistory | channel_id, before_id, limit |
| 0x010A | FileRequest | file_hash |
| 0x010B | SubscribeChannel | channel_id |
| 0x010C | UnsubscribeChannel | channel_id |
| 0x010D | VideoStateUpdate | channel_id, video_enabled, quality |
| 0x010E | ScreenShareStart | channel_id |
| 0x010F | ScreenShareStop | channel_id |
| 0x0110 | LinkCapabilitiesRequest | (empty — server responds with capabilities) |

### Server → Client

| Type ID | Name | Payload |
|---------|------|---------|
| 0x0200 | Ready | server_info, channels, members, roles, recent_messages, link_capabilities |
| 0x0201 | ChatMessageBroadcast | message with author info |
| 0x0202 | TypingBroadcast | channel_id, user_hash |
| 0x0203 | PresenceBroadcast | user_hash, status |
| 0x0204 | MemberJoin | user_hash, user_info |
| 0x0205 | MemberLeave | user_hash |
| 0x0206 | MemberBan | user_hash, reason |
| 0x0207 | ChannelCreate | channel_info |
| 0x0208 | ChannelUpdate | channel_info |
| 0x0209 | ChannelDelete | channel_id |
| 0x020A | MessageHistory | messages[] |
| 0x020B | VoiceStateBroadcast | user_hash, channel_id, state |
| 0x020C | RoleUpdate | role_info |
| 0x020D | ServerUpdate | server_info |
| 0x020E | ReactionBroadcast | message_id, emoji, user_hash, added |
| 0x020F | ReadStateSync | channel_id, last_read_id, mention_count |
| 0x0210 | VideoStateBroadcast | user_hash, channel_id, video_enabled, quality |
| 0x0211 | ScreenShareBroadcast | user_hash, channel_id, sharing |
| 0x0212 | LinkCapabilities | audio, video_send, video_recv, screen_share, max_video_quality |

---

## 5. Comparison: Current vs Reticulum Architecture

| Aspect | Current (Client-Server) | Reticulum |
|--------|------------------------|-----------|
| **Auth** | JWT + password hash | Cryptographic identity (keypair) |
| **User ID** | Snowflake (64-bit) | Destination hash (128-bit) |
| **Transport** | HTTP + WebSocket over TCP/IP | RNS over any medium |
| **Encryption** | TLS (transport-level) | E2E per-packet (identity-level) |
| **Forward secrecy** | TLS session keys | ECDH per-link + ratchets |
| **Server hosting** | Cloud VPS + PostgreSQL + Redis | Any device running Python + SQLite |
| **Voice** | mediasoup (WebRTC SFU) | LXST (Codec2/Opus over RNS) |
| **Video** | mediasoup (WebRTC SFU) | LXST extended with H.264/VP9 (internet-only) |
| **Screen share** | mediasoup (WebRTC SFU) | LXST video stream (internet-only) |
| **DMs** | Routed through server | Direct P2P via LXMF |
| **Offline delivery** | Not supported (must be online) | LXMF propagation nodes |
| **Server discovery** | Web-based | Announce-based (cryptographic) |
| **Ban evasion** | New email | New cryptographic identity (hard) |
| **Horizontal scaling** | Redis pub/sub + multiple instances | Each server is independent |
| **File sharing** | HTTP upload to server | RNS Resource transfer |
| **Max message size** | ~2000 chars (arbitrary) | 431 bytes/packet (unlimited via Resources) |
| **Works without internet** | No | Yes (LoRa, serial, packet radio) |

---

## 6. Recommended Implementation Stack

### Server Node

```
Language:       Python 3.11+
Networking:     rns (Reticulum), lxmf, lxst
Database:       SQLite (single-node, no need for PostgreSQL)
Serialization:  msgpack (compact binary, used by LXMF)
Config:         YAML or TOML
Voice:          LXST with Opus/Codec2
Video:          LXST extended with H.264/VP9/AV1 (internet links only)
```

### Client

Two viable approaches:

#### Option A: Python TUI (like Nomad Network)
- Terminal-based UI using `urwid` or `textual`
- Native Reticulum integration (runs RNS directly)
- Works on any platform with Python
- Lowest overhead, works on embedded devices

#### Option B: Python Backend + Web Frontend (recommended for Discord UX parity)
- Python backend handles all Reticulum communication
- Exposes a local WebSocket API to the frontend
- React/TypeScript frontend (reuse existing Harmonium UI)
- The Python↔Browser bridge is localhost only

```
┌─────────────────────────────────────┐
│  Browser (React UI)                 │
│  ┌───────────────────────────────┐  │
│  │ Existing Harmonium frontend   │  │
│  │ (adapted for new event types) │  │
│  └──────────┬────────────────────┘  │
│             │ localhost WebSocket    │
│  ┌──────────▼────────────────────┐  │
│  │ Python Bridge                 │  │
│  │ - Translates WS ↔ RNS        │  │
│  │ - Manages Identity            │  │
│  │ - Handles LXMF for DMs       │  │
│  │ - LXST for voice & video     │  │
│  └──────────┬────────────────────┘  │
│             │ Reticulum              │
│  ┌──────────▼────────────────────┐  │
│  │ RNS Instance                  │  │
│  │ - TCP/UDP/LoRa/Serial/I2P    │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

#### Option C: Electron/Tauri + Python Sidecar
- Desktop app with embedded Python runtime
- Best UX for non-technical users
- Largest distribution size

---

## 7. Migration Path from Current Harmonium

### Phase 1: Core Infrastructure
1. Build Python server node with RNS identity management
2. Implement Link-based client connections with Channel message passing
3. Port the permission system (bitfields work identically)
4. SQLite schema for channels, messages, members, roles

### Phase 2: Messaging
1. Implement ChatMessage type with Channel-based delivery
2. Message history storage and retrieval
3. Typing indicators, reactions, message editing/deletion
4. File attachments via Resource transfer

### Phase 3: Voice & Video
1. Integrate LXST for 1:1 voice calls
2. Build SFU-style fan-out on server node for group voice
3. Codec selection based on link quality (Opus for fast, Codec2 for slow)
4. Link capability detection and transport-aware feature gating
5. Extend LXST with video codec support (H.264/VP9) for internet links
6. Implement screen sharing as a video stream type with STREAM permission
7. Active speaker detection for group video scaling (5+ participants)

### Phase 4: DMs & Offline
1. LXMF integration for direct messages
2. Propagation node support for offline message delivery
3. P2P file sharing for DMs

### Phase 5: Client
1. Python bridge with localhost WebSocket API
2. Adapt existing React frontend to new event types
3. Identity management UI (create, import, export, backup)

### Phase 6: Advanced
1. Server discovery via announce listening
2. Cross-server identity (same keypair, different servers)
3. LoRa/radio transport testing
4. Mobile client (Kivy or React Native with Python bridge)

---

## 8. Lessons from Nomad Network

[Nomad Network](https://github.com/markqvist/NomadNet) is the most mature application built on LXMF and Reticulum. While it's a terminal-based 1:1 messaging tool (not a group chat platform), it serves as a **reference implementation** for many of the patterns Harmonium would need. Rather than building on top of Nomad Network, the goal is to study its solutions and adapt them.

### What to Borrow

#### LXMF Message Handling

Nomad Network's `LXMRouter` integration is the blueprint for DM delivery:

- **Inbound handling**: Registers a delivery callback via `LXMRouter.register_delivery_callback()`. When an LXMF message arrives (whether via direct Link or propagation node sync), the callback fires and the message is persisted locally. Harmonium's server node and client should follow this exact pattern.
- **Outbound routing**: Messages are submitted to `LXMRouter.handle_outbound()`, which automatically selects the best delivery method — direct Link if the recipient is reachable, propagation if not. No manual path management needed.
- **Delivery status tracking**: LXMF messages have delivery callbacks (`set_delivery_callback`) with states like `SENT`, `DELIVERED`, `FAILED`. Harmonium should expose these as read receipts / delivery indicators in the UI.

#### Propagation Node Integration

Nomad Network can both **use** and **act as** a propagation node:

- **As a client**: Configures an outbound propagation node for store-and-forward when direct delivery fails. The server node should do this for offline member message queuing.
- **As a node**: Runs `LXMRouter.enable_propagation()` to accept and relay messages for other identities. Each Harmonium server node should also act as a propagation node for its members, giving them offline delivery without relying on third-party infrastructure.
- **Sync protocol**: Propagation nodes automatically peer and synchronize messages. Harmonium could leverage this for server node redundancy — run two nodes for the same community, and propagation peering keeps them in sync.

#### Conversation Persistence

Nomad Network stores conversations as directories on the filesystem:

```
conversations/
├── <destination_hash_hex>/
│   ├── <timestamp>_<message_hash>    # Individual message files
│   ├── <timestamp>_<message_hash>
│   └── unread                        # Marker file for unread state
└── <destination_hash_hex>/
    └── ...
```

Messages are written using `LXMessage.write_to_directory()` and read back with `LXMessage.unpack_from_file()`. This is simple and reliable for DMs. For server channels (which need indexing, pagination, and search), Harmonium should use SQLite instead, but the per-conversation directory pattern could still work for DM storage on the client side.

#### Announce Handling & Peer Discovery

Nomad Network registers an announce handler filtering on the `"lxmf.delivery"` aspect:

```python
RNS.Transport.register_announce_handler(
    AnnounceHandler(aspect_filter="lxmf.delivery", callback=peer_discovered)
)
```

When an announce arrives, it extracts the `app_data` (display name) and caches the peer's identity. Harmonium should register handlers for both `"harmonium.user"` and `"harmonium.server"` aspects, caching display names, avatars hashes, and server metadata from announces.

#### Identity & Display Name Management

Nomad Network carries the user's display name in the announce `app_data` field and caches known peers' names locally. This is the right pattern — Harmonium should:

1. Announce the user's display name + discriminator + avatar hash + status in `app_data`
2. Cache all discovered peer info locally (indexed by destination hash)
3. Update the cache whenever a new announce is received from a known peer
4. Show the destination hash as a fallback when no cached name exists

### What NOT to Borrow

#### TUI Architecture

Nomad Network uses `urwid` for its terminal UI. This is irrelevant to Harmonium — the Python bridge + React frontend approach gives much better UX. Don't try to adapt or extend the TUI.

#### Flat Conversation Model

Nomad Network treats all conversations as equal, flat, 1:1 exchanges. There's no concept of servers, channels, categories, or permissions. The entire organizational layer must be built from scratch.

#### Single-User Design

Nomad Network assumes a single user identity per running instance. Harmonium's server node needs to manage many concurrent member Links simultaneously, which is a fundamentally different concurrency model. The server node will need async/threaded Link management, not Nomad Network's single-threaded approach.

#### Page/Content Hosting

Nomad Network includes a Gopher/Gemini-like page hosting system where nodes serve text pages. This is tangential to chat functionality and not worth porting.

### Specific Code to Study

| Nomad Network File | What to Learn |
|---------------------|---------------|
| `NomadNet/Conversation.py` | Message persistence, unread tracking, conversation lifecycle |
| `NomadNet/Directory.py` | Peer discovery, announce caching, identity→name mapping |
| `NomadNet/Node.py` | How to run as a network node accepting connections |
| `NomadNet/LXMF/LXMRouter.py` (in LXMF lib) | Message routing, propagation peering, delivery method selection |
| `NomadNet/LXMF/LXMessage.py` (in LXMF lib) | Message format, fields, serialization, file I/O |

### How This Changes the Migration Path

With Nomad Network as a reference, Phase 4 (DMs & Offline) becomes significantly easier:

- **DMs**: Adapt Nomad Network's conversation + LXMRouter pattern almost directly
- **Offline delivery**: Enable propagation on the server node — the LXMF library handles the hard parts (peering, sync, deduplication)
- **Peer discovery**: Copy the announce handler pattern for both user and server discovery

The server node itself is essentially a **multi-channel, multi-user Nomad Network node** with a permissions layer and voice support added on top.

---

## 9. Open Questions & Trade-offs

### Server Node Trust

The server node operator can read messages in server channels (they're decrypted on the node for fan-out). Options:
1. **Accept it** — same as Discord, server operators are trusted
2. **Double encryption** — encrypt messages to each recipient individually (expensive, O(N) per message)
3. **Group ratchet** — shared symmetric key rotated on membership changes (complex key management)

**Recommendation**: Accept the Discord model for server channels. Use LXMF for truly private DMs.

### Message Size Limits

At 431 bytes per Link packet, messages are much shorter than Discord's 2000-char limit. Options:
1. **Resource transfer** for long messages (adds latency for segmentation)
2. **Accept shorter messages** — encourage concise communication
3. **Automatic segmentation** — split long messages into multiple packets, reassemble on receipt

**Recommendation**: Use Resources for messages over 400 bytes. Most chat messages are well under this limit.

### Scalability

A single server node can likely handle hundreds of concurrent Links, but not thousands. Options:
1. **Accept the limit** — most Discord servers have <100 concurrent users
2. **Federation** — multiple nodes share server state (complex consensus)
3. **Sharding** — different channels on different nodes

**Recommendation**: Start with single-node. Most communities are small. Federation can come later.

### No Native Multicast

Reticulum doesn't have native multicast to multiple SINGLE destinations. The server node must send individual packets to each connected member. On fast links this is fine; on LoRa with 50 members, a single message broadcast would take a long time.

**Recommendation**: Design the protocol to be bandwidth-aware. Server nodes should track each member's link quality and adapt (e.g., batch updates, compress, or skip non-essential events for slow links).

---

## 10. Sources

- [Reticulum Network](https://reticulum.network/)
- [Reticulum Manual](https://reticulum.network/manual/)
- [Reticulum API Reference](https://reticulum.network/manual/reference.html)
- [GitHub — Reticulum](https://github.com/markqvist/Reticulum)
- [GitHub — LXMF](https://github.com/markqvist/LXMF)
- [GitHub — LXST](https://github.com/markqvist/LXST)
- [GitHub — NomadNet](https://github.com/markqvist/NomadNet)
- [GitHub — Sideband](https://github.com/markqvist/Sideband)
- [GitHub — reticulum-meshchat](https://github.com/liamcottle/reticulum-meshchat)
- [Group messaging discussion #465](https://github.com/markqvist/Reticulum/discussions/465)
- [Group chat discussion #994](https://github.com/markqvist/Reticulum/discussions/994)
