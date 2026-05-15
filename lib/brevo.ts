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
const CLUB_NAME = "IEUM(이음)";
const PRIVACY_POLICY_URL = "https://github.com/kkwjk2718/AI-for-Cut/blob/main/PRIVACY.md";

const emailTextContent = `안녕하세요.

경남과학고등학교 동아리 IEUM입니다.

「${EVENT_TITLE.replaceAll(", ", "·")}」의
{${BOOTH_NAME}} 부스를 이용해 주셔서 감사합니다.

오늘의 즐거운 기억을 오래 간직하시는 데 작은 선물이 되었으면 좋겠습니다.

촬영된 원본 사진 및 처리 과정에서 생성된 관련 이미지는 개인정보 처리 방침에 따라 24시간 이내에 폐기됩니다.
다만, 선택 항목에 동의하신 경우 행사 홍보 및 결과 전시를 위해 활용될 수 있습니다.

자세한 개인정보 처리 방침은 아래 링크를 참고해 주시기 바랍니다.
${PRIVACY_POLICY_URL}

본 메일은 자동으로 발송되었으며, 회신이 불가능한 메일입니다.
문의사항이 있으신 경우 admin@gshs.app으로 연락해 주시기 바랍니다.

감사합니다.

경남과학고등학교 동아리 IEUM 드림`;

function buildEmailHtmlContent(): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${BOOTH_NAME}</title>
  </head>
  <body style="margin:0; padding:0; background:#050505; font-family:Arial, 'Malgun Gothic', sans-serif; color:#f4f1e8;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050505; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:#141414; border:1px solid rgba(244,241,232,0.18); border-radius:20px; overflow:hidden;">
            <tr>
              <td style="padding:32px 34px 24px; border-bottom:1px solid rgba(244,241,232,0.12);">
                <div style="font-size:13px; letter-spacing:0.22em; font-weight:800; color:#5eead4; text-transform:uppercase;">GSHS Festival Photo</div>
                <h1 style="margin:12px 0 0; font-size:28px; line-height:1.28; color:#f4f1e8;">AI와 함께하는 수과정페 네컷</h1>
                <p style="margin:10px 0 0; font-size:15px; line-height:1.7; color:rgba(244,241,232,0.68);">경남과학고등학교 동아리 IEUM</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 34px;">
                <p style="margin:0 0 18px; font-size:17px; line-height:1.8; color:#f4f1e8;">안녕하세요.<br />경남과학고등학교 동아리 <strong>IEUM</strong>입니다.</p>
                <p style="margin:0 0 18px; font-size:17px; line-height:1.8; color:#f4f1e8;">
                  「${EVENT_TITLE.replaceAll(", ", "·")}」의<br />
                  <strong style="color:#5eead4;">{${BOOTH_NAME}}</strong> 부스를 이용해 주셔서 감사합니다.
                </p>
                <div style="margin:28px 0; padding:22px 24px; border-radius:16px; background:#f4f1e8; color:#050505;">
                  <p style="margin:0; font-size:22px; line-height:1.45; font-weight:900;">완성된 네컷 사진을 첨부했습니다.</p>
                  <p style="margin:10px 0 0; font-size:16px; line-height:1.7; font-weight:700;">오늘의 즐거운 기억을 오래 간직하시는 데 작은 선물이 되었으면 좋겠습니다.</p>
                </div>
                <p style="margin:0 0 16px; font-size:15px; line-height:1.8; color:rgba(244,241,232,0.72);">
                  촬영된 원본 사진 및 처리 과정에서 생성된 관련 이미지는 개인정보 처리 방침에 따라 <strong style="color:#f4f1e8;">24시간 이내에 폐기</strong>됩니다.
                  다만, 선택 항목에 동의하신 경우 행사 홍보 및 결과 전시를 위해 활용될 수 있습니다.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0;">
                  <tr>
                    <td style="border-radius:999px; background:#5eead4;">
                      <a href="${PRIVACY_POLICY_URL}" style="display:inline-block; padding:14px 22px; color:#050505; font-size:15px; font-weight:900; text-decoration:none;">개인정보 처리방침 보기</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0; font-size:14px; line-height:1.8; color:rgba(244,241,232,0.58);">
                  본 메일은 자동으로 발송되었으며, 회신이 불가능한 메일입니다.<br />
                  문의사항이 있으신 경우 <a href="mailto:admin@gshs.app" style="color:#5eead4; text-decoration:none; font-weight:800;">admin@gshs.app</a>으로 연락해 주시기 바랍니다.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 34px 30px; background:#0b0b0b; border-top:1px solid rgba(244,241,232,0.12);">
                <p style="margin:0; font-size:15px; line-height:1.7; color:rgba(244,241,232,0.72);">감사합니다.</p>
                <p style="margin:6px 0 0; font-size:17px; line-height:1.7; color:#f4f1e8; font-weight:900;">경남과학고등학교 동아리 IEUM 드림</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

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
      subject: `[${BOOTH_NAME}] 완성 사진을 보내드립니다`,
      textContent: emailTextContent,
      htmlContent: buildEmailHtmlContent(),
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
