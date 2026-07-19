import { mkdir, open, readFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import type { JsonValue } from "../../src/shared/contracts/ipc";
import { JsonValueSchema } from "../../src/shared/contracts/ipc";
import { NativeError } from "../shared/native-error";

interface SettingsDocument {
  readonly schemaVersion: 1;
  readonly values: Readonly<Record<string, JsonValue>>;
}

const EMPTY_SETTINGS: SettingsDocument = { schemaVersion: 1, values: {} };

function parseSettings(raw: unknown): SettingsDocument {
  if (typeof raw !== "object" || raw === null) {
    throw NativeError.create("settings.invalid", "Settings must be a JSON object.");
  }
  if (!("schemaVersion" in raw) || raw.schemaVersion !== 1) {
    throw NativeError.create("settings.version", "Unsupported settings version.");
  }
  if (!("values" in raw) || typeof raw.values !== "object" || raw.values === null) {
    throw NativeError.create("settings.invalid", "Settings values are missing.");
  }

  const values: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(raw.values)) {
    values[key] = JsonValueSchema.parse(value);
  }
  return { schemaVersion: 1, values };
}

export class SettingsStore {
  private writeQueue: Promise<void> = Promise.resolve();

  private constructor(
    private readonly filePath: string,
    private values: Record<string, JsonValue>,
  ) {}

  static async of(filePath: string): Promise<SettingsStore> {
    let document = EMPTY_SETTINGS;
    try {
      const rawText = await readFile(filePath, "utf8");
      document = parseSettings(JSON.parse(rawText) as unknown);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return new SettingsStore(filePath, {});
      }
      throw NativeError.from(error, "settings.read");
    }
    return new SettingsStore(filePath, { ...document.values });
  }

  get(key: string): JsonValue | null {
    return this.values[key] ?? null;
  }

  async set(key: string, value: JsonValue): Promise<void> {
    this.values = { ...this.values, [key]: value };
    await this.enqueueFlush();
  }

  async delete(key: string): Promise<void> {
    this.values = Object.fromEntries(Object.entries(this.values).filter(([entryKey]) => entryKey !== key));
    await this.enqueueFlush();
  }

  async replace(values: Readonly<Record<string, JsonValue>>): Promise<void> {
    this.values = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, JsonValueSchema.parse(value)]),
    );
    await this.enqueueFlush();
  }

  createSnapshot(): Readonly<Record<string, JsonValue>> {
    return { ...this.values };
  }

  private enqueueFlush(): Promise<void> {
    const snapshot = this.createSnapshot();
    const write = this.writeQueue
      .catch(() => undefined)
      .then(async () => this.flush(snapshot));
    this.writeQueue = write;
    return write;
  }

  private async flush(values: Readonly<Record<string, JsonValue>>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.filePath}.tmp`;
    const document: SettingsDocument = {
      schemaVersion: 1,
      values,
    };
    const handle = await open(temporaryPath, "w", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(document, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, this.filePath);
  }
}
