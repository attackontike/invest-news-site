// 증분 기준 시각: 지난 백업 시점 - overlapHours. 처음이면 전체 백업
const c = $('설정').first().json;
const row = ($('백업 기준점 조회').all().map((i) => i.json).find((r) => r && r.key === 'backup_last')) || null;
const last = row && Date.parse(row.value);
const since = Number.isFinite(last) ? new Date(last - c.overlapHours * 3600_000).toISOString() : '';
return [{ json: { since, full: !since } }];
