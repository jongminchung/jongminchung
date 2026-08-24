import { ImageResponse } from "next/og";

const size = { width: 1200, height: 630 };
// ImageResponse does not parse OKLCH values, so this output boundary keeps an sRGB palette.
const imageTheme = {
  background: "#f3f6ff",
  border: "#cdd5e7",
  foreground: "#11131a",
  mutedForeground: "#596174",
  primary: "#2457ff",
  primaryForeground: "#ffffff",
} as const;

/** 요청에 대한 응답을 생성함 */
export function GET(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "66px 72px",
        background: imageTheme.background,
        color: imageTheme.foreground,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: -2,
        }}
      >
        jongminchung
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
            background: imageTheme.primary,
            color: imageTheme.primaryForeground,
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
          borderTop: `2px solid ${imageTheme.border}`,
          paddingTop: 22,
          color: imageTheme.mutedForeground,
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
