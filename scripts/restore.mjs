// 백업 복구: invest-backup 저장소의 파일을 Supabase에 되돌려 넣습니다.
//
// 1) 백업 저장소를 받아 둡니다:   git clone https://github.com/내아이디/invest-backup.git
// 2) PowerShell에서 (사이트 저장소 폴더):
//      $env:SUPABASE_URL="https://xxxx.supabase.co"
//      $env:SUPABASE_KEY="서버용 키 (service_role 또는 sb_secret_)"
//      $env:GEMINI_API_KEY="Gemini 키"            # 지식베이스 벡터를 다시 만들 때 필요
//      node scripts/restore.mjs C:\00AI_EXP\invest-backup --dry-run   # 먼저 무엇이 들어갈지 확인
//      node scripts/restore.mjs C:\00AI_EXP\invest-backup             # 실제 복구
//    옵션: --skip-kb (지식베이스 제외), --only=articles,reports (일부 테이블만)
//
// 복구 전에 Supabase에 schema.sql ~ schema-4b.sql이 실행돼 있어야 합니다.
// 종목 사전(symbols)은 백업하지 않으므로, 복구 후 n8n "종목 사전" 워크플로를 한 번 실행하세요.

import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const dry = process.argv.includes('--dry-run');
const skipKb = process.argv.includes('--skip-kb');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const { SUPABASE_URL: url, SUPABASE_KEY: key, GEMINI_API_KEY: gkey } = process.env;
const embedModel = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
const dim = 768;

if (!dir || !fs.existsSync(dir)) { console.error('사용법: node scripts/restore.mjs <invest-backup 폴더> [--dry-run]'); process.exit(1); }
if (!dry && (!url || !key)) { console.error('SUPABASE_URL, SUPABASE_KEY 환경변수를 먼저 설정하세요.'); process.exit(1); }

const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);

// 테이블: [충돌 기준 열, 행을 구분하는 키]
const TABLES = {
  watchlist: ['market,code', (r) => `${r.market}:${r.code}`],
  indicators: ['series_key', (r) => r.series_key],
  stock_data: ['market,code', (r) => `${r.market}:${r.code}`],
  econ_events: ['event_key', (r) => r.event_key],
  cursors: ['key', (r) => r.key],
  articles: ['url_key', (r) => r.url_key],
  reports: ['report_key', (r) => r.report_key],
  kb_chunks: ['chunk_key', (r) => r.chunk_key],
};
const want = (t) => (!only.length || only.includes(t)) && !(skipKb && t === 'kb_chunks');

// weekly 폴더를 날짜 순서로 쌓고(나중 것이 우선), latest를 더함
const data = Object.fromEntries(Object.keys(TABLES).map((t) => [t, new Map()]));
const weekly = path.join(dir, 'weekly');
const weeks = fs.existsSync(weekly) ? fs.readdirSync(weekly).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
for (const w of weeks) for (const t of ['articles', 'reports', 'kb_chunks']) for (const r of readJsonl(path.join(weekly, w, `${t}.jsonl`))) data[t].set(TABLES[t][1](r), r);
for (const t of ['watchlist', 'indicators', 'stock_data', 'econ_events', 'cursors']) for (const r of readJsonl(path.join(dir, 'latest', `${t}.jsonl`))) data[t].set(TABLES[t][1](r), r);

console.log(`백업 주차 ${weeks.length}개 (${weeks[0] || '-'} ~ ${weeks.at(-1) || '-'})`);
for (const [t, m] of Object.entries(data)) console.log(`  ${t.padEnd(12)} ${String(m.size).padStart(7)}행${want(t) ? '' : '  (건너뜀)'}`);
if (dry) { console.log('\n--dry-run: 아무것도 쓰지 않았습니다.'); process.exit(0); }

const headers = { apikey: key, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function upsert(table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${TABLES[table][0]}`, { method: 'POST', headers, body: JSON.stringify(part) });
    if (!res.ok) throw new Error(`${table} ${i}~: ${res.status} ${(await res.text()).slice(0, 300)}`);
    process.stdout.write(`\r  ${table} ${Math.min(i + 500, rows.length)}/${rows.length}`);
  }
  console.log('');
}

async function embed(rows) {
  if (!gkey) throw new Error('지식베이스 벡터를 다시 만들려면 GEMINI_API_KEY가 필요합니다 (또는 --skip-kb).');
  const out = [];
  for (let i = 0; i < rows.length; i += 50) {
    const part = rows.slice(i, i + 50);
    const body = { requests: part.map((r) => ({ model: `models/${embedModel}`, content: { parts: [{ text: r.content }] }, taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: dim })) };
    let res;
    for (let tries = 0; tries < 4; tries++) {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${embedModel}:batchEmbedContents`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': gkey }, body: JSON.stringify(body) });
      if (res.ok) break;
      await sleep(5000 * (tries + 1));
    }
    if (!res.ok) throw new Error(`임베딩 ${i}~: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const { embeddings } = await res.json();
    part.forEach((r, j) => {
      const v = embeddings[j].values;
      const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      out.push({ ...r, embedding: v.map((x) => Math.round((x / n) * 1e6) / 1e6) });
    });
    process.stdout.write(`\r  벡터 다시 만들기 ${out.length}/${rows.length}`);
    await sleep(800);
  }
  console.log('');
  return out;
}

for (const t of Object.keys(TABLES)) {
  if (!want(t)) continue;
  let rows = [...data[t].values()];
  if (!rows.length) continue;
  if (t === 'kb_chunks') rows = await embed(rows);
  await upsert(t, rows);
}

console.log(`
복구 완료. Supabase SQL Editor에서 아래를 한 번 실행해 번호 순서를 맞춰 주세요:

select setval(pg_get_serial_sequence('articles','id'),  coalesce((select max(id) from articles), 1));
select setval(pg_get_serial_sequence('reports','id'),   coalesce((select max(id) from reports), 1));
select setval(pg_get_serial_sequence('kb_chunks','id'), coalesce((select max(id) from kb_chunks), 1));

그다음 n8n "종목 사전" 워크플로를 한 번 실행하세요 (symbols는 백업 대상이 아님).`);
