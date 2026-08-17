export type StateMachineStatus = "idle" | "loading" | "added";
export type StateMachineEdge = "CLICK" | "SUCCESS" | "RESET";

export const stateMachineTransitions: Readonly<
    Record<
        StateMachineStatus,
        {
            readonly delay: number;
            readonly edge: StateMachineEdge;
            readonly next: StateMachineStatus;
        }
    >
> = {
    idle: { delay: 1700, edge: "CLICK", next: "loading" },
    loading: { delay: 1300, edge: "SUCCESS", next: "added" },
    added: { delay: 1900, edge: "RESET", next: "idle" },
};

export const stateMachineChipColors: Readonly<
    Record<
        StateMachineStatus,
        { readonly bg: string; readonly text: string; readonly border: string }
    >
> = {
    idle: { bg: "#e7f5ff", text: "#1864ab", border: "#a5d8ff" },
    loading: { bg: "#fff9db", text: "#8f6900", border: "#ffe066" },
    added: { bg: "#ebfbee", text: "#237032", border: "#b2f2bb" },
};
