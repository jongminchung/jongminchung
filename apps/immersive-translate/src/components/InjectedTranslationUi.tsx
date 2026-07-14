import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { MediaTheme } from "@astryxdesign/core/theme";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import type { CSSProperties, JSX } from "react";
import { useSyncExternalStore } from "react";
import type {
  InjectedCaptionCue,
  InjectedFloatingStatus,
  InjectedTranslationUiStore,
} from "../lib/injected-ui-events";
import { TranslateIcon } from "./TranslationIcons";

interface InjectedTranslationUiProps {
  readonly store: InjectedTranslationUiStore;
  readonly onPrimaryAction: () => Promise<void>;
}

function floatingLabel(status: InjectedFloatingStatus, active: boolean): string {
  if (status === "error") return "번역 장애";
  if (status === "running") return "번역 중";
  return active ? "페이지 번역 끄기" : "페이지 번역 켜기";
}

function captionStyle(cue: InjectedCaptionCue): CSSProperties {
  return {
    left: cue.placement.left,
    width: cue.placement.width,
    top: cue.placement.top ?? undefined,
    bottom: cue.placement.bottom ?? undefined,
  };
}

function CaptionOverlay({
  cue,
  message,
}: {
  cue: InjectedCaptionCue;
  message: string;
}): JSX.Element {
  const cardStyle = {
    "--caption-background-opacity": `${Math.min(82, Math.max(62, cue.backgroundOpacity - 8))}%`,
  } as CSSProperties;

  return (
    <section
      id="tab-shelf-caption-overlay"
      data-testid="caption-container"
      data-tab-shelf-caption-overlay="true"
      className="pointer-events-none fixed z-[2147483647] -translate-x-1/2"
      style={captionStyle(cue)}
      aria-live="polite"
      role="status"
    >
      <MediaTheme mode="dark">
        <Card
          data-testid="reference-bilingual-caption"
          data-tab-shelf-caption-cues="true"
          className="caption-card mx-auto w-fit min-w-[min(260px,100%)] max-w-full text-left"
          padding={4}
          style={cardStyle}
        >
          {cue.lines.map((line, index) => (
            <Text
              as="div"
              display="block"
              color="primary"
              weight="medium"
              key={`${cue.id}-${line.kind}`}
              data-testid={
                line.kind === "translated" ? "caption-translated-line" : "caption-original-line"
              }
              data-tab-shelf-caption-line={line.kind}
              className={index === 0 ? "caption-line" : "caption-line mt-1"}
              style={{ fontSize: cue.fontSize, lineHeight: 1.25 }}
            >
              {line.text}
            </Text>
          ))}
        </Card>
      </MediaTheme>
      <VisuallyHidden
        as="div"
        data-testid="video-auto-subtitle-status"
        data-tab-shelf-caption-status="true"
        aria-live="polite"
      >
        {message}
      </VisuallyHidden>
    </section>
  );
}

export function InjectedTranslationUi({
  store,
  onPrimaryAction,
}: InjectedTranslationUiProps): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const label = floatingLabel(state.floating.status, state.floating.active);

  return (
    <div data-astryx-theme="neutral" className="immersive-translation-scope">
      <section
        id="immersive-translate-floating-rail"
        data-testid="floating-translate-rail"
        className="fixed right-[14px] top-[34%] z-[2147483647]"
        aria-label="번역 컨트롤"
      >
        <div className="relative">
          <IconButton
            id="immersive-translate-floating-control"
            data-testid="floating-translate-control"
            data-state={state.floating.status}
            label={label}
            tooltip={label}
            size="lg"
            variant={state.floating.status === "error" ? "destructive" : "primary"}
            isLoading={state.floating.status === "running"}
            clickAction={onPrimaryAction}
            className="min-h-[44px] min-w-[44px] rounded-full shadow-lg"
            icon={<Icon icon={TranslateIcon} size="md" color="inherit" />}
          />
          {state.floating.active ? (
            <StatusDot
              data-testid="floating-translate-active-indicator"
              className="absolute -bottom-0.5 -right-0.5"
              variant="success"
              label="번역 활성"
              tooltip="페이지 번역 활성"
            />
          ) : null}
        </div>
      </section>
      <VisuallyHidden as="div" id="tab-shelf-translation-bridge-status" aria-live="polite">
        {state.floating.message}
      </VisuallyHidden>
      {state.captionCue ? (
        <CaptionOverlay cue={state.captionCue} message={state.captionMessage} />
      ) : (
        <VisuallyHidden
          as="div"
          data-testid="video-auto-subtitle-status"
          data-tab-shelf-caption-status="true"
          aria-live="polite"
        >
          {state.captionMessage}
        </VisuallyHidden>
      )}
    </div>
  );
}
