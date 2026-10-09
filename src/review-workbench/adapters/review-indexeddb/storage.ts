// Purpose: storage-level primitives for the durable review adapter
// Responsibilities: minimal structural IndexedDB typings (no DOM lib), promise helpers, database open with schema setup, and pending-record writes
// Rationale: hosts inject the platform IDB factory and tests inject an isolated one; the adapter carries no dependency on DOM typings or on fake-indexeddb.
// Spec: openspec/changes/add-workbench-spa/design.md (Boundaries and storage)

export const SCHEMA_VERSION = 1;
export const AGGREGATE_STORE = "aggregates";
export const PENDING_STORE = "pending";
export const DEFAULT_REVIEW_DB_NAME = "wanna-review";

export interface IdbRequestLike<T> {
  readonly result: T;
  readonly error: Error | null;
  onsuccess: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface IdbOpenRequestLike {
  readonly result: IdbDatabaseLike;
  readonly error: Error | null;
  onupgradeneeded: ((event: unknown) => void) | null;
  onsuccess: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface IdbDatabaseLike {
  close(): void;
  createObjectStore(name: string, options?: { keyPath?: string }): unknown;
  transaction(
    stores: string | readonly string[],
    mode: "readonly" | "readwrite",
  ): IdbTransactionLike;
}

export interface IdbTransactionLike {
  objectStore(name: string): IdbObjectStoreLike;
  abort(): void;
  readonly error: Error | null;
  oncomplete: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onabort: ((event: unknown) => void) | null;
}

export interface IdbObjectStoreLike {
  get(key: string): IdbRequestLike<unknown>;
  put(value: unknown, key?: string): IdbRequestLike<unknown>;
  delete(key: string): IdbRequestLike<unknown>;
}

export interface IdbFactoryLike {
  open(name: string, version?: number): IdbOpenRequestLike;
}

export function requestAsPromise<T>(request: IdbRequestLike<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("idb request failed"));
  });
}

export function transactionDone(transaction: IdbTransactionLike): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("idb transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("idb transaction aborted"));
  });
}

export function openDatabase(
  factory: IdbFactoryLike,
  name: string,
): Promise<IdbDatabaseLike> {
  const request = factory.open(name, SCHEMA_VERSION);
  return new Promise<IdbDatabaseLike>((resolve, reject) => {
    request.onupgradeneeded = () => {
      request.result.createObjectStore(AGGREGATE_STORE);
      request.result.createObjectStore(PENDING_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("idb open failed"));
  });
}
