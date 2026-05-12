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

export async function sendPhotoEmail({
  to,
  image,
  fileName,
}: SendPhotoEmailOptions): Promise<SendPhotoEmailResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || "AI Photo Booth";

  if (!apiKey || !senderEmail) {
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
      subject: "[경남과학고 수학과학페스티벌] AI 네컷사진을 보냅니다",
      htmlContent:
        "<p>AI 네컷 포토부스를 이용해 주셔서 감사합니다.</p><p>완성된 이미지를 첨부했습니다.</p>",
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
    throw new Error(`Brevo email failed: ${response.status} ${detail}`);
  }

  const payload = (await response.json()) as { messageId?: string };
  return { success: true, skipped: false, messageId: payload.messageId };
}
