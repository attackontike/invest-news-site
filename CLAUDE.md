# 투자 뉴스 브리프 — Claude Code 작업 안내

이 저장소는 국내·미국 시장의 공시·뉴스·지표를 자동 수집해 요약·게시하는 개인 투자 정보 시스템의 **사이트와 설정 원본**이다. 실제 자동화는 n8n Cloud에서 돌고, 데이터는 Supabase, 사이트는 Vercel(Astro 정적 사이트), 알림·명령은 Discord, 노트는 옵시디안 볼트(GitHub `invest-vault`)에 있다.

- 현재 상태와 남은 일: `docs/HANDOFF.md` (**작업 시작 전에 먼저 읽기**)
- 처음부터 다시 설치하거나 일부를 다시 설정할 때: `docs/INSTALL.md`
- 사용자는 한국어로 대화한다. 설명과 안내는 한국어로, 비전문가도 따라 할 수 있게 쓴다.

## 저장소 구조

| 경로 | 내용 |
|---|---|
| `src/` | Astro 7 사이트. 메뉴: 시장 브리핑(`/`), 시장 뉴스, 공시·공식 발표, 관심 종목(+ `/watchlist/<코드>`), 주간 리포트, 리서치, 데이터·일정 |
| `src/content/digest/`, `research/`, `weekly/` | **n8n이 커밋하는 콘텐츠.** 직접 고치지 않음 |
| `src/data/market.json`, `stocks.json` | **n8n이 매일 갱신.** 덮어쓰지 않음 |
| `src/lib/news.ts` | 화면 기준 `RULES`, 관심 종목 목록(게시 파일과 stocks.json 중 최신) |
| `api/discord.js` | Vercel 함수. Discord 서명 검증 → n8n 웹훅 중계 |
| `scripts/register-commands.mjs` | Discord 슬래시 명령 등록 (`/watch`, `/research`, `/ask`) |
| `scripts/restore.mjs` | 백업 저장소 → Supabase 복구 |
| `supabase/schema*.sql` | DB 스키마. 순서: schema → 2 → 3 → 3b → 4 → 4b |
| `n8n/*.json` | n8n 워크플로 13개 (빌드 결과물) |
| `tools/n8n-build/` | 워크플로 원본 코드와 빌드 도구. 자세한 규칙은 그 폴더 README |

## 반드시 지킬 것

### 비밀 값
- **`.env` 파일을 열거나 내용을 출력하지 않는다.** 스크립트는 `node --env-file=.env scripts/...`로 실행한다.
- 키·토큰·웹훅 주소를 대화나 커밋에 쓰지 않는다. 사용자에게 값을 대화창에 붙여 달라고 하지 않는다. 필요한 값은 사용자가 `.env`나 각 서비스 화면에 직접 넣고, 이름만 알려 준다.
- n8n 워크플로 JSON에는 자리표시(`YOUR-GITHUB-ID`, `https://YOUR-PROJECT.supabase.co`, 빈 웹훅)만 둔다.

### git
- 작업 시작 전 항상 `git pull` (n8n이 하루 여러 번 커밋함: digest 하루 4번, market.json·stocks.json 매일, weekly 매주).
- `src/content/**`와 `src/data/*.json`은 수정·덮어쓰기 금지 (사용자가 명시적으로 요청한 경우만).
- 커밋 전 `npm run build`가 통과하는지 확인.

### 되돌리기 어려운 작업은 먼저 묻기
Supabase SQL 실행(특히 DROP·DELETE), n8n 워크플로 교체·삭제, 저장소 생성·삭제, Discord 명령 재등록, Vercel 환경변수 변경.

## 설계 원칙 (코드를 고칠 때 유지)

1. 수집(T1 공시·T2 뉴스·T3 데이터)은 DB에 쌓기만, 게시는 하루 4번. 사이트 커밋 횟수를 늘리지 않는다.
2. AI(Gemini 등)는 **자료 번호로만 근거**를 단다(F·N·K·S·W). URL은 시스템이 붙이고, 없는 번호는 제거한다.
3. 사실과 AI 해석을 구분한다: 지식베이스 `kb_chunks.is_ai`, 화면의 "AI 정리" 표시.
4. `/ask`의 답은 지식베이스에 저장하지 않는다.
5. 종목코드는 Gemini가 아니라 종목 사전(`symbols`)에서만 확인한다.
6. 실패해도 멈추지 않게: 예비 모델, 부분 실패 시 나머지 계속, 모든 실패는 "실패 알림" 워크플로로 Discord에 처치 문구와 함께.
7. 매수·매도 권유, 목표주가, 가격 예측은 어떤 프롬프트·화면에서도 쓰지 않는다. 호재·악재는 기사 논조 분류일 뿐이다.
8. 사용자가 바꿀 값은 워크플로의 "설정" 노드에만.
9. 디자인: 빨강 = 상승·호재, 파랑 = 하락·악재(국내 관례). Pretendard, 라이트·다크·모바일 모두 확인.

## 자주 하는 작업

| 작업 | 방법 |
|---|---|
| 사이트 수정 | `src/` 수정 → `npm run build` → 커밋·push → Vercel 자동 배포 |
| n8n 코드 노드 수정 | `tools/n8n-build/code/*.js` 수정 → `node tools/n8n-build/build_wf.cjs` → 커밋. 사용자에게는 **바뀐 노드 이름과 새 코드 파일**을 알려 주고 n8n에서 그 노드 코드만 교체하도록 안내 |
| 새 지표 추가 | T3 설정 노드의 `fred`/`ecos` 목록에 한 줄 (`group: 'sentiment'`, `market: 'KR'` 지원) |
| Discord 명령 추가·변경 | `scripts/register-commands.mjs` 수정 → 사용자가 `.env`를 준비한 뒤 `node --env-file=.env scripts/register-commands.mjs` |
| 관심 종목 | Discord `/watch add·remove·list` (DB `watchlist`) |
| 복구 | `docs/INSTALL.md`의 "백업과 복구" |
