import type { HostingChangedFile } from "./HostingChangedFile";
import type { HostingChangeRequest } from "./HostingChangeRequest";
import type { HostingNamespace } from "./HostingNamespace";
import type { HostingTimelineEntry } from "./HostingTimelineEntry";

export type HostingResponse =
  | { kind: "changeRequests"; items: Array<HostingChangeRequest>; nextPage: number | null }
  | { kind: "changeRequest"; item: HostingChangeRequest }
  | { kind: "files"; items: Array<HostingChangedFile> }
  | { kind: "timeline"; items: Array<HostingTimelineEntry> }
  | { kind: "viewedFiles"; paths: Array<string> }
  | { kind: "completed"; message: string }
  | { kind: "namespaces"; items: Array<HostingNamespace> }
  | { kind: "shareRepositories"; canCreatePrivate: boolean; names: Array<string> }
  | { kind: "repositoryAvailability"; exists: boolean }
  | {
      kind: "repository";
      project: string;
      webUrl: string;
      cloneUrl: string;
      sshUrl: string | null;
    };
