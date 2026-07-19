import {
    SEQUENCE_EDITOR_APPLICATION_ARGUMENT,
    runSequenceEditorCli,
} from "./utility/git/sequence-editor-cli";

const sequenceEditorIndex = process.argv.indexOf(
    SEQUENCE_EDITOR_APPLICATION_ARGUMENT,
);
if (sequenceEditorIndex < 0) {
    void import("./main/index");
} else {
    void runSequenceEditorCli(process.argv.slice(sequenceEditorIndex + 1)).then(
        (exitCode) => {
            process.exit(exitCode);
        },
    );
}
