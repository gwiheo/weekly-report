import { buildXlsx } from "@/lib/export-xlsx";
import { normalizePlan } from "@/lib/plan";
import { planFileBaseName } from "@/lib/table";

export const runtime = "nodejs";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const plan = normalizePlan(payload);
  if (!plan) {
    return Response.json({ error: "계획 데이터를 읽을 수 없습니다." }, { status: 400 });
  }

  try {
    const buffer = await buildXlsx(plan);
    const fileName = `${planFileBaseName(plan)}.xlsx`;
    return new Response(new Blob([new Uint8Array(buffer)], { type: XLSX_MIME }), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="plan.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("xlsx export failed", error);
    return Response.json({ error: "xlsx 파일을 만들지 못했습니다." }, { status: 500 });
  }
}
