import { RoomError } from '@poke-air/core';
import type { Result } from '@poke-air/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { z } from 'zod';

type AnyAck = (result: Result<object>) => void;

/**
 * Wraps a socket event handler:
 * - validates the payload with zod (INVALID_PAYLOAD on failure),
 * - acks `{ ok: true, ...result }` on success,
 * - maps `RoomError` to `{ ok: false, error }` and anything else to INTERNAL_ERROR.
 */
export function withValidation<S extends z.ZodType, R extends object | void>(
  schema: S,
  logger: FastifyBaseLogger,
  handler: (payload: z.output<S>) => R,
) {
  return (payload: unknown, ack: unknown): void => {
    const reply: AnyAck = typeof ack === 'function' ? (ack as AnyAck) : () => {};
    const parsed = schema.safeParse(payload ?? {});
    if (!parsed.success) {
      reply({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
      return;
    }
    try {
      const result = handler(parsed.data);
      reply({ ok: true, ...(result ?? {}) });
    } catch (error) {
      if (error instanceof RoomError) {
        reply({ ok: false, error: error.toPayload() });
        return;
      }
      logger.error({ err: error }, 'Unhandled socket handler error');
      reply({ ok: false, error: { code: 'INTERNAL_ERROR' } });
    }
  };
}
