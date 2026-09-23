import { useDocumentTitle } from '@/hooks/useCommon';
import { SUPPORT_EMAIL } from '@/config/constants';
import { PublicHeader, PublicFooter } from './PublicShell';

/**
 * Placeholder legal copy written so a 13-year-old can read it (SEC-16).
 * Final wording must come from the client's legal review for DPDP compliance (section 25.1).
 */
function LegalShell({ title, updated, children }) {
  useDocumentTitle(title);
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-sm font-semibold text-brand-600">Last updated {updated}</p>
        <h1 className="mt-2 text-4xl font-bold">{title}</h1>
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Draft for review — final text will be provided after legal review.</div>
        <div className="mt-8 space-y-8 text-[16px] leading-relaxed text-ink-700 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy" updated="21 September 2026">
      <section><h2>The short version</h2><p>We collect as little as possible, we never show you ads, and we never sell or share your data. Your doubts are private to you.</p></section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your name and email (to sign in).</li>
          <li>Your class and board (to show the right syllabus).</li>
          <li>Your parent or guardian&apos;s name, relationship and one contact (for consent and the weekly report).</li>
          <li>What you do while learning: answers, scores, mistakes and rewards.</li>
          <li>Photos or voice you choose to send with a doubt (deleted after 90 days).</li>
        </ul>
      </section>
      <section>
        <h2>What we never collect</h2>
        <ul><li>Your date of birth, address, school name or exact location.</li><li>Your contacts or other apps.</li></ul>
      </section>
      <section><h2>Who can see your data</h2><p>You can. Your parent receives a weekly summary with numbers and topic names only — never your doubt conversations or answers. Our support team can only see a doubt if you or our safety filter flagged it.</p></section>
      <section><h2>Your choices</h2><p>You can download your data or delete your account at any time from Settings. Deleted accounts are erased within 30 days. Questions? Write to {SUPPORT_EMAIL}.</p></section>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of use" updated="21 September 2026">
      <section><h2>Using Gyaangrid</h2><p>Gyaangrid is for students in Classes 6–10. You need your parent or guardian&apos;s permission to use it.</p></section>
      <section><h2>Be kind and honest</h2><p>Use Gyaangrid to learn. Do not try to break the app, copy content or share your account.</p></section>
      <section><h2>About the AI tutor</h2><p>The AI tutor only helps with Mathematics from your syllabus. It can make mistakes — if an answer looks wrong, please report it so we can fix it.</p></section>
      <section><h2>Gold Coins</h2><p>Coins are rewards for learning. They have no cash value. Ways to use them may be added later.</p></section>
    </LegalShell>
  );
}
