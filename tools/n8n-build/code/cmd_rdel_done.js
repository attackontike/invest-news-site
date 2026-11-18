// 리서치 삭제 결과를 Discord에 새 메시지로 알립니다.
const r = $('리서치 삭제 있음?').first().json;
const count = (n) => { try { const b = $(n).first().json.body; return Array.isArray(b) ? b.length : 0; } catch (e) { return 0; } };
const status = (n) => { try { return $(n).first().json.statusCode; } catch (e) { return null; } };
const reports = count('리포트 기록 삭제');
const chunks = count('지식베이스 조각 삭제');
const fileStatus = status('사이트 파일 확인');
let gh;
try { gh = $('사이트 파일 삭제').first().json.statusCode; } catch (e) { gh = null; }
const file = fileStatus === 404 ? '사이트 파일 없음' : gh === 200 ? '사이트 파일 삭제 (1~2분 뒤 반영)' : `사이트 파일 삭제 실패 (${gh ?? fileStatus ?? '?'})`;
const content = (reports + chunks === 0 && fileStatus === 404)
  ? `⚠️ **${r.slug}** 리서치를 찾지 못했습니다. 주소를 확인해 주세요.`
  : `🗑️ **${r.slug}** 삭제 완료: ${file} · 리포트 기록 ${reports}건 · 지식베이스 조각 ${chunks}건\n옵시디안 볼트의 노트는 그대로 두었습니다. 필요하면 직접 지워 주세요.`;
return [{ json: { url: `https://discord.com/api/v10/webhooks/${r.appId}/${r.token}`, content } }];
