import type { Metadata } from 'next';
import { LegalPage } from '../_legal/legal-page.tsx';

export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>GenCut for Creators is operated by GenCut AI. This page explains what we collect, why, and how to have it deleted. Contact: privacy@gencut.ai.</p>
      <h2>What we collect from creators and their teams</h2>
      <ul>
        <li>Your email address, to sign you in.</li>
        <li>What you enter in your brand profile, including private fields (legal name, rate card, brands you avoid) that are never published.</li>
        <li>Images you upload (photo, logo, style examples).</li>
        <li>A record of important actions (connecting an account, publishing your page) for security.</li>
      </ul>
      <h2>What we read from connected accounts</h2>
      <p>When you connect Instagram, you sign in on Instagram and choose what to allow. GenCut then reads your username, account type, profile picture, follower, following and post counts, your recent posts (caption, link, date, type), and the insights Instagram reports for your account and posts (such as reach, views and interactions). We store dated readings so you can see change over time.</p>
      <p>We never read private messages, never post, comment or follow on your behalf, and never buy or fake engagement. Access tokens are encrypted and never shown in the app or written to logs.</p>
      <h2>What becomes public</h2>
      <p>Only if you publish your media kit: your public name, handle, photo, bio, brand message, categories, the numbers and posts you choose, style images, partnerships you list (labelled self-reported) and links to your connected accounts.</p>
      <h2>People who visit or contact a creator</h2>
      <ul>
        <li>Visits to a media kit are counted once per visitor per day using a one-way code made from the network address and browser with a secret that changes daily. We do not store the address or browser.</li>
        <li>If you send an inquiry, we store your name, email, organisation, message and the exact consent text you agreed to, and show them to the creator and their team.</li>
      </ul>
      <h2>Who we share data with</h2>
      <p>Service providers that run GenCut: Supabase (database and sign-in), Netlify (hosting) and, when you use the assistant with an unrecognised question, Anthropic (to route the question; your numbers are not sent). We do not sell personal data.</p>
      <h2>Keeping and deleting data</h2>
      <ul>
        <li>Disconnecting an account deletes our copy of its access token immediately. Its past readings are kept for your history until you delete them on the Channels page.</li>
        <li>You can ask us to delete your workspace and everything in it at privacy@gencut.ai.</li>
        <li>If you remove GenCut from Instagram or ask Meta to delete your data, Meta tells us and we erase what we read from that account. See <a href="/data-deletion" className="underline">Data deletion</a>.</li>
      </ul>
      <h2>Ages</h2>
      <p>GenCut for Creators is for people aged 18 or older in this version.</p>
    </LegalPage>
  );
}
