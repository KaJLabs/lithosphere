/**
 * Bridge transaction state machine.
 *
 * IDLE → APPROVING → APPROVED → LOCKING → LOCKED → WAITING_SIGNATURES → COMPLETED
 *                          ↓
 *                        ERROR (from any step)
 */
export const MULTX_STEPS = {
  IDLE: 'idle',
  APPROVING: 'approving',
  APPROVED: 'approved',
  LOCKING: 'locking',
  LOCKED: 'locked',
  WAITING_SIGNATURES: 'waiting_signatures',
  COMPLETED: 'completed',
  ERROR: 'error',
} as const;

export type MultXStep = (typeof MULTX_STEPS)[keyof typeof MULTX_STEPS];
