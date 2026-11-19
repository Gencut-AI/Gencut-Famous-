import assert from 'node:assert/strict';
import { test } from 'node:test';
import { googleSignInEnabled } from '../lib/google-sign-in.ts';

test('Google sign-in is shown only when explicitly switched on', () => {
  assert.equal(googleSignInEnabled('on'), true);
  assert.equal(googleSignInEnabled(' ON '), true);
  assert.equal(googleSignInEnabled(undefined), false);
  assert.equal(googleSignInEnabled(''), false);
  assert.equal(googleSignInEnabled('true'), false);
  assert.equal(googleSignInEnabled('off'), false);
});
