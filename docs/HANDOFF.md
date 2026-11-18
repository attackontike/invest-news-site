# 인계 리포트 — 투자 뉴스 브리프 (2026-11-18 기준)

claude.ai 채팅에서 2026-11-12부터 11-18까지 구축한 내용을 정리했다. 이후 작업은 Claude Code에서 이어간다.

## 1. 한눈에 보는 현재 상태

| 구분 | 상태 |
|---|---|
| 1단계: T2 뉴스 수집, 게시, 사이트, 지식베이스, 옵시디안 | ✅ 설치·운영 중 |
| 2단계: T1 공시 수집, 즉시 알림, 종목 사전, 관심 종목 | ✅ 설치·운영 중 |
| 3-A: Discord 앱, Vercel 중계, `/watch` | ✅ 설치·운영 중 |
| 3-B: `/research` 리서치 (Q&A는 GitHub Models + Groq 무료) | ✅ 설치, n8n 직접 실행 확인 / ⬜ Discord `/research` 결과 메시지까지 확인 필요 |
| 3-C: `/ask` 지식베이스 질문 | ✅ 설치·운영 중 |
| 4-A: FRED·ECOS 지표 15개, 경제 일정, 전날 예고 | ✅ 설치·운영 중 |
| 4-B: 관심 종목 재무·실적 일정, 종목 페이지 | ✅ 설치·운영 중 |
| 시장 심리 지표 (VIX 등 5개, 시장 온도계) | ✅ 설치·운영 중 |
| 백업 (매주 Supabase → `invest-backup`) | ✅ 설치·운영 중 |
| 주간 리포트 | ✅ 설치·Active (2026-11-18, n8n API로 설치). 첫 자동 실행 2026-11-22(일) 08:00 |

## 2. 하루·한 주의 자동 실행 (한국 시간)

| 시각 | 워크플로 | 하는 일 |
|---|---|---|
| 평일 07:00~23:30, 30분마다 | T1 공시 수집 | DART·SEC·연준 → 관심 종목 중요 공시·FOMC 즉시 Discord |
| 매일 07~23시 정각 | T2 언론 수집 | RSS·Google News·네이버(관심 종목 별도 검색) |
| 매일 06:40 | T3 데이터·일정 | 지표 20개(시장 심리 포함), 30일 일정 → `src/data/market.json` |
| 매일 06:50 | 종목 데이터 | 관심 종목 재무·EPS·실적 발표일 → `src/data/stocks.json` |
| 07:00·12:00·16:30·22:00 | 게시 | Gemini 요약 → digest 커밋, Discord 브리핑, 옵시디안, 지식베이스 |
| 매일 20:00 | 일정 예고 | 내일 중요 일정 Discord |
| 일요일 06:00 | 종목 사전 | DART 상장사 + SEC 티커 → `symbols` |
| 일요일 06:30 | 백업 | Supabase → `invest-backup` |
| 일요일 08:00 | 주간 리포트 | (설치 후) 지난주 정리 + 다음 주 체크포인트 |
| Discord 명령 때 | Discord 명령 / 리서치 / 질문 답변 | `/watch`, `/research`, `/ask` |
| 다른 워크플로 실패 때 | 실패 알림 | 멈춘 노드와 처치 방법을 Discord로 |

n8n 실행 횟수: 자동 실행 월 약 1,490회 + Discord 명령 사용분.

## 3. 워크플로 13개

| n8n 이름 | 파일 | 노드 | 설정 노드에 사용자가 넣은 값 |
|---|---|---|---|
| 투자 뉴스 - T1 공시 수집 | `t1-filings-collect.json` | 15 | supabaseUrl, secUserAgent(이메일), discordAlertWebhook |
| 투자 뉴스 - T2 언론 수집 | `t2-news-collect.json` | 13 | supabaseUrl |
| 투자 뉴스 - T3 데이터·일정 | `t3-data-calendar.json` | 16 | githubOwner, supabaseUrl, **ecosKey**, manualEvents, 지표 목록(환율 4·심리 5 추가됨) |
| 투자 뉴스 - 게시 | `publish-digest.json` | 29 | githubOwner, siteUrl, supabaseUrl, discordWebhookUrl, vaultRepo, 모델 이름 |
| 투자 뉴스 - 종목 사전 | `symbols-build.json` | 8 | supabaseUrl, secUserAgent |
| 투자 뉴스 - 종목 데이터 | `stock-data.json` | 17 | githubOwner, supabaseUrl |
| 투자 뉴스 - 일정 예고 | `event-preview.json` | 5 | supabaseUrl, discordWebhookUrl, siteUrl |
| 투자 뉴스 - Discord 명령 | `discord-command.json` | 14 | supabaseUrl. "리서치 실행"·"질문 답변 실행" 노드에서 대상 워크플로 선택 |
| 투자 뉴스 - 리서치 | `research.json` | 37 | githubOwner, siteUrl, supabaseUrl, secUserAgent, vaultRepo, 모델, qaPrimary·qaFallback |
| 투자 뉴스 - 질문 답변 | `ask.json` | 17 | supabaseUrl, 모델 |
| 투자 뉴스 - 실패 알림 | `error-alert.json` | 3 | DISCORD_WEBHOOK_URL (코드 맨 위) |
| 투자 뉴스 - 백업 | `backup.json` | 24 | githubOwner, supabaseUrl, discordWebhookUrl |
| 투자 뉴스 - 주간 리포트 | `weekly-report.json` | 24 | (설치 전) |

