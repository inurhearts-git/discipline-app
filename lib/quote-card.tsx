// The share-card layout (1080x1350, 4:5), rendered by app/api/card/[id]/route.tsx
// with next/og. Kept free of Next and Supabase imports so it can be previewed
// on its own. Every div needs display:flex (a Satori rule).

export interface CardItem {
  text: string;
  attributed_to: string;
  source: string | null;
  tag: string;
}

export type CardTheme = "dark" | "light";

export const PALETTES = {
  dark: { bg: "#14110f", text: "#f6f1e7", brass: "#c9a227", sage: "#8ca07a", ember: "#c2542e", slate: "#9c968a", line: "rgba(246,241,231,0.16)" },
  light: { bg: "#f6f1e7", text: "#14110f", brass: "#96781a", sage: "#5f7a4c", ember: "#b04824", slate: "#6b655a", line: "rgba(20,17,15,0.16)" },
} as const;

export const W = 1080;
export const H = 1350;

// Font size by length, so short lines feel big and long passages still fit.
function quoteSize(len: number): number {
  if (len <= 60) return 84;
  if (len <= 110) return 70;
  if (len <= 170) return 60;
  if (len <= 250) return 52;
  if (len <= 360) return 44;
  if (len <= 500) return 38;
  return 32;
}

// Very long passages are cut at a word boundary so the card never overflows.
function clip(text: string, max = 700): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s]+$/, "")}…`;
}

export function QuoteCard({ item, theme }: { item: CardItem; theme: CardTheme }) {
  const c = PALETTES[theme];
  const accent = item.tag === "SCRIPTURE" ? c.sage : item.tag === "SPEECH" ? c.ember : c.brass;
  const text = clip(item.text.trim());
  const size = quoteSize(text.length);

  return (

      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: c.bg,
          padding: "110px 100px 90px",
          fontFamily: "Space Grotesk",
        }}
      >
        <div style={{ display: "flex", fontFamily: "Newsreader", fontStyle: "italic", fontSize: 220, lineHeight: 0.8, height: 120, color: c.brass, opacity: 0.6 }}>
          “
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", fontFamily: "Newsreader", fontStyle: "italic", fontSize: size, lineHeight: 1.32, color: c.text }}>{text}</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 54 }}>
            <div style={{ width: 56, height: 3, background: accent, marginRight: 22 }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 34, color: c.text }}>{item.attributed_to}</div>
              {item.source ? <div style={{ display: "flex", fontSize: 26, color: c.slate, marginTop: 8 }}>{item.source}</div> : null}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `2px solid ${c.line}`, paddingTop: 34 }}>
          <div style={{ display: "flex", fontFamily: "Newsreader", fontStyle: "italic", fontSize: 40, color: c.text }}>Discipline</div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 22, letterSpacing: 4, color: accent }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: accent, marginRight: 12 }} />
            {item.tag}
          </div>
        </div>
      </div>
  );
}
