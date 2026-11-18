// 백업 시점 저장 + Discord 알림 내용
const c = $('설정').first().json;
const files = $('백업 파일 만들기').all().map((i) => i.json);
const manifest = JSON.parse(files.find((f) => f.path.endsWith('manifest.json')).content);
const k = manifest.counts;
const msg = `💾 백업 완료 (${manifest.mode === 'full' ? '전체' : '증분'}) · 기사 ${k.articles} · 지식베이스 ${k.kb_chunks} · 리포트 ${k.reports} · 관심 종목 ${k.watchlist} · 지표 ${k.indicators} · 종목 ${k.stock_data} · 일정 ${k.econ_events}`;
return [{ json: { cursorRows: [{ key: 'backup_last', value: c.nowIso, updated_at: c.nowIso }], discord: { username: '투자 뉴스 브리프 · 백업', content: msg } } }];
