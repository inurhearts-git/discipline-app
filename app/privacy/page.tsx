import type { Metadata } from "next";
import { Bullets, LegalPage } from "@/components/legal/LegalPage";
import { APP_NAME, CONTACT_LINE } from "@/lib/legal";

export const metadata: Metadata = { title: `Privacy · ${APP_NAME}` };

const link = { color: "var(--brass)" } as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      otherHref="/terms"
      otherLabel="Read the Terms of use →"
      intro={<p style={{ margin: 0 }}>This explains what {APP_NAME} collects about you, why, who helps us run it, and the choices you have. We try to collect only what the app needs.</p>}
      sections={[
        {
          heading: "What we collect",
          body: (
            <Bullets
              items={[
                "Your account: name, email address and password (the password is stored in a protected form by our sign-in provider, and we can't read it).",
                "Your date of birth, which we use to check you are 18 or older.",
                "What you set up: interests, bio, avatar colour, and the mood you pick.",
                "How you use the app: the time you spend each day (for the daily limit and streaks), and which items you view, like or save.",
                "What you write: one-line reflections, private journal entries, and anything you submit or report.",
                "Notices we show you in the app (under the bell), which kinds you switched off, and your device's time zone, so your day, your daily hour and your streak run from your own midnight and a streak reminder arrives in your evening.",
                "That you accepted these terms, and when.",
              ]}
            />
          ),
        },
        {
          heading: "Why we use it",
          body: (
            <p style={{ margin: 0 }}>
              To run your account, enforce the daily limit and the age rule, show your streak, order your feed toward what you like, show your saved items and reflections back to you, review submissions and reports, and keep the service
              safe. We don&apos;t sell your information, and we don&apos;t show ads.
            </p>
          ),
        },
        {
          heading: "Your journal and reflections",
          body: (
            <p style={{ margin: 0 }}>
              These are private to your account in the app. They are stored in our database, so the person who runs the service has technical access to it, and we may be required to disclose data by law. We don&apos;t read journals as part
              of running the app. Please don&apos;t write anything in the journal that you would not want stored. You can download your own journal at any time from the Journal page (Export); the file contains only your entries, and once downloaded it is yours to keep safe.
            </p>
          ),
        },
        {
          heading: "Who helps us run it",
          body: (
            <>
              <Bullets
                items={[
                  "Supabase: our database and sign-in.",
                  "Vercel: hosting.",
                  "Resend: sign-up and password emails.",
                  "Anthropic: its Claude AI drafts the plain-language meanings of public quotes. Only the public quote text is sent, never your personal information.",
                  <>
                    YouTube (Google): videos play in YouTube&apos;s embedded player. When you play a video, Google may collect data under the{" "}
                    <a href="https://policies.google.com/privacy" style={link} target="_blank" rel="noopener noreferrer">
                      Google Privacy Policy
                    </a>
                    , and the{" "}
                    <a href="https://www.youtube.com/t/terms" style={link} target="_blank" rel="noopener noreferrer">
                      YouTube Terms of Service
                    </a>{" "}
                    apply.
                  </>,
                ]}
              />
              <p style={{ margin: 0 }}>These companies may process data in countries other than yours.</p>
            </>
          ),
        },
        {
          heading: "Cookies and storage on your device",
          body: (
            <p style={{ margin: 0 }}>
              We store small items in your browser to keep you signed in and to remember things like your theme, the mood you picked today, which items you recently saw (so your feed stays fresh), and unsaved journal drafts. We don&apos;t use
              advertising or tracking cookies of our own.
            </p>
          ),
        },
        {
          heading: "How long we keep it",
          body: (
            <>
              <p style={{ margin: "0 0 10px" }}>We keep your information while your account is open.</p>
              <p style={{ margin: 0 }}>
                You can delete your account from your Profile. Your details are then hidden straight away and kept in an encrypted archive for 30 days, so you can come back and pick up where you left off if you sign in again with the same
                email. If you choose to start a new journey, or the 30 days pass, the archive is erased for good, along with your sign-in details, except anything we must keep by law. Quotes or clips you submitted may stay in the app without
                your name.
              </p>
              <p style={{ margin: "10px 0 0" }}>
                Notices under the bell are deleted 90 days after you read them, and after a year in any case. Deleting your account deletes them and your notice settings straight away; they are not kept in the archive.
              </p>
              <p style={{ margin: "10px 0 0" }}>
                To protect against data loss we keep encrypted backups of the database for up to 12 months. Backups are only used to restore the service. Deleted information leaves the backups as they are replaced, within 12 months.
              </p>
            </>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <p style={{ margin: 0 }}>
              Depending on where you live (for example under UK data protection law or India&apos;s Digital Personal Data Protection Act), you can ask to see, correct or delete your information, withdraw consent, and complain to the
              data protection authority. You can edit most of your details on your Profile page. For anything else, contact us as below.
            </p>
          ),
        },
        {
          heading: "Age",
          body: <p style={{ margin: 0 }}>{APP_NAME} is for people aged 18 or over. We don&apos;t knowingly collect information from anyone younger, and we delete it if we learn we have.</p>,
        },
        {
          heading: "Changes and contact",
          body: (
            <>
              <p style={{ margin: "0 0 10px" }}>If this policy changes, the version date at the top changes.</p>
              <p style={{ margin: 0 }}>{CONTACT_LINE}</p>
            </>
          ),
        },
      ]}
    />
  );
}
