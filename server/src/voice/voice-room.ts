import type {
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
  RtpCapabilities,
  RtpParameters,
  DtlsParameters,
  MediaKind,
} from 'mediasoup/types';
import type { ProducerType } from '@harmonium/shared';
import { getTransportOptions } from './mediasoup-config.js';

export interface VoicePeer {
  userId: string;
  sendTransport: WebRtcTransport | null;
  recvTransport: WebRtcTransport | null;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

export interface TransportConnectInfo {
  sendTransport: {
    id: string;
    iceParameters: unknown;
    iceCandidates: unknown;
    dtlsParameters: unknown;
  };
  recvTransport: {
    id: string;
    iceParameters: unknown;
    iceCandidates: unknown;
    dtlsParameters: unknown;
  };
  rtpCapabilities: RtpCapabilities;
}

export class VoiceRoom {
  private readonly router: Router;
  private readonly peers = new Map<string, VoicePeer>();
  readonly producerMetadata = new Map<string, ProducerType>();

  constructor(router: Router) {
    this.router = router;
  }

  get rtpCapabilities(): RtpCapabilities {
    return this.router.rtpCapabilities;
  }

  get peerCount(): number {
    return this.peers.size;
  }

  get isEmpty(): boolean {
    return this.peers.size === 0;
  }

  hasPeer(userId: string): boolean {
    return this.peers.has(userId);
  }

  async addPeer(userId: string): Promise<TransportConnectInfo> {
    // If peer already exists, clean up first
    if (this.peers.has(userId)) {
      await this.removePeer(userId);
    }

    const transportOptions = getTransportOptions();

    // Create send (producer) transport
    const sendTransport = await this.router.createWebRtcTransport(transportOptions);

    // Create recv (consumer) transport
    const recvTransport = await this.router.createWebRtcTransport(transportOptions);

    const peer: VoicePeer = {
      userId,
      sendTransport,
      recvTransport,
      producers: new Map(),
      consumers: new Map(),
    };

    this.peers.set(userId, peer);

    return {
      sendTransport: {
        id: sendTransport.id,
        iceParameters: sendTransport.iceParameters,
        iceCandidates: sendTransport.iceCandidates,
        dtlsParameters: sendTransport.dtlsParameters,
      },
      recvTransport: {
        id: recvTransport.id,
        iceParameters: recvTransport.iceParameters,
        iceCandidates: recvTransport.iceCandidates,
        dtlsParameters: recvTransport.dtlsParameters,
      },
      rtpCapabilities: this.router.rtpCapabilities,
    };
  }

  async connectTransport(
    userId: string,
    transportId: string,
    dtlsParameters: DtlsParameters,
  ): Promise<void> {
    const peer = this.peers.get(userId);
    if (!peer) {
      throw new Error('Peer not found in room');
    }

    const transport = this.findTransport(peer, transportId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    await transport.connect({ dtlsParameters });
  }

  async produce(
    userId: string,
    transportId: string,
    kind: MediaKind,
    rtpParameters: RtpParameters,
    producerType: ProducerType,
  ): Promise<string> {
    const peer = this.peers.get(userId);
    if (!peer) {
      throw new Error('Peer not found in room');
    }

    const transport = this.findTransport(peer, transportId);
    if (!transport) {
      throw new Error('Transport not found');
    }

    const producer = await transport.produce({ kind, rtpParameters });

    peer.producers.set(producer.id, producer);
    this.producerMetadata.set(producer.id, producerType);

    // Clean up on producer close
    producer.on('transportclose', () => {
      peer.producers.delete(producer.id);
      this.producerMetadata.delete(producer.id);
    });

    return producer.id;
  }

  async consume(
    userId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities,
  ): Promise<{
    id: string;
    producerId: string;
    kind: MediaKind;
    rtpParameters: RtpParameters;
  }> {
    const peer = this.peers.get(userId);
    if (!peer) {
      throw new Error('Peer not found in room');
    }

    if (!peer.recvTransport) {
      throw new Error('Receive transport not found');
    }

    const canConsume = this.router.canConsume({ producerId, rtpCapabilities });
    if (!canConsume) {
      throw new Error('Cannot consume this producer');
    }

    const consumer = await peer.recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Start paused — client calls resumeConsumer after setup
    });

