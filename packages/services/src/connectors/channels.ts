import { randomBytes } from 'node:crypto';
import {
  type ConnectionState,
  INSTAGRAM,
  INSTAGRAM_SCOPES,
  type Platform,
  connectionState,
  connectorFor,
  effectiveInstagramScopes,
  instagramScopeLabel,
  missingScopes,
  parseGrantedScopes,
} from '@gencut/core';
import { z } from 'zod';
import { recordAudit } from '../audit.ts';
import type { RequestContext } from '../context.ts';
import type { Db, Sql } from '../db.ts';
import { ServiceError } from '../errors.ts';
import { requireCapability } from '../membership.ts';
import type { TokenCipher } from './crypto.ts';
import { type InstagramApi, InstagramApiError } from './instagram-api.ts';

export interface ConnectorDeps {
  readonly instagram: InstagramApi;
  readonly cipher: TokenCipher;
  readonly now?: () => Date;
}

export interface ChannelView {
  readonly id: string;
  readonly platform: Platform;
  readonly username: string;
  readonly displayName: string | null;
  readonly accountType: string | null;
  readonly state: ConnectionState;
  readonly missingScopes: readonly string[];
  readonly connectedAt: Date;
  readonly accessExpiresAt: Date | null;
  readonly lastSyncedAt: Date | null;
  readonly lastSyncStatus: 'ok' | 'partial' | 'failed' | null;
  readonly lastSyncError: string | null;
  readonly authError: string | null;
}

interface ChannelRow {
  id: string;
  platform: Platform;
  username: string;
  display_name: string | null;
  account_type: string | null;
  granted_scopes: string[];
  connected_at: Date;
  access_expires_at: Date | null;
  last_synced_at: Date | null;
  last_sync_status: ChannelView['lastSyncStatus'];
  last_sync_error: string | null;
  auth_error: string | null;
  revoked_at: Date | null;
}

export function toChannelView(r: ChannelRow, now: Date): ChannelView {
  const m = connectorFor(r.platform);
  const granted = r.platform === 'instagram' ? effectiveInstagramScopes(r.granted_scopes) : r.granted_scopes;
  const missing = missingScopes(m, granted).map((s) => (r.platform === 'instagram' ? instagramScopeLabel(s, r.granted_scopes) : s));
  return {
    id: r.id, platform: r.platform, username: r.username, displayName: r.display_name, accountType: r.account_type,
    state: connectionState(m, { grantedScopes: granted, accountType: r.account_type, accessExpiresAt: r.access_expires_at, revokedAt: r.revoked_at, authError: r.auth_error }, now),
    missingScopes: missing, connectedAt: r.connected_at, accessExpiresAt: r.access_expires_at,
    lastSyncedAt: r.last_synced_at, lastSyncStatus: r.last_sync_status, lastSyncError: r.last_sync_error, authError: r.auth_error,
  };
}

/** Active connections (disconnected ones are history, kept until their data is deleted). */
export async function listChannels(db: Db, ctx: RequestContext, workspaceId: string, now = new Date()): Promise<ChannelView[]> {
  await requireCapability(db, ctx, workspaceId, 'view');
  return loadChannels(db, workspaceId, now);
}

export async function loadChannels(db: Db, workspaceId: string, now = new Date()): Promise<ChannelView[]> {
  const rows = await db<ChannelRow[]>`
    SELECT c.id, c.platform, c.username, c.display_name, c.account_type, c.granted_scopes, c.connected_at, k.access_expires_at,
           c.last_synced_at, c.last_sync_status, c.last_sync_error, c.auth_error, c.revoked_at
    FROM creator_channels c LEFT JOIN channel_credentials k ON k.channel_id = c.id
    WHERE c.workspace_id = ${workspaceId} AND c.revoked_at IS NULL
    ORDER BY c.platform, c.connected_at
  `;
  return rows.map((r) => toChannelView(r, now));
}

/** Store a token for a channel, encrypted, bound to the channel id. `now` is when it was issued. */
export async function storeCredential(db: Db, cipher: TokenCipher, channelId: string, token: string, expiresAt: Date | null, now = new Date()): Promise<void> {
  const s = cipher.seal(token, `channel:${channelId}`);
  await db`
    INSERT INTO channel_credentials (channel_id, key_id, nonce, ciphertext, access_expires_at, issued_at, updated_at)
    VALUES (${channelId}, ${s.keyId}, ${Buffer.from(s.nonce)}, ${Buffer.from(s.ciphertext)}, ${expiresAt}, ${now}, now())
    ON CONFLICT (channel_id) DO UPDATE SET key_id = EXCLUDED.key_id, nonce = EXCLUDED.nonce, ciphertext = EXCLUDED.ciphertext,
      access_expires_at = EXCLUDED.access_expires_at, issued_at = EXCLUDED.issued_at, updated_at = now()
  `;
}

