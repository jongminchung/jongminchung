import { ImageResponse } from "next/og";

/** Home의 중립적인 화면과 Tech·Invest 연결을 공유 이미지에도 반영한다. */
export function GET(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "#ffffff",
        color: "#0d0d0d",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1.5 }}>
          jongminchung
        </span>
        <span style={{ fontSize: 16, color: "#5d5d5d" }}>Personal space</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 72,
          letterSpacing: -3,
          lineHeight: 1.12,
        }}
      >
        <span>Build with curiosity.</span>
        <span>Think with evidence.</span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid #dfdfdf",
          paddingTop: 28,
          fontSize: 20,
        }}
      >
        <span>Tech / Software &amp; experiments</span>
        <span>Invest / Sources &amp; research</span>
        <span style={{ color: "#5d5d5d" }}>jamie.kr</span>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
