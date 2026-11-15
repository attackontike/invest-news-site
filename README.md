# 투자 뉴스 브리프 (3단계까지)

국내·미국 시장 뉴스를 매시간 모아 Supabase에 쌓고, 하루 4번(07:00, 12:00, 16:30, 22:00) Gemini로 요약해 Astro 사이트와 Discord에 게시합니다. 요약한 기사와 브리핑은 지식베이스(pgvector)에도 쌓입니다.

```
[n8n T2 언론 수집, 매시 07~23시] → Supabase articles (status=new)
[n8n 게시, 하루 4번] → Gemini 요약·평가 → articles 갱신 · reports 저장
                     → GitHub 커밋 → Vercel 배포 → Discord #브리핑
                     → Gemini 임베딩 → Supabase kb_chunks (지식베이스)
                     → 옵시디안 노트 → GitHub invest-vault → Obsidian Git으로 내 볼트에 동기화
```

## 2단계에서 추가된 것

- **종목 사전** (`n8n/symbols-build.json`, 매주 일요일): DART 상장사와 SEC 티커를 `symbols`에 저장
- **T1 공시 수집** (`n8n/t1-filings-collect.json`, 평일 30분마다): DART 공시(관심 종목 전부 + 상장사 중요 공시), 미국 관심 종목 SEC 서류, 연준 통화정책 발표. 관심 종목 중요 공시와 FOMC 성명은 Discord로 즉시 알림
- **관심 종목**: Supabase `watchlist` 테이블. T2 수집이 종목마다 뉴스를 따로 검색하고, 게시에서 중요도 +15
- **게시**: Gemini 회사명을 종목 사전과 맞춰 종목코드 부여, 공시와 기사를 따로 대표 선정
- **사이트**: 공시·공식 발표(`/filings`), 관심 종목(`/watchlist`) 메뉴, 브리핑의 주요 공시
- 추가 스키마는 `supabase/schema-2.sql`, 자격 증명은 DART (Query Auth, `crtfc_key`) 하나 추가
- 2단계 설치 순서는 별도의 "설치 가이드 (2단계)"를 따르세요

## 3-A에서 추가된 것

- **Discord 명령**: `/watch add·remove·list`로 관심 종목 관리
- `api/discord.js`: Vercel 중계 함수. Discord 서명 확인, 허용 사용자 확인, n8n으로 전달 (환경변수 `DISCORD_PUBLIC_KEY`, `ALLOWED_USER_IDS`, `N8N_COMMAND_WEBHOOK_URL`, `RELAY_SECRET`)
- `scripts/register-commands.mjs`: 슬래시 명령 등록
- `n8n/discord-command.json`: 명령 처리 워크플로 (자격 증명 Relay Secret 추가)
- `supabase/schema-3.sql`: `watch_context` 함수
- 설치 순서는 "설치 가이드 (3-A)"를 따르세요

## 3-B에서 추가된 것

- **`/research topic:주제`**: 주제 해석 → 공시(DART·SEC)·뉴스(네이버·Google News)·지식베이스 과거 맥락·웹 배경 수집 → 근거 번호가 붙은 Gemini 리포트 → 다른 AI의 투자 관점 Q&A 7개 (GitHub Models 기본, Groq 예비, 둘 다 무료) → 사이트·Discord·옵시디안·지식베이스
- `n8n/research.json` (35노드), `discord-command.json` 갱신 (리서치 실행 연결)
- 사이트 "리서치" 메뉴 (`/research`, `/research/<slug>`)
- `supabase/schema-3b.sql`: `research_context` 함수
- 자격 증명 GitHub Models, Groq (둘 다 Header Auth, `Authorization: Bearer 토큰`) 추가
- 설치 순서는 "설치 가이드 (3-B)"를 따르세요

## 3-C에서 추가된 것

