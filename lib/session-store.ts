import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { BoothSession } from "./types";
import { deleteSessionFiles, ensureSessionDir, ensureStorageRoot, getSessionDir, getStorageRoot } from "./storage";
import { assertSessionId } from "./validators";

const SESSION_FILE = "session.json";
const PRIVACY_CONSENT_VERSION = "2026-05-privacy-v1";
const sessionLocks = new Map<string, Promise<void>>();

interface CreateSessionOptions {
  archiveImageConsent?: boolean;
}

function ttlMinutes(): number {
  const value = Number(process.env.SESSION_TTL_MINUTES || "1440");
  return Number.isFinite(value) && value > 0 ? value : 1440;
}

function nowIso(): string {
  return new Date().toISOString();
}

function expiresAt(): string {
  return new Date(Date.now() + ttlMinutes() * 60 * 1000).toISOString();
}

function metadataPath(sessionId: string): string {
  return path.join(getSessionDir(sessionId), SESSION_FILE);
}

export async function withSessionLock<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
  const id = assertSessionId(sessionId);
  const previous = sessionLocks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const current = previous.catch(() => undefined).then(() => gate);

  sessionLocks.set(id, current);
  await previous.catch(() => undefined);

  try {
    return await task();
  } finally {
    release();
    if (sessionLocks.get(id) === current) {
      sessionLocks.delete(id);
    }
  }
}

export async function createSession(options: CreateSessionOptions = {}): Promise<BoothSession> {
  await ensureStorageRoot();
  const id = randomUUID();
  const now = nowIso();
  const session: BoothSession = {
    id,
    createdAt: now,
    updatedAt: now,
    expiresAt: expiresAt(),
    state: "created",
    files: {
      shots: [],
    },
    privacyConsent: {
      required: true,
      archiveImage: Boolean(options.archiveImageConsent),
      consentedAt: now,
      version: PRIVACY_CONSENT_VERSION,
    },
  };
  await ensureSessionDir(id);
  await writeSession(session);
  return session;
}

export async function readSession(sessionId: string): Promise<BoothSession> {
  const id = assertSessionId(sessionId);
  let raw: string;
  try {
    raw = await fs.readFile(metadataPath(id), "utf8");
  } catch {
    throw new Error("세션을 찾을 수 없습니다.");
  }
  const session = JSON.parse(raw) as BoothSession;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    session.state = "expired";
    await writeSession(session);
    throw new Error("세션이 만료되었습니다.");
  }
  return session;
}

export async function writeSession(session: BoothSession): Promise<BoothSession> {
  session.updatedAt = nowIso();
  await ensureSessionDir(session.id);
  await fs.writeFile(metadataPath(session.id), JSON.stringify(session, null, 2), "utf8");
  return session;
}

export async function updateSession(
  sessionId: string,
  updater: (session: BoothSession) => BoothSession | void,
): Promise<BoothSession> {
  return withSessionLock(sessionId, async () => {
    const session = await readSession(sessionId);
    const result = updater(session) ?? session;
    return writeSession(result);
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await deleteSessionFiles(sessionId);
}

export async function cleanupExpiredSessions(): Promise<{ deleted: number }> {
  await ensureStorageRoot();
  const entries = await fs.readdir(getStorageRoot(), { withFileTypes: true });
  let deleted = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sessionId = entry.name;
    try {
      assertSessionId(sessionId);
      const file = path.join(getStorageRoot(), sessionId, SESSION_FILE);
      const raw = await fs.readFile(file, "utf8");
      const session = JSON.parse(raw) as BoothSession;
      if (new Date(session.expiresAt).getTime() < Date.now()) {
        await deleteSession(sessionId);
        deleted += 1;
      }
    } catch {
      const absolute = path.join(getStorageRoot(), sessionId);
      await fs.rm(absolute, { recursive: true, force: true });
      deleted += 1;
    }
  }

  return { deleted };
}
