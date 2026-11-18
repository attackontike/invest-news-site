// 사이트의 리서치 파일 sha를 꺼내 삭제 요청을 만듭니다. 파일이 없으면 sha 없이 보내고 GitHub이 거절합니다 (결과 알림에서 "파일 없음"으로 표시).
const c = $('설정').first().json;
const r = $('리서치 삭제 있음?').first().json;
const j = $input.first().json || {};
const sha = (j.statusCode === 200 && j.body && j.body.sha) || null;
return [{ json: { body: { message: `research: delete ${r.slug}`, sha, branch: c.githubBranch } } }];
