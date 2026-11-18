const fs = require('fs');
const path = require('path');
const code = (f) => fs.readFileSync(path.join(__dirname, 'code', f), 'utf8');
let seq = 0;
const uid = () => `${(++seq).toString(16).padStart(8, '0')}-0000-4000-8000-1a2b3c4d5e6f`; // 빌드할 때마다 같은 값 (git 비교가 쉬움)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const S = (k) => `$('설정').first().json.${k}`;

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return { parameters, id: uid(), name, type, typeVersion, position, ...extra };
}
const codeNode = (name, pos, file) => node(name, 'n8n-nodes-base.code', 2, pos, { jsCode: code(file) });
const schedule = (name, pos, crons) =>
  node(name, 'n8n-nodes-base.scheduleTrigger', 1.2, pos, { rule: { interval: crons.map((e) => ({ field: 'cronExpression', expression: e })) } });

function http(name, pos, o, extra = {}) {
  const p = { method: o.method || 'GET', url: o.url };
  if (o.custom) { p.authentication = 'genericCredentialType'; p.genericAuthType = 'httpCustomAuth'; }
  if (o.headerAuth) { p.authentication = 'genericCredentialType'; p.genericAuthType = 'httpHeaderAuth'; }
  if (o.github) { p.authentication = 'predefinedCredentialType'; p.nodeCredentialType = 'githubApi'; }
  if (o.queryAuth) { p.authentication = 'genericCredentialType'; p.genericAuthType = 'httpQueryAuth'; }
  if (o.headers) {
    p.sendHeaders = true;
    p.headerParameters = { parameters: Object.entries(o.headers).map(([name, value]) => ({ name, value })) };
  }
  if (o.body) { p.sendBody = true; p.specifyBody = 'json'; p.jsonBody = o.body; }
  p.options = {};
  if (o.batch) p.options.batching = { batch: { batchSize: o.batch[0], batchInterval: o.batch[1] } };
  if (o.timeout) p.options.timeout = o.timeout;
  if (o.full) p.options.response = { response: { fullResponse: true, neverError: true, responseFormat: o.full } };
  if (o.file) p.options.response = { response: { responseFormat: 'file', outputPropertyName: 'data' } };
  if (o.pagination) p.options.pagination = { pagination: o.pagination };
  return node(name, 'n8n-nodes-base.httpRequest', 4.2, pos, p, extra);
}
const wf = (name, nodes, connections) => ({
  name, nodes, connections, active: false, pinData: {},
  settings: { executionOrder: 'v1', timezone: 'Asia/Seoul', saveManualExecutions: true, callerPolicy: 'workflowsFromSameOwner' },
  meta: { templateCredsSetupCompleted: false },
});
const line = (...names) => {
  const c = {};
  for (let i = 0; i < names.length - 1; i++) c[names[i]] = { main: [[{ node: names[i + 1], type: 'main', index: 0 }]] };
  return c;
};
const X = (i) => [i * 240, 300];

// ========== T2 언론 수집 ==========
const SB = (path) => `={{ ${S('supabaseUrl')} }}/rest/v1/${path}`;
const T2 = ['매시 정각', '설정', '관심 종목 조회', '요청 목록', 'RSS 읽기', '네이버 요청', '네이버 뉴스', '기사 정리', '이미 저장된 기사', '새 기사 고르기', '링크 확인', '저장 준비', 'Supabase 저장'];
const P2 = (n) => X(T2.indexOf(n));
const t2 = wf('투자 뉴스 - T2 언론 수집', [
  schedule('매시 정각', P2('매시 정각'), ['0 7-23 * * *']),
  codeNode('설정', P2('설정'), 't2_settings.js'),
  http('관심 종목 조회', P2('관심 종목 조회'), { method: 'POST', url: SB('rpc/t1_context'), custom: true, timeout: 30000, body: '={{ JSON.stringify({}) }}' }, { alwaysOutputData: true }),
  codeNode('요청 목록', P2('요청 목록'), 't2_requests.js'),
  http('RSS 읽기', P2('RSS 읽기'), {
    url: '={{ $json.url }}',
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
    batch: [5, 1000], timeout: 20000, full: 'text',
  }, { onError: 'continueRegularOutput' }),
  codeNode('네이버 요청', P2('네이버 요청'), 't2_naver_requests.js'),
  http('네이버 뉴스', P2('네이버 뉴스'), { url: '={{ $json.url }}', custom: true, batch: [5, 500], timeout: 20000, full: 'json' }, { onError: 'continueRegularOutput' }),
  codeNode('기사 정리', P2('기사 정리'), 't2_parse.js'),
  http('이미 저장된 기사', P2('이미 저장된 기사'), {
    method: 'POST', url: SB('rpc/existing_url_keys'), custom: true, timeout: 30000,
    body: '={{ JSON.stringify({ keys: $json.keys }) }}',
  }),
  codeNode('새 기사 고르기', P2('새 기사 고르기'), 't2_pick.js'),
  http('링크 확인', P2('링크 확인'), { method: 'HEAD', url: '={{ $json.url }}', headers: { 'User-Agent': UA }, batch: [10, 0], timeout: 15000, full: 'text' }, { onError: 'continueRegularOutput' }),
  codeNode('저장 준비', P2('저장 준비'), 't2_rows.js'),
  http('Supabase 저장', P2('Supabase 저장'), {
    method: 'POST', url: SB('articles?on_conflict=url_key'), custom: true, timeout: 30000,
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: '={{ JSON.stringify($json.rows) }}',
  }),
], line(...T2));

// ========== 게시 ==========
const GEM = (model) => `=https://generativelanguage.googleapis.com/v1beta/models/{{ ${S(model)} }}:generateContent`;
const ghUrl = `=https://api.github.com/repos/{{ ${S('githubOwner')} }}/{{ ${S('githubRepo')} }}/contents/{{ $('다이제스트 생성').first().json.path }}`;
const VAULT = `=https://api.github.com/repos/{{ ${S('githubOwner')} }}/{{ ${S('vaultRepo')} }}`;
const write = (name, pos, path, field) =>
  http(name, pos, {
    method: 'POST', url: SB(path), custom: true, timeout: 60000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: `={{ JSON.stringify($('다이제스트 생성').first().json.${field}) }}`,
  }, { executeOnce: true, alwaysOutputData: true });

