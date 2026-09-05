import {
  ACTIVE_FRAME_SESSION_STORAGE_KEY,
  REMEMBERED_FRAME_SESSION_STORAGE_KEY,
} from "../shared/config";
import { normalizeOrigin } from "../shared/origins";

export interface SessionStorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface RememberedFrameSession {
  readonly tabId: number;
  readonly origin: string;
}

function isTabId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readActiveTabIds(value: unknown): Set<number> {
  if (!Array.isArray(value)) {
    return new Set();
  }
  const entries: readonly unknown[] = value;
  return new Set(entries.filter(isTabId));
}

function readRememberedFrames(
  value: unknown,
): Map<number, RememberedFrameSession> {
  if (!Array.isArray(value)) {
    return new Map();
  }
  const entries: readonly unknown[] = value;
  const sessions = new Map<number, RememberedFrameSession>();
  for (const entry of entries) {
    if (
      isRecord(entry) &&
      isTabId(entry.tabId) &&
      typeof entry.origin === "string" &&
      normalizeOrigin(entry.origin) === entry.origin
    ) {
      sessions.set(entry.tabId, {
        tabId: entry.tabId,
        origin: entry.origin,
      });
    }
  }
  return sessions;
}

export class FrameSessionStore {
  readonly #storage: SessionStorageArea;
  #mutation: Promise<void> = Promise.resolve();

  constructor(storage: SessionStorageArea) {
    this.#storage = storage;
  }

  setActive(tabId: number, active: boolean): Promise<number> {
    return this.#run(async () => {
      const stored = await this.#storage.get(ACTIVE_FRAME_SESSION_STORAGE_KEY);
      const activeTabs = readActiveTabIds(
        stored[ACTIVE_FRAME_SESSION_STORAGE_KEY],
      );
      if (active) activeTabs.add(tabId);
      else activeTabs.delete(tabId);
      await this.#storage.set({
        [ACTIVE_FRAME_SESSION_STORAGE_KEY]: [...activeTabs],
      });
      return activeTabs.size;
    });
  }

  setRemembered(tabId: number, origin: string | null): Promise<void> {
    return this.#run(async () => {
      const stored = await this.#storage.get(
        REMEMBERED_FRAME_SESSION_STORAGE_KEY,
      );
      const sessions = readRememberedFrames(
        stored[REMEMBERED_FRAME_SESSION_STORAGE_KEY],
      );
      if (origin === null) sessions.delete(tabId);
      else {
        const normalized = normalizeOrigin(origin);
        if (normalized === null || normalized !== origin) {
          throw new Error("Remembered frame requires a canonical origin");
        }
        sessions.set(tabId, { tabId, origin });
      }
      await this.#storage.set({
        [REMEMBERED_FRAME_SESSION_STORAGE_KEY]: [...sessions.values()],
      });
    });
  }

  takeRemembered(origins: ReadonlySet<string>): Promise<number[]> {
    return this.#takeRemembered(({ origin }) => origins.has(origin));
  }

  takeDisallowedRemembered(
    allowedOrigins: ReadonlySet<string>,
  ): Promise<number[]> {
    return this.#takeRemembered(({ origin }) => !allowedOrigins.has(origin));
  }

  #takeRemembered(
    shouldTake: (session: RememberedFrameSession) => boolean,
  ): Promise<number[]> {
    return this.#run(async () => {
      const stored = await this.#storage.get(
        REMEMBERED_FRAME_SESSION_STORAGE_KEY,
      );
      const sessions = readRememberedFrames(
        stored[REMEMBERED_FRAME_SESSION_STORAGE_KEY],
      );
      const tabIds = [...sessions.values()]
        .filter(shouldTake)
        .map(({ tabId }) => tabId);
      for (const tabId of tabIds) sessions.delete(tabId);
      await this.#storage.set({
        [REMEMBERED_FRAME_SESSION_STORAGE_KEY]: [...sessions.values()],
      });
      return tabIds;
    });
  }

  #run<T>(work: () => Promise<T>): Promise<T> {
    let resolveResult!: (value: T) => void;
    let rejectResult!: (error: unknown) => void;
    const result = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    this.#mutation = this.#mutation
      .catch(() => undefined)
      .then(async () => {
        try {
          resolveResult(await work());
        } catch (error) {
          rejectResult(error);
        }
      });
    return result;
  }
}
