# 통합 설치 가이드 — 투자 뉴스 브리프

1단계부터 주간 리포트까지의 설치를 한 문서로 합쳤다. 처음부터 다시 설치하거나, 특정 부분만 다시 설정할 때 해당 장만 보면 된다. 단계별 상세 가이드는 `docs/HANDOFF.md` 8장의 링크에 있다.

---

## 0. 준비물

**계정:** GitHub, Vercel, n8n Cloud, Supabase, Discord(서버 관리 권한), 옵시디안(데스크톱)
**도구:** Node.js 22.23.4 이상, Git

**키 (모두 무료 발급)**

| 키 | 발급처 | 쓰는 곳 |
|---|---|---|
| Gemini API 키 | aistudio.google.com | n8n "Gemini" |
| 네이버 Client ID·Secret | developers.naver.com (검색 API, WEB 설정 `http://localhost`) | n8n "Naver API" |
| OpenDART 인증키 (40자리) | opendart.fss.or.kr | n8n "DART" |
| FRED API 키 (32자리) | fred.stlouisfed.org → My Account → API Keys | n8n "FRED" |
| 한국은행 ECOS 인증키 | ecos.bok.or.kr → 개발자센터 | T3 설정 노드 `ecosKey` |
| Finnhub API 키 | finnhub.io | n8n "Finnhub" |
| Groq API 키 | console.groq.com | n8n "Groq" |
| GitHub 토큰 2개 | GitHub → Developer settings → Fine-grained tokens | n8n "GitHub (투자)", "GitHub Models" |
| Discord 앱 | discord.com/developers/applications | Vercel, `.env` |
| SEC 연락처 | 본인 이메일 (키 없음) | 설정 노드 `secUserAgent` |

**비밀 값 다루기:** 키는 대화창에 붙이지 않는다. 웹 화면의 입력 칸이나 `.env`에 직접 넣고, 작업을 맡길 때는 이름만 알려 준다(17장).

---

## 1. GitHub 저장소와 토큰

| 저장소 | 공개 | 만들 때 |
|---|---|---|
| `invest-news-site` | 선택 | README 체크 안 함 (로컬에서 push) |
| `invest-vault` | **비공개** | **README 체크** (빈 저장소엔 n8n이 커밋 못 함) |
| `invest-backup` | **비공개** | **README 체크** |

**토큰 `n8n-invest`:** Only select repositories → 세 저장소 모두, Repository permissions → Contents: Read and write
**토큰 `n8n-models`:** Account permissions → Models: Read-only (저장소 권한 불필요)

사이트 저장소 올리기:
```powershell
cd C:\00AI_EXP\invest-news-site
npm install
npm run build
git init; git branch -M main; git add .; git commit -m "Initial commit"
git remote add origin https://github.com/attackontike/invest-news-site.git
git push -u origin main
```
`git remote`에 `내아이디` 같은 자리표시가 들어갔으면 `git remote set-url origin <실제 주소>`.

---

## 2. Supabase

1. 새 프로젝트 (지역 Seoul)
2. SQL Editor에서 **차례로** 실행 (파일 전체 복사 → Run → "Success. No rows returned"):
   `supabase/schema.sql` → `schema-2.sql` → `schema-3.sql` → `schema-3b.sql` → `schema-4.sql` → `schema-4b.sql`
3. Project Settings → API Keys에서 Project URL과 **서버용 키**(service_role `eyJ…` 또는 Secret `sb_secret_…`)

확인: 테이블 9개 (`articles`, `reports`, `kb_chunks`, `watchlist`, `symbols`, `cursors`, `indicators`, `econ_events`, `stock_data`)

```sql
-- 행 수 확인 (읽기만 함)
select 'articles', count(*) from articles union all select 'kb_chunks', count(*) from kb_chunks
union all select 'watchlist', count(*) from watchlist union all select 'symbols', count(*) from symbols;
```

---

## 3. Vercel

