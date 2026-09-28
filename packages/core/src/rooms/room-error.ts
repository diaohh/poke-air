import type { ErrorCode, ErrorPayload } from '@poke-air/shared';

/** Domain error thrown by core logic. Transport adapters turn it into an `ErrorPayload`. */
export class RoomError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly params?: Record<string, string | number>,
  ) {
    super(code);
    this.name = 'RoomError';
  }

  toPayload(): ErrorPayload {
    return this.params ? { code: this.code, params: this.params } : { code: this.code };
  }
}
