import { buildPptx } from "@/lib/export-pptx";
import { normalizePlan } from "@/lib/plan";
import { planFileBaseName } from "@/lib/table";

export const runtime = "nodejs";

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

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
    const buffer = await buildPptx(plan);
    const fileName = `${planFileBaseName(plan)}.pptx`;
    return new Response(new Blob([new Uint8Array(buffer)], { type: PPTX_MIME }), {
      headers: {
        "Content-Type": PPTX_MIME,
        "Content-Disposition": `attachment; filename="plan.pptx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("pptx export failed", error);
    return Response.json({ error: "pptx 파일을 만들지 못했습니다." }, { status: 500 });
  }
}
