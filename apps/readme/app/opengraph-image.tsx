import { createIconDataUrl } from "@jongminchung/icon";
import { ImageResponse } from "next/og";

export const alt = "Jamie — Jongmin Chung. Complex systems should explain themselves.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const personalIcon = createIconDataUrl("personal");

export default function OpenGraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "66px 72px",
        background: "#f3f6ff",
        color: "#11131a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <img alt="" aria-hidden="true" height={62} src={personalIcon} width={62} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontWeight: 800,
          }}
        >
          <span style={{ fontSize: 24 }}>JAMIE</span>
          <span
            style={{
              color: "#596174",
              fontSize: 13,
              letterSpacing: 3,
            }}
          >
            README
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 78,
            fontWeight: 900,
            letterSpacing: -5,
            lineHeight: 0.92,
          }}
        >
          Complex systems
        </div>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            marginTop: 10,
            padding: "2px 14px 8px",
            background: "#2457ff",
            color: "white",
            fontSize: 78,
            fontWeight: 900,
            letterSpacing: -5,
            lineHeight: 0.92,
          }}
        >
          should explain themselves.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: "2px solid #cdd5e7",
          paddingTop: 22,
          color: "#596174",
          fontSize: 16,
          letterSpacing: 2,
        }}
      >
        <span>JONGMIN CHUNG</span>
        <span>LANGUAGE → MODELS → CODE</span>
        <span>JAMIE.KR</span>
      </div>
    </div>,
    size,
  );
}