const pubNodes = [
  schedule('게시 시각', [0, 300], ['0 7,12,22 * * *', '30 16 * * *']),
  codeNode('설정', [240, 300], 'pub_settings.js'),
  http('새 기사 조회', [480, 300], { url: SB('articles?status=eq.new&select=*&order=published_at.desc&limit=400'), custom: true, timeout: 30000 }, { alwaysOutputData: true }),
  http('오늘 게시분 조회', [720, 300], {
    url: SB(`articles?status=eq.published&digest_date=eq.{{ ${S('today')} }}&select=*&limit=1000`), custom: true, timeout: 30000,
  }, { executeOnce: true, alwaysOutputData: true }),
  http('오늘 브리핑 조회', [960, 300], {
    url: SB(`reports?kind=eq.briefing&report_key=like.briefing:{{ ${S('today')} }}:*&select=report_key,body,created_at`), custom: true, timeout: 30000,
  }, { executeOnce: true, alwaysOutputData: true }),
  codeNode('프롬프트 생성', [1200, 300], 'pub_prompts.js'),
  http('Gemini 요약·평가', [1440, 300], {
    method: 'POST', url: GEM('geminiModel'), headerAuth: true, batch: [2, 3000], timeout: 240000,
    body: '={{ JSON.stringify($json.body) }}',
  }, { onError: 'continueErrorOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  http('Gemini 예비 모델', [1680, 460], {
    method: 'POST', url: GEM('fallbackModel'), headerAuth: true, batch: [1, 3000], timeout: 240000,
    body: "={{ JSON.stringify($('프롬프트 생성').item.json.body) }}",
  }, { onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),
  node('Gemini 결과 합치기', 'n8n-nodes-base.merge', 3, [1920, 300], { mode: 'append' }),
  codeNode('Gemini 결과 정리', [2160, 300], 'pub_gemini_parse.js'),
  http('종목 사전 조회', [2400, 300], {
    method: 'POST', url: SB('rpc/digest_context'), custom: true, timeout: 30000,
    body: '={{ JSON.stringify({ keys: $json.keys, tickers: $json.tickers }) }}',
  }),
  codeNode('다이제스트 생성', [2640, 300], 'pub_digest.js'),
  write('기사 저장', [2400, 300], 'articles?on_conflict=url_key', 'articleRows'),
  write('브리핑 저장', [2640, 300], 'reports?on_conflict=report_key', 'reportRows'),
  http('GitHub 기존 파일 확인', [2880, 300], { url: `${ghUrl}?ref={{ ${S('githubBranch')} }}`, github: true, timeout: 30000 },
    { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }),
  http('GitHub 커밋', [3120, 300], {
    method: 'PUT', url: ghUrl, github: true, timeout: 60000,
    body: `={{ JSON.stringify({ message: $('다이제스트 생성').first().json.commitMessage, content: $('다이제스트 생성').first().json.content, branch: ${S('githubBranch')}, ...($json.sha ? { sha: $json.sha } : {}) }) }}`,
  }, { executeOnce: true }),
  codeNode('Discord 사용?', [3360, 180], 'pub_discord_gate.js'),
  http('Discord 알림', [3600, 180], { method: 'POST', url: `={{ ${S('discordWebhookUrl')} }}`, timeout: 30000, body: '={{ JSON.stringify($json) }}' }),
  codeNode('지식베이스 준비', [3360, 420], 'pub_kb_prepare.js'),
  http('임베딩', [3600, 420], {
    method: 'POST', url: `=https://generativelanguage.googleapis.com/v1beta/models/{{ ${S('embeddingModel')} }}:batchEmbedContents`,
    headerAuth: true, batch: [1, 1000], timeout: 120000, body: '={{ JSON.stringify($json.body) }}',
  }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  codeNode('지식베이스 저장 준비', [3840, 420], 'pub_kb_rows.js'),
  codeNode('옵시디안 사용?', [3360, 660], 'pub_vault_gate.js'),
  http('볼트 파일 목록', [3600, 660], { url: `${VAULT}/git/trees/{{ ${S('vaultBranch')} }}?recursive=1`, github: true, timeout: 60000 }),
  http('볼트 기준 커밋', [3840, 660], { url: `${VAULT}/git/ref/heads/{{ ${S('vaultBranch')} }}`, github: true, timeout: 30000 }, { executeOnce: true }),
  codeNode('옵시디안 노트 만들기', [4080, 660], 'pub_vault_notes.js'),
  http('볼트 트리 만들기', [4320, 660], { method: 'POST', url: `${VAULT}/git/trees`, github: true, timeout: 120000, body: '={{ JSON.stringify($json.tree) }}' }),
  http('볼트 커밋 만들기', [4560, 660], {
    method: 'POST', url: `${VAULT}/git/commits`, github: true, timeout: 60000,
    body: "={{ JSON.stringify({ message: $('옵시디안 노트 만들기').first().json.message, tree: $json.sha, parents: [$('옵시디안 노트 만들기').first().json.parent] }) }}",
  }),
  http('볼트 반영', [4800, 660], { method: 'PATCH', url: `${VAULT}/git/refs/heads/{{ ${S('vaultBranch')} }}`, github: true, timeout: 60000, body: '={{ JSON.stringify({ sha: $json.sha }) }}' }),
  http('지식베이스 저장', [4080, 420], {
    method: 'POST', url: SB('kb_chunks?on_conflict=chunk_key'), custom: true, timeout: 120000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: '={{ JSON.stringify($json.rows) }}',
  }),
];
const pubConn = {
  ...line('게시 시각', '설정', '새 기사 조회', '오늘 게시분 조회', '오늘 브리핑 조회', '프롬프트 생성', 'Gemini 요약·평가'),
  'Gemini 요약·평가': { main: [[{ node: 'Gemini 결과 합치기', type: 'main', index: 0 }], [{ node: 'Gemini 예비 모델', type: 'main', index: 0 }]] },
  'Gemini 예비 모델': { main: [[{ node: 'Gemini 결과 합치기', type: 'main', index: 1 }]] },
  ...line('Gemini 결과 합치기', 'Gemini 결과 정리', '종목 사전 조회', '다이제스트 생성', '기사 저장', '브리핑 저장', 'GitHub 기존 파일 확인', 'GitHub 커밋'),
  'GitHub 커밋': { main: [[{ node: 'Discord 사용?', type: 'main', index: 0 }, { node: '지식베이스 준비', type: 'main', index: 0 }, { node: '옵시디안 사용?', type: 'main', index: 0 }]] },
  ...line('옵시디안 사용?', '볼트 파일 목록', '볼트 기준 커밋', '옵시디안 노트 만들기', '볼트 트리 만들기', '볼트 커밋 만들기', '볼트 반영'),
  ...line('Discord 사용?', 'Discord 알림'),
  ...line('지식베이스 준비', '임베딩', '지식베이스 저장 준비', '지식베이스 저장'),
};
for (const n of pubNodes) if (!['Gemini 결과 정리', '종목 사전 조회', '다이제스트 생성'].includes(n.name) && n.position[0] >= 2400) n.position[0] += 480;
const pub = wf('투자 뉴스 - 게시', pubNodes, pubConn);

// ========== 실패 알림 ==========
const err = wf('투자 뉴스 - 실패 알림', [
  node('실패 감지', 'n8n-nodes-base.errorTrigger', 1, [0, 300], {}),
  codeNode('알림 내용 만들기', [240, 300], 'err_alert.js'),
  http('Discord 실패 알림', [480, 300], { method: 'POST', url: '={{ $json.webhook }}', timeout: 30000, body: '={{ JSON.stringify($json.payload) }}' }),
], line('실패 감지', '알림 내용 만들기', 'Discord 실패 알림'));

// ========== 종목 사전 ==========
const SYM = ['매주 일요일', '설정', 'DART 고유번호 파일', '압축 풀기', '텍스트로 읽기', 'SEC 티커 목록', '사전 행 만들기', '사전 저장'];
const P3 = (n) => X(SYM.indexOf(n));
const sym = wf('투자 뉴스 - 종목 사전', [
  schedule('매주 일요일', P3('매주 일요일'), ['0 6 * * 0']),
  codeNode('설정', P3('설정'), 'sym_settings.js'),
  http('DART 고유번호 파일', P3('DART 고유번호 파일'), { url: 'https://opendart.fss.or.kr/api/corpCode.xml', queryAuth: true, timeout: 120000, file: true }),
  node('압축 풀기', 'n8n-nodes-base.compression', 1.1, P3('압축 풀기'), { operation: 'decompress', binaryPropertyName: 'data', outputPrefix: 'file_' }),
  node('텍스트로 읽기', 'n8n-nodes-base.extractFromFile', 1, P3('텍스트로 읽기'), { operation: 'text', binaryPropertyName: 'file_0', destinationKey: 'xml', options: {} }),
  http('SEC 티커 목록', P3('SEC 티커 목록'), { url: 'https://www.sec.gov/files/company_tickers.json', headers: { 'User-Agent': `={{ ${S('secUserAgent')} }}` }, timeout: 60000 }, { executeOnce: true }),
  codeNode('사전 행 만들기', P3('사전 행 만들기'), 'sym_rows.js'),
  http('사전 저장', P3('사전 저장'), {
    method: 'POST', url: SB('symbols?on_conflict=market,code'), custom: true, timeout: 120000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: '={{ JSON.stringify($json.rows) }}',
  }),
], line(...SYM));

// ========== T1 공시 수집 ==========
const CUR = "$('수집 맥락 조회').first().json.cursors.dart_last_rcept_no";
const t1Nodes = [
  schedule('30분마다', [0, 300], ['*/30 7-23 * * 1-5']),
  codeNode('설정', [240, 300], 't1_settings.js'),
  http('수집 맥락 조회', [480, 300], { method: 'POST', url: SB('rpc/t1_context'), custom: true, timeout: 30000, body: '={{ JSON.stringify({}) }}' }, { alwaysOutputData: true }),
  http('DART 공시목록', [720, 300], {
    url: `=https://opendart.fss.or.kr/api/list.json?bgn_de={{ ${S('bgnDe')} }}&end_de={{ ${S('endDe')} }}&page_count=100`,
    queryAuth: true, timeout: 30000,
    pagination: {
      paginationMode: 'updateAParameterInEachRequest',
      parameters: { parameters: [{ type: 'qs', name: 'page_no', value: '={{ $pageCount + 1 }}' }] },
      paginationCompleteWhen: 'other',
      completeExpression: `={{ !${CUR} || !$response.body.list || $response.body.page_no >= $response.body.total_page || $response.body.list.some(x => x.rcept_no <= ${CUR}) }}`,
      limitPagesFetched: true,
      maxRequests: 10,
      requestInterval: 300,
    },
  }, { executeOnce: true, retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),
  codeNode('SEC 요청 만들기', [960, 300], 't1_sec_requests.js'),
  http('SEC·연준 읽기', [1200, 300], { url: '={{ $json.url }}', headers: { 'User-Agent': `={{ ${S('secUserAgent')} }}` }, batch: [5, 1000], timeout: 30000, full: 'text' }, { onError: 'continueRegularOutput' }),
  codeNode('공시 정리', [1440, 300], 't1_parse.js'),
  http('이미 저장된 공시', [1680, 300], { method: 'POST', url: SB('rpc/existing_url_keys'), custom: true, timeout: 30000, body: '={{ JSON.stringify({ keys: $json.keys }) }}' }),
  codeNode('새 공시 고르기', [1920, 300], 't1_pick.js'),
  codeNode('저장할 공시 있음?', [2160, 120], 't1_save_gate.js'),
  http('공시 저장', [2400, 120], {
    method: 'POST', url: SB('articles?on_conflict=url_key'), custom: true, timeout: 30000,
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: '={{ JSON.stringify($json.rows) }}',
  }),
  codeNode('알릴 공시 있음?', [2160, 300], 't1_alert_gate.js'),
  http('Discord 공시 알림', [2400, 300], { method: 'POST', url: `={{ ${S('discordAlertWebhook')} }}`, timeout: 30000, batch: [1, 1000], body: '={{ JSON.stringify($json.payload) }}' }),
  codeNode('커서 바뀜?', [2160, 480], 't1_cursor_gate.js'),
  http('커서 저장', [2400, 480], {
    method: 'POST', url: SB('cursors?on_conflict=key'), custom: true, timeout: 30000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: '={{ JSON.stringify($json.rows) }}',
  }),
];
const t1 = wf('투자 뉴스 - T1 공시 수집', t1Nodes, {
  ...line('30분마다', '설정', '수집 맥락 조회', 'DART 공시목록', 'SEC 요청 만들기', 'SEC·연준 읽기', '공시 정리', '이미 저장된 공시', '새 공시 고르기'),
  '새 공시 고르기': { main: [[{ node: '저장할 공시 있음?', type: 'main', index: 0 }, { node: '알릴 공시 있음?', type: 'main', index: 0 }, { node: '커서 바뀜?', type: 'main', index: 0 }]] },
  ...line('저장할 공시 있음?', '공시 저장'),
  ...line('알릴 공시 있음?', 'Discord 공시 알림'),
  ...line('커서 바뀜?', '커서 저장'),
});

// ========== Discord 명령 (3-A) ==========
const cmd = wf('투자 뉴스 - Discord 명령', [
  node('Discord 명령 받기', 'n8n-nodes-base.webhook', 2, [0, 300], { httpMethod: 'POST', path: 'invest-discord-command', authentication: 'headerAuth', responseMode: 'onReceived', options: {} }, { webhookId: '6f1d2c4e-8a3b-4e5f-9c7d-0b1a2e3f4d5c' }),
  codeNode('설정', [240, 300], 'cmd_settings.js'),
  codeNode('명령 해석', [480, 300], 'cmd_parse.js'),
  http('관심 종목·후보 조회', [720, 300], { method: 'POST', url: SB('rpc/watch_context'), custom: true, timeout: 30000, body: '={{ JSON.stringify({ q: $json.q, key: $json.key }) }}' }),
  codeNode('처리 결정', [960, 300], 'cmd_decide.js'),
  codeNode('추가할 것 있음?', [1200, 120], 'cmd_insert_gate.js'),
  http('관심 종목 추가', [1440, 120], {
    method: 'POST', url: SB('watchlist?on_conflict=market,code'), custom: true, timeout: 30000,
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: '={{ JSON.stringify($json.rows) }}',
  }),
  codeNode('삭제할 것 있음?', [1200, 300], 'cmd_delete_gate.js'),
  http('관심 종목 삭제', [1440, 300], { method: 'DELETE', url: SB('watchlist?market=eq.{{ $json.market }}&code=eq.{{ encodeURIComponent($json.code) }}'), custom: true, timeout: 30000 }),
  codeNode('리서치 있음?', [1200, 480], 'cmd_research_gate.js'),
  node('리서치 실행', 'n8n-nodes-base.executeWorkflow', 1.2, [1440, 480], { source: 'database', workflowId: { __rl: true, value: '', mode: 'list' }, mode: 'once', options: { waitForSubWorkflow: false } }),
  codeNode('질문 있음?', [1200, 660], 'cmd_ask_gate.js'),
  node('질문 답변 실행', 'n8n-nodes-base.executeWorkflow', 1.2, [1440, 660], { source: 'database', workflowId: { __rl: true, value: '', mode: 'list' }, mode: 'once', options: { waitForSubWorkflow: false } }),
  http('Discord 답장', [1200, 840], {
    method: 'PATCH', url: "={{ $('처리 결정').first().json.followUrl }}", timeout: 30000,
    body: "={{ JSON.stringify({ content: $('처리 결정').first().json.reply }) }}",
  }),
], {
  ...line('Discord 명령 받기', '설정', '명령 해석', '관심 종목·후보 조회', '처리 결정'),
  '처리 결정': { main: [[{ node: '추가할 것 있음?', type: 'main', index: 0 }, { node: '삭제할 것 있음?', type: 'main', index: 0 }, { node: '리서치 있음?', type: 'main', index: 0 }, { node: '질문 있음?', type: 'main', index: 0 }, { node: 'Discord 답장', type: 'main', index: 0 }]] },
  ...line('리서치 있음?', '리서치 실행'),
  ...line('질문 있음?', '질문 답변 실행'),
  ...line('추가할 것 있음?', '관심 종목 추가'),
  ...line('삭제할 것 있음?', '관심 종목 삭제'),
});

// ========== 리서치 (3-B) ==========
const GEMR = (m) => `=https://generativelanguage.googleapis.com/v1beta/models/{{ ${S(m)} }}`;
const RF = "$('리포트 완성').first().json";
const ghContents = (repo, pathExpr) => `=https://api.github.com/repos/{{ ${S('githubOwner')} }}/{{ ${S(repo)} }}/contents/{{ ${pathExpr}.split('/').map(encodeURIComponent).join('/') }}`;
const R = ['리서치 요청 받음', '설정', '주제 해석', '해석 정리', '종목 확인', '조사 대상 정리', 'DART 요청 만들기', 'DART 공시 조회', 'SEC·뉴스 요청 만들기', 'SEC·뉴스 조회', '네이버 요청 만들기', '네이버 조회', '질문 임베딩', '과거 맥락 요청', '과거 맥락 조회', '배경 조사', '자료 정리', '리포트 작성'];
const PR = (n) => [R.indexOf(n) * 240, 300];
const rNodes = [
  node('리서치 요청 받음', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, PR('리서치 요청 받음'), { inputSource: 'passthrough' }),
  codeNode('설정', PR('설정'), 'r_settings.js'),
  http('주제 해석', PR('주제 해석'), { method: 'POST', url: `${GEMR('geminiModel')}:generateContent`, headerAuth: true, timeout: 60000, body: '={{ JSON.stringify($json.interpretBody) }}' }, { onError: 'continueRegularOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  codeNode('해석 정리', PR('해석 정리'), 'r_interpret.js'),
  http('종목 확인', PR('종목 확인'), { method: 'POST', url: SB('rpc/research_context'), custom: true, timeout: 30000, body: '={{ JSON.stringify({ keys: $json.keys, tickers: $json.tickers }) }}' }),
  codeNode('조사 대상 정리', PR('조사 대상 정리'), 'r_targets.js'),
  codeNode('DART 요청 만들기', PR('DART 요청 만들기'), 'r_dart_requests.js'),
  http('DART 공시 조회', PR('DART 공시 조회'), { url: '={{ $json.url }}', queryAuth: true, batch: [3, 500], timeout: 30000, full: 'json' }, { onError: 'continueRegularOutput' }),
  codeNode('SEC·뉴스 요청 만들기', PR('SEC·뉴스 요청 만들기'), 'r_web_requests.js'),
  http('SEC·뉴스 조회', PR('SEC·뉴스 조회'), { url: '={{ $json.url }}', headers: { 'User-Agent': `={{ ${S('secUserAgent')} }}` }, batch: [5, 1000], timeout: 30000, full: 'text' }, { onError: 'continueRegularOutput' }),
  codeNode('네이버 요청 만들기', PR('네이버 요청 만들기'), 'r_naver_requests.js'),
  http('네이버 조회', PR('네이버 조회'), { url: '={{ $json.url }}', custom: true, batch: [4, 500], timeout: 20000, full: 'json' }, { onError: 'continueRegularOutput' }),
  http('질문 임베딩', PR('질문 임베딩'), { method: 'POST', url: `${GEMR('embeddingModel')}:embedContent`, headerAuth: true, timeout: 60000, body: "={{ JSON.stringify($('조사 대상 정리').first().json.embedBody) }}" }, { executeOnce: true, onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 3000 }),
  codeNode('과거 맥락 요청', PR('과거 맥락 요청'), 'r_kb_query.js'),
  http('과거 맥락 조회', PR('과거 맥락 조회'), { method: 'POST', url: SB('rpc/match_kb'), custom: true, timeout: 30000, body: '={{ JSON.stringify($json.body || {}) }}' }, { executeOnce: true, onError: 'continueRegularOutput', alwaysOutputData: true }),
  http('배경 조사', PR('배경 조사'), { method: 'POST', url: `${GEMR('geminiModel')}:generateContent`, headerAuth: true, timeout: 120000, body: "={{ JSON.stringify($('조사 대상 정리').first().json.backgroundBody) }}" }, { executeOnce: true, onError: 'continueRegularOutput', alwaysOutputData: true, retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),
  codeNode('자료 정리', PR('자료 정리'), 'r_pack.js'),
  http('리포트 작성', PR('리포트 작성'), { method: 'POST', url: `${GEMR('geminiModel')}:generateContent`, headerAuth: true, timeout: 240000, body: '={{ JSON.stringify($json.reportBody) }}' }, { onError: 'continueErrorOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  http('리포트 작성 (예비)', [4320, 460], { method: 'POST', url: `${GEMR('fallbackModel')}:generateContent`, headerAuth: true, timeout: 240000, body: "={{ JSON.stringify($('자료 정리').first().json.reportBody) }}" }, { onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),
  node('리포트 결과 합치기', 'n8n-nodes-base.merge', 3, [4560, 300], { mode: 'append' }),
  http('다른 AI 관점', [4800, 300], {
    method: 'POST', url: `={{ ${S('qaPrimary')}.url }}`, headerAuth: true, timeout: 180000,
    headers: { Accept: 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: "={{ JSON.stringify($('자료 정리').first().json.qaBodyPrimary) }}",
  }, { executeOnce: true, onError: 'continueErrorOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),
  http('다른 AI 관점 (예비)', [5040, 460], {
    method: 'POST', url: `={{ ${S('qaFallback')}.url }}`, headerAuth: true, timeout: 180000,
    body: "={{ JSON.stringify($('자료 정리').first().json.qaBodyFallback) }}",
  }, { onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),
  node('AI 관점 합치기', 'n8n-nodes-base.merge', 3, [5280, 300], { mode: 'append' }),
  codeNode('리포트 완성', [5520, 300], 'r_finish.js'),
  codeNode('리포트 있음?', [5760, 120], 'r_ok_gate.js'),
  http('사이트에 리포트 커밋', [6000, 120], {
    method: 'PUT', url: ghContents('githubRepo', `${RF}.sitePath`), github: true, timeout: 60000,
    body: `={{ JSON.stringify({ message: ${RF}.commitMessage, content: ${RF}.siteContent, branch: ${S('githubBranch')} }) }}`,
  }),
  http('리포트 저장', [6240, 120], {
    method: 'POST', url: SB('reports?on_conflict=report_key'), custom: true, timeout: 30000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: `={{ JSON.stringify(${RF}.reportRows) }}`,
  }, { executeOnce: true, alwaysOutputData: true }),
  codeNode('결과 보내기?', [6480, -60], 'r_discord_gate.js'),
  http('Discord 결과', [6720, -60], { method: 'POST', url: `={{ ${S('followUrl')} }}`, timeout: 30000, body: '={{ JSON.stringify($json) }}' }),
  codeNode('볼트 사용?', [6480, 120], 'r_vault_gate.js'),
  http('볼트에 노트 커밋', [6720, 120], {
    method: 'PUT', url: ghContents('vaultRepo', `${RF}.vaultPath`), github: true, timeout: 60000,
    body: `={{ JSON.stringify({ message: ${RF}.commitMessage, content: ${RF}.vaultContent, branch: ${S('vaultBranch')} }) }}`,
  }),
  codeNode('지식베이스 준비', [6480, 300], 'r_kb_prepare.js'),
  http('임베딩', [6720, 300], { method: 'POST', url: `${GEMR('embeddingModel')}:batchEmbedContents`, headerAuth: true, timeout: 120000, body: '={{ JSON.stringify($json.body) }}' }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  codeNode('지식베이스 저장 준비', [6960, 300], 'pub_kb_rows.js'),
  http('지식베이스 저장', [7200, 300], {
    method: 'POST', url: SB('kb_chunks?on_conflict=chunk_key'), custom: true, timeout: 120000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: '={{ JSON.stringify($json.rows) }}',
  }),
  codeNode('실패 알릴까?', [5760, 520], 'r_fail_gate.js'),
  http('Discord 실패 답장', [6000, 520], { method: 'POST', url: `={{ ${S('followUrl')} }}`, timeout: 30000, body: '={{ JSON.stringify($json) }}' }),
];
const research = wf('투자 뉴스 - 리서치', rNodes, {
  ...line(...R.slice(0, -1), '리포트 작성'),
  '리포트 작성': { main: [[{ node: '리포트 결과 합치기', type: 'main', index: 0 }], [{ node: '리포트 작성 (예비)', type: 'main', index: 0 }]] },
  '리포트 작성 (예비)': { main: [[{ node: '리포트 결과 합치기', type: 'main', index: 1 }]] },
  '리포트 결과 합치기': { main: [[{ node: '다른 AI 관점', type: 'main', index: 0 }]] },
  '다른 AI 관점': { main: [[{ node: 'AI 관점 합치기', type: 'main', index: 0 }], [{ node: '다른 AI 관점 (예비)', type: 'main', index: 0 }]] },
  '다른 AI 관점 (예비)': { main: [[{ node: 'AI 관점 합치기', type: 'main', index: 1 }]] },
  ...line('AI 관점 합치기', '리포트 완성'),
  '리포트 완성': { main: [[{ node: '리포트 있음?', type: 'main', index: 0 }, { node: '실패 알릴까?', type: 'main', index: 0 }]] },
  ...line('리포트 있음?', '사이트에 리포트 커밋', '리포트 저장'),
  '리포트 저장': { main: [[{ node: '결과 보내기?', type: 'main', index: 0 }, { node: '볼트 사용?', type: 'main', index: 0 }, { node: '지식베이스 준비', type: 'main', index: 0 }]] },
  ...line('결과 보내기?', 'Discord 결과'),
  ...line('볼트 사용?', '볼트에 노트 커밋'),
  ...line('지식베이스 준비', '임베딩', '지식베이스 저장 준비', '지식베이스 저장'),
  ...line('실패 알릴까?', 'Discord 실패 답장'),
});

// ========== 질문 답변 (3-C) ==========
const A = ['질문 받음', '설정', '질문 해석', '해석 정리', '종목 확인', '검색 준비', '질문 임베딩', '검색 요청 만들기', '지식베이스 검색 (종목)', '지식베이스 검색 (전체)', '근거 정리', '답변 작성'];
const PA = (n) => [A.indexOf(n) * 240, 300];
const ask = wf('투자 뉴스 - 질문 답변', [
  node('질문 받음', 'n8n-nodes-base.executeWorkflowTrigger', 1.1, PA('질문 받음'), { inputSource: 'passthrough' }),
  codeNode('설정', PA('설정'), 'a_settings.js'),
  http('질문 해석', PA('질문 해석'), { method: 'POST', url: `${GEMR('geminiModel')}:generateContent`, headerAuth: true, timeout: 60000, body: '={{ JSON.stringify($json.interpretBody) }}' }, { onError: 'continueRegularOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 3000 }),
  codeNode('해석 정리', PA('해석 정리'), 'a_interpret.js'),
  http('종목 확인', PA('종목 확인'), { method: 'POST', url: SB('rpc/research_context'), custom: true, timeout: 30000, body: '={{ JSON.stringify({ keys: $json.keys, tickers: $json.tickers }) }}' }),
  codeNode('검색 준비', PA('검색 준비'), 'a_prep.js'),
  http('질문 임베딩', PA('질문 임베딩'), { method: 'POST', url: `${GEMR('embeddingModel')}:embedContent`, headerAuth: true, timeout: 60000, body: '={{ JSON.stringify($json.embedBody) }}' }, { onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 3000 }),
  codeNode('검색 요청 만들기', PA('검색 요청 만들기'), 'a_search_bodies.js'),
  http('지식베이스 검색 (종목)', PA('지식베이스 검색 (종목)'), { method: 'POST', url: SB('rpc/match_kb'), custom: true, timeout: 30000, body: '={{ JSON.stringify($json.filtered || {}) }}' }, { executeOnce: true, onError: 'continueRegularOutput', alwaysOutputData: true }),
  http('지식베이스 검색 (전체)', PA('지식베이스 검색 (전체)'), { method: 'POST', url: SB('rpc/match_kb'), custom: true, timeout: 30000, body: "={{ JSON.stringify($('검색 요청 만들기').first().json.all || {}) }}" }, { executeOnce: true, onError: 'continueRegularOutput', alwaysOutputData: true }),
  codeNode('근거 정리', PA('근거 정리'), 'a_pack.js'),
  http('답변 작성', PA('답변 작성'), { method: 'POST', url: `${GEMR('geminiModel')}:generateContent`, headerAuth: true, timeout: 120000, body: '={{ JSON.stringify($json.answerBody) }}' }, { onError: 'continueErrorOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  http('답변 작성 (예비)', [2880, 460], { method: 'POST', url: `${GEMR('fallbackModel')}:generateContent`, headerAuth: true, timeout: 120000, body: "={{ JSON.stringify($('근거 정리').first().json.answerBody) }}" }, { onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),
  node('답변 합치기', 'n8n-nodes-base.merge', 3, [3120, 300], { mode: 'append' }),
  codeNode('답변 완성', [3360, 300], 'a_finish.js'),
  codeNode('답변 보낼까?', [3600, 300], 'a_send_gate.js'),
  http('Discord 답변', [3840, 300], { method: 'POST', url: `={{ ${S('followUrl')} }}`, timeout: 30000, body: '={{ JSON.stringify($json) }}' }),
], {
  ...line(...A),
  '답변 작성': { main: [[{ node: '답변 합치기', type: 'main', index: 0 }], [{ node: '답변 작성 (예비)', type: 'main', index: 0 }]] },
  '답변 작성 (예비)': { main: [[{ node: '답변 합치기', type: 'main', index: 1 }]] },
  ...line('답변 합치기', '답변 완성', '답변 보낼까?', 'Discord 답변'),
});

// ========== T3 데이터·일정 (4-A) ==========
const D = ['매일 06:40', '설정', 'FRED 요청 만들기', 'FRED 조회', 'ECOS 요청 만들기', 'ECOS 조회', '기존 지표 조회', '데이터 정리', '지표 저장', '일정 저장', 'GitHub 기존 파일 확인', 'GitHub 커밋', '지식베이스 준비', '임베딩', '지식베이스 저장 준비', '지식베이스 저장'];
const PD = (n) => [D.indexOf(n) * 240, 300];
const DF = "$('데이터 정리').first().json";
const ghData = `=https://api.github.com/repos/{{ ${S('githubOwner')} }}/{{ ${S('githubRepo')} }}/contents/src/data/market.json`;
const data = wf('투자 뉴스 - T3 데이터·일정', [
  schedule('매일 06:40', PD('매일 06:40'), ['40 6 * * *']),
  codeNode('설정', PD('설정'), 'd_settings.js'),
  codeNode('FRED 요청 만들기', PD('FRED 요청 만들기'), 'd_fred_requests.js'),
  http('FRED 조회', PD('FRED 조회'), { url: '={{ $json.url }}', queryAuth: true, batch: [4, 1000], timeout: 30000, full: 'json' }, { onError: 'continueRegularOutput' }),
  codeNode('ECOS 요청 만들기', PD('ECOS 요청 만들기'), 'd_ecos_requests.js'),
  http('ECOS 조회', PD('ECOS 조회'), { url: '={{ $json.url }}', batch: [2, 1000], timeout: 30000, full: 'json' }, { onError: 'continueRegularOutput' }),
  http('기존 지표 조회', PD('기존 지표 조회'), { url: SB('indicators?select=*'), custom: true, timeout: 30000 }, { executeOnce: true, alwaysOutputData: true }),
  codeNode('데이터 정리', PD('데이터 정리'), 'd_build.js'),
  http('지표 저장', PD('지표 저장'), {
    method: 'POST', url: SB('indicators?on_conflict=series_key'), custom: true, timeout: 30000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: `={{ JSON.stringify(${DF}.indicatorRows) }}`,
  }, { executeOnce: true, alwaysOutputData: true }),
  http('일정 저장', PD('일정 저장'), {
    method: 'POST', url: SB('econ_events?on_conflict=event_key'), custom: true, timeout: 30000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: `={{ JSON.stringify(${DF}.eventRows) }}`,
  }, { executeOnce: true, alwaysOutputData: true }),
  http('GitHub 기존 파일 확인', PD('GitHub 기존 파일 확인'), { url: `${ghData}?ref={{ ${S('githubBranch')} }}`, github: true, timeout: 30000 }, { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }),
  http('GitHub 커밋', PD('GitHub 커밋'), {
    method: 'PUT', url: ghData, github: true, timeout: 60000,
    body: `={{ JSON.stringify({ message: 'data: ' + ${S('today')}, content: ${DF}.siteContent, branch: ${S('githubBranch')}, ...($json.sha ? { sha: $json.sha } : {}) }) }}`,
  }, { executeOnce: true }),
  codeNode('지식베이스 준비', PD('지식베이스 준비'), 'd_kb_prepare.js'),
  http('임베딩', PD('임베딩'), { method: 'POST', url: `=https://generativelanguage.googleapis.com/v1beta/models/{{ ${S('embeddingModel')} }}:batchEmbedContents`, headerAuth: true, timeout: 120000, body: '={{ JSON.stringify($json.body) }}' }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  codeNode('지식베이스 저장 준비', PD('지식베이스 저장 준비'), 'pub_kb_rows.js'),
  http('지식베이스 저장', PD('지식베이스 저장'), {
    method: 'POST', url: SB('kb_chunks?on_conflict=chunk_key'), custom: true, timeout: 60000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: '={{ JSON.stringify($json.rows) }}',
  }),
], line(...D));

// ========== 일정 예고 (4-A) ==========
const PV = ['매일 20:00', '설정', '내일 일정 조회', '예고 만들기', 'Discord 예고'];
const preview = wf('투자 뉴스 - 일정 예고', [
  schedule('매일 20:00', [0, 300], ['0 20 * * *']),
  codeNode('설정', [240, 300], 'p_settings.js'),
  http('내일 일정 조회', [480, 300], { url: SB(`econ_events?event_date=eq.{{ ${S('tomorrow')} }}&select=*&order=importance.desc`), custom: true, timeout: 30000 }, { alwaysOutputData: true }),
  codeNode('예고 만들기', [720, 300], 'p_build.js'),
  http('Discord 예고', [960, 300], { method: 'POST', url: `={{ ${S('discordWebhookUrl')} }}`, timeout: 30000, body: '={{ JSON.stringify($json) }}' }),
], line(...PV));

// ========== 종목 데이터 (4-B) ==========
const ST = ['매일 06:50', '설정', '관심 종목 조회', 'DART 재무 요청 만들기', 'DART 재무 조회', 'Finnhub 요청 만들기', 'Finnhub 조회', '기존 종목 데이터 조회', '종목 데이터 정리', '종목 데이터 저장', '실적 일정 저장', 'GitHub 기존 파일 확인', 'GitHub 커밋', '지식베이스 준비', '임베딩', '지식베이스 저장 준비', '지식베이스 저장'];
const PS = (n) => [ST.indexOf(n) * 240, 300];
const SF = "$('종목 데이터 정리').first().json";
const ghStocks = `=https://api.github.com/repos/{{ ${S('githubOwner')} }}/{{ ${S('githubRepo')} }}/contents/src/data/stocks.json`;
const stocks = wf('투자 뉴스 - 종목 데이터', [
  schedule('매일 06:50', PS('매일 06:50'), ['50 6 * * *']),
  codeNode('설정', PS('설정'), 's_settings.js'),
  http('관심 종목 조회', PS('관심 종목 조회'), { method: 'POST', url: SB('rpc/t1_context'), custom: true, timeout: 30000, body: '={{ JSON.stringify({}) }}' }, { alwaysOutputData: true }),
  codeNode('DART 재무 요청 만들기', PS('DART 재무 요청 만들기'), 's_dart_requests.js'),
  http('DART 재무 조회', PS('DART 재무 조회'), { url: '={{ $json.url }}', queryAuth: true, batch: [5, 300], timeout: 30000, full: 'json' }, { onError: 'continueRegularOutput' }),
  codeNode('Finnhub 요청 만들기', PS('Finnhub 요청 만들기'), 's_finnhub_requests.js'),
  http('Finnhub 조회', PS('Finnhub 조회'), { url: '={{ $json.url }}', queryAuth: true, batch: [3, 1500], timeout: 30000, full: 'json' }, { onError: 'continueRegularOutput' }),
  http('기존 종목 데이터 조회', PS('기존 종목 데이터 조회'), { url: SB('stock_data?select=*'), custom: true, timeout: 30000 }, { executeOnce: true, alwaysOutputData: true }),
  codeNode('종목 데이터 정리', PS('종목 데이터 정리'), 's_build.js'),
  http('종목 데이터 저장', PS('종목 데이터 저장'), {
    method: 'POST', url: SB('stock_data?on_conflict=market,code'), custom: true, timeout: 30000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: `={{ JSON.stringify(${SF}.stockRows) }}`,
  }, { executeOnce: true, alwaysOutputData: true }),
  http('실적 일정 저장', PS('실적 일정 저장'), {
    method: 'POST', url: SB('econ_events?on_conflict=event_key'), custom: true, timeout: 30000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: `={{ JSON.stringify(${SF}.eventRows) }}`,
  }, { executeOnce: true, alwaysOutputData: true }),
  http('GitHub 기존 파일 확인', PS('GitHub 기존 파일 확인'), { url: `${ghStocks}?ref={{ ${S('githubBranch')} }}`, github: true, timeout: 30000 }, { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }),
  http('GitHub 커밋', PS('GitHub 커밋'), {
    method: 'PUT', url: ghStocks, github: true, timeout: 60000,
    body: `={{ JSON.stringify({ message: 'stocks: ' + ${S('today')}, content: ${SF}.siteContent, branch: ${S('githubBranch')}, ...($json.sha ? { sha: $json.sha } : {}) }) }}`,
  }, { executeOnce: true }),
  codeNode('지식베이스 준비', PS('지식베이스 준비'), 's_kb_prepare.js'),
  http('임베딩', PS('임베딩'), { method: 'POST', url: `=https://generativelanguage.googleapis.com/v1beta/models/{{ ${S('embeddingModel')} }}:batchEmbedContents`, headerAuth: true, timeout: 120000, body: '={{ JSON.stringify($json.body) }}' }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  codeNode('지식베이스 저장 준비', PS('지식베이스 저장 준비'), 'pub_kb_rows.js'),
  http('지식베이스 저장', PS('지식베이스 저장'), {
    method: 'POST', url: SB('kb_chunks?on_conflict=chunk_key'), custom: true, timeout: 60000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: '={{ JSON.stringify($json.rows) }}',
  }),
], line(...ST));

// ========== 백업 ==========
const SINCE = "$('기간 정하기').first().json.since";
const page = { paginationMode: 'updateAParameterInEachRequest', parameters: { parameters: [{ type: 'qs', name: 'offset', value: '={{ $pageCount * 1000 }}' }] }, paginationCompleteWhen: 'other', completeExpression: '={{ !Array.isArray($response.body) || $response.body.length < 1000 }}', limitPagesFetched: true, maxRequests: 300, requestInterval: 200 };
const exp = (name, pos, path, filter = '') => http(name, pos, { url: SB(`${path}&limit=1000${filter}`), custom: true, timeout: 120000, pagination: page }, { executeOnce: true, alwaysOutputData: true });
const delta = (col) => `{{ ${SINCE} ? '&' + ${col} : '' }}`;
const BK = `=https://api.github.com/repos/{{ ${S('githubOwner')} }}/{{ ${S('backupRepo')} }}`;
const BKN = ['매주 일요일 06:30', '설정', '백업 기준점 조회', '기간 정하기', '관심 종목 내보내기', '지표 내보내기', '종목 데이터 내보내기', '일정 내보내기', '커서 내보내기', '리포트 내보내기', '기사 내보내기', '지식베이스 내보내기', '백업 파일 만들기', '블롭 만들기', '트리 준비', '백업 저장소 트리', '백업 기준 커밋', '트리 만들기', '커밋 만들기', '백업 반영', '백업 정리', '백업 시점 저장', 'Discord 사용?', 'Discord 백업 알림'];
const PB = (n) => [BKN.indexOf(n) * 220, 300];
const backup = wf('투자 뉴스 - 백업', [
  schedule('매주 일요일 06:30', PB('매주 일요일 06:30'), ['30 6 * * 0']),
  codeNode('설정', PB('설정'), 'b_settings.js'),
  http('백업 기준점 조회', PB('백업 기준점 조회'), { url: SB('cursors?key=eq.backup_last&select=*'), custom: true, timeout: 30000 }, { alwaysOutputData: true }),
  codeNode('기간 정하기', PB('기간 정하기'), 'b_since.js'),
  exp('관심 종목 내보내기', PB('관심 종목 내보내기'), 'watchlist?select=*&order=added_at.asc'),
  exp('지표 내보내기', PB('지표 내보내기'), 'indicators?select=*&order=series_key.asc'),
  exp('종목 데이터 내보내기', PB('종목 데이터 내보내기'), 'stock_data?select=*&order=market.asc,code.asc'),
  exp('일정 내보내기', PB('일정 내보내기'), 'econ_events?select=*&order=event_date.asc'),
  exp('커서 내보내기', PB('커서 내보내기'), 'cursors?select=*&order=key.asc'),
  exp('리포트 내보내기', PB('리포트 내보내기'), 'reports?select=*&order=id.asc', delta(`'created_at=gte.' + ${SINCE}`)),
  exp('기사 내보내기', PB('기사 내보내기'), 'articles?select=*&order=id.asc', delta(`'or=(collected_at.gte.' + ${SINCE} + ',processed_at.gte.' + ${SINCE} + ')'`)),
  exp('지식베이스 내보내기', PB('지식베이스 내보내기'), 'kb_chunks?select=id,chunk_key,kind,is_ai,tier,source_grade,market,tickers,source,url,published_at,content,created_at&order=id.asc', delta(`'created_at=gte.' + ${SINCE}`)),
  codeNode('백업 파일 만들기', PB('백업 파일 만들기'), 'b_files.js'),
  http('블롭 만들기', PB('블롭 만들기'), { method: 'POST', url: `${BK}/git/blobs`, github: true, batch: [2, 500], timeout: 120000, body: "={{ JSON.stringify({ content: $json.content, encoding: 'utf-8' }) }}" }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  codeNode('트리 준비', PB('트리 준비'), 'b_tree.js'),
  http('백업 저장소 트리', PB('백업 저장소 트리'), { url: `${BK}/git/trees/{{ ${S('backupBranch')} }}`, github: true, timeout: 60000 }, { executeOnce: true }),
  http('백업 기준 커밋', PB('백업 기준 커밋'), { url: `${BK}/git/ref/heads/{{ ${S('backupBranch')} }}`, github: true, timeout: 30000 }, { executeOnce: true }),
  http('트리 만들기', PB('트리 만들기'), { method: 'POST', url: `${BK}/git/trees`, github: true, timeout: 60000, body: "={{ JSON.stringify({ base_tree: $('백업 저장소 트리').first().json.sha, tree: $('트리 준비').first().json.tree }) }}" }),
  http('커밋 만들기', PB('커밋 만들기'), { method: 'POST', url: `${BK}/git/commits`, github: true, timeout: 60000, body: `={{ JSON.stringify({ message: 'backup: ' + ${S('today')}, tree: $json.sha, parents: [$('백업 기준 커밋').first().json.object.sha] }) }}` }),
  http('백업 반영', PB('백업 반영'), { method: 'PATCH', url: `${BK}/git/refs/heads/{{ ${S('backupBranch')} }}`, github: true, timeout: 60000, body: '={{ JSON.stringify({ sha: $json.sha }) }}' }),
  codeNode('백업 정리', PB('백업 정리'), 'b_done.js'),
  http('백업 시점 저장', PB('백업 시점 저장'), {
    method: 'POST', url: SB('cursors?on_conflict=key'), custom: true, timeout: 30000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: '={{ JSON.stringify($json.cursorRows) }}',
  }, { alwaysOutputData: true }),
  codeNode('Discord 사용?', PB('Discord 사용?'), 'b_discord_gate.js'),
  http('Discord 백업 알림', PB('Discord 백업 알림'), { method: 'POST', url: `={{ ${S('discordWebhookUrl')} }}`, timeout: 30000, body: '={{ JSON.stringify($json) }}' }),
], line(...BKN));

// ========== 주간 리포트 ==========
const WF = "$('리포트 완성').first().json";
const WN = ['매주 일요일 08:00', '설정', '주간 기사 조회', '지표 조회', '다음 주 일정 조회', '관심 종목 조회', '주간 리서치 조회', '자료 정리', '주간 리포트 작성'];
const PW = (n) => [WN.indexOf(n) * 230, 300];
const wkSite = ghContents('githubRepo', `${WF}.sitePath`);
const wkVault = ghContents('vaultRepo', `${WF}.vaultPath`);
const weekly = wf('투자 뉴스 - 주간 리포트', [
  schedule('매주 일요일 08:00', PW('매주 일요일 08:00'), ['0 8 * * 0']),
  codeNode('설정', PW('설정'), 'w_settings.js'),
  http('주간 기사 조회', PW('주간 기사 조회'), { url: SB(`articles?status=eq.published&published_at=gte.{{ ${S('sinceIso')} }}&select=id,url,title,title_ko,source,source_grade,tier,market,published_at,sentiment,importance,coverage,story_key,tickers,event_type&order=importance.desc&limit=1000`), custom: true, timeout: 60000 }, { executeOnce: true, alwaysOutputData: true }),
  http('지표 조회', PW('지표 조회'), { url: SB('indicators?select=*'), custom: true, timeout: 30000 }, { executeOnce: true, alwaysOutputData: true }),
  http('다음 주 일정 조회', PW('다음 주 일정 조회'), { url: SB(`econ_events?event_date=gte.{{ ${S('nextMon')} }}&event_date=lte.{{ ${S('nextSun')} }}&select=*&order=event_date.asc`), custom: true, timeout: 30000 }, { executeOnce: true, alwaysOutputData: true }),
  http('관심 종목 조회', PW('관심 종목 조회'), { method: 'POST', url: SB('rpc/t1_context'), custom: true, timeout: 30000, body: '={{ JSON.stringify({}) }}' }, { executeOnce: true, alwaysOutputData: true }),
  http('주간 리서치 조회', PW('주간 리서치 조회'), { url: SB(`reports?kind=eq.research&created_at=gte.{{ ${S('sinceIso')} }}&select=report_key,title,created_at`), custom: true, timeout: 30000 }, { executeOnce: true, alwaysOutputData: true }),
  codeNode('자료 정리', PW('자료 정리'), 'w_pack.js'),
  http('주간 리포트 작성', PW('주간 리포트 작성'), { method: 'POST', url: `${GEMR('geminiModel')}:generateContent`, headerAuth: true, timeout: 180000, body: '={{ JSON.stringify($json.body) }}' }, { onError: 'continueErrorOutput', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  http('주간 리포트 작성 (예비)', [2070, 460], { method: 'POST', url: `${GEMR('fallbackModel')}:generateContent`, headerAuth: true, timeout: 180000, body: "={{ JSON.stringify($('자료 정리').first().json.body) }}" }, { onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 5000 }),
  node('결과 합치기', 'n8n-nodes-base.merge', 3, [2300, 300], { mode: 'append' }),
  codeNode('리포트 완성', [2530, 300], 'w_finish.js'),
  http('사이트 기존 파일', [2760, 300], { url: `${wkSite}?ref={{ ${S('githubBranch')} }}`, github: true, timeout: 30000 }, { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }),
  http('사이트에 커밋', [2990, 300], {
    method: 'PUT', url: wkSite, github: true, timeout: 60000,
    body: `={{ JSON.stringify({ message: ${WF}.commitMessage, content: ${WF}.siteContent, branch: ${S('githubBranch')}, ...($json.sha ? { sha: $json.sha } : {}) }) }}`,
  }, { executeOnce: true }),
  http('리포트 저장', [3220, 300], {
    method: 'POST', url: SB('reports?on_conflict=report_key'), custom: true, timeout: 30000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: `={{ JSON.stringify(${WF}.reportRows) }}`,
  }, { executeOnce: true, alwaysOutputData: true }),
  codeNode('Discord 사용?', [3450, 120], 'w_gate_discord.js'),
  http('Discord 주간 알림', [3680, 120], { method: 'POST', url: `={{ ${S('discordWebhookUrl')} }}`, timeout: 30000, body: '={{ JSON.stringify($json) }}' }),
  codeNode('볼트 사용?', [3450, 300], 'w_gate_vault.js'),
  http('볼트 기존 파일', [3680, 300], { url: `${wkVault}?ref={{ ${S('vaultBranch')} }}`, github: true, timeout: 30000 }, { executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' }),
  http('볼트에 노트 커밋', [3910, 300], {
    method: 'PUT', url: wkVault, github: true, timeout: 60000,
    body: `={{ JSON.stringify({ message: ${WF}.commitMessage, content: ${WF}.vaultContent, branch: ${S('vaultBranch')}, ...($json.sha ? { sha: $json.sha } : {}) }) }}`,
  }, { executeOnce: true }),
  codeNode('지식베이스 준비', [3450, 480], 'w_kb_prepare.js'),
  http('임베딩', [3680, 480], { method: 'POST', url: `${GEMR('embeddingModel')}:batchEmbedContents`, headerAuth: true, timeout: 120000, body: '={{ JSON.stringify($json.body) }}' }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  codeNode('지식베이스 저장 준비', [3910, 480], 'pub_kb_rows.js'),
  http('지식베이스 저장', [4140, 480], {
    method: 'POST', url: SB('kb_chunks?on_conflict=chunk_key'), custom: true, timeout: 60000,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: '={{ JSON.stringify($json.rows) }}',
  }),
], {
  ...line(...WN),
  '주간 리포트 작성': { main: [[{ node: '결과 합치기', type: 'main', index: 0 }], [{ node: '주간 리포트 작성 (예비)', type: 'main', index: 0 }]] },
  '주간 리포트 작성 (예비)': { main: [[{ node: '결과 합치기', type: 'main', index: 1 }]] },
  ...line('결과 합치기', '리포트 완성', '사이트 기존 파일', '사이트에 커밋', '리포트 저장'),
  '리포트 저장': { main: [[{ node: 'Discord 사용?', type: 'main', index: 0 }, { node: '볼트 사용?', type: 'main', index: 0 }, { node: '지식베이스 준비', type: 'main', index: 0 }]] },
  ...line('Discord 사용?', 'Discord 주간 알림'),
  ...line('볼트 사용?', '볼트 기존 파일', '볼트에 노트 커밋'),
  ...line('지식베이스 준비', '임베딩', '지식베이스 저장 준비', '지식베이스 저장'),
});

const outDir = path.join(__dirname, '..', '..', 'n8n');
fs.writeFileSync(`${outDir}/weekly-report.json`, JSON.stringify(weekly, null, 2));
fs.writeFileSync(`${outDir}/backup.json`, JSON.stringify(backup, null, 2));
fs.writeFileSync(`${outDir}/stock-data.json`, JSON.stringify(stocks, null, 2));
fs.writeFileSync(`${outDir}/t3-data-calendar.json`, JSON.stringify(data, null, 2));
fs.writeFileSync(`${outDir}/event-preview.json`, JSON.stringify(preview, null, 2));
fs.writeFileSync(`${outDir}/ask.json`, JSON.stringify(ask, null, 2));
fs.writeFileSync(`${outDir}/research.json`, JSON.stringify(research, null, 2));
fs.writeFileSync(`${outDir}/discord-command.json`, JSON.stringify(cmd, null, 2));
fs.writeFileSync(`${outDir}/symbols-build.json`, JSON.stringify(sym, null, 2));
fs.writeFileSync(`${outDir}/t1-filings-collect.json`, JSON.stringify(t1, null, 2));
fs.writeFileSync(`${outDir}/t2-news-collect.json`, JSON.stringify(t2, null, 2));
fs.writeFileSync(`${outDir}/publish-digest.json`, JSON.stringify(pub, null, 2));
fs.writeFileSync(`${outDir}/error-alert.json`, JSON.stringify(err, null, 2));

// 연결 검사
for (const w of [t2, pub, err, sym, t1, cmd, research, ask, data, preview, stocks, backup, weekly]) {
  const names = new Set(w.nodes.map((n) => n.name));
  for (const [from, c] of Object.entries(w.connections)) {
    if (!names.has(from)) throw new Error(`${w.name}: unknown ${from}`);
    c.main.flat().forEach((t) => { if (!names.has(t.node)) throw new Error(`${w.name}: unknown target ${t.node}`); });
  }
  console.log(w.name, w.nodes.length, 'nodes ok');
}
