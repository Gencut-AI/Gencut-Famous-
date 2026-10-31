import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encrypts platform tokens at rest with AES-256-GCM. Keys come from the
 * platform secret store as GENCUT_TOKEN_KEYS="k2:<base64 32 bytes>,k1:<…>";
 * the first key encrypts, every listed key can decrypt, so keys rotate
 * without downtime. The channel id is bound in as associated data, so a
 * ciphertext copied to another row will not decrypt.
 */
export interface Sealed {
  readonly keyId: string;
  readonly nonce: Uint8Array;
  readonly ciphertext: Uint8Array;
}

export class TokenCipher {
  private readonly keys: ReadonlyMap<string, Buffer>;
  private readonly current: string;

  constructor(keys: ReadonlyArray<{ id: string; key: Buffer }>) {
    if (!keys.length) throw new Error('No token encryption key configured.');
    for (const k of keys) {
      if (!/^[a-z0-9_-]{1,20}$/.test(k.id)) throw new Error('Token key ids are short lowercase words.');
      if (k.key.length !== 32) throw new Error(`Token key ${k.id} must be 32 bytes.`);
    }
    this.keys = new Map(keys.map((k) => [k.id, k.key]));
    this.current = keys[0]?.id as string;
  }

  /** Parse GENCUT_TOKEN_KEYS; null when unset (connecting is then disabled, never unencrypted). */
  static fromEnv(raw: string | undefined): TokenCipher | null {
    if (!raw?.trim()) return null;
    const keys = raw.split(',').map((part) => {
      const [id, b64] = part.trim().split(':');
      if (!id || !b64) throw new Error('GENCUT_TOKEN_KEYS must look like "k1:<base64>".');
      return { id, key: Buffer.from(b64, 'base64') };
    });
    return new TokenCipher(keys);
  }

  seal(plaintext: string, aad: string): Sealed {
    const key = this.keys.get(this.current) as Buffer;
    const nonce = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', key, nonce);
    c.setAAD(Buffer.from(aad));
    const body = Buffer.concat([c.update(plaintext, 'utf8'), c.final(), c.getAuthTag()]);
    return { keyId: this.current, nonce, ciphertext: body };
  }

  open(s: Sealed, aad: string): string {
    const key = this.keys.get(s.keyId);
    if (!key) throw new Error(`Token key ${s.keyId} is no longer configured.`);
    const body = Buffer.from(s.ciphertext);
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(s.nonce));
    d.setAAD(Buffer.from(aad));
    d.setAuthTag(body.subarray(body.length - 16));
    return Buffer.concat([d.update(body.subarray(0, body.length - 16)), d.final()]).toString('utf8');
  }
}
