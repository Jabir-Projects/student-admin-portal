import "server-only";

import {
  InMemoryDocumentStorage,
  VercelBlobDocumentStorage,
} from "@/server/documents/storage.node";

const globalDocumentStorage = globalThis as unknown as {
  testDocumentStorage?: InMemoryDocumentStorage;
};

export function createRuntimeDocumentStorage() {
  if (
    process.env.DOCUMENT_STORAGE_DRIVER === "memory" &&
    process.env.V2_9_TEST_STORAGE_ALLOWED === "true" &&
    !process.env.VERCEL
  ) {
    globalDocumentStorage.testDocumentStorage ??= new InMemoryDocumentStorage();
    return globalDocumentStorage.testDocumentStorage;
  }
  return new VercelBlobDocumentStorage();
}
