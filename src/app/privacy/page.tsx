import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/terms";
export const metadata = { title: "Privacy Policy" };
export default function Page() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what ReelForge Studio collects, why, and the choices you have. We aim to collect as little as we need to run your studio."
      sections={[
        [
          "What we collect",
          <>
            <ul>
              <li>Account details: name, email, a salted password hash, optional avatar, and when you accepted these terms.</li>
              <li>Your content: ideas, scripts, uploads, generated images, audio and video, agent chats, and files on your virtual desktop.</li>
              <li>Usage and security data: sign-in times, IP address for rate limiting, job and error logs.</li>
              <li>Optional preferences and “memory” notes you let the agent keep.</li>
            </ul>
          </>,
        ],
        [
          "How we use it",
          <>
            <p>
              To run the service (generate, store and play your films), secure accounts, send account emails (verification, password reset, notices), prevent
              abuse and improve ReelForge. We do not sell your personal data.
            </p>
          </>,
        ],
        [
          "AI processing",
          <>
            <p>
              Your prompts and media are sent to the AI models that power ReelForge, some self-hosted and some from third-party providers, only to produce your
              outputs. Those providers process data under their own terms.
            </p>
          </>,
        ],
        [
          "Sharing",
          <>
            <p>
              We share data only with service providers that help us run ReelForge (hosting, email delivery via Resend, AI model providers), when the law
              requires it, or to protect users and the service. Other ReelForge users cannot see your projects, agents or desktop.
            </p>
          </>,
        ],
        [
          "Retention and deletion",
          <>
            <p>
              We keep your data while your account is active. When you delete your account, your projects, media, chats, agents and desktop files are wiped.
              Anonymous learned style notes that do not identify you may be kept. Backups roll off within about 30 days.
            </p>
          </>,
        ],
        [
          "Your rights",
          <>
            <p>
              Under the Nigeria Data Protection Act 2023 and similar laws you may access, correct, export or delete your data and object to certain processing.
              Most of this is available in Profile; for anything else, email us.
            </p>
          </>,
        ],
        [
          "Security",
          <>
            <p>
              Passwords are hashed, sessions are signed and revocable, and each account is isolated. No system is perfectly secure; tell us at once if you
              suspect misuse.
            </p>
          </>,
        ],
        [
          "Cookies",
          <>
            <p>We use one essential sign-in cookie and local storage for interface preferences. No advertising trackers.</p>
          </>,
        ],
        [
          "Children",
          <>
            <p>ReelForge is not for anyone under 18, and we do not knowingly collect their data.</p>
          </>,
        ],
        [
          "Changes and contact",
          <>
            <p>
              We will update the version above when this policy changes. Contact{" "}
              <a className="text-brand-300 underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </>,
        ],
      ]}
    />
  );
}