export async function readCredential(db: Db, cipher: TokenCipher, channelId: string): Promise<{ token: string; issuedAt: Date; expiresAt: Date | null } | null> {
  const [row] = await db<{ key_id: string; nonce: Buffer; ciphertext: Buffer; issued_at: Date; access_expires_at: Date | null }[]>`
    SELECT key_id, nonce, ciphertext, issued_at, access_expires_at FROM channel_credentials WHERE channel_id = ${channelId}
  `;
  if (!row) return null;
  const token = cipher.open({ keyId: row.key_id, nonce: row.nonce, ciphertext: row.ciphertext }, `channel:${channelId}`);
  return { token, issuedAt: row.issued_at, expiresAt: row.access_expires_at };
}

/** Where to send the creator to connect Instagram. The caller keeps `state` bound to the browser. */
export function instagramAuthorizeUrl(deps: Pick<ConnectorDeps, 'instagram'>, redirectUri: string, state: string): string {
  return deps.instagram.authorizeUrl(redirectUri, state, INSTAGRAM_SCOPES);
}

/**
 * Finish Instagram sign-in: exchange the code, keep a long-lived token
 * (encrypted), record exactly which permissions were granted, and say what
 * state the connection is in. A personal account is refused, not stored.
 */
export async function connectInstagram(
  sql: Sql,
  ctx: RequestContext,
  workspaceId: string,
  code: string,
  redirectUri: string,
  deps: ConnectorDeps,
): Promise<ChannelView> {
  const now = deps.now?.() ?? new Date();
  await requireCapability(sql, ctx, workspaceId, 'manage_channels');
  if (!/^[A-Za-z0-9_#-]{10,1000}$/.test(code)) throw new ServiceError('invalid', 'Instagram returned an unexpected sign-in code. Try connecting again.');

  let grant;
  let long;
  let account;
  try {
    grant = await deps.instagram.exchangeCode(code, redirectUri);
    long = await deps.instagram.longLived(grant.accessToken);
    account = await deps.instagram.account(long.accessToken);
  } catch (e) {
    if (e instanceof InstagramApiError) throw new ServiceError('invalid', `${e.message}. Try connecting again.`);
    throw e;
  }
  const scopes = parseGrantedScopes(grant.permissions);
  if (account.accountType && !INSTAGRAM.accountTypes.includes(account.accountType)) {
    throw new ServiceError('invalid', 'This is a personal Instagram account. Switch it to a Creator or Business account in Instagram settings, then connect again.');
  }
  const expiresAt = long.expiresInSeconds > 0 ? new Date(now.getTime() + long.expiresInSeconds * 1000) : null;

  return (await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'manage_channels');
    const [elsewhere] = await tx<{ workspace_id: string }[]>`
      SELECT workspace_id FROM creator_channels WHERE platform = 'instagram' AND external_account_id = ${account.userId} AND revoked_at IS NULL FOR UPDATE
    `;
    if (elsewhere && elsewhere.workspace_id !== workspaceId) {
      throw new ServiceError('invalid', `@${account.username} is already connected to another GenCut creator. Disconnect it there first.`);
    }
    const [row] = elsewhere
      ? await tx<{ id: string }[]>`
          UPDATE creator_channels SET username = ${account.username}, display_name = ${account.name}, account_type = ${account.accountType},
            profile_picture_url = ${account.profilePictureUrl}, granted_scopes = ${scopes}, auth_error = NULL, connected_by = ${ctx.userId},
            connected_at = ${now}, updated_at = now()
          WHERE platform = 'instagram' AND external_account_id = ${account.userId} AND revoked_at IS NULL RETURNING id`
      : await tx<{ id: string }[]>`
          INSERT INTO creator_channels (workspace_id, platform, external_account_id, username, display_name, account_type, profile_picture_url, granted_scopes, connected_by, connected_at)
          VALUES (${workspaceId}, 'instagram', ${account.userId}, ${account.username}, ${account.name}, ${account.accountType}, ${account.profilePictureUrl}, ${scopes}, ${ctx.userId}, ${now})
          RETURNING id`;
    if (!row) throw new Error('channel upsert returned no row');
    await storeCredential(tx, deps.cipher, row.id, long.accessToken, expiresAt, now);
    const [view] = (await loadChannels(tx, workspaceId, now)).filter((c) => c.id === row.id);
    if (!view) throw new Error('channel vanished');
    await recordAudit(tx, {
      workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'channel', entityId: row.id,
      action: elsewhere ? 'reconnected' : 'connected', toState: view.state,
      detail: { platform: 'instagram', username: account.username, accountType: account.accountType, grantedScopes: scopes, missingScopes: view.missingScopes },
    });
    return view;
  })) as ChannelView;
}

/**
 * Disconnect: delete GenCut's copy of the token at once and mark the channel
 * disconnected. Content and readings stay until the owner deletes them, so
 * growth history survives a reconnect. Instagram Login has no revoke call
 * (see the connector manifest), so the page also tells the creator where to
 * remove GenCut in Instagram.
 */
