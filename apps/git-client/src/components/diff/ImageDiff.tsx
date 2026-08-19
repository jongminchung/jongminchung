import { Input } from "@jongminchung/ui/components/input";
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@jongminchung/ui/components/toggle-group";
import { cn } from "@jongminchung/ui/lib/utils";
import { useState } from "react";
import type {
    FilePreview,
    ImagePreview,
} from "../../shared/contracts/model/index";

type ImageDiffMode = "sideBySide" | "swipe" | "onion";

export function imageFrom(
    preview: FilePreview | null | undefined,
): ImagePreview | null {
    return preview?.kind === "image" ? preview.preview : null;
}

export function previewDescription(
    preview: FilePreview | null | undefined,
): string {
    if (!preview || preview.kind === "missing") return "File does not exist";
    if (preview.kind === "tooLarge")
        return `${preview.sizeBytes.toLocaleString()} bytes · preview limit exceeded`;
    if (preview.kind === "binary")
        return `${preview.sizeBytes.toLocaleString()} bytes · binary`;
    return `${preview.preview.mimeType} · ${preview.preview.sizeBytes.toLocaleString()} bytes`;
}

export function ImageDiff({
    beforePreview,
    afterPreview,
}: {
    readonly beforePreview: FilePreview | null | undefined;
    readonly afterPreview: FilePreview | null | undefined;
}) {
    const [mode, setMode] = useState<ImageDiffMode>("sideBySide");
    const [mix, setMix] = useState(50);
    const before = imageFrom(beforePreview);
    const after = imageFrom(afterPreview);

    return (
        <div className="imageDiff">
            <div className="imageDiffToolbar">
                <ToggleGroup
                    aria-label="Image comparison mode"
                    onValueChange={(value) => {
                        const selected = value[0] as ImageDiffMode | undefined;
                        if (selected !== undefined) setMode(selected);
                    }}
                    value={[mode]}
                >
                    <ToggleGroupItem
                        value="sideBySide"
                        className={cn(
                            "h-7 px-2.5",
                            "data-pressed:bg-accent data-pressed:text-accent-foreground",
                        )}
                    >
                        Side by side
                    </ToggleGroupItem>
                    <ToggleGroupItem
                        disabled={!before || !after}
                        value="swipe"
                        className={cn(
                            "h-7 px-2.5",
                            "data-pressed:bg-accent data-pressed:text-accent-foreground",
                        )}
                    >
                        Swipe
                    </ToggleGroupItem>
                    <ToggleGroupItem
                        disabled={!before || !after}
                        value="onion"
                        className={cn(
                            "h-7 px-2.5",
                            "data-pressed:bg-accent data-pressed:text-accent-foreground",
                        )}
                    >
                        Onion skin
                    </ToggleGroupItem>
                </ToggleGroup>
                {mode !== "sideBySide" && before && after && (
                    <label>
                        {mode === "swipe" ? "Reveal" : "After opacity"}
                        <Input
                            aria-label={
                                mode === "swipe"
                                    ? "Image reveal"
                                    : "After image opacity"
                            }
                            min="0"
                            max="100"
                            onChange={(event) =>
                                setMix(Number(event.target.value))
                            }
                            type="range"
                            value={mix}
                        />
                        <small>{mix}%</small>
                    </label>
                )}
            </div>
            {mode === "sideBySide" || !before || !after ? (
                <div className="imageDiffPair">
                    <figure>
                        <figcaption>
                            Before · {previewDescription(beforePreview)}
                        </figcaption>
                        {before ? (
                            <img alt="Before revision" src={before.dataUrl} />
                        ) : (
                            <div>Not available</div>
                        )}
                    </figure>
                    <figure>
                        <figcaption>
                            After · {previewDescription(afterPreview)}
                        </figcaption>
                        {after ? (
                            <img alt="After revision" src={after.dataUrl} />
                        ) : (
                            <div>Not available</div>
                        )}
                    </figure>
                </div>
            ) : (
                <figure className="imageDiffOverlay">
                    <figcaption>Before / After</figcaption>
                    <div>
                        <img alt="Before revision" src={before.dataUrl} />
                        <img
                            alt="After revision"
                            src={after.dataUrl}
                            style={
                                mode === "swipe"
                                    ? { clipPath: `inset(0 ${100 - mix}% 0 0)` }
                                    : { opacity: mix / 100 }
                            }
                        />
                    </div>
                </figure>
            )}
        </div>
    );
}
