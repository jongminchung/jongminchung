import { strFromU8, unzipSync } from "fflate";
import {
    JsonValueSchema,
    type JsonValue,
} from "../../src/shared/contracts/ipc";

const SETTINGS_ARCHIVE_MAX_BYTES = 1_048_576;
const SETTINGS_ARCHIVE_MAX_EXPANDED_BYTES = 4_194_304;
export const SETTINGS_CREDENTIAL_PREFIX = "hostingCredential:";

function validateSettingsArchiveEnvelope(bytes: Uint8Array): void {
    if (bytes.byteLength > SETTINGS_ARCHIVE_MAX_BYTES) {
        throw new Error("Settings archive is larger than 1 MiB.");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const searchStart = Math.max(0, bytes.byteLength - 65_557);
    let end = -1;
    for (
        let offset = bytes.byteLength - 22;
        offset >= searchStart;
        offset -= 1
    ) {
        if (view.getUint32(offset, true) === 0x06054b50) {
            end = offset;
            break;
        }
    }
    if (end < 0) throw new Error("Settings archive is not a valid ZIP file.");
    const entryCount = view.getUint16(end + 10, true);
    const directorySize = view.getUint32(end + 12, true);
    let offset = view.getUint32(end + 16, true);
    const directoryEnd = offset + directorySize;
    if (entryCount !== 1 || directoryEnd > end) {
        throw new Error("Settings archive must contain exactly settings.json.");
    }
    let expandedBytes = 0;
    for (let index = 0; index < entryCount; index += 1) {
        if (
            offset + 46 > directoryEnd ||
            view.getUint32(offset, true) !== 0x02014b50
        ) {
            throw new Error("Settings archive directory is invalid.");
        }
        expandedBytes += view.getUint32(offset + 24, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const nameStart = offset + 46;
        const nameEnd = nameStart + nameLength;
        if (nameEnd > directoryEnd) {
            throw new Error("Settings archive entry name is invalid.");
        }
        if (strFromU8(bytes.subarray(nameStart, nameEnd)) !== "settings.json") {
            throw new Error("Settings archive contains an unexpected entry.");
        }
        offset = nameEnd + extraLength + commentLength;
    }
    if (
        expandedBytes > SETTINGS_ARCHIVE_MAX_EXPANDED_BYTES ||
        offset !== directoryEnd
    ) {
        throw new Error("Settings archive expands beyond the allowed size.");
    }
}

export function parseImportedSettings(
    bytes: Uint8Array,
): Readonly<Record<string, JsonValue>> {
    validateSettingsArchiveEnvelope(bytes);
    const entry = unzipSync(bytes)["settings.json"];
    if (entry === undefined)
        throw new Error("settings.json is missing from the archive.");
    const raw = JSON.parse(strFromU8(entry)) as unknown;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error("Imported settings are invalid.");
    }
    if (
        Reflect.get(raw, "format") !== "git-client-settings" ||
        Reflect.get(raw, "schemaVersion") !== 1
    ) {
        throw new Error("Imported settings use an unsupported format.");
    }
    const rawValues = Reflect.get(raw, "values");
    if (
        typeof rawValues !== "object" ||
        rawValues === null ||
        Array.isArray(rawValues)
    ) {
        throw new Error("Imported settings values are invalid.");
    }
    return Object.fromEntries(
        Object.entries(rawValues).flatMap(([key, value]) =>
            key.startsWith(SETTINGS_CREDENTIAL_PREFIX)
                ? []
                : [[key, JsonValueSchema.parse(value)] as const],
        ),
    );
}
