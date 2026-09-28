# 주간 연구계획 마인드맵 (Weekly Research Planner)

연구 주제 · 추진 내용 · 주간 일정을 **마인드맵**으로 정리하고, 그대로 **주간업무표 형식의 docx**(스프레드시트처럼 칸이 나뉜 표)와 **xlsx**로 저장하는 웹 앱입니다.

## 무엇을 할 수 있나요

- **마인드맵 편집**: 가운데 문서 노드 → 연구 주제 → 추진 내용으로 가지를 뻗어 가며 작성합니다. 확대/축소, 화면 이동, 키보드 단축키를 지원합니다.
- **일정 표시**: 추진 내용마다 월~금(또는 토·일 포함) 중 기간을 골라 두면, 표에서 해당 요일 칸이 하나로 합쳐지고 `←──→` 화살표가 들어갑니다. 화살표 대신 `임시 공휴일` 같은 문구도 넣을 수 있습니다.
- **회의 표기**: `@ 외부회의`, `# 내부회의` 머리 기호를 붙일 수 있고, 표 첫 줄의 범례와 짝을 이룹니다.
- **표 미리보기**: 저장될 표와 같은 구조를 화면에서 먼저 확인하고, 칸을 눌러 해당 항목으로 바로 이동합니다.
- **저장**: `DOCX 저장`(A4 가로, 병합된 표 한 장), `XLSX`(같은 표를 엑셀 시트로), `PPTX`(16:9 슬라이드 한 장), `JSON`(다시 불러와 편집).
- **자동 보관**: 작성 중인 내용은 브라우저 localStorage에 저장되어 새로고침해도 남아 있습니다.

## 표 구성

첨부 양식과 같은 구조로 만들어집니다.

| 열 | 내용 |
| --- | --- |
| 1열 | 연구 주제 (주제별로 세로 병합) |
| 2열 | 연구 내용 (`-` 머리기호 목록, 주제별로 세로 병합) |
| 3열 이후 | 월·화·수·목·금 (첫 줄은 요일, 둘째 줄은 `26.8.17` 형식의 날짜) |

- 표 맨 윗줄 두 번째 칸에는 범례(`@ : 외부회의 , # : 내부회의`)가 들어갑니다.
- 한 주제 안에서 일정이 서로 겹치면 겹치는 만큼만 줄을 나누고, 주제·내용 칸은 세로로 병합합니다.
- 주제 블록 사이의 빈 줄은 옵션으로 끄고 켤 수 있습니다.

## 실행 방법

```bash
npm install
npm run dev
```

http://localhost:43127 에서 열립니다.

```bash
npm run build && npm run start   # 프로덕션 실행
npm run lint                     # 린트
```

Node.js 20 이상을 권장합니다. 별도의 API 키나 데이터베이스는 필요하지 않습니다.

## Cloud Agent 환경

`.cursor/environment.json`이 새 에이전트 부팅을 준비합니다.

- `install`: `npm ci`로 lockfile 기준 패키지를 설치합니다.
- `terminals`: 포트 43127에서 Next.js 개발 서버를 띄웁니다.

이미 떠 있는 세션에는 적용되지 않습니다. 이후 **새로 시작한** Cloud Agent부터 패키지 설치와 개발 서버가 자동으로 준비됩니다. Preview 브라우저의 localStorage(작성 중인 계획)는 VM이 지워지면 사라지므로, 주간 원본은 JSON으로 내려받아 두세요.

## 키보드 단축키

| 키 | 동작 |
| --- | --- |
| `Enter` | 같은 단계에 새 항목 추가 |
| `Shift + Enter` | 노드 안에서 줄바꿈 |
| `Tab` | 주제에서는 하위 추진 내용, 추진 내용에서는 형제 항목 추가 |
| `Backspace` (빈 칸에서) | 해당 노드 삭제 |
| `Ctrl/⌘ + S` | docx 저장 |
| 휠 / `Ctrl + 휠` | 화면 이동 / 확대·축소 |

## 폴더 구조

```
src/
  app/
    api/export/docx/route.ts   docx 생성 (docx 라이브러리)
    api/export/xlsx/route.ts   xlsx 생성 (exceljs)
    api/export/pptx/route.ts   pptx 생성 (pptxgenjs)
    page.tsx                   앱 진입점
  components/
    mindmap-canvas.tsx         마인드맵 캔버스 (노드, 연결선, 확대/이동)
    inspector-panel.tsx        선택한 노드의 상세 설정 (일정·표기·순서)
    table-preview.tsx          저장될 표 미리보기
    planner-app.tsx            전체 레이아웃과 내보내기 동작
  lib/
    plan.ts                    데이터 모델과 예시 데이터
    table.ts                   마인드맵 → 표 변환 (병합·화살표·레인 배치)
    export-docx.ts             표 모델 → docx
    export-xlsx.ts             표 모델 → xlsx
    export-pptx.ts             표 모델 → pptx (슬라이드 높이에 맞춰 페이지 나눔)
    use-plan.ts                상태 관리와 localStorage 보관
```

`lib/table.ts`가 단일 기준입니다. 미리보기·docx·xlsx·pptx가 모두 같은 표 모델을 사용하므로 화면에서 본 그대로 파일에 저장됩니다.

pptx는 슬라이드 높이가 정해져 있어, 주제 블록 단위로 높이를 재서 한 장에 담기지 않으면 다음 장으로 넘기고 머리글 두 줄을 다시 얹습니다. 세로 병합된 주제는 쪼개지지 않습니다.

## 기술 스택

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · docx · exceljs · pptxgenjs
