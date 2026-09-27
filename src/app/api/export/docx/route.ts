import { buildDocx } from "@/lib/export-docx";
import { normalizePlan } from "@/lib/plan";
import { planFileBaseName } from "@/lib/table";

export const runtime = "nodejs";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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
    const buffer = await buildDocx(plan);
    const fileName = `${planFileBaseName(plan)}.docx`;
    return new Response(new Blob([new Uint8Array(buffer)], { type: DOCX_MIME }), {
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": `attachment; filename="plan.docx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("docx export failed", error);
    return Response.json({ error: "docx 파일을 만들지 못했습니다." }, { status: 500 });
  }
}
