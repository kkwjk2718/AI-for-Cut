import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import type { AdminPhotoRecord, BoothSession } from "./types";
import { summarizeCost } from "./costs";
import { assertSessionId } from "./validators";

const INDEX_FILE = "records.json";

function adminRoot(): string {
  const configured = process.env.ADMIN_ARCHIVE_DIR || "./temp/admin";
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

function imageDir(): string {
  return path.join(adminRoot(), "images");
}

function indexPath(): string {
  return path.join(adminRoot(), INDEX_FILE);
}

export function isAdminImageArchiveEnabled(): boolean {
  return process.env.ADMIN_ARCHIVE_ENABLED?.trim().toLowerCase() === "true";
}

async function ensureAdminStore(): Promise<void> {
  await fs.mkdir(imageDir(), { recursive: true });
}

async function writeRecords(records: AdminPhotoRecord[]): Promise<void> {
  await ensureAdminStore();
  await fs.writeFile(indexPath(), JSON.stringify(records, null, 2), "utf8");
}

export async function readAdminRecords(): Promise<AdminPhotoRecord[]> {
  try {
    const raw = await fs.readFile(indexPath(), "utf8");
    const records = JSON.parse(raw) as AdminPhotoRecord[];
    return records.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  } catch {
    return [];
  }
}

export async function archiveFinalImage(session: BoothSession, image: Buffer): Promise<AdminPhotoRecord> {
  await ensureAdminStore();
  const sessionId = assertSessionId(session.id);
  const canStoreImage = isAdminImageArchiveEnabled() && session.privacyConsent?.archiveImage === true;
  const imageFile = canStoreImage ? `${sessionId}.png` : undefined;

  if (imageFile) {
    const target = path.join(imageDir(), imageFile);
    await fs.writeFile(target, image);
  }

  const metadata = await sharp(image).metadata();
  const records = await readAdminRecords();
  const existing = records.find((record) => record.sessionId === sessionId);
  if (existing?.imageFile && !imageFile) {
    await fs.rm(path.join(imageDir(), path.basename(existing.imageFile)), { force: true });
  }
  const now = new Date().toISOString();
  const nextRecord: AdminPhotoRecord = {
    id: existing?.id ?? sessionId,
    sessionId,
    createdAt: session.createdAt,
    completedAt: existing?.completedAt ?? now,
    updatedAt: now,
    imageFile,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    archiveImageConsent: session.privacyConsent?.archiveImage === true,
    selectedKeywords: session.selectedKeywords,
    poseSummary: session.recommendations?.pose_summary,
    aiCost: session.aiCost ?? summarizeCost(),
    email: existing?.email,
  };

  await writeRecords([
    nextRecord,
    ...records.filter((record) => record.sessionId !== sessionId),
  ]);
  return nextRecord;
}

export async function markAdminEmailSent(
  sessionId: string,
  email: { skipped: boolean; hasMessageId: boolean },
): Promise<void> {
  const safeSessionId = assertSessionId(sessionId);
  const records = await readAdminRecords();
  const nextRecords = records.map((record) =>
    record.sessionId === safeSessionId
      ? {
          ...record,
          updatedAt: new Date().toISOString(),
          email: {
            sentAt: new Date().toISOString(),
            skipped: email.skipped,
            hasMessageId: email.hasMessageId,
          },
        }
      : record,
  );
  await writeRecords(nextRecords);
}

export async function readAdminImage(recordId: string): Promise<Buffer> {
  const safeRecordId = assertSessionId(recordId);
  const records = await readAdminRecords();
  const record = records.find((item) => item.id === safeRecordId);
  if (!record?.imageFile) {
    throw new Error("Archived image is not stored for this record.");
  }
  return fs.readFile(path.join(imageDir(), path.basename(record.imageFile)));
}
