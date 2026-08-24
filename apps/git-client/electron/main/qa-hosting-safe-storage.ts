import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { SafeStorageLike } from "./hosting-credential-store";

const FORMAT = Buffer.from("GCQ1", "ascii");
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Keychain-free encryption for the isolated packaged hosting profile only.
 * The profile seed is a disposable QA certificate and never a user secret.
 */
export class QaHostingSafeStorage implements SafeStorageLike {
  readonly #key: Buffer;

  private constructor(key: Buffer) {
    this.#key = key;
  }

  static fromSeed(seed: Buffer): QaHostingSafeStorage {
    return new QaHostingSafeStorage(createHash("sha256").update(seed).digest());
  }

  isEncryptionAvailable(): boolean {
    return true;
  }

  encryptString(value: string): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", this.#key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([FORMAT, iv, cipher.getAuthTag(), encrypted]);
  }

  decryptString(value: Buffer): string {
    const headerLength = FORMAT.length + IV_LENGTH + AUTH_TAG_LENGTH;
    if (
      value.length < headerLength ||
      !value.subarray(0, FORMAT.length).equals(FORMAT)
    ) {
      throw new Error("QA hosting credential ciphertext is invalid");
    }
    const ivStart = FORMAT.length;
    const tagStart = ivStart + IV_LENGTH;
    const encryptedStart = tagStart + AUTH_TAG_LENGTH;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.#key,
      value.subarray(ivStart, tagStart),
    );
    decipher.setAuthTag(value.subarray(tagStart, encryptedStart));
    return Buffer.concat([
      decipher.update(value.subarray(encryptedStart)),
      decipher.final(),
    ]).toString("utf8");
  }
}
