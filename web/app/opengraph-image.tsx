import { ImageResponse } from "next/og";

// Social share card (1200×630). Rendered by Next at build time; auto-wired into
// og:image and twitter:image. Uses system fonts so there's no font fetch.
export const alt = "Tessera — AI-protected lending for tokenized stocks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#111214";
const BLUE = "#2353E6";
const PAPER = "#FBFBFA";
const MUTED = "#6E727A";

function Tile({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return <div style={{ width: 92, height: 92, borderRadius: 18, background: color, opacity }} />;
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: PAPER,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Tile color={INK} opacity={0.92} />
            <Tile color={INK} opacity={0.42} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Tile color={INK} opacity={0.42} />
            <Tile color={BLUE} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 104, fontWeight: 800, color: INK, letterSpacing: -3 }}>Tessera</div>
          <div style={{ fontSize: 38, color: INK, lineHeight: 1.25, maxWidth: 1000 }}>
            Borrow against tokenized stocks. An AI agent watches every position 24/7 and acts before a liquidation.
          </div>
          <div style={{ fontSize: 26, color: MUTED, marginTop: 8 }}>
            Arbitrum Stylus · No token, ever · Non-custodial
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
