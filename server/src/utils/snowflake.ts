// Snowflake ID Generator
// Structure: 42 bits timestamp | 5 bits worker | 5 bits process | 12 bits sequence
// Custom epoch: January 1, 2024

const CUSTOM_EPOCH = 1704067200000n; // 2024-01-01T00:00:00.000Z

const WORKER_ID_BITS = 5n;
const PROCESS_ID_BITS = 5n;
const SEQUENCE_BITS = 12n;

const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n; // 4095

const WORKER_ID_SHIFT = SEQUENCE_BITS;                              // 12
const PROCESS_ID_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS;            // 17
const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS + PROCESS_ID_BITS; // 22

let lastTimestamp = -1n;
let sequence = 0n;

const workerId = 0n;
const processId = 0n;

function currentTimestamp(): bigint {
  return BigInt(Date.now());
}

export function generateId(): bigint {
  let now = currentTimestamp();

  if (now === lastTimestamp) {
    sequence = (sequence + 1n) & MAX_SEQUENCE;
    // Sequence exhausted in this millisecond; wait for next ms
    if (sequence === 0n) {
      while (now <= lastTimestamp) {
        now = currentTimestamp();
      }
    }
  } else {
    sequence = 0n;
  }

  lastTimestamp = now;

  const id =
    ((now - CUSTOM_EPOCH) << TIMESTAMP_SHIFT) |
    (workerId << WORKER_ID_SHIFT) |
    (processId << PROCESS_ID_SHIFT) |
    sequence;

  return id;
}

export function snowflakeToTimestamp(id: bigint): Date {
  const timestamp = (id >> TIMESTAMP_SHIFT) + CUSTOM_EPOCH;
  return new Date(Number(timestamp));
}
