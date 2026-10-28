// The social share card (Open Graph + Twitter), rendered at build time by next/og.
import { ImageResponse } from "next/og";
import { ChefMark } from "@/components/ChefMark";

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
          background: "#fffbf7",
          color: "#2b1d16",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: "#d9774f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChefMark size={72} />
          </div>
          <div style={{ fontSize: 48, fontWeight: 700 }}>Tastora</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, maxWidth: 960 }}>
            Good food should still feel like home.
          </div>
          <div style={{ fontSize: 34, color: "#6b5b50", maxWidth: 980 }}>
            Restaurant ideas from someone&apos;s own tastes, with clear notes on what to check.
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
