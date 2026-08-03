import { Link } from 'react-router-dom'
import { BRAND } from '../version'

// NOTE: Plain-language starter privacy policy. Have counsel review before public
// launch — especially the advertising/data sections (CCPA/CPRA) and any health
// data handling.
export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link to="/" className="text-sm text-brand-600 hover:text-brand-800">← {BRAND}</Link>
      <h1 className="mt-3 text-2xl font-semibold text-brand-900">Privacy Policy</h1>
      <p className="mt-1 text-sm text-brand-500">Last updated: 2026 · Effective for the {BRAND} closed beta.</p>

      <div className="prose-sm mt-6 space-y-5 text-sm leading-relaxed text-brand-700">
        <Section title="What we collect">
          Account info (name, email, phone); your dog(s)' profiles (breed, age, weight,
          spay/neuter status, interests); health records and documents you upload;
          wearable vitals if you connect a device; photos, captions, and location tags
          you post; and messages you send to the AI companion.
        </Section>
        <Section title="How we use it">
          To run the service (profiles, vault, marketplace, shop, feed); to power AI
          features (care guidance and health-signal interpretation); to show you
          relevant offers; and to improve the product. Uploaded documents and vitals
          are processed by our AI provider to extract and interpret information.
        </Section>
        <Section title="Advertising — how targeting works">
          We use your dog's attributes (e.g. breed, life stage) to show relevant
          sponsored content <strong>inside {BRAND}</strong>. Advertisers select an
          audience segment; <strong>we serve the ad and never sell or hand over your
          individual personal information.</strong> You can opt out of personalized
          offers (see Your choices).
        </Section>
        <Section title="Who we share with">
          Service providers that operate the platform on our behalf — hosting and
          database (Supabase), AI processing (Anthropic), payments (Stripe), and
          fulfillment partners for orders/bookings — under contracts limiting their
          use of the data. We do <strong>not</strong> sell your personal information.
        </Section>
        <Section title="Security &amp; retention">
          Data is encrypted in transit; documents and photos live in access-controlled
          storage scoped to your account. We keep data while your account is active and
          delete it on request or on account deletion.
        </Section>
        <Section title="Your choices">
          You can access and edit your data in the app, opt out of personalized offers,
          and <strong>delete your account and data at any time</strong> from
          Settings → Account (or by contacting us). Deletion is permanent.
        </Section>
        <Section title="Health &amp; medical disclaimer">
          {BRAND}'s AI is not a veterinarian and does not provide medical diagnosis.
          For anything urgent or health-critical, contact your vet.
        </Section>
        <Section title="Children">
          {BRAND} is for adults (18+) and not directed to children.
        </Section>
        <Section title="Contact">
          Questions or data requests: the {BRAND} team via the email associated with
          your invite.
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold text-brand-900">{title}</h2>
      <p className="mt-1">{children}</p>
    </section>
  )
}
