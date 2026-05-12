import { redirect } from "next/navigation";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { isAdminCookieAuthenticated } from "@/lib/admin-auth";
import { readAdminRecords } from "@/lib/admin-store";
import type { AiCostLine, AdminPhotoRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function money(value: number): string {
  if (!Number.isFinite(value)) {
    return "$0.0000";
  }
  return `$${value.toFixed(value >= 1 ? 2 : 4)}`;
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function totalTokens(lines: AiCostLine[]): number {
  return lines.reduce((sum, line) => sum + line.totalTokens, 0);
}

function topKeywords(records: AdminPhotoRecord[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const keyword of Object.values(record.selectedKeywords ?? {})) {
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border-2 border-white/10 bg-white/10 p-6 text-white shadow-panel">
      <p className="text-xl font-black text-white/58">{label}</p>
      <p className="safe-text mt-3 text-4xl font-black">{value}</p>
    </div>
  );
}

function CostRows({ record }: { record: AdminPhotoRecord }) {
  if (record.aiCost.lines.length === 0) {
    return <p className="text-xl font-bold text-white/58">AI 사용량 기록이 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[24px] bg-[#101722]/58 p-4">
      <table className="w-full min-w-[760px] border-collapse text-left text-xl text-white">
        <thead>
          <tr className="border-b-2 border-white/18 text-white/58">
            <th className="py-3 pr-4">항목</th>
            <th className="py-3 pr-4">모델</th>
            <th className="py-3 pr-4">입력</th>
            <th className="py-3 pr-4">캐시</th>
            <th className="py-3 pr-4">출력</th>
            <th className="py-3 text-right">비용</th>
          </tr>
        </thead>
        <tbody>
          {record.aiCost.lines.map((line) => (
            <tr key={line.id} className="border-b border-white/10">
              <td className="py-3 pr-4 font-black">{line.label}</td>
              <td className="py-3 pr-4 font-bold text-white/76">{line.model}</td>
              <td className="py-3 pr-4">{line.inputTokens.toLocaleString()}</td>
              <td className="py-3 pr-4">{line.cachedInputTokens.toLocaleString()}</td>
              <td className="py-3 pr-4">{line.outputTokens.toLocaleString()}</td>
              <td className="py-3 text-right font-black text-[#5eead4]">{money(line.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminPage() {
  if (!(await isAdminCookieAuthenticated())) {
    redirect("/admin/login");
  }

  const records = await readAdminRecords();
  const totalCost = records.reduce((sum, record) => sum + record.aiCost.totalUsd, 0);
  const sentCount = records.filter((record) => record.email && !record.email.skipped).length;
  const archivedImageCount = records.filter((record) => record.imageFile).length;
  const avgCost = records.length ? totalCost / records.length : 0;
  const keywordRanking = topKeywords(records);

  return (
    <main className="min-h-screen bg-[#101722] p-8 text-white">
      <div className="mx-auto grid max-w-[1500px] gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] border-2 border-white/10 bg-white/10 p-6 shadow-panel">
          <div className="grid gap-2">
            <p className="text-xl font-black tracking-[0.22em] text-[#5eead4]">ADMIN</p>
            <h1 className="safe-text text-5xl font-black">AI 네컷 관리자</h1>
          </div>
          <div className="flex gap-3">
            <a
              href="/admin/health"
              className="flex min-h-[72px] items-center justify-center rounded-[22px] bg-white px-7 text-2xl font-black text-[#101722]"
            >
              운영 점검
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

        <section className="grid gap-4 md:grid-cols-4">
          <Stat label="완성된 네컷" value={`${records.length.toLocaleString()}장`} />
          <Stat label="AI 총비용" value={money(totalCost)} />
          <Stat label="네컷 1장 평균" value={money(avgCost)} />
          <Stat label="실제 메일 전송" value={`${sentCount.toLocaleString()}건`} />
        </section>

        <section className="rounded-[28px] border-2 border-white/10 bg-white/8 p-6">
          <p className="safe-text text-xl font-bold leading-8 text-white/68">
            비용은 OpenAI usage token과 설정된 USD/1M token 단가로 계산한 AI 비용입니다.
            카메라, Sharp 합성, Brevo 메일 비용은 포함하지 않습니다. 기본 관리자 기록에는 얼굴 이미지가 저장되지 않으며,
            사진 아카이브가 켜져 있고 사용자가 선택 저장에 동의한 경우에만 완성 사진을 보관합니다. 현재 보관 이미지:
            {` ${archivedImageCount.toLocaleString()}장`}
          </p>
        </section>

        {keywordRanking.length > 0 && (
          <section className="grid gap-4 rounded-[28px] border-2 border-white/10 bg-white/8 p-6">
            <h2 className="safe-text text-3xl font-black">선택 키워드 TOP 10</h2>
            <div className="flex flex-wrap gap-3">
              {keywordRanking.map(([keyword, count]) => (
                <span key={keyword} className="rounded-full bg-white/12 px-5 py-3 text-xl font-black">
                  {keyword} {count.toLocaleString()}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6">
          {records.length === 0 ? (
            <div className="rounded-[32px] border-2 border-white/10 bg-white/10 p-12 text-center text-3xl font-black shadow-panel">
              아직 완성된 네컷 기록이 없습니다.
            </div>
          ) : (
            records.map((record) => (
              <article
                key={record.id}
                className="grid gap-6 rounded-[32px] border-2 border-white/10 bg-white/10 p-6 shadow-panel lg:grid-cols-[320px_1fr]"
              >
                <div className="grid gap-4">
                  {record.imageFile ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/admin/image/${record.id}`}
                      alt="완성된 네컷"
                      className="w-full rounded-[24px] border-4 border-white bg-white object-contain"
                    />
                  ) : (
                    <div className="grid aspect-[2/3] place-items-center rounded-[24px] border-4 border-white/16 bg-[#101722]/72 p-6 text-center">
                      <div className="grid gap-3">
                        <p className="text-3xl font-black text-white">사진 미저장</p>
                        <p className="safe-text text-xl font-bold leading-7 text-white/58">
                          선택 저장 동의가 없거나 사진 아카이브가 꺼져 있습니다.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[22px] bg-[#101722]/58 p-4">
                      <p className="text-lg font-bold text-white/58">네컷 1장</p>
                      <p className="mt-2 text-3xl font-black text-[#5eead4]">{money(record.aiCost.totalUsd)}</p>
                    </div>
                    <div className="rounded-[22px] bg-[#101722]/58 p-4">
                      <p className="text-lg font-bold text-white/58">컷당 환산</p>
                      <p className="mt-2 text-3xl font-black text-[#5eead4]">{money(record.aiCost.totalUsd / 4)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid content-start gap-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="safe-text text-4xl font-black">{dateTime(record.completedAt)}</h2>
                      <p className="mt-2 text-xl font-bold text-white/58">
                        {record.width}x{record.height} · {totalTokens(record.aiCost.lines).toLocaleString()} tokens
                      </p>
                      <p className="mt-1 text-lg font-bold text-white/46">
                        사진 저장: {record.imageFile ? "동의 및 보관" : "미보관"}
                      </p>
                    </div>
                    <span className="rounded-[18px] bg-[#5eead4] px-5 py-3 text-xl font-black text-[#101722]">
                      {record.email ? (record.email.skipped ? "메일 건너뜀" : "메일 전송") : "미전송"}
                    </span>
                  </div>

                  {record.poseSummary && (
                    <p className="safe-text rounded-[22px] bg-[#101722]/58 p-5 text-xl font-bold leading-8 text-white/76">
                      {record.poseSummary}
                    </p>
                  )}

                  {record.selectedKeywords && (
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(record.selectedKeywords).map(([category, keyword]) => (
                        <span key={category} className="rounded-full bg-white/12 px-5 py-3 text-xl font-black">
                          {category}: {keyword}
                        </span>
                      ))}
                    </div>
                  )}

                  <CostRows record={record} />
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
