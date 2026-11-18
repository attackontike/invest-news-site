// 테이블별로 JSON Lines 파일(.jsonl, 한 줄에 한 행)을 만듭니다.
const c = $('설정').first().json;
const { since, full } = $('기간 정하기').first().json;
const rowsOf = (node) => $(node).all().map((i) => i.json).filter((r) => r && Object.keys(r).length);
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
const delta = { articles: rowsOf('기사 내보내기'), kb_chunks: rowsOf('지식베이스 내보내기'), reports: rowsOf('리포트 내보내기') };
const latest = { watchlist: rowsOf('관심 종목 내보내기'), indicators: rowsOf('지표 내보내기'), stock_data: rowsOf('종목 데이터 내보내기'), econ_events: rowsOf('일정 내보내기'), cursors: rowsOf('커서 내보내기') };

const files = [];
const dir = `weekly/${c.today}`;
for (const [t, rows] of Object.entries(delta)) files.push({ path: `${dir}/${t}.jsonl`, content: jsonl(rows) });
for (const [t, rows] of Object.entries(latest)) files.push({ path: `latest/${t}.jsonl`, content: jsonl(rows) });

const counts = Object.fromEntries([...Object.entries(delta), ...Object.entries(latest)].map(([t, r]) => [t, r.length]));
const manifest = { createdAt: c.nowIso, mode: full ? 'full' : 'incremental', since: since || null, counts, note: 'kb_chunks는 embedding 없이 저장. 복구 때 scripts/restore.mjs가 다시 만듦' };
files.push({ path: `${dir}/manifest.json`, content: JSON.stringify(manifest, null, 2) + '\n' });
files.push({
  path: 'README.md',
  content: `# 투자 뉴스 브리프 백업

n8n "투자 뉴스 - 백업" 워크플로가 매주 일요일 자동으로 커밋합니다.

| 폴더 | 내용 |
|---|---|
| \`weekly/날짜/\` | 지난 백업 이후 바뀐 기사(articles), 지식베이스(kb_chunks, 벡터 제외), 리포트(reports). 첫 폴더는 전체 |
| \`latest/\` | 관심 종목, 지표, 종목 데이터, 경제 일정, 커서 전체 (매주 덮어씀, 이전 버전은 Git 기록에) |

복구는 사이트 저장소의 \`scripts/restore.mjs\`를 쓰세요. weekly 폴더를 날짜 순서로 적용한 뒤 latest를 적용하고, 지식베이스 벡터를 다시 만듭니다.

마지막 백업: ${c.nowIso} (${full ? '전체' : '증분'})
`,
});
return files.map((f) => ({ json: f }));
