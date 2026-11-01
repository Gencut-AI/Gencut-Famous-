import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeOtpCode } from '../lib/otp.ts';

test('accepts 6 to 10 digit codes and strips spaces and dashes', () => {
  assert.equal(normalizeOtpCode('123456'), '123456');
  assert.equal(normalizeOtpCode(' 123 456 '), '123456');
  assert.equal(normalizeOtpCode('123-456'), '123456');
  assert.equal(normalizeOtpCode('12345678'), '12345678');
});

test('rejects anything that is not a code', () => {
  assert.equal(normalizeOtpCode(''), null);
  assert.equal(normalizeOtpCode(null), null);
  assert.equal(normalizeOtpCode('12345'), null);
  assert.equal(normalizeOtpCode('12345678901'), null);
  assert.equal(normalizeOtpCode('12a456'), null);
});