- **`/ask question:질문 (days:기간)`**: 지식베이스를 종목 검색 + 전체 검색으로 찾아, 근거 번호(S1…)를 원문 링크로 바꾼 답변을 Discord로. 답변은 지식베이스에 다시 저장하지 않음
- `n8n/ask.json` (17노드), `discord-command.json` 갱신 (질문 답변 실행 연결), 등록 스크립트에 `/ask` 추가
- 새 키·스키마·사이트 변경 없음. 설치 순서는 "설치 가이드 (3-C)"

## 폴더

| 경로 | 내용 |
|---|---|
| `supabase/schema.sql` | 테이블, 지식베이스, 함수. SQL Editor에서 한 번 실행 |
| `supabase/schema-2.sql` | 2단계 추가분 (종목 사전 키, 수집·게시용 함수) |
| `n8n/symbols-build.json` | 종목 사전 워크플로 (2단계) |
| `n8n/t1-filings-collect.json` | T1 공시 수집 워크플로 (2단계) |
| `n8n/t2-news-collect.json` | T2 언론 수집 워크플로 |
| `n8n/publish-digest.json` | 게시 워크플로 (요약, 커밋, 알림, 지식베이스) |
| `n8n/error-alert.json` | 실패 알림 워크플로 |
| `src/lib/news.ts` | 화면 기준 `RULES` (기간, 개수, 최소 신뢰도) |
| `src/content/digest/` | n8n이 커밋하는 하루치 파일 (처음엔 비어 있음) |
| `vault-template/` | 옵시디안 볼트 저장소에 넣을 README와 .gitignore |

## 설치 순서

### 1. Supabase
1. supabase.com에서 새 프로젝트를 만듭니다. 지역은 Seoul(ap-northeast-2)을 고릅니다.
2. SQL Editor에 `supabase/schema.sql` 전체를 붙여 넣고 Run합니다.
3. Project Settings → API에서 **Project URL**과 서버용 키를 복사합니다. 서버용 키는 `service_role`(eyJ…로 시작) 또는 새 형식의 Secret key(`sb_secret_`로 시작)입니다. 이 키는 RLS를 우회하므로 n8n에만 넣고 사이트나 GitHub에는 절대 넣지 않습니다.

### 2. 키 준비
- **네이버 검색 API**: developers.naver.com → 애플리케이션 등록 → 사용 API에 "검색" 추가 → Client ID, Client Secret
- **Gemini API 키**: v1에서 쓰던 키를 그대로 써도 됩니다
- **GitHub 토큰**: Fine-grained, 저장소 `invest-news-site`와 `invest-vault` 두 개, Contents Read and write (만료일 메모)
- **Discord 웹훅**: #브리핑 채널용 1개, 실패 알림용 1개(같은 채널이어도 됨)

### 3. GitHub와 Vercel
v1과 같습니다. 빈 저장소 `invest-news-site`를 만들고(README 등 체크하지 않음) 프로젝트 폴더에서:

```powershell
npm install
git init
git branch -M main
git add .
git commit -m "Initial commit: invest news site"
git remote add origin https://github.com/내아이디/invest-news-site.git
git push -u origin main
```

Vercel에서 Add New → Project → 저장소 Import → 기본값 그대로 Deploy. 배포 주소를 적어 둡니다. 첫 게시 전에는 "아직 표시할 기사가 없습니다"가 정상입니다. 선택으로 환경변수 `PUBLIC_DISCORD_INVITE`에 Discord 초대 링크를 넣으면 사이드바에 표시됩니다.

### 3-1. 옵시디안 볼트 저장소
1. GitHub에서 **비공개** 저장소 `invest-vault`를 만듭니다. 이번에는 **Add a README를 체크**해서 비어 있지 않게 만듭니다(빈 저장소에는 노트를 커밋할 수 없음).
2. 저장소를 내 컴퓨터로 받습니다: `git clone https://github.com/내아이디/invest-vault.git`
3. `vault-template/`의 `README.md`와 `.gitignore`를 그 폴더에 복사해 커밋·push합니다.
4. 옵시디안 → Open folder as vault → `invest-vault` 폴더를 엽니다.
5. 설정 → 커뮤니티 플러그인 → **Git** 설치·활성화 → 옵션에서 *Auto pull interval*을 10분 정도로, *Pull on startup*을 켭니다. 내 메모도 올리려면 *Auto commit-and-sync interval*도 켭니다.
6. 선택: **Dataview** 플러그인을 설치하면 종목 노트에 최근 기사 표가 나타납니다. 없으면 백링크로 볼 수 있습니다.

