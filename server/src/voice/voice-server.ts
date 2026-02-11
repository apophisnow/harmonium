import * as mediasoup from 'mediasoup';
import type { Worker } from 'mediasoup/types';
import { workerSettings, mediaCodecs, NUM_WORKERS } from './mediasoup-config.js';
import { VoiceRoom } from './voice-room.js';

export class VoiceServer {
  private workers: Worker[] = [];
  private rooms = new Map<string, VoiceRoom>();
  private nextWorkerIndex = 0;

  async initialize(): Promise<void> {
    for (let i = 0; i < NUM_WORKERS; i++) {
      const worker = await mediasoup.createWorker(workerSettings);

      worker.on('died', () => {
        console.error(`mediasoup worker ${worker.pid} died, exiting...`);
        // Remove from pool — in production you might want to restart
        const idx = this.workers.indexOf(worker);
        if (idx !== -1) {
          this.workers.splice(idx, 1);
        }
      });

      this.workers.push(worker);
    }

    console.log(`VoiceServer initialized with ${this.workers.length} mediasoup workers`);
  }

  private getNextWorker(): Worker {
    if (this.workers.length === 0) {
      throw new Error('No mediasoup workers available');
    }

    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async getOrCreateRoom(channelId: string): Promise<VoiceRoom> {
    let room = this.rooms.get(channelId);
    if (room) return room;

    const worker = this.getNextWorker();
    const router = await worker.createRouter({ mediaCodecs });
    room = new VoiceRoom(router);
    this.rooms.set(channelId, room);

    return room;
  }

  getRoom(channelId: string): VoiceRoom | undefined {
    return this.rooms.get(channelId);
  }

  removeRoom(channelId: string): void {
    const room = this.rooms.get(channelId);
    if (room) {
      room.close();
      this.rooms.delete(channelId);
    }
  }

  async shutdown(): Promise<void> {
    // Close all rooms
    for (const [channelId, room] of this.rooms) {
      room.close();
      this.rooms.delete(channelId);
    }

    // Close all workers
    for (const worker of this.workers) {
      worker.close();
    }
    this.workers = [];

    console.log('VoiceServer shut down');
  }
}

/** Module-level singleton, following the pattern used by other modules (e.g., PubSubManager, ConnectionManager) */
let voiceServerInstance: VoiceServer | undefined;

export function getVoiceServer(): VoiceServer {
  if (!voiceServerInstance) {
    voiceServerInstance = new VoiceServer();
  }
  return voiceServerInstance;
}