저장소의 JSON은 자리표시만 들어 있다. **실제 값은 n8n 안에만 있으므로**, 워크플로를 다시 가져오면 설정 노드와 자격 증명을 다시 넣어야 한다.

## 4. 외부 서비스와 비밀 값의 위치

| 서비스 | 쓰는 곳 | 비밀 값 위치 |
|---|---|---|
| Supabase | DB·지식베이스 | n8n 자격 증명 "Supabase" (Custom Auth) |
| Gemini | 요약·리포트·임베딩·배경 검색 | n8n "Gemini" (Header Auth `x-goog-api-key`) |
| GitHub | 사이트·볼트·백업 커밋 | n8n "GitHub (투자)" (토큰 `n8n-invest`: invest-news-site·invest-vault·invest-backup, Contents 쓰기) |
| GitHub Models / Groq | 리서치 Q&A | n8n "GitHub Models"(토큰 `n8n-models`, Models 읽기) / "Groq" (Header Auth `Authorization: Bearer`) |
| 네이버 검색 | 국내 뉴스 | n8n "Naver API" (Custom Auth) |
| OpenDART | 공시·종목 사전·분기 실적 | n8n "DART" (Query Auth `crtfc_key`) |
| FRED | 미국 지표·일정·심리 | n8n "FRED" (Query Auth `api_key`) |
| Finnhub | 미국 종목 지표·실적일 | n8n "Finnhub" (Query Auth `token`) |
| 한국은행 ECOS | 한국 지표·환율 | **T3 설정 노드 `ecosKey`** |
| SEC EDGAR | 미국 공시·티커 | 키 없음, 설정 노드 `secUserAgent`에 이메일 |
| Discord | 앱·명령, 웹훅 | 봇 토큰은 `.env`(명령 등록 때만), 웹훅은 각 설정 노드, 중계 비밀은 n8n "Relay Secret" + Vercel |
| Vercel | 사이트·중계 함수 | 환경변수 `DISCORD_PUBLIC_KEY`, `ALLOWED_USER_IDS`, `N8N_COMMAND_WEBHOOK_URL`, `RELAY_SECRET` |

GitHub 계정 `attackontike`. 저장소: `invest-news-site`(공개 여부 확인 필요), `invest-vault`(비공개), `invest-backup`(비공개). 로컬 작업 폴더 `C:\00AI_EXP`.

## 5. Supabase

테이블: `articles`, `reports`, `kb_chunks`(768차원), `watchlist`, `symbols`, `cursors`, `indicators`, `econ_events`, `stock_data`
함수: `existing_url_keys`, `match_kb`, `t1_context`, `digest_context`, `watch_context`, `research_context`
모든 테이블 RLS 켜짐(공개 키로 접근 불가), n8n은 서버 키 사용.

## 6. 남은 일 (우선순위)

> **n8n 자격 증명 실제 상태:** 저장소 JSON은 Custom Auth(Supabase)·Header Auth(Gemini)로 되어 있지만, 실제 n8n 워크플로는 n8n 내장 자격 증명 `Supabase account`(supabaseApi), `Google Gemini(PaLM) Api account`(googlePalmApi), `GitHub account`(githubApi)를 쓴다. 저장소 JSON을 다시 가져올 때는 노드의 Authentication을 이 내장 종류로 바꾼다.
>
> **n8n API:** `C:\00AI_EXP\invest-news-site\.env`에 `N8N_BASE_URL`, `N8N_API_KEY`가 있으면 Claude Code가 워크플로 조회·생성·수정을 할 수 있다 (`node --env-file=...`, 값은 출력하지 않음). 수동 실행은 API로 불가.


