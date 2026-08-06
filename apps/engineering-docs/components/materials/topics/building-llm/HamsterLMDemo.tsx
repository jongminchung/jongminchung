// @ts-nocheck -- Upstream visual source; runtime contracts are checked at the registry boundary.
"use client";

import React, { useState, useEffect } from "react";

export const HamsterLMDemo = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          margin: "1.5rem auto",
          padding: "0.75rem 2rem",
          fontSize: "1rem",
          fontWeight: 600,
          color: "#fff",
          backgroundColor: "#f59e0b",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        🐹 HamsterLM 데모 체험하기
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.6)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "420px",
              height: "80vh",
              maxHeight: "720px",
              borderRadius: "12px",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="닫기"
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                zIndex: 10000,
                width: "32px",
                height: "32px",
                border: "none",
                borderRadius: "50%",
                backgroundColor: "rgba(0,0,0,0.5)",
                color: "#fff",
                fontSize: "18px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
            <iframe
              src="https://kciter.so/HamsterLM/"
              title="HamsterLM 데모"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};
