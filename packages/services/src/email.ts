/**
 * Outgoing email, behind an interface so the provider can be replaced and
 * tests can use a fake. Only the services layer sends email.
 */
export interface OutgoingEmail {
  readonly to: readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly replyTo?: string;
}

export interface EmailSender {
  send(email: OutgoingEmail): Promise<void>;
}

export class EmailSendError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'EmailSendError';
    this.status = status;
  }
}

/** Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendEmailSender implements EmailSender {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey: string, from: string, fetchImpl: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.from = from;
    this.fetchImpl = fetchImpl;
  }

  /** Null unless both the key and the sender address are configured. */
  static fromEnv(env: Readonly<Record<string, string | undefined>>): ResendEmailSender | null {
    const key = env.RESEND_API_KEY?.trim();
    const from = env.GENCUT_EMAIL_FROM?.trim();
    return key && from ? new ResendEmailSender(key, from) : null;
  }

  async send(email: OutgoingEmail): Promise<void> {
    const res = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: this.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Resend's error body names the problem (bad key, unverified domain); it never echoes the key.
      let detail = '';
      try {
        const body = (await res.json()) as { message?: unknown; name?: unknown };
        detail = String(body.message ?? body.name ?? '').slice(0, 200);
      } catch {
        // no body
      }
      throw new EmailSendError(res.status, `Email provider refused the message (${res.status})${detail ? `: ${detail}` : ''}`);
    }
  }
}
