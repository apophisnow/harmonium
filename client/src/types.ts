import type { Message } from '@harmonium/shared';

/** Message with client-only fields for optimistic UI */
export interface ClientMessage extends Message {
  _isPending?: boolean;
  _isFailed?: boolean;
  _tempId?: string;
}
