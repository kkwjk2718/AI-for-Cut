import { logError, logEvent } from "./event-log";

interface SendPhotoEmailOptions {
  to: string;
  image: Buffer;
  fileName: string;
}

export interface SendPhotoEmailResult {
  success: boolean;
  skipped: boolean;
  messageId?: string;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

const EVENT_TITLE = "2026. 진주시와 함께하는 경남과학고등학교 수학, 과학, 정보 페스티벌";
const BOOTH_NAME = "AI와 함께하는 수과정페 네컷";
const CLUB_NAME = "이음(IEUM)";

export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim() && process.env.BREVO_SENDER_EMAIL?.trim());
}

export async function sendPhotoEmail({
  to,
  image,
  fileName,
}: SendPhotoEmailOptions): Promise<SendPhotoEmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || CLUB_NAME;

  if (!apiKey || !senderEmail) {
    if (isProduction()) {
      throw new Error("Brevo is not configured.");
    }
    return { success: true, skipped: true };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: senderEmail,
        name: senderName,
      },
      to: [{ email: to }],
      subject: `[${EVENT_TITLE}] ${BOOTH_NAME} 사진을 보냅니다`,
      htmlContent:
        `<p>${EVENT_TITLE} ${BOOTH_NAME} 부스를 이용해 주셔서 감사합니다.</p><p>${CLUB_NAME}이 완성된 이미지를 첨부했습니다.</p>`,
      attachment: [
        {
          content: image.toString("base64"),
          name: fileName,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    await logError("brevo_email_failed", { status: response.status });
    throw new Error(`Brevo email failed: ${response.status} ${detail}`);
  }

  const payload = (await response.json()) as { messageId?: string };
  await logEvent("brevo_email_sent", { hasMessageId: Boolean(payload.messageId) });
  return { success: true, skipped: false, messageId: payload.messageId };
}
