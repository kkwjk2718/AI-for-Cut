import { promises as fs } from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { isAdminCookieAuthenticated } from "@/lib/admin-auth";
import { isAdminImageArchiveEnabled } from "@/lib/admin-store";
import { isBrevoConfigured } from "@/lib/brevo";
import { isOpenAiConfigured } from "@/lib/openai";
import { getStorageRoot } from "@/lib/storage";

export const dynamic = "force-dynamic";

type HealthState = "ok" | "warn" | "fail";

interface HealthCheck {
  label: string;
  state: HealthState;
  detail: string;
}

function stateText(state: HealthState): string {
  return state === "ok" ? "OK" : state === "warn" ? "확인 필요" : "실패";
}

function stateClass(state: HealthState): string {
  if (state === "ok") {
    return "bg-[#5eead4] text-[#101722]";
  }
  if (state === "warn") {
    return "bg-[#facc15] text-[#101722]";
  }
  return "bg-[#f04438] text-white";
}

async function checkOpenAi(): Promise<HealthCheck> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !isOpenAiConfigured()) {
    return { label: "OpenAI", state: "fail", detail: "OPENAI_API_KEY가 설정되지 않았습니다." };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      return { label: "OpenAI", state: "fail", detail: `연결 실패: HTTP ${response.status}` };
    }
    return { label: "OpenAI", state: "ok", detail: "API 인증과 연결이 정상입니다." };
  } catch (error) {
    return {
      label: "OpenAI",
      state: "fail",
      detail: error instanceof Error ? error.message : "OpenAI 연결 확인에 실패했습니다.",
    };
  }
}

async function checkBrevo(): Promise<HealthCheck> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey || !isBrevoConfigured()) {
    return { label: "Brevo", state: "fail", detail: "BREVO_API_KEY 또는 BREVO_SENDER_EMAIL이 설정되지 않았습니다." };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/account", {
      headers: { accept: "application/json", "api-key": apiKey },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      return { label: "Brevo", state: "fail", detail: `연결 실패: HTTP ${response.status}` };
    }
    return { label: "Brevo", state: "ok", detail: "API 인증과 연결이 정상입니다." };
  } catch (error) {
    return {
      label: "Brevo",
      state: "fail",
      detail: error instanceof Error ? error.message : "Brevo 연결 확인에 실패했습니다.",
    };
  }
}

async function checkTempStorage(): Promise<HealthCheck> {
  try {
    const root = getStorageRoot();
    await fs.mkdir(root, { recursive: true });
    const probe = path.join(root, `.health-${Date.now()}.tmp`);
    await fs.writeFile(probe, "ok", "utf8");
    await fs.rm(probe, { force: true });
    return { label: "Temp 저장소", state: "ok", detail: root };
  } catch (error) {
    return {
      label: "Temp 저장소",
      state: "fail",
      detail: error instanceof Error ? error.message : "임시 저장소 쓰기 확인에 실패했습니다.",
    };
  }
}

function localConfigChecks(): HealthCheck[] {
  return [
    {
      label: "관리자 PIN",
      state: process.env.ADMIN_PIN?.trim() ? "ok" : "warn",
      detail: process.env.ADMIN_PIN?.trim() ? "ADMIN_PIN이 설정되어 있습니다." : "개발 기본 PIN 0000이 사용됩니다.",
    },
    {
      label: "사진 아카이브",
      state: isAdminImageArchiveEnabled() ? "warn" : "ok",
      detail: isAdminImageArchiveEnabled()
        ? "ADMIN_ARCHIVE_ENABLED=true입니다. 선택 저장 동의가 있는 완성 사진만 저장됩니다."
        : "ADMIN_ARCHIVE_ENABLED=false입니다. 기본적으로 얼굴 이미지를 관리자 아카이브에 저장하지 않습니다.",
    },
    {
      label: "CRON_SECRET",
      state: process.env.CRON_SECRET?.trim() ? "ok" : "fail",
      detail: process.env.CRON_SECRET?.trim()
        ? "cleanup-expired 보호 토큰이 설정되어 있습니다."
        : "cleanup-expired API 호출 보호를 위해 CRON_SECRET이 필요합니다.",
    },
  ];
}

function HealthCard({ check }: { check: HealthCheck }) {
  return (
    <article className="grid gap-4 rounded-[28px] border-2 border-white/10 bg-white/10 p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <h2 className="safe-text text-4xl font-black">{check.label}</h2>
        <span className={`rounded-[18px] px-5 py-3 text-xl font-black ${stateClass(check.state)}`}>
          {stateText(check.state)}
        </span>
      </div>
      <p className="safe-text text-2xl font-bold leading-8 text-white/68">{check.detail}</p>
    </article>
  );
}

export default async function AdminHealthPage() {
  if (!(await isAdminCookieAuthenticated())) {
    redirect("/admin/login");
  }

  const checks = [
    ...(await Promise.all([checkOpenAi(), checkBrevo(), checkTempStorage()])),
    ...localConfigChecks(),
  ];

  return (
    <main className="min-h-screen bg-[#101722] p-8 text-white">
      <div className="mx-auto grid max-w-[1400px] gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] border-2 border-white/10 bg-white/10 p-6 shadow-panel">
          <div className="grid gap-2">
            <p className="text-xl font-black tracking-[0.22em] text-[#5eead4]">HEALTH</p>
            <h1 className="safe-text text-5xl font-black">운영 전 점검</h1>
          </div>
          <div className="flex gap-3">
            <a
              href="/admin"
              className="flex min-h-[72px] items-center justify-center rounded-[22px] bg-white px-7 text-2xl font-black text-[#101722]"
            >
              관리자 홈
            </a>
            <a
              href="/"
              className="flex min-h-[72px] items-center justify-center rounded-[22px] bg-[#5eead4] px-7 text-2xl font-black text-[#101722]"
            >
              촬영 화면
            </a>
            <AdminLogoutButton />
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-2">
          {checks.map((check) => (
            <HealthCard key={check.label} check={check} />
          ))}
        </section>
      </div>
    </main>
  );
}
