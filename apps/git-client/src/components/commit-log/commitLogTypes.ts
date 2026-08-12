import type { LogOrder } from "../../shared/contracts/model";

export interface CommitLogFilterState {
    readonly query: string;
    readonly regex: boolean;
    readonly matchCase: boolean;
    readonly author: string;
    readonly branch: string;
    readonly since: string;
    readonly path: string;
    readonly order: LogOrder;
}

export interface CommitLogViewOptions {
    readonly showAuthor: boolean;
    readonly showDate: boolean;
    readonly showHash: boolean;
    readonly showTagNames: boolean;
    readonly compactReferences: boolean;
    readonly showLongEdges: boolean;
    readonly referencesOnLeft: boolean;
    readonly preferCommitDate: boolean;
}
