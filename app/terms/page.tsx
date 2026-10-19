import type { Metadata } from "next";
import { Bullets, LegalPage } from "@/components/legal/LegalPage";
import { APP_NAME, CONTACT_LINE, MIN_AGE } from "@/lib/legal";

export const metadata: Metadata = { title: `Terms of use · ${APP_NAME}` };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      otherHref="/privacy"
      otherLabel="Read the Privacy Policy →"
      intro={
        <p style={{ margin: 0 }}>
          {APP_NAME} is a small app of quotes, scripture and short speech clips, with a daily time limit so you can focus. By creating an account or using it you agree to these terms. If you don&apos;t agree, please
          don&apos;t use it.
        </p>
      }
      sections={[
        {
          heading: "Who can use it",
          body: (
            <p style={{ margin: 0 }}>
              You must be at least {MIN_AGE} years old. By signing up you confirm that you are, and that the date of birth you give is true. We may close accounts that we believe belong to someone under {MIN_AGE}.
            </p>
          ),
        },
        {
          heading: "Where the content comes from, and why it may be wrong",
          body: (
            <>
              <p style={{ margin: "0 0 10px" }}>
                The quotes, scripture and other text in {APP_NAME} come from publicly available sources, such as public-domain books and translations, and from videos on YouTube. We try to choose them carefully, but they may be
                incorrect. A quote may be misattributed, shortened, mistranslated or taken out of context, and a speaker&apos;s views may have changed.
              </p>
              <p style={{ margin: "0 0 10px" }}>
                <strong>Before you make any change in your life because of something you read or watched here, check the original source yourself.</strong> Nothing in the app is a promise that it is accurate, complete or right for you.
              </p>
              <p style={{ margin: 0 }}>
                If you spot a mistake, please use the Report an error button on the item. Scripture and other texts are shown for reflection. Including a text does not mean we endorse a belief or tradition.
              </p>
            </>
          ),
        },
        {
          heading: "Not professional advice",
          body: (
            <>
              <p style={{ margin: "0 0 10px" }}>
                {APP_NAME} is not medical, mental health, legal, financial or other professional advice, and it is not a substitute for it. The short &quot;What it means&quot; explanations are first drafted by an AI
                system and then reviewed, and they can still be wrong.
              </p>
              <p style={{ margin: 0 }}>
                If you are in crisis or thinking of harming yourself, please contact your local emergency number or a crisis line right away, or speak to someone you trust.
              </p>
            </>
          ),
        },
        {
          heading: "Videos and other people's content",
          body: (
            <p style={{ margin: 0 }}>
              Videos are owned by their creators and play through YouTube&apos;s own embedded player. We don&apos;t host or copy them, and YouTube&apos;s Terms of Service and Google&apos;s Privacy Policy apply when you watch. If you own
              something shown here and want it removed, use Report an error and tell us, and we will take it down.
            </p>
          ),
        },
        {
          heading: "Your account and what you add",
          body: (
            <>
              <p style={{ margin: "0 0 10px" }}>Keep your password to yourself. You are responsible for what happens under your account. Don&apos;t:</p>
              <Bullets
                items={[
                  "submit anything you don't have the right to share, or anything unlawful, hateful, harassing or misleading",
                  "try to break, overload or get around the app, including its daily time limit and its age checks",
                  "scrape the app or use it to build another service",
                ]}
              />
              <p style={{ margin: 0 }}>
                If you submit a quote or clip, you confirm you have the right to share it and you let us show it in the app. Your private journal and reflections stay yours; we only use them to show them back to you. We may remove any content, or
                close any account, that breaks these terms.
              </p>
            </>
          ),
        },
        {
          heading: "The service as it is",
          body: (
            <p style={{ margin: 0 }}>
              {APP_NAME} is provided as it is, while it is available. It is still being built and tested, so it may change, have errors or be unavailable, and features and content may be removed. We don&apos;t promise it will always work.
            </p>
          ),
        },
        {
          heading: "Limits on our responsibility",
          body: (
            <p style={{ margin: 0 }}>
              To the fullest extent the law allows, we are not responsible for decisions you make based on content in the app, or for losses that were not reasonably foreseeable. Nothing in these terms limits liability that cannot lawfully
              be limited, such as for fraud, or for death or personal injury caused by negligence, and nothing takes away rights you have as a consumer under the law where you live.
            </p>
          ),
        },
        {
          heading: "Changes and ending",
          body: (
            <p style={{ margin: 0 }}>
              We may update these terms. When we do, the version date at the top changes, and we may ask you to agree again. You can stop using {APP_NAME} at any time, and you can delete your account yourself from your Profile (see the Privacy Policy for what happens to your details).
            </p>
          ),
        },
        {
          heading: "Which law applies",
          body: (
            <p style={{ margin: 0 }}>
              These terms are governed by the laws of England and Wales. If you live in India, you also keep any rights under Indian law that cannot be waived by contract. Either side may bring a claim in the courts that have authority
              over it under the law that applies to you.
            </p>
          ),
        },
        {
          heading: "Contact",
          body: <p style={{ margin: 0 }}>{CONTACT_LINE}</p>,
        },
      ]}
    />
  );
}
