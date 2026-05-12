import { promises as fs } from "fs";
import path from "path";

type EventPayload = Record<string, string | number | boolean | null | undefined>;

function logRoot(): string {
  const configured = process.env.EVENT_LOG_DIR || "./temp/logs";
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

async function writeJsonl(fileName: string, type: string, payload: EventPayload = {}): Promise<void> {
  try {
    await fs.mkdir(logRoot(), { recursive: true });
    const line = JSON.stringify({
      time: new Date().toISOString(),
      type,
      ...payload,
    });
    await fs.appendFile(path.join(logRoot(), fileName), `${line}\n`, "utf8");
  } catch {
    // Logging must never break the booth flow.
  }
}

export function logEvent(type: string, payload?: EventPayload): Promise<void> {
  return writeJsonl("events.jsonl", type, payload);
}

export function logError(type: string, payload?: EventPayload): Promise<void> {
  return writeJsonl("errors.jsonl", type, payload);
}