이미 쓰는 볼트가 있다면 그 볼트를 Git 저장소로 만들어 같은 방식으로 써도 됩니다. n8n은 `자동/`과 `종목/` 폴더만 건드립니다.

### 4. n8n 자격 증명 (Credentials → Add)

| 이름 | 종류 | 값 |
|---|---|---|
| Supabase | Custom Auth | 아래 JSON |
| Naver API | Custom Auth | `{"headers":{"X-Naver-Client-Id":"아이디","X-Naver-Client-Secret":"시크릿"}}` |
| Gemini | Header Auth | Name `x-goog-api-key`, Value 키 (v1 것 재사용 가능) |
| GitHub (투자) | GitHub API | User: 아이디, Access Token: 새 토큰 |

Supabase Custom Auth JSON:
- `service_role` 키(eyJ…)라면 `{"headers":{"apikey":"키","Authorization":"Bearer 키"}}`
- Secret key(`sb_secret_…`)라면 `{"headers":{"apikey":"키"}}`

### 5. 워크플로 가져오기
1. Import from File로 세 파일을 가져옵니다.
2. **T2 언론 수집**의 "설정" 노드: `supabaseUrl`을 넣습니다.
3. **게시**의 "설정" 노드: `githubOwner`, `siteUrl`(Vercel 주소), `supabaseUrl`, `discordWebhookUrl`을 넣습니다. 볼트 저장소 이름이 다르면 `vaultRepo`도 고칩니다(비우면 옵시디안 단계를 건너뜀).
4. 자격 증명 연결:
   - Supabase: "이미 저장된 기사", "Supabase 저장", "새 기사 조회", "오늘 게시분 조회", "오늘 브리핑 조회", "기사 저장", "브리핑 저장", "지식베이스 저장"
   - Naver API: "네이버 뉴스"
   - Gemini: "Gemini 요약·평가", "Gemini 예비 모델", "임베딩"
   - GitHub (투자): "GitHub 기존 파일 확인", "GitHub 커밋", "볼트 파일 목록", "볼트 기준 커밋", "볼트 트리 만들기", "볼트 커밋 만들기", "볼트 반영"
5. **실패 알림**의 "알림 내용 만들기" 노드 맨 위 `DISCORD_WEBHOOK_URL`에 웹훅을 넣고 저장합니다.
6. T2 언론 수집과 게시 워크플로 각각 ⋯ → Settings → Error Workflow에서 "투자 뉴스 - 실패 알림"을 고릅니다.

### 6. 수동 실행으로 확인
1. **T2 언론 수집**을 Execute workflow로 실행 → Supabase Table Editor의 `articles`에 `status=new` 행이 생기는지 확인합니다. "RSS 읽기" 출력에서 `statusCode`가 403·404인 피드는 "설정" 노드에서 주소를 고치거나 줄을 지웁니다.
2. **게시**를 실행 → GitHub 커밋, Vercel 배포, Discord 메시지, `articles`가 `published`로 바뀌는지, `kb_chunks`에 행이 생기는지 확인합니다. 옵시디안에서 Git: Pull을 실행해 `자동/일일/오늘날짜 시장` 노트가 생겼는지도 봅니다.
3. 사이트에서 기사 제목을 눌러 원문이 열리는지 확인합니다.

### 7. 활성화
두 워크플로를 Active(또는 Publish)로 바꿉니다. 실패 알림 워크플로는 활성화하지 않아도 됩니다.

