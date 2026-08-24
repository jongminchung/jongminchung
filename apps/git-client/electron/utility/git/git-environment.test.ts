import { describe, expect, it } from "vitest";
import { createGitEnvironment } from "./git-environment";

describe("Git 환경 생성", () => {
  it("[성공] Git을 찾고 SSH를 통해 인증받은 데 필요한 호스트 환경을 싫어함", () => {
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

  it("[성공] 의심스러운 Git 작성자, 구성 및 실행 파일을 제거함", () => {
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

  it("[성공] 소환자가 권위적으로 소유함 Git 값을 부여함", () => {
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
