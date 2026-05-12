export function isEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

export function isSessionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function assertSessionId(value: unknown): string {
  if (!isSessionId(value)) {
    throw new Error("유효하지 않은 세션입니다.");
  }
  return value;
}

export function assertShotIndex(value: unknown): number {
  const index = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(index) || index < 1 || index > 4) {
    throw new Error("촬영 번호는 1부터 4까지여야 합니다.");
  }
  return index;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 16;

export function parseDataUrl(value: unknown): { mime: string; buffer: Buffer } {
  if (typeof value !== "string") {
    throw new Error("이미지 데이터가 없습니다.");
  }

  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(value);
  if (!match) {
    throw new Error("지원하지 않는 이미지 형식입니다.");
  }

  if (match[2].length > MAX_BASE64_LENGTH) {
    throw new Error("이미지 용량이 너무 큽니다.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("이미지 용량이 너무 큽니다.");
  }

  return {
    mime: match[1] === "image/jpg" ? "image/jpeg" : match[1],
    buffer,
  };
}
