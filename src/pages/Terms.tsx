import { Link } from 'react-router-dom'
import { BRAND } from '../version'

// NOTE: Plain-language starter terms. Have counsel review before public launch.
export default function Terms() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link to="/" className="text-sm text-brand-600 hover:text-brand-800">← {BRAND}</Link>
      <h1 className="mt-3 text-2xl font-semibold text-brand-900">Terms of Service</h1>
      <p className="mt-1 text-sm text-brand-500">Closed beta terms.</p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-brand-700">
        <Section title="The service">
          {BRAND} is an all-in-one dog-owner platform: pet profiles, a health-records
          vault, an AI care companion, a services marketplace, a retail shop, wearable
          health tracking, and a community feed. This is a beta — features may change,
          break, or be removed.
        </Section>
        <Section title="Bookings, orders &amp; fulfillment">
          {BRAND} acts as an intermediary. Services and products are fulfilled by
          third-party partners. During the beta, orders and bookings are coordinated
          manually and may not be fulfilled; do not rely on them for urgent needs.
        </Section>
        <Section title="Not veterinary advice">
          Content and AI responses are informational only and are not a substitute for
          professional veterinary care. Always consult a licensed veterinarian for your
          dog's health.
        </Section>
        <Section title="Your content">
          You keep ownership of what you post. You grant {BRAND} a license to host and
          display it to operate the service. Don't post anything unlawful, harmful, or
          that isn't yours to share.
        </Section>
        <Section title="Accounts">
          Keep your login secure. You can delete your account anytime from
          Settings → Account.
        </Section>
        <Section title="Disclaimers &amp; liability">
          The beta is provided "as is," without warranties. To the extent permitted by
          law, {BRAND} is not liable for indirect or consequential damages arising from
          use of the service.
        </Section>
        <Section title="Contact">
          Reach the {BRAND} team via your invite email.
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
