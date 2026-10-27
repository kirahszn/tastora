// The social share card (Open Graph + Twitter), rendered at build time by next/og.
import { ImageResponse } from "next/og";

export const SHARE_SIZE = { width: 1200, height: 630 };
export const SHARE_ALT = "Tastora — Good food should still feel like home. Restaurant ideas for someone you care for.";

export function shareCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#fbf6ee",
          color: "#2b1d16",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#d9774f",
              color: "#2b1d16",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
            }}
          >
            T
          </div>
          <div style={{ fontSize: 48, fontWeight: 700 }}>Tastora</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, maxWidth: 960 }}>
            Good food should still feel like home.
          </div>
          <div style={{ fontSize: 34, color: "#6b5b50", maxWidth: 980 }}>
            New York restaurant ideas from someone&apos;s own tastes, with clear notes on what to check.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#a44f2e", fontWeight: 700 }}>
          Powered by Qloo taste intelligence
        </div>
      </div>
    ),
    SHARE_SIZE,
  );
}
