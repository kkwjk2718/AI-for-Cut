import { promises as fs } from "fs";
import path from "path";
import { assertSessionId } from "./validators";

export function getStorageRoot(): string {
  const configured = process.env.TEMP_STORAGE_DIR || "./temp/sessions";
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

export function getSessionDir(sessionId: string): string {
  const safeId = assertSessionId(sessionId);
  return path.join(getStorageRoot(), safeId);
}

export function getSessionFilePath(sessionId: string, fileName: string): string {
  const dir = getSessionDir(sessionId);
  const normalized = path.basename(fileName);
  if (normalized !== fileName || !/^[a-z0-9._-]+$/i.test(normalized)) {
    throw new Error("유효하지 않은 파일 이름입니다.");
  }
  return path.join(dir, normalized);
}

export async function ensureStorageRoot(): Promise<void> {
  await fs.mkdir(getStorageRoot(), { recursive: true });
}

export async function ensureSessionDir(sessionId: string): Promise<string> {
  const dir = getSessionDir(sessionId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeSessionFile(
  sessionId: string,
  fileName: string,
  buffer: Buffer,
): Promise<string> {
  await fs.access(getSessionDir(sessionId));
  const target = getSessionFilePath(sessionId, fileName);
  await fs.writeFile(target, buffer);
  return fileName;
}

export async function readSessionFile(sessionId: string, fileName: string): Promise<Buffer> {
  return fs.readFile(getSessionFilePath(sessionId, fileName));
}

export async function deleteSessionFiles(sessionId: string): Promise<void> {
  await fs.rm(getSessionDir(sessionId), { recursive: true, force: true });
}
