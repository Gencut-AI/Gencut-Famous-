import { CONTENT_EXAMPLES_MAX, MEDIA_MAX_BYTES, type MediaContentType, type MediaKind, sniffImageType } from '@gencut/core';
import { z } from 'zod';
import { recordAudit } from '../audit.ts';
import type { RequestContext } from '../context.ts';
import type { Db, Sql } from '../db.ts';
import { ServiceError } from '../errors.ts';
import { requireCapability, requireMembership } from '../membership.ts';

export interface MediaFile {
  readonly contentType: MediaContentType;
  readonly bytes: Uint8Array;
}

export interface MediaItem {
  readonly id: string;
  readonly kind: MediaKind;
  readonly caption: string | null;
  readonly createdAt: Date;
}

/** Upload a logo, profile photo (each replaces the current one) or content example. */
export async function uploadMedia(sql: Sql, ctx: RequestContext, workspaceId: string, kind: MediaKind, bytes: Uint8Array, caption?: string): Promise<MediaItem> {
  if (bytes.length === 0) throw new ServiceError('invalid', 'Choose an image to upload.');
  if (bytes.length > MEDIA_MAX_BYTES) throw new ServiceError('invalid', 'Images must be 5 MB or smaller.');
  const type = sniffImageType(bytes);
  if (!type) throw new ServiceError('invalid', 'Use a PNG, JPEG or WebP image.');
  const cap = caption?.trim().slice(0, 200) || null;
  return (await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'edit_profile');
    if (kind === 'content_example') {
      const [{ n } = { n: 0 }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM media_assets WHERE workspace_id = ${workspaceId} AND kind = 'content_example'`;
      if (n >= CONTENT_EXAMPLES_MAX) throw new ServiceError('invalid', `Up to ${CONTENT_EXAMPLES_MAX} content examples. Remove one first.`);
    } else {
      await tx`UPDATE media_assets SET replaced_at = now() WHERE workspace_id = ${workspaceId} AND kind = ${kind} AND replaced_at IS NULL`;
    }
    const [row] = await tx<{ id: string; created_at: Date }[]>`
      INSERT INTO media_assets (workspace_id, kind, content_type, bytes, byte_size, caption, created_by)
      VALUES (${workspaceId}, ${kind}, ${type}, ${Buffer.from(bytes)}, ${bytes.length}, ${cap}, ${ctx.userId})
      RETURNING id, created_at
    `;
    if (!row) throw new Error('media insert returned no row');
    // Replaced logos and photos are not kept.
    await tx`DELETE FROM media_assets WHERE workspace_id = ${workspaceId} AND kind = ${kind} AND replaced_at IS NOT NULL`;
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'media_asset', entityId: row.id, action: 'uploaded', detail: { kind, bytes: bytes.length } });
    return { id: row.id, kind, caption: cap, createdAt: row.created_at };
  })) as MediaItem;
}

export async function listMedia(db: Db, ctx: RequestContext, workspaceId: string): Promise<MediaItem[]> {
  await requireCapability(db, ctx, workspaceId, 'view');
  const rows = await db<{ id: string; kind: MediaKind; caption: string | null; created_at: Date }[]>`
    SELECT id, kind, caption, created_at FROM media_assets WHERE workspace_id = ${workspaceId} AND replaced_at IS NULL ORDER BY kind, created_at
  `;
  return rows.map((r) => ({ id: r.id, kind: r.kind, caption: r.caption, createdAt: r.created_at }));
}

export async function deleteMedia(sql: Sql, ctx: RequestContext, workspaceId: string, id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) throw new ServiceError('not_found', 'Not found.');
  await sql.begin(async (tx) => {
    await requireCapability(tx, ctx, workspaceId, 'edit_profile');
    const rows = await tx`DELETE FROM media_assets WHERE id = ${id} AND workspace_id = ${workspaceId} RETURNING id`;
    if (!rows.length) throw new ServiceError('not_found', 'Not found.');
    await recordAudit(tx, { workspaceId, actorType: 'user', actorId: ctx.userId, via: ctx.via, entityType: 'media_asset', entityId: id, action: 'deleted' });
  });
}

/** Bytes for a team member of the image's workspace. */
export async function getMediaForMember(db: Db, ctx: RequestContext, id: string): Promise<MediaFile | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db<{ workspace_id: string; content_type: MediaContentType; bytes: Buffer }[]>`
    SELECT workspace_id, content_type, bytes FROM media_assets WHERE id = ${id} AND replaced_at IS NULL
  `;
  if (!row) return null;
  try {
    await requireMembership(db, ctx.userId, row.workspace_id);
  } catch {
    return null;
  }
  return { contentType: row.content_type, bytes: new Uint8Array(row.bytes) };
}

/**
 * Bytes for the public: only the logo, the profile photo, and content examples
 * of a creator whose profile page is published. Nothing else is ever public.
 */
export async function getPublicMedia(db: Db, id: string): Promise<MediaFile | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db<{ content_type: MediaContentType; bytes: Buffer }[]>`
    SELECT m.content_type, m.bytes FROM media_assets m
    JOIN profile_pages pp ON pp.workspace_id = m.workspace_id AND pp.published
    WHERE m.id = ${id} AND m.replaced_at IS NULL
  `;
  return row ? { contentType: row.content_type, bytes: new Uint8Array(row.bytes) } : null;
}
