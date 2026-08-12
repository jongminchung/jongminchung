import { describe, expect, it } from "vitest";
import { createGitEnvironment } from "./git-environment";

describe("createGitEnvironment", () => {
    it("preserves the host environment needed to locate Git and authenticate over SSH", () => {
        expect(
            createGitEnvironment({
                HOME: "/Users/example",
                PATH: "/opt/homebrew/bin:/usr/bin",
                SSH_AUTH_SOCK: "/private/tmp/agent.sock",
                TMPDIR: "/private/tmp/",
            }),
        ).toEqual({
            HOME: "/Users/example",
            PATH: "/opt/homebrew/bin:/usr/bin",
            SSH_AUTH_SOCK: "/private/tmp/agent.sock",
            TMPDIR: "/private/tmp/",
        });
    });

    it("removes inherited Git repository, configuration, and executable overrides", () => {
        const environment = createGitEnvironment({
            GIT_ALTERNATE_OBJECT_DIRECTORIES: "/tmp/objects",
            GIT_ASKPASS: "/tmp/askpass",
            GIT_CONFIG_COUNT: "1",
            GIT_CONFIG_KEY_0: "core.sshCommand",
            GIT_CONFIG_PARAMETERS: "'core.hooksPath=/tmp/hooks'",
            GIT_CONFIG_VALUE_0: "/tmp/impostor",
            GIT_DIR: "/tmp/other.git",
            GIT_EXEC_PATH: "/tmp/git-core",
            GIT_EXTERNAL_DIFF: "/tmp/diff",
            GIT_INDEX_FILE: "/tmp/index",
            GIT_OBJECT_DIRECTORY: "/tmp/object-directory",
            GIT_SSH_COMMAND: "/tmp/ssh",
            GIT_WORK_TREE: "/tmp/worktree",
            git_ceiling_directories: "/tmp",
        });

        expect(environment).toEqual({});
    });

    it("allows only the Git values explicitly owned by the caller", () => {
        const environment = createGitEnvironment(
            {
                GIT_DIR: "/tmp/other.git",
                GIT_EDITOR: "/tmp/inherited-editor",
                LC_ALL: "ko_KR.UTF-8",
                PATH: "/usr/bin",
            },
            {
                GIT_EDITOR: "true",
                GIT_OPTIONAL_LOCKS: "0",
                GIT_TERMINAL_PROMPT: "0",
                LC_ALL: "C",
            },
        );

        expect(environment).toEqual({
            GIT_EDITOR: "true",
            GIT_OPTIONAL_LOCKS: "0",
            GIT_TERMINAL_PROMPT: "0",
            LC_ALL: "C",
            PATH: "/usr/bin",
        });
    });
});
