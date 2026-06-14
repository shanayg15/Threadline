import { ImageResponse } from "next/og";

/**
 * Default Open Graph / social image, generated in Threadline's brand (coral on warm cream).
 * No external asset — drawn with inline styles so it stays license-clean. Applies to all
 * routes unless a route exports its own opengraph-image.
 */

export const alt = "Threadline — the post-purchase text concierge for Shopify brands";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#FAF6F1";
const CORAL = "#E8623A";
const INK = "#1F1B18";
const MUTED = "#6B625B";

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: CREAM,
        padding: "72px",
        fontFamily: "sans-serif",
      }}
    >
      {/* wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            backgroundColor: CORAL,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "34px",
          }}
        >
          💬
        </div>
        <div style={{ fontSize: "40px", fontWeight: 700, color: INK }}>Threadline</div>
      </div>

      {/* headline */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div
          style={{
            fontSize: "68px",
            fontWeight: 700,
            color: INK,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            maxWidth: "960px",
          }}
        >
          One text thread that sells, supports, and brings customers back.
        </div>
        <div style={{ fontSize: "30px", color: MUTED, maxWidth: "880px" }}>
          Open-source, SMS-first post-purchase concierge for Shopify brands.
        </div>
      </div>

      {/* footer strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: "24px",
          color: MUTED,
        }}
      >
        <div
          style={{ width: "14px", height: "14px", borderRadius: "999px", backgroundColor: CORAL }}
        />
        <div>Persistent 1:1 channel · Grounded in your live catalog · Open source (MIT)</div>
      </div>
    </div>,
    { ...size },
  );
}
