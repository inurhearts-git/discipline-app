import Link from "next/link";
import type { ReactNode } from "react";
import { Shell } from "@/components/ui/Shell";
import { COLORS, alpha } from "@/lib/constants";
import { LEGAL_DRAFT_NOTE, TERMS_VERSION } from "@/lib/legal";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

// Shared frame for the Terms and the Privacy Policy: readable text, a draft
// notice, and a link to the other document.
export function LegalPage({
  title,
  intro,
  sections,
  otherHref,
  otherLabel,
}: {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
  otherHref: string;
  otherLabel: string;
}) {
  const p = { margin: "0 0 10px", fontSize: 14, lineHeight: 1.65, color: COLORS.parchment } as const;
  return (
    <Shell>
      <div style={{ padding: "26px 24px 40px" }}>
        <Link href="/" style={{ color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
          ← Back
        </Link>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontWeight: 400, fontSize: 30, color: COLORS.parchment, margin: "18px 0 6px" }}>{title}</h1>
        <p style={{ margin: "0 0 18px", fontSize: 12, color: COLORS.slate }}>Version {TERMS_VERSION}</p>

        <div style={{ border: `1px solid ${alpha(COLORS.brass, 45)}`, background: alpha(COLORS.brass, 8), borderRadius: 10, padding: "10px 12px", marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: COLORS.parchment }}>{LEGAL_DRAFT_NOTE}</p>
        </div>

        <div style={p}>{intro}</div>

        {sections.map((s, i) => (
          <section key={s.heading} style={{ marginTop: 22 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600, color: COLORS.parchment }}>
              {i + 1}. {s.heading}
            </h2>
            <div style={p}>{s.body}</div>
          </section>
        ))}

        <p style={{ marginTop: 28, fontSize: 13 }}>
          <Link href={otherHref} style={{ color: COLORS.brass }}>
            {otherLabel}
          </Link>
        </p>
      </div>
    </Shell>
  );
}

// A short list used inside sections.
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
      {items.map((it, i) => (
        <li key={i} style={{ fontSize: 14, lineHeight: 1.65, color: COLORS.parchment, marginBottom: 4 }}>
          {it}
        </li>
      ))}
    </ul>
  );
}
