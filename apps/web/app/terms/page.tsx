import type { Metadata } from 'next';
import { LegalPage } from '../_legal/legal-page.tsx';

export const metadata: Metadata = { title: 'Terms' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms">
      <p>These terms cover your use of GenCut Famous, operated by GenCut AI.</p>
      <h2>Your account</h2>
      <ul>
        <li>You must be 18 or older, or manage the account for a creator who is.</li>
        <li>You are responsible for who you invite as a manager. Managers can edit your profile, connect accounts and publish your media kit; only you can change access or delete data.</li>
      </ul>
      <h2>Connected accounts</h2>
      <ul>
        <li>You may connect only accounts you own or are authorized to manage, and must follow each platform's terms.</li>
        <li>GenCut uses official platform sign-in and APIs only. Numbers shown are what each platform reports and can change or be corrected by the platform.</li>
      </ul>
      <h2>Your media kit</h2>
      <ul>
        <li>You decide what is published and are responsible for what you publish, including partnerships you list, which GenCut shows as self-reported.</li>
        <li>Sponsored content you make remains subject to advertising disclosure rules such as the FTC's.</li>
      </ul>
      <h2>Not allowed</h2>
      <ul>
        <li>Buying or faking followers or engagement, impersonating someone, or using GenCut to spam or scrape.</li>
      </ul>
      <h2>Changes and contact</h2>
      <p>We will tell you about material changes before they apply. Questions: hello@gencut.ai.</p>
    </LegalPage>
  );
}
