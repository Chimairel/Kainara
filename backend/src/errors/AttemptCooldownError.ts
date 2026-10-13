/** An existing account lock or resend cooldown, reported without restarting its timer. */
export class AttemptCooldownError extends Error {
  constructor(message: string, public readonly retryAfterSeconds: number) {
    super(message);
    this.name = 'AttemptCooldownError';
  }
}
