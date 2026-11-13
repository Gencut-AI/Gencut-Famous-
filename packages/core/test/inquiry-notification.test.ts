import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inquiryNotificationEmail } from '../src/index.ts';

const base = { publicName: 'Christian', kind: 'brand_partnership' as const, name: 'Jo Brand', email: 'jo@brand.example', organization: 'Brand Co', message: 'Spring series?\nBudget ready.', inboxUrl: 'https://gencutfamous.netlify.app/inquiries' };

describe('new-inquiry email', () => {
  it('says what, who and how to reply, with a link to the inbox', () => {
    const e = inquiryNotificationEmail(base);
    assert.equal(e.subject, 'New inquiry: Brand partnership from Jo Brand (Brand Co)');
    assert.match(e.text, /Email: jo@brand\.example/);
    assert.match(e.text, /Spring series\?\nBudget ready\./);
    assert.match(e.text, /https:\/\/gencutfamous\.netlify\.app\/inquiries/);
    assert.match(e.html, /href="https:\/\/gencutfamous\.netlify\.app\/inquiries"/);
  });

  it('cannot be broken by what a sender types', () => {
    const e = inquiryNotificationEmail({ ...base, name: 'Eve\r\nBcc: x@evil.example', organization: null, message: '<script>alert(1)</script><a href="https://evil.example">win</a>' });
    assert.ok(!/[\r\n]/.test(e.subject), 'no line breaks in the subject');
    assert.ok(!e.html.includes('<script>'));
    assert.ok(!e.html.includes('<a href="https://evil.example"'));
    assert.match(e.html, /&lt;script&gt;/);
  });
});
