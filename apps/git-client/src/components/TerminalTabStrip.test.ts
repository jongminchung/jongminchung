import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { TerminalSessionSnapshot } from "../domain/TerminalService";
import { TerminalTabStrip } from "./TerminalTabStrip";

const session: TerminalSessionSnapshot = {
  key: "session-local",
  repositoryId: "repository-id",
  title: "Local",
  status: "running",
  terminalId: "terminal-id",
  error: null,
  exitCode: null,
  target: { kind: "default" },
};

describe("TerminalTabStrip", () => {
  it("preserves evidence-backed labels without nesting the close control in a tab button", () => {
    const optionsButtonRef = { current: null };
    const agentsButtonRef = { current: null };
    const predefinedButtonRef = { current: null };
    const markup = renderToStaticMarkup(
      createElement(TerminalTabStrip, {
        activeKey: session.key,
        agentsButtonRef,
        hasPredefinedSessions: true,
        onActivate: vi.fn(),
        onClose: vi.fn(() => Promise.resolve()),
        onCreate: vi.fn(() => Promise.resolve()),
        onHide: vi.fn(),
        onOpenAgents: vi.fn(),
        onOpenOptions: vi.fn(),
        onOpenPredefined: vi.fn(),
        optionsButtonRef,
        predefinedButtonRef,
        sessions: [session],
        showAgents: true,
      }),
    );

    expect(markup).toContain('aria-label="Action Toolbar"');
    expect(markup).toContain('aria-label="Local"');
    expect(markup).toContain(">Local</span>");
    expect(markup).toContain('aria-label="Close Local"');
    expect(markup).toContain('aria-label="New Tab"');
    expect(markup).toContain('aria-label="New Predefined Session"');
    expect(markup).toContain(">AI Agents<");
    expect(markup).toContain('aria-label="Options"');
    expect(markup).toContain('aria-label="Hide"');

    const buttons = markup.match(/<button\b[\s\S]*?<\/button>/gu) ?? [];
    expect(buttons).toHaveLength(7);
    expect(buttons.every((button) => !/<button\b/u.test(button.slice(7)))).toBe(true);
  });
});
