import "server-only";

import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";

import { del, get, head, list, put } from "@vercel/blob";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export type StoredDocument = Readonly<{ body: Uint8Array; size: number }>;
export type StoredObjectMetadata = Readonly<{
  key: string;
  size: number;
  uploadedAt: Date;
}>;
export interface DocumentStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<StoredDocument | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<readonly StoredObjectMetadata[]>;
}
export function createDocumentStorageKey(id: string, version: number) {
  return `documents/${id}/v${version}/${randomUUID()}.pdf`;
}
export function checksumDocument(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
export class InMemoryDocumentStorage implements DocumentStorage {
  private readonly values = new Map<
    string,
    { bytes: Uint8Array; uploadedAt: Date }
  >();
  constructor(private readonly now: () => Date = () => new Date()) {}
  async put(key: string, bytes: Uint8Array) {
    this.values.set(key, { bytes: bytes.slice(), uploadedAt: this.now() });
  }
  async get(key: string) {
    const value = this.values.get(key);
    return value
      ? { body: value.bytes.slice(), size: value.bytes.byteLength }
      : null;
  }
  async exists(key: string) {
    return this.values.has(key);
  }
  async delete(key: string) {
    this.values.delete(key);
  }
  async list(prefix: string) {
    return [...this.values.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({
        key,
        size: value.bytes.byteLength,
        uploadedAt: value.uploadedAt,
      }));
  }
}
export class VercelBlobDocumentStorage implements DocumentStorage {
  private readonly token = process.env.BLOB_READ_WRITE_TOKEN;
  private options() {
    if (!this.token && !process.env.BLOB_STORE_ID)
      throw new Error("Document storage is not configured.");
    return this.token ? { token: this.token } : {};
  }
  async put(key: string, bytes: Uint8Array) {
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOCUMENT_BYTES)
      throw new Error("Document bytes are invalid.");
    await put(key, Buffer.from(bytes), {
      ...this.options(),
      access: "private",
      addRandomSuffix: false,
      contentType: "application/pdf",
    });
  }
  async get(key: string) {
    try {
      const result = await get(key, {
        ...this.options(),
        access: "private",
      });
      if (!result?.stream) return null;
      const body = new Uint8Array(
        await new Response(result.stream).arrayBuffer(),
      );
      return { body, size: body.byteLength };
    } catch {
      return null;
    }
  }
  async exists(key: string) {
    try {
      await head(key, this.options());
      return true;
    } catch {
      return false;
    }
  }
  async delete(key: string) {
    await del(key, this.options());
  }
  async list(prefix: string) {
    const result = await list({ ...this.options(), prefix, limit: 100 });
    return result.blobs.map((blob) => ({
      key: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    }));
  }
}
