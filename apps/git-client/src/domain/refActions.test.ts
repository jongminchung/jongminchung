import { describe, expect, it } from "vitest";
import {
  checkoutTarget,
  deleteRefOperation,
  mergeRefOperation,
} from "./refActions";
import { sampleRefs } from "./sampleData";

describe("참조 작업", () => {
  it("[성공] 전체 참조 대신 사용자 측 위치, 원격 및 태그 이름을 확인함", () => {
    expect(sampleRefs.map(checkoutTarget)).toEqual(
      sampleRefs.map((ref) => ref.shortName),
    );
  });

  it("[성공] 삭제 기능을 참조하여 일치하는 Git 플레이어에 매핑함", () => {
    const local = sampleRefs.find(
      (ref) => ref.kind === "local" && !ref.current,
    );
    const remote = sampleRefs.find((ref) => ref.kind === "remote");
    const tag = sampleRefs.find((ref) => ref.kind === "tag");

    expect(local && deleteRefOperation(local)).toEqual({
      kind: "deleteBranch",
      name: local?.shortName,
      force: false,
    });
    expect(remote && deleteRefOperation(remote)).toEqual({
      kind: "deleteRemoteBranch",
      remote: "origin",
      branch: remote?.shortName.slice("origin/".length),
    });
    expect(tag && deleteRefOperation(tag)).toEqual({
      kind: "deleteTag",
      name: tag?.shortName,
    });
  });

  it("[성공] 현재 분기에 대한 삭제를 제공하지 않음", () => {
    const current = sampleRefs.find((ref) => ref.current);
    expect(current && deleteRefOperation(current)).toBeNull();
  });

  it("[실패] 다시 쓰기 옵션을 활성화하지 않고 전체 도움말을 도움말로 사용함", () => {
    const branch = sampleRefs.find(
      (ref) => ref.kind === "local" && !ref.current,
    );

    expect(branch && mergeRefOperation(branch)).toEqual({
      kind: "merge",
      revision: branch?.name,
      noFf: false,
      squash: false,
    });
  });
});
