# n8n 워크플로 빌드 도구

`n8n/*.json` 워크플로 파일은 손으로 고치지 않고, 이 폴더의 코드에서 만들어 냅니다.

| 파일 | 내용 |
|---|---|
| `code/*.js` | n8n Code 노드에 들어가는 자바스크립트 원본 (노드 이름별) |
| `build_wf.cjs` | 노드 구성·연결·HTTP 설정을 정의하고 `n8n/*.json` 13개를 다시 만듦 |
| `harness.cjs` | Code 노드를 n8n 밖에서 시험하는 도구 (`$('노드').all()`, `$input` 흉내) |

## 쓰는 법

```bash
node tools/n8n-build/build_wf.cjs     # n8n/*.json 다시 생성 (노드 ID는 매번 같음)
```

## 규칙

- Code 노드 코드는 **`URL`, `Buffer`를 쓰지 않음** (n8n Cloud 실행 환경에 없음). Base64는 코드 안의 `b64()` 사용
- 여러 Code 노드가 같이 쓰는 함수는 `*.inc.js`에 두고, 빌드 전에 이어 붙여 만든 파일을 `code/`에 둠 (예: `namekey.inc.js` + 본문 → `pub_digest.js`). 지금 `code/`의 파일들은 이미 이어 붙인 완성본
- 사용자가 바꿀 값은 각 워크플로의 **"설정" 노드**에만 (`*_settings.js`). 실제 키·웹훅 값은 n8n 안에만 있고, 이 저장소에는 `YOUR-...` 자리표시만
- 워크플로를 다시 가져오면 n8n에서 설정 노드 값과 자격 증명을 다시 넣어야 하므로, 작은 수정은 **해당 노드의 코드만 n8n에 붙여 넣는** 방식을 권장

## 시험 예

```js
const { run } = require('./harness.cjs');
const S = { '설정': run('code/t2_settings.js', {}) };
const reqs = run('code/t2_requests.js', { ...S, '관심 종목 조회': [{ json: { watchlist: [] } }] });
```
