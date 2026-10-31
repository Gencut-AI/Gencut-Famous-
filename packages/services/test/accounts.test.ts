import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  acceptInvitation,
  createCreator,
  createInvitation,
  getCreatorProfile,
  listMemberships,
  listTeam,
  removeManager,
  revokeInvitation,
  updateProfile,
} from '../src/index.ts';
import { type Harness, creator, expectService, harness, user } from './helpers.ts';

describe('accounts and team access', () => {
  let h: Harness;
  before(async () => {
    h = await harness();
  });
  after(() => h.close());

  it('creates a creator with only a name, a handle and an adult attestation, and audits it', async () => {
    const maya = user();
    const ws = await createCreator(h.sql, maya, { publicName: 'Maya Rivera', handle: '@Maya.Cooks', adult: true });
    const p = await getCreatorProfile(h.sql, maya, ws);
    assert.equal(p.handle, 'maya.cooks');
    assert.deepEqual((await listMemberships(h.sql, maya)).map((m) => m.role), ['owner']);
    const actions = h.db.query(`SELECT string_agg(action, ',' ORDER BY id) FROM audit_events WHERE workspace_id = '${ws}'`);
    assert.equal(actions, 'created,created,created');
  });

  it('refuses minors, bad handles and taken handles, field by field, writing nothing', async () => {
    const u = user();
    await expectService(createCreator(h.sql, u, { publicName: 'Kid', handle: 'kid.creator', adult: false }), 'invalid', 'adult');
    await expectService(createCreator(h.sql, u, { publicName: 'X', handle: 'admin', adult: true }), 'invalid', 'handle');
    await expectService(createCreator(h.sql, u, { publicName: 'X', handle: 'maya.cooks', adult: true }), 'invalid', 'handle');
    assert.deepEqual(await listMemberships(h.sql, u), []);
  });

  it('keeps creators apart: another user can neither read nor write', async () => {
    const owner = user();
    const ws = await creator(h.sql, owner, 'private.one');
    const stranger = user();
    await expectService(getCreatorProfile(h.sql, stranger, ws), 'forbidden');
    await expectService(updateProfile(h.sql, stranger, ws, { bio: 'hacked' }), 'forbidden');
    await expectService(getCreatorProfile(h.sql, stranger, 'not-a-uuid'), 'forbidden');
  });

  it('invites a manager by one-time link, for the invited address only', async () => {
    const owner = user();
    const ws = await creator(h.sql, owner, 'teamed.up');
    const mgr = user('manager@agency.example');
    const { token } = await createInvitation(h.sql, owner, ws, 'Manager@Agency.example');
    assert.equal(h.db.query(`SELECT count(*) FROM invitations WHERE token_hash = '${token}'`), '0', 'raw token never stored');

    await expectService(acceptInvitation(h.sql, user('someone@else.example'), token), 'forbidden');
    assert.equal(await acceptInvitation(h.sql, mgr, token), ws);
    await expectService(acceptInvitation(h.sql, mgr, token), 'not_found');

    assert.deepEqual((await listTeam(h.sql, owner, ws)).map((t) => t.role), ['owner', 'manager']);
    // Managers edit the profile but cannot manage the team.
    await updateProfile(h.sql, mgr, ws, { bio: 'Recipes for busy weeknights.' });
    await expectService(createInvitation(h.sql, mgr, ws, 'x@example.com'), 'forbidden');
    await expectService(removeManager(h.sql, mgr, ws, owner.userId), 'forbidden');

    await removeManager(h.sql, owner, ws, mgr.userId);
    await expectService(getCreatorProfile(h.sql, mgr, ws), 'forbidden');
  });

  it('refuses expired and withdrawn invitations', async () => {
    const owner = user();
    const ws = await creator(h.sql, owner, 'expiry.check');
    const mgr = user('late@example.com');
    const old = await createInvitation(h.sql, owner, ws, 'late@example.com', new Date('2026-01-01T00:00:00Z'));
    await expectService(acceptInvitation(h.sql, mgr, old.token), 'not_found');
    const withdrawn = await createInvitation(h.sql, owner, ws, 'late@example.com');
    await revokeInvitation(h.sql, owner, ws, withdrawn.invitation.id);
    await expectService(acceptInvitation(h.sql, mgr, withdrawn.token), 'not_found');
  });
});
