import Link from "next/link";
import { COLORS } from "@/lib/constants";

// Small "Terms · Privacy" row for the bottom of sign-in, sign-up and Profile.
export function LegalLinks({ align = "center" }: { align?: "center" | "left" }) {
  const style = { color: COLORS.slate, textDecoration: "underline" } as const;
  return (
    <p style={{ margin: "18px 0 0", fontSize: 12, color: COLORS.slate, textAlign: align }}>
      <Link href="/terms" style={style}>
        Terms
      </Link>
      {"  ·  "}
      <Link href="/privacy" style={style}>
        Privacy
      </Link>
    </p>
  );
}
