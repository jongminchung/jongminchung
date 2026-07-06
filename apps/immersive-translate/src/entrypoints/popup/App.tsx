import type { JSX } from "react";
import { ActiveTabTranslationPanel } from "../../components/ActiveTabTranslationPanel";

export default function PopupApp(): JSX.Element {
  return (
    <main id="immersive-translate-popup" className="w-[360px] max-w-full">
      <ActiveTabTranslationPanel />
    </main>
  );
}
