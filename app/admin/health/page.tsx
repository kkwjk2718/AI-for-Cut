import { promises as fs } from "fs";
import path from "path";
import { redirect } from "next/navigation";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { isAdminCookieAuthenticated } from "@/lib/admin-auth";
import { isAdminImageArchiveEnabled, readAdminRecords } from "@/lib/admin-store";
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

async function checkDiskSpace(): Promise<HealthCheck> {
  try {
    const statfs = (fs as typeof fs & {
      statfs?: (path: string) => Promise<{ bavail: number; bsize: number }>;
    }).statfs;
    if (!statfs) {
      return { label: "디스크 여유 공간", state: "warn", detail: "현재 Node 런타임에서 디스크 잔여량을 확인할 수 없습니다." };
    }
    const stats = await statfs(getStorageRoot());
    const freeBytes = stats.bavail * stats.bsize;
    const freeGb = freeBytes / 1024 / 1024 / 1024;
    return {
      label: "디스크 여유 공간",
      state: freeGb >= 5 ? "ok" : "warn",
      detail: `${freeGb.toFixed(1)}GB 사용 가능`,
    };
  } catch (error) {
    return {
      label: "디스크 여유 공간",
      state: "warn",
      detail: error instanceof Error ? error.message : "디스크 잔여량 확인에 실패했습니다.",
    };
  }
}

async function checkMediaPipeAssets(): Promise<HealthCheck> {
  const required = [
    "selfie_segmentation.binarypb",
    "selfie_segmentation.tflite",
    "selfie_segmentation_landscape.tflite",
    "selfie_segmentation_solution_wasm_bin.js",
    "selfie_segmentation_solution_wasm_bin.wasm",
  ];
  const root = path.join(process.cwd(), "public", "vendor", "mediapipe", "selfie_segmentation");
  const missing: string[] = [];

  await Promise.all(
    required.map(async (fileName) => {
      try {
        await fs.access(path.join(root, fileName));
      } catch {
        missing.push(fileName);
      }
    }),
  );

  return {
    label: "MediaPipe",
    state: missing.length === 0 ? "ok" : "fail",
    detail: missing.length === 0 ? "로컬 segmentation asset이 준비되어 있습니다." : `누락: ${missing.join(", ")}`,
  };
}

async function checkBrandAssets(): Promise<HealthCheck> {
  const required = ["school-mark.png", "keuni-deuri-hands.png"];
  const root = path.join(process.cwd(), "public", "brand");
  const missing: string[] = [];

  await Promise.all(
    required.map(async (fileName) => {
      try {
        await fs.access(path.join(root, fileName));
      } catch {
        missing.push(fileName);
      }
    }),
  );

  return {
    label: "브랜드 asset",
    state: missing.length === 0 ? "ok" : "warn",
    detail: missing.length === 0 ? "프레임 로고 asset이 준비되어 있습니다." : `누락 시 기본 프레임으로 대체됩니다: ${missing.join(", ")}`,
  };
}

function todayKst(value: string): boolean {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", dateStyle: "short" });
  return formatter.format(new Date(value)) === formatter.format(new Date());
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
    {
      label: "카메라 권한",
      state: "warn",
      detail: "브라우저 권한은 촬영 화면에서 실제 카메라를 켜서 확인해야 합니다.",
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
    ...(await Promise.all([
      checkOpenAi(),
      checkBrevo(),
      checkTempStorage(),
      checkDiskSpace(),
      checkMediaPipeAssets(),
      checkBrandAssets(),
    ])),
    ...localConfigChecks(),
  ];
  const records = await readAdminRecords();
  const todayRecords = records.filter((record) => todayKst(record.completedAt));
  const todayEmailCount = todayRecords.filter((record) => record.email && !record.email.skipped).length;
  const avgCost =
    records.length > 0
      ? records.reduce((sum, record) => sum + record.aiCost.totalUsd, 0) / records.length
      : 0;

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

        <section className="grid gap-5 lg:grid-cols-3">
          <HealthCard
            check={{
              label: "오늘 생성 수",
              state: "ok",
              detail: `${todayRecords.length.toLocaleString()}건`,
            }}
          />
          <HealthCard
            check={{
              label: "오늘 이메일 발송",
              state: "ok",
              detail: `${todayEmailCount.toLocaleString()}건`,
            }}
          />
          <HealthCard
            check={{
              label: "평균 AI 비용",
              state: "ok",
              detail: `$${avgCost.toFixed(avgCost >= 1 ? 2 : 4)}`,
            }}
          />
        </section>
      </div>
    </main>
  );
}