    peer.consumers.set(consumer.id, consumer);

    // Clean up on consumer close
    consumer.on('transportclose', () => {
      peer.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      peer.consumers.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  async resumeConsumer(userId: string, consumerId: string): Promise<void> {
    const peer = this.peers.get(userId);
    if (!peer) {
      throw new Error('Peer not found in room');
    }

    const consumer = peer.consumers.get(consumerId);
    if (!consumer) {
      throw new Error('Consumer not found');
    }

    await consumer.resume();
  }

  async removePeer(userId: string): Promise<void> {
    const peer = this.peers.get(userId);
    if (!peer) return;

    // Close all consumers
    for (const consumer of peer.consumers.values()) {
      consumer.close();
    }
    peer.consumers.clear();

    // Close all producers and clean up metadata
    for (const [producerId, producer] of peer.producers) {
      producer.close();
      this.producerMetadata.delete(producerId);
    }
    peer.producers.clear();

    // Close transports
    if (peer.sendTransport) {
      peer.sendTransport.close();
    }
    if (peer.recvTransport) {
      peer.recvTransport.close();
    }

    this.peers.delete(userId);
  }

  getOtherProducerIds(excludeUserId: string): Array<{ producerId: string; userId: string; kind: MediaKind; producerType: ProducerType }> {
    const result: Array<{ producerId: string; userId: string; kind: MediaKind; producerType: ProducerType }> = [];

    for (const [userId, peer] of this.peers) {
      if (userId === excludeUserId) continue;
      for (const [producerId, producer] of peer.producers) {
        const producerType = this.producerMetadata.get(producerId) ?? 'audio';
        result.push({ producerId, userId, kind: producer.kind, producerType });
      }
    }

    return result;
  }

  getProducersByUser(userId: string): Array<{ producerId: string; kind: MediaKind }> {
    const peer = this.peers.get(userId);
    if (!peer) return [];
    return Array.from(peer.producers.entries()).map(([id, p]) => ({
      producerId: id,
      kind: p.kind,
    }));
  }

  async closeProducer(userId: string, producerId: string): Promise<MediaKind | null> {
    const peer = this.peers.get(userId);
    if (!peer) return null;
    const producer = peer.producers.get(producerId);
    if (!producer) return null;
    const kind = producer.kind;
    producer.close();
    peer.producers.delete(producerId);
    this.producerMetadata.delete(producerId);
    return kind;
  }

  getScreenSharerUserId(): string | null {
    for (const [userId, peer] of this.peers) {
      for (const [producerId] of peer.producers) {
        if (this.producerMetadata.get(producerId) === 'screenShare') return userId;
      }
    }
    return null;
  }

  getWebcamUserIds(): string[] {
    const userIds: string[] = [];
    for (const [userId, peer] of this.peers) {
      for (const [producerId] of peer.producers) {
        if (this.producerMetadata.get(producerId) === 'webcam') {
          userIds.push(userId);
          break;
        }
      }
    }
    return userIds;
  }

  close(): void {
    // Close all peer transports first
    for (const peer of this.peers.values()) {
      for (const consumer of peer.consumers.values()) {
        consumer.close();
      }
      for (const [producerId, producer] of peer.producers) {
        producer.close();
        this.producerMetadata.delete(producerId);
      }
      if (peer.sendTransport) peer.sendTransport.close();
      if (peer.recvTransport) peer.recvTransport.close();
    }
    this.peers.clear();

    // Close the router
    this.router.close();
  }

  private findTransport(peer: VoicePeer, transportId: string): WebRtcTransport | null {
    if (peer.sendTransport?.id === transportId) return peer.sendTransport;
    if (peer.recvTransport?.id === transportId) return peer.recvTransport;
    return null;
  }
}