1. Add New → Project → `invest-news-site` Import → 기본값 Deploy (Node 22.x)
2. Settings → Environment Variables (Production) — 12장 Discord 설정 때 넣음:
   `DISCORD_PUBLIC_KEY`, `ALLOWED_USER_IDS`, `N8N_COMMAND_WEBHOOK_URL`, `RELAY_SECRET`
3. 환경변수를 바꾸면 Deployments → 최신 ⋯ → **Redeploy**

---

## 4. 옵시디안 볼트

```powershell
cd C:\00AI_EXP
git clone https://github.com/attackontike/invest-vault.git
copy C:\00AI_EXP\invest-news-site\vault-template\README.md invest-vault\README.md
copy C:\00AI_EXP\invest-news-site\vault-template\.gitignore invest-vault\.gitignore
cd invest-vault; git add .; git commit -m "vault template"; git push
```
**볼트는 사이트 폴더 안에 clone하지 않는다.** 옵시디안 → Open folder as vault → `C:\00AI_EXP\invest-vault` → 커뮤니티 플러그인 **Git** (Pull on startup, Auto pull 10분), 선택으로 Dataview. 모바일에서는 Git 플러그인 비권장.

n8n은 `자동/`(일일·기사·리서치·주간)과 `종목/`(없을 때만)에 쓴다. `자동/`은 직접 고치지 않는다.

---

## 5. n8n 자격 증명 (10개)

| 이름 | 종류 | 값 |
|---|---|---|
| Supabase | Custom Auth | `{"headers":{"apikey":"키","Authorization":"Bearer 키"}}` (sb_secret_ 키면 apikey만) |
| Naver API | Custom Auth | `{"headers":{"X-Naver-Client-Id":"ID","X-Naver-Client-Secret":"시크릿"}}` |
| Gemini | Header Auth | Name `x-goog-api-key`, Value 키 |
| GitHub (투자) | GitHub API | User `attackontike`, Token `n8n-invest` |
| GitHub Models | Header Auth | Name `Authorization`, Value `Bearer github_pat_…` |
| Groq | Header Auth | Name `Authorization`, Value `Bearer gsk_…` |
| DART | Query Auth | Name `crtfc_key`, Value 인증키 |
| FRED | Query Auth | Name `api_key`, Value 키 |
| Finnhub | Query Auth | Name `token`, Value 키 |
| Relay Secret | Header Auth | Name `x-relay-secret`, Value 중계 비밀(`[guid]::NewGuid().ToString("N")`) |

**Query Auth·Header Auth의 Name 칸은 위 이름 그대로.** 자격 증명 제목과 다르다. 같은 종류가 여럿이므로 노드마다 맞는 것을 고른다.

---

## 6. 워크플로 공통 순서

모든 워크플로: Import from File(`n8n/*.json`) → **설정 노드부터** 채우기 → 아래 표대로 자격 증명 → ⋯ Settings → Error Workflow = "투자 뉴스 - 실패 알림" → 저장 → Execute workflow로 시험 → Active(Publish)

**실패 알림을 가장 먼저:** `error-alert.json` 가져오기 → "알림 내용 만들기" 노드 맨 위 `DISCORD_WEBHOOK_URL` → 저장(목록에 안 보이면 저장·새로고침·Publish·같은 프로젝트인지 확인)

---

## 7. 종목 사전 (`symbols-build.json`) — 일요일 06:00

설정: `supabaseUrl`, `secUserAgent`(실제 이메일, 영문만)
자격 증명: DART → DART 고유번호 파일 / Supabase → 사전 저장
확인: `symbols`에 국내 약 2,500~4,000, 미국 약 1만 행. "SEC 티커 목록" 403이면 이메일.

---

## 8. T2 언론 수집 + 게시 — 1단계

**T2 (`t2-news-collect.json`)** 설정 `supabaseUrl` / Supabase → 관심 종목 조회, 이미 저장된 기사, Supabase 저장 / Naver API → 네이버 뉴스
확인: `articles`에 `status=new` 행. RSS 피드 403·404는 설정 노드 `feeds`에서 수정.