1. ~~주간 리포트 설치~~ ✅ 2026-11-18. 첫 실행(11-22 08:00) 결과 확인: `src/content/weekly/2026-W47.md` 커밋, Discord, 옵시디안 `자동/주간/`
2. ~~실패 알림 처치 문구 최신화~~ ✅ 2026-11-18 (웹훅 유지) — 이후 추가된 노드들의 안내가 `tools/n8n-build/code/err_alert.js`에 있음. n8n "실패 알림"의 "알림 내용 만들기" 노드 코드를 이 파일로 교체하되, 맨 위 `DISCORD_WEBHOOK_URL` 값은 기존 것을 유지
3. Discord에서 `/research topic:…` 실행해 결과 메시지까지 확인
4. ~~2027년 FOMC·금통위 날짜~~ ✅ 2026-11-18 T3 `manualEvents`에 17건. 금통위 4/9·10/15는 기사마다 달라(일부 4/22·10/28) 한국은행 공식 일정표로 재확인 필요
5. 옵시디안 최종 리포트 노트에 시장 심리·백업·주간 리포트 반영 (선택)
6. **`/research-delete` 명령 등록** (2026-11-19 n8n 쪽은 설치됨) — `.env`에 `DISCORD_APP_ID`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`를 넣고 `node --env-file=.env scripts/register-commands.mjs`
7. **국내 주가 (선택)** — 공공데이터포털 "금융위원회_주식시세정보" 활용 신청 → 일반 인증키(Decoding)를 n8n "종목 데이터" 설정 노드 `krxKey`에. 비어 있으면 국내 주가만 빠지고 나머지는 정상

### 2026-11-19 추가된 것
- 첫 화면 시장 요약: 코스피·코스닥(ECOS 802Y001)·S&P 500·나스닥(FRED)·원/달러·온도계. T3 설정 `group: 'index'`
- 관심 종목 주가 (전 거래일 종가): 미국 Finnhub `quote`, 국내 `krxKey`
- 시장 뉴스 날짜별 페이지 `/news/YYYY-MM-DD` (기간 제한 없음), `/news`는 가장 최근 날짜
- 사이트 검색 `/search` (Pagefind, 빌드 때 색인. 날짜별 뉴스·리서치·주간 리포트만 색인)
- 리서치: 자료가 주제와 맞지 않거나 부족하면 게시하지 않고 Discord로 알림. `/research-delete target:<주소>`로 사이트 파일·reports·kb_chunks 삭제 (볼트 노트는 그대로)
- 게시: 공시(T1)를 기사보다 먼저 담음, Gemini 기본 모델 요청 13초 간격 (무료 등급 분당 5회)

다음 후보: 이상 신호 알림(관심 종목 뉴스 급증·논조 급변·VIX 급등), 대화형 리서치 챗봇.

## 7. 지금까지의 교훈 (같은 실수 방지)

- 새 워크플로를 가져오면 **설정 노드부터** (supabaseUrl 기본값 때문에 "incorrect host" 오류가 났었음)
- Query Auth의 **Name 칸은 서비스가 정한 이름** (`crtfc_key`, `api_key`, `token`). FRED에서 "api_key is not set"이 났었음
- 같은 종류 자격 증명이 여럿이면 노드마다 맞는 것을 골랐는지 확인 (DART 대신 FRED가 선택될 뻔함)
- 가이드 예시 문구를 그대로 넣지 않기 (`manualEvents` 날짜에 설명 문구가 들어가 오류가 났었음)
- "에러가 없는데 안 보임"은 대개 반영 시점 문제 (어느 파일을 언제 읽는지)
- n8n은 하루 여러 번 커밋하므로 로컬 작업 전 `git pull`
- 비밀 값은 대화에 붙이지 않기 (Discord 봇 토큰을 리셋했었음). `.env` + `node --env-file`
- 다른 장소에서는 GitHub 웹 편집·업로드로도 사이트 수정 가능 (Vercel 자동 배포)

## 8. 참고

- 통합 설치 가이드: `docs/INSTALL.md`
- 단계별 설치 가이드(웹): 1단계 Fprq4DhAjtoJd7wm33qsbU, 2단계 RRbTb7YTFEoHWAUn2greTj, 3-A 1FBWX7rFA1ZeJNq73q3A4a, 3-B DjLFY5wpX4yDcS3RDPDc4B, 3-C 2gcdf3Bn4METFMxHYzaTwV, 4-A 2JnG1CGE7jUmxyYZqmd9Ax, 4-B S3kSn5yquCVsqKTfoAh5qe, 백업 QM1g671tr6yQ9GQdR66XXS, 주간 리포트 MZjo2qpBm9uTZPS6ErfcNF (모두 `https://claude.ai/artifact/` 뒤에 붙임)
- 옵시디안 노트: 투자뉴스사이트구축 1단계 · 2단계 · 3-A · 3-B · 3-C · 4단계 · 최종 리포트
