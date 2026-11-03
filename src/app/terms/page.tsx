import { LegalPage } from "@/components/LegalPage";
import { CONTACT_EMAIL } from "@/lib/terms";
export const metadata = { title: "Terms & Conditions" };
export default function Page() {
  return (
    <LegalPage
      title="Terms & Conditions"
      intro="These terms govern your use of ReelForge Studio (“ReelForge”, “we”), an AI film studio that turns ideas into scripts, characters, storyboards, voices and finished videos. By creating an account or using ReelForge you agree to them."
      sections={[
        [
          "Your account",
          <>
            <p>
              You must be at least 18 (or the age of majority where you live) and give accurate details. Keep your password secret; you are responsible for
              activity on your account. Each account, its projects, agents and virtual desktops are private to you.
            </p>
          </>,
        ],
        [
          "AI-generated content",
          <>
            <p>
              ReelForge uses artificial-intelligence models to generate text, images, audio and video. Outputs can be inaccurate, unexpected, similar to other
              people’s outputs, or unsuitable. Review everything before you publish it. Outputs are not professional, legal, medical or financial advice, and do
              not reflect our views.
            </p>
          </>,
        ],
        [
          "You own your outputs",
          <>
            <p>
              As between you and us, you own the inputs you provide and the outputs generated for you, to the extent the law allows. You grant us a limited
              licence to host, process and display them only to run the service for you. We do not use your private projects to advertise ReelForge without your
              permission.
            </p>
          </>,
        ],
        [
          "Acceptable use",
          <>
            <p>You must not use ReelForge to create or share:</p>
            <ul>
              <li>deepfakes or realistic likenesses or voices of real people without their clear consent, or content that impersonates someone;</li>
              <li>sexual content involving minors, or non-consensual intimate imagery;</li>
              <li>illegal, hateful, harassing, violent-extremist or defamatory content;</li>
              <li>misinformation designed to deceive, such as fake news footage or election content;</li>
              <li>content that infringes copyright, trademarks or other rights.</li>
            </ul>
            <p>
              Do not attack, overload, reverse-engineer or resell the service, or try to reach another user’s data or desktop. We may remove content and suspend
              accounts that break these rules.
            </p>
          </>,
        ],
        [
          "Credits, usage and payments",
          <>
            <p>
              Generation uses compute. ReelForge may limit usage, apply rate limits or charge credits for renders, voices and agent tasks. During the free beta,
              limits can change without notice. Where paid plans exist, prices are shown before purchase; credits are non-refundable except where the law
              requires otherwise, and unused credits may expire.
            </p>
          </>,
        ],
        [
          "Account deletion and data",
          <>
            <p>
              You can delete your account at any time from Profile. Deletion permanently wipes your projects, media, agents, chats and virtual desktop files.
              Anonymous, aggregated style notes the studio has learned (for example, which shot styles work well) may be kept to improve ReelForge; they do not
              identify you or contain your files. See the Privacy Policy.
            </p>
          </>,
        ],
        [
          "Third-party models and licences",
          <>
            <p>
              ReelForge runs third-party AI models, each under its own licence. Some, including Meta’s MMS speech models, are licensed for{" "}
              <b>non-commercial use only</b>; outputs made with them may not be used commercially. Where a model has such restrictions we try to label it, and
              you are responsible for complying with them for your use.
            </p>
          </>,
        ],
        [
          "Beta service, no warranty",
          <>
            <p>
              ReelForge is provided “as is” and “as available”, without warranties of any kind, including fitness for a particular purpose, accuracy or
              uninterrupted availability. Features may change or be removed. Keep your own copies of important work.
            </p>
          </>,
        ],
        [
          "Limitation of liability",
          <>
            <p>
              To the maximum extent the law allows, we are not liable for indirect, incidental, special or consequential losses, lost profits or lost data. Our
              total liability for any claim is limited to the greater of the amount you paid us in the 12 months before the claim or ₦50,000. You agree to
              indemnify us against claims arising from content you create or from breaking these terms.
            </p>
          </>,
        ],
        [
          "Changes and termination",
          <>
            <p>
              We may update these terms; when we do, we change the version above and ask you to accept again before you continue. You may stop using ReelForge
              at any time.
            </p>
          </>,
        ],
        [
          "Governing law",
          <>
            <p>
              These terms are governed by the laws of the Federal Republic of Nigeria. Disputes go to the courts of Nigeria, unless mandatory consumer law where
              you live says otherwise.
            </p>
          </>,
        ],
        [
          "Contact",
          <>
            <p>
              Email{" "}
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