**게시 (`publish-digest.json`)** 설정 `githubOwner`, `siteUrl`, `supabaseUrl`, `discordWebhookUrl`(#브리핑), `vaultRepo`, `geminiModel`·`fallbackModel`

| 자격 증명 | 노드 |
|---|---|
| Supabase | 새 기사 조회, 오늘 게시분 조회, 오늘 브리핑 조회, 종목 사전 조회, 기사 저장, 브리핑 저장, 지식베이스 저장 |
| Gemini | Gemini 요약·평가, Gemini 예비 모델, 임베딩 |
| GitHub (투자) | GitHub 기존 파일 확인, GitHub 커밋, 볼트 파일 목록, 볼트 기준 커밋, 볼트 트리 만들기, 볼트 커밋 만들기, 볼트 반영 |

첫 실행은 **T2 → 게시** 순서. 확인: digest 커밋, 사이트, Discord, `kb_chunks`, 옵시디안 `자동/일일/`.

---

## 9. T1 공시 수집 (`t1-filings-collect.json`) — 2단계

설정: `supabaseUrl`, `secUserAgent`, `discordAlertWebhook`(#공시알림), 선택 `alertAllImportant`
자격 증명: DART → DART 공시목록 / Supabase → 수집 맥락 조회, 이미 저장된 공시, 공시 저장, 커서 저장
첫 실행엔 DART 즉시 알림이 없음(기준점 설정). 관심 종목은 Discord `/watch`나 Table Editor `watchlist`.

---

## 10. T3 데이터·일정 + 일정 예고 — 4-A

**T3 (`t3-data-calendar.json`)** 설정: `githubOwner`, `supabaseUrl`, `ecosKey`, `manualEvents`

`manualEvents` 형식 (날짜는 숫자만, 기관 홈페이지에서 확인):
```js
manualEvents: [
  { date: '2026-12-09', timeEt: '14:00', market: 'US', name: 'FOMC 금리 결정', importance: 3 },  // 미국 날짜·동부 시각
  { date: '2027-01-14', time: '10:00', market: 'KR', name: '한국은행 기준금리 결정', importance: 3 }, // 한국 날짜·시각
],
```
`fred` 목록에는 기본 7개 + 유로/달러(`market: 'KR'`) + 시장 심리 5개(`group: 'sentiment'`: VIXCLS, BAMLH0A0HYM2, T10Y2Y, DTWEXBGS, STLFSI4), `ecos` 목록에는 기본 4개 + 원/엔·원/유로·원/위안(731Y001 / 0000002·0000003·0000053).

| 자격 증명 | 노드 |
|---|---|
| FRED | FRED 조회 |
| Supabase | 기존 지표 조회, 지표 저장, 일정 저장, 지식베이스 저장 |
| GitHub (투자) | GitHub 기존 파일 확인, GitHub 커밋 |
| Gemini | 임베딩 |

확인: "데이터 정리" 출력 `report` 첫 줄 `FRED: 요청 N개, 응답 N개, 지표 N개…`, `src/data/market.json` 커밋.

**일정 예고 (`event-preview.json`)** 설정 `supabaseUrl`, `discordWebhookUrl`, `siteUrl`, `minImportance`(2) / Supabase → 내일 일정 조회

---

## 11. 종목 데이터 (`stock-data.json`) — 4-B

설정: `githubOwner`, `supabaseUrl`
자격 증명: Supabase → 관심 종목 조회, 기존 종목 데이터 조회, 종목 데이터 저장, 실적 일정 저장, 지식베이스 저장 / DART → DART 재무 조회 / Finnhub → Finnhub 조회 / GitHub (투자) → GitHub 기존 파일 확인, GitHub 커밋 / Gemini → 임베딩
확인: `report` 첫 줄 `관심 종목 N개 … 정리 N개`, `src/data/stocks.json` 커밋, `/watchlist/<코드>` 페이지.

---

## 12. Discord 명령·리서치·질문 답변 — 3단계

**Discord 앱:** New Application → General Information의 Application ID·Public Key / Bot → Reset Token / Installation → Guild Install / Bot → Requires OAuth2 Code Grant **끄기** / 초대:
```
https://discord.com/oauth2/authorize?client_id=<APP_ID>&scope=applications.commands%20bot&permissions=0
```
서버 ID·내 사용자 ID: 개발자 모드 켜고 오른쪽 클릭 → ID 복사.

**순서가 중요:**
1. n8n `discord-command.json` 가져오기 → 설정 `supabaseUrl` → Relay Secret → Discord 명령 받기 / Supabase → 관심 종목·후보 조회, 관심 종목 추가, 관심 종목 삭제 → **Active** → "Discord 명령 받기" 노드의 **Production URL** 복사
2. `research.json`, `ask.json` 가져오기 (아래 표) → 저장·Publish
3. Discord 명령 워크플로의 **리서치 실행** → "투자 뉴스 - 리서치", **질문 답변 실행** → "투자 뉴스 - 질문 답변" 선택
4. Vercel 환경변수 4개 → Redeploy → `https://사이트/api/discord`가 "동작 중" 문구를 보이는지
5. Discord 개발자 포털 → Interactions Endpoint URL = `https://사이트/api/discord` → Save
6. 명령 등록: `.env` 준비(17장) 후 `node --env-file=.env scripts/register-commands.mjs` → "등록 완료: /watch, /research, /ask"

| 리서치 (`research.json`) 자격 증명 | 노드 |
|---|---|
| Gemini | 주제 해석, 질문 임베딩, 배경 조사, 리포트 작성, 리포트 작성 (예비), 임베딩 |
| GitHub Models | 다른 AI 관점 |
| Groq | 다른 AI 관점 (예비) |
| Supabase | 종목 확인, 과거 맥락 조회, 리포트 저장, 지식베이스 저장 |
| DART / Naver API | DART 공시 조회 / 네이버 조회 |
| GitHub (투자) | 사이트에 리포트 커밋, 볼트에 노트 커밋 |

리서치 설정: `githubOwner`, `siteUrl`, `supabaseUrl`, `secUserAgent`, `vaultRepo`, 모델, `qaPrimary`(GitHub Models `openai/gpt-4.1-mini`), `qaFallback`(Groq `openai/gpt-oss-120b`). n8n에서 직접 실행하면 `testTopic`으로 돌고 Discord로는 안 보냄.

질문 답변 (`ask.json`): 설정 `supabaseUrl`, 모델 / Gemini → 질문 해석, 질문 임베딩, 답변 작성, 답변 작성 (예비) / Supabase → 종목 확인, 지식베이스 검색 (종목), 지식베이스 검색 (전체)

**Discord 명령 워크플로를 교체할 때는 옛 것을 먼저 비활성화** (같은 웹훅 경로).

---

## 13. 주간 리포트 (`weekly-report.json`) — 매주 일요일 08:00

사이트 쪽 파일은 이 저장소에 이미 반영돼 있다 (`src/pages/weekly/`, `src/content/weekly/`, `content.config.ts` 등). push만 되어 있으면 된다.

설정: `githubOwner`, `siteUrl`, `supabaseUrl`, `discordWebhookUrl`, `vaultRepo`, 모델

| 자격 증명 | 노드 |
|---|---|
| Supabase | 주간 기사 조회, 지표 조회, 다음 주 일정 조회, 관심 종목 조회, 주간 리서치 조회, 리포트 저장, 지식베이스 저장 |
| Gemini | 주간 리포트 작성, 주간 리포트 작성 (예비), 임베딩 |
| GitHub (투자) | 사이트 기존 파일, 사이트에 커밋, 볼트 기존 파일, 볼트에 노트 커밋 |

확인: `src/content/weekly/YYYY-Www.md` 커밋, 사이트 "주간 리포트", Discord, 옵시디안 `자동/주간/`. Gemini가 모두 실패하면 "AI 요약 없음" 리포트가 대신 게시됨.

---

## 14. 백업과 복구 (`backup.json`) — 일요일 06:30

설정: `githubOwner`, `supabaseUrl`, `discordWebhookUrl`(선택)
자격 증명: Supabase → 백업 기준점 조회, 내보내기 8개, 백업 시점 저장 / GitHub (투자) → 블롭 만들기, 백업 저장소 트리, 백업 기준 커밋, 트리 만들기, 커밋 만들기, 백업 반영
첫 실행은 전체, 이후 증분. 지식베이스 벡터와 `symbols`는 백업하지 않음.

**복구:**
1. (새 Supabase라면) 2장 스키마 6개 실행
2. `git clone https://github.com/attackontike/invest-backup.git C:\00AI_EXP\invest-backup`
3. `.env`에 `SUPABASE_URL`, `SUPABASE_KEY`, `GEMINI_API_KEY`
4. `node --env-file=.env scripts/restore.mjs C:\00AI_EXP\invest-backup --dry-run` → 행 수 확인
5. `node --env-file=.env scripts/restore.mjs C:\00AI_EXP\invest-backup`
6. 출력된 `setval` SQL 3줄 실행 → n8n 종목 사전 실행 → (새 프로젝트면) 모든 설정 노드 `supabaseUrl`과 Supabase 자격 증명 교체

---

## 15. 처음부터 설치할 때의 실행 순서

1. 실패 알림 → 2. 종목 사전 → 3. 관심 종목 등록 → 4. T1 → 5. T2 → 6. 게시 → 7. T3 → 8. 종목 데이터 → 9. 일정 예고 → 10. Discord 명령·리서치·질문 답변 → 11. 주간 리포트 → 12. 백업
각각 시험 실행 후 Active. 사이트 확인은 커밋 → Vercel 배포(1~2분) 뒤.

---

## 16. 문제 해결 (자주 나온 것)

| 증상 | 처치 |
|---|---|
| connection cannot be established / incorrect host | 그 워크플로 설정 노드 `supabaseUrl`이 기본값 |
| Supabase 401 | Custom Auth JSON 형식, 키 종류 |
| 404 (rpc 함수·테이블) | 해당 스키마 SQL 미실행 |
| DART 010·011 | DART 자격 증명 (Query Auth `crtfc_key`), 다른 Query Auth가 선택되지 않았는지 |
| FRED "api_key is not set" | FRED Query Auth Name `api_key`, 노드에 FRED 선택 |
| Finnhub 401 | Query Auth Name `token` |
| SEC 403 | `secUserAgent`에 실제 이메일 (종목 사전·T1·리서치) |
| Gemini 404 / 400 / 503 | 모델 이름 / thinkingConfig 줄 삭제 / 자동 예비 모델 |
| GitHub 404 / 401 / 422 | owner·repo 이름 / 토큰 권한·만료 / 다시 실행 |
| Invalid time value | `manualEvents` 날짜 형식 (숫자 날짜만) |
| 명령 등록 403 Missing Access | `applications.commands` 포함 초대 주소로 재초대 |
| Integration requires code grant | Bot → Requires OAuth2 Code Grant 끄기 |
| "생각하는 중…"에서 멈춤 | Discord 명령 워크플로 Active, Production URL, Relay Secret 값 일치 |
| 사이트에 안 보임 (에러 없음) | 커밋·배포 완료 여부, 반영 시점 (게시 4회/일, 데이터 1회/일) |
| Error Workflow 목록에 실패 알림이 없음 | 저장·새로고침·검색·Publish·같은 프로젝트 |

---

## 17. 비밀 값 다루기

- 웹 화면의 키 입력 칸은 **직접** 채우고, 작업을 맡길 땐 "FRED라는 이름으로 만들어 뒀다"처럼 이름만 알려 준다.
- 로컬 스크립트는 `.env.example`을 복사해 `.env`를 만들고(메모장 저장 시 "모든 파일"), 값을 직접 채운다. `.env`는 `.gitignore`에 있어 올라가지 않는다(`git status`로 확인).
- 실행은 `node --env-file=.env scripts/<스크립트>`. Claude Code에는 "`.env`는 열지 말고 이 명령으로 실행해"라고 말한다.
- 노출됐다면 해당 키를 재발급하고 새 값으로 교체한다 (Discord Reset Token, GitHub 토큰 재생성, Supabase 키 Rotate, 나머지는 새 키 발급 후 옛 키 삭제).