export async function disconnectChannel(sql: Sql, ctx: RequestContext, workspaceId: string, channelId: string): Promise<void> {
  if (!z.uuid().safeParse(channelId).success) throw new ServiceError('not_found', 'That account is not connected.');
  await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'manage_channels');
    const [ch] = await tx<{ platform: Platform; username: string }[]>`
      UPDATE creator_channels SET revoked_at = now(), revoked_by = ${ctx.userId}, updated_at = now()
      WHERE id = ${channelId} AND workspace_id = ${workspaceId} AND revoked_at IS NULL RETURNING platform, username
    `;
    if (!ch) throw new ServiceError('not_found', 'That account is not connected.');
    await tx`DELETE FROM channel_credentials WHERE channel_id = ${channelId}`;
    await recordAudit(tx, {
      workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'channel', entityId: channelId,
      action: 'disconnected', toState: 'revoked', detail: { platform: ch.platform, username: ch.username, tokenDeleted: true, platformRevocation: 'not_available' },
    });
  });
}

/** Owner only: erase a channel and everything read from it (content, readings, token). */
export async function deleteChannelData(sql: Sql, ctx: RequestContext, workspaceId: string, channelId: string): Promise<void> {
  if (!z.uuid().safeParse(channelId).success) throw new ServiceError('not_found', 'Not found.');
  await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'delete_data');
    const [ch] = await tx<{ platform: Platform }[]>`DELETE FROM creator_channels WHERE id = ${channelId} AND workspace_id = ${workspaceId} RETURNING platform`;
    if (!ch) throw new ServiceError('not_found', 'Not found.');
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'channel', entityId: channelId, action: 'data_deleted', detail: { platform: ch.platform } });
  });
}

/** Disconnected channels whose data is still held, so the owner can delete it. */
export async function listDisconnected(db: Db, ctx: RequestContext, workspaceId: string): Promise<Array<{ id: string; platform: Platform; username: string; revokedAt: Date }>> {
  await requireCapability(db, ctx, workspaceId, 'view');
  const rows = await db<{ id: string; platform: Platform; username: string; revoked_at: Date }[]>`
    SELECT id, platform, username, revoked_at FROM creator_channels WHERE workspace_id = ${workspaceId} AND revoked_at IS NOT NULL ORDER BY revoked_at DESC
  `;
  return rows.map((r) => ({ id: r.id, platform: r.platform, username: r.username, revokedAt: r.revoked_at }));
}

/**
 * Meta's callbacks, after the signed request is verified by the caller.
 * Deauthorize: the person removed GenCut in Instagram → disconnect.
 * Data deletion: the person asked Meta to delete their data → erase it and
 * return a confirmation code they can look up.
 */
export async function metaDeauthorized(sql: Sql, instagramUserId: string): Promise<number> {
  return (await sql.begin(async (tx) => {
    const rows = await tx<{ id: string; workspace_id: string }[]>`
      UPDATE creator_channels SET revoked_at = now(), auth_error = 'Removed in Instagram', updated_at = now()
      WHERE platform = 'instagram' AND external_account_id = ${instagramUserId} AND revoked_at IS NULL RETURNING id, workspace_id
    `;
    for (const r of rows) {
      await tx`DELETE FROM channel_credentials WHERE channel_id = ${r.id}`;
      await recordAudit(tx, { workspaceId: r.workspace_id, actorType: 'system', actorId: 'meta', via: 'api', entityType: 'channel', entityId: r.id, action: 'deauthorized_by_platform', toState: 'revoked' });
    }
    return rows.length;
  })) as number;
}

export async function metaDataDeletion(sql: Sql, instagramUserId: string): Promise<{ confirmationCode: string; channelsDeleted: number }> {
  const confirmationCode = randomBytes(9).toString('base64url');
  return (await sql.begin(async (tx) => {
    const rows = await tx<{ id: string; workspace_id: string }[]>`
      DELETE FROM creator_channels WHERE platform = 'instagram' AND external_account_id = ${instagramUserId} RETURNING id, workspace_id
    `;
    for (const r of rows) {
      await recordAudit(tx, { workspaceId: r.workspace_id, actorType: 'system', actorId: 'meta', via: 'api', entityType: 'channel', entityId: r.id, action: 'data_deleted_by_platform_request', detail: { confirmationCode } });
    }
    await tx`INSERT INTO deletion_requests (confirmation_code, platform, channels_deleted) VALUES (${confirmationCode}, 'instagram', ${rows.length})`;
    return { confirmationCode, channelsDeleted: rows.length };
  })) as { confirmationCode: string; channelsDeleted: number };
}

/** Status of a platform data-deletion request, for the public status page. */
export async function deletionRequestStatus(db: Db, code: string): Promise<{ completedAt: Date; channelsDeleted: number } | null> {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(code)) return null;
  const [row] = await db<{ completed_at: Date; channels_deleted: number }[]>`SELECT completed_at, channels_deleted FROM deletion_requests WHERE confirmation_code = ${code}`;
  return row ? { completedAt: row.completed_at, channelsDeleted: row.channels_deleted } : null;
}
