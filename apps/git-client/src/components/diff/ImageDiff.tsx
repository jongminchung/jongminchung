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
        <div
            className={`imageDiff [display:grid] [grid-template-rows:auto_minmax(0,_1fr)] [height:100%] [min-height:0] [background:var(--card)] [&_figcaption]:[position:relative] [&_figcaption]:[z-index:2] [&_figcaption]:[padding:7px_10px] [&_figcaption]:[color:var(--muted-foreground)] [&_figcaption]:[background:var(--muted)] [&_figcaption]:[border-bottom:1px_solid_var(--border)] [&_figcaption]:[font-size:11px] imageDiff`}
        >
            <div
                className={`imageDiffToolbar [display:flex] [min-height:36px] [align-items:center] [justify-content:space-between] [gap:12px] [padding:5px_10px] [border-bottom:1px_solid_var(--border)] [background:var(--muted)] [&>_div]:[display:flex] [&>_div]:[align-items:center] [&>_div]:[gap:6px] [&>_label]:[display:flex] [&>_label]:[align-items:center] [&>_label]:[gap:6px] [&_input[type=range]]:[width:120px] imageDiffToolbar`}
            >
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
                <div
                    className={`imageDiffPair [display:grid] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [min-height:0] [&_figure]:[display:grid] [&_figure]:[grid-template-rows:auto_minmax(0,_1fr)] [&_figure]:[min-width:0] [&_figure]:[min-height:0] [&_figure]:[margin:0] [&_figure]:[background-color:var(--card)] [&_figure]:[background-image:linear-gradient(45deg,_var(--muted)_25%,_transparent_25%),_linear-gradient(-45deg,_var(--muted)_25%,_transparent_25%),_linear-gradient(45deg,_transparent_75%,_var(--muted)_75%),_linear-gradient(-45deg,_transparent_75%,_var(--muted)_75%)] [&_figure]:[background-size:18px_18px] [&_figure]:[background-position:0_0,_0_9px,_9px_-9px,_-9px_0] [&_figure_+_figure]:[border-left:1px_solid_var(--border)] [&_figure_>_img]:[width:100%] [&_figure_>_img]:[height:100%] [&_figure_>_img]:[min-height:180px] [&_figure_>_img]:[object-fit:contain] [&_figure_>_img]:[padding:16px] [&_figure_>_div]:[width:100%] [&_figure_>_div]:[height:100%] [&_figure_>_div]:[min-height:180px] [&_figure_>_div]:[object-fit:contain] [&_figure_>_div]:[padding:16px] [&_figure_>_div]:[display:grid] [&_figure_>_div]:[place-items:center] [&_figure_>_div]:[color:var(--muted-foreground)] max-[960px]:[grid-template-columns:1fr] max-[960px]:[overflow:auto] max-[960px]:[&_figure_+_figure]:[border-left:0] max-[960px]:[&_figure_+_figure]:[border-top:1px_solid_var(--border)] imageDiffPair`}
                >
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
                <figure
                    className={`imageDiffOverlay [display:grid] [grid-template-rows:auto_minmax(0,_1fr)] [min-width:0] [min-height:0] [margin:0] [background-color:var(--card)] [background-image:linear-gradient(45deg,_var(--muted)_25%,_transparent_25%),_linear-gradient(-45deg,_var(--muted)_25%,_transparent_25%),_linear-gradient(45deg,_transparent_75%,_var(--muted)_75%),_linear-gradient(-45deg,_transparent_75%,_var(--muted)_75%)] [background-size:18px_18px] [background-position:0_0,_0_9px,_9px_-9px,_-9px_0] [&>_div]:[position:relative] [&>_div]:[min-height:0] [&_img]:[position:absolute] [&_img]:[inset:0] [&_img]:[width:100%] [&_img]:[height:100%] [&_img]:[object-fit:contain] [&_img]:[padding:16px] imageDiffOverlay`}
                >
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
