// 블롭(파일 내용) sha를 경로와 짝지어 트리 요청을 만듭니다.
const files = $('백업 파일 만들기').all().map((i) => i.json);
const blobs = $input.all().map((i) => i.json);
if (blobs.length !== files.length || blobs.some((b) => !b.sha)) throw new Error(`블롭 생성 결과가 맞지 않습니다 (파일 ${files.length}개, 결과 ${blobs.length}개)`);
return [{ json: { tree: files.map((f, i) => ({ path: f.path, mode: '100644', type: 'blob', sha: blobs[i].sha })) } }];