## 운영 메모

- **실행 횟수**: 1단계 월 약 650회, 2단계부터 T1 공시 수집(평일 하루 34번)이 더해져 월 약 1,400회입니다. n8n 요금제 한도를 확인하세요.
- **수집에 새 기사가 없으면** 조용히 끝나며 실패로 치지 않습니다. 모든 피드가 실패했을 때만 실패 알림이 옵니다.
- **Google News 기사 링크**는 Google을 거쳐 원문으로 이동하는 주소입니다. 매체명은 기사마다 붙어 오는 값을 씁니다.
- **같은 사건**은 Gemini가 묶고, 사이트에는 매체 신뢰도가 가장 높은 기사 1건을 대표로 보여 주며 "N개 매체 보도"로 표시합니다. 묶인 다른 기사도 DB와 지식베이스에는 모두 저장됩니다.
- **지식베이스**는 이번 회차에 새로 요약한 기사(`is_ai=false`)와 브리핑(`is_ai=true`)을 저장합니다. 임베딩이 실패해도 사이트 게시는 이미 끝난 뒤입니다.
- **워크플로를 내려받아 커밋할 때** "설정" 노드의 Discord 웹훅 주소가 함께 들어갑니다. 저장소를 비공개로 두거나 커밋 전에 지우세요. 자격 증명(키)은 내보내기에 포함되지 않습니다.
- 코드를 고치기 전에는 항상 `git pull`부터 합니다. n8n이 하루 4번 커밋합니다.
- **옵시디안 노트**: 회차마다 그날의 일일 노트와 기사 노트를 커밋 1번으로 덮어씁니다. 같은 사건은 파일 이름 끝 `~꼬리표`로 다시 찾아 같은 노트를 갱신합니다. 종목 노트는 없을 때만 만들고 이후에는 건드리지 않으므로 메모는 그곳에 쓰세요. 1단계에서는 Gemini가 뽑은 회사명으로 종목 노트를 만들기 때문에 이름이 조금씩 다를 수 있고(예: 삼성전자 / Samsung Electronics), 2단계 종목 사전이 들어오면 정리됩니다.

## 오류 처치

| 노드 | 증상 | 처치 |
|---|---|---|
| 기사 정리 | 모든 피드 요청이 실패 | 오류 메시지의 피드별 결과 확인. 전부 실패면 잠시 뒤 재실행 |
| 네이버 뉴스 | 401 | Naver API 자격 증명의 Client ID·Secret 확인 |
| Supabase 노드들 | 401 | Supabase 자격 증명 JSON 형식과 키 종류 확인 |
| 이미 저장된 기사 | 404 | `schema.sql`을 실행했는지 확인 (`existing_url_keys` 함수) |
| Gemini 요약·평가 | 404 no longer available | "설정" 노드 `geminiModel`을 오류가 알려 주는 새 이름으로 |
| Gemini 요약·평가 | 400 | "프롬프트 생성"에서 `thinkingConfig: { thinkingLevel: 'low' }` 부분 삭제 |
| Gemini 요약·평가 | 503 high demand | 자동으로 예비 모델로 넘어감 |
| 다이제스트 생성 | Gemini 요약이 모두 실패 | 30분쯤 뒤 수동 재실행 |
| 임베딩 | 404 | "설정" 노드 `embeddingModel` 이름 확인 |
| 지식베이스 저장 준비 | 임베딩 크기 ≠ embedDim | `embedDim`을 768로 (schema의 vector(768)과 같아야 함) |
| GitHub 커밋 | 404 / 401 | `githubOwner`·`githubRepo` 확인 / 토큰 권한·만료 확인 |
| 볼트 파일 목록 | 404 / 409 | `vaultRepo` 이름, 토큰에 볼트 저장소 포함 여부 / 저장소가 비어 있으면 README로 초기화 |
| 볼트 반영 | 422 | 옵시디안에서 같은 순간에 push한 경우. 게시를 다시 실행 |
