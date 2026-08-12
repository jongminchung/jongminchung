"use client";

interface Props {
    name: string;
    caption?: string;
}

export const DiagramPlaceholder = ({ name, caption }: Props) => (
    <figure>
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                    "repeating-linear-gradient(45deg, #f8f9fa, #f8f9fa 8px, #f1f3f5 8px, #f1f3f5 16px)",
                border: "2px dashed #5c636a",
                borderRadius: "8px",
                padding: "64px 20px",
                textAlign: "center",
                color: "#495057",
            }}
        >
            <div>
                <div
                    style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                    }}
                >
                    {name}
                </div>
                <div
                    style={{
                        fontSize: "11px",
                        color: "#495057",
                        marginTop: "4px",
                    }}
                >
                    (placeholder · 추후 인터랙티브 다이어그램으로 대체)
                </div>
            </div>
        </div>
        {caption && (
            <figcaption dangerouslySetInnerHTML={{ __html: caption }} />
        )}
    </figure>
);
