// Discord 슬래시 명령 중계 함수 (Vercel)
// Discord → 이 함수(서명 확인, 3초 안에 "생각 중" 응답) → n8n "Discord 명령" 워크플로
//
// Vercel 환경변수
//   DISCORD_PUBLIC_KEY        Discord 앱 General Information의 Public Key
//   ALLOWED_USER_IDS          명령을 쓸 수 있는 Discord 사용자 ID (여러 명이면 쉼표로)
//   N8N_COMMAND_WEBHOOK_URL   n8n "Discord 명령" 워크플로의 Production URL
//   RELAY_SECRET              n8n Webhook 노드 Header Auth와 같은 비밀 값

import { waitUntil } from '@vercel/functions';

const PING = 1;
const APPLICATION_COMMAND = 2;
const PONG = 1;
const CHANNEL_MESSAGE = 4;
const DEFERRED_CHANNEL_MESSAGE = 5;
const EPHEMERAL = 64;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

let keyPromise = null;
async function verify(request, raw) {
  const sig = request.headers.get('x-signature-ed25519');
  const ts = request.headers.get('x-signature-timestamp');
  const pub = process.env.DISCORD_PUBLIC_KEY;
  if (!sig || !ts || !pub || !/^[0-9a-f]+$/i.test(sig)) return false;
  keyPromise ||= crypto.subtle.importKey('raw', hexToBytes(pub.trim()), { name: 'Ed25519' }, false, ['verify']);
  try {
    return await crypto.subtle.verify('Ed25519', await keyPromise, hexToBytes(sig), new TextEncoder().encode(ts + raw));
  } catch {
    return false;
  }
}

export async function GET() {
  return new Response('Discord 명령 중계 함수가 동작 중입니다. Discord는 POST로만 요청합니다.', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export async function POST(request) {
  const raw = await request.text();
  if (!(await verify(request, raw))) return new Response('invalid request signature', { status: 401 });

  const it = JSON.parse(raw);
  if (it.type === PING) return json({ type: PONG });
  if (it.type !== APPLICATION_COMMAND) return json({ type: CHANNEL_MESSAGE, data: { content: '지원하지 않는 요청입니다.', flags: EPHEMERAL } });

  // 허용된 사용자만
  const userId = (it.member && it.member.user && it.member.user.id) || (it.user && it.user.id);
  const allowed = String(process.env.ALLOWED_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(userId)) {
    return json({ type: CHANNEL_MESSAGE, data: { content: '이 명령을 사용할 권한이 없습니다.', flags: EPHEMERAL } });
  }

  const hook = process.env.N8N_COMMAND_WEBHOOK_URL;
  if (!hook || !process.env.RELAY_SECRET) {
    return json({ type: CHANNEL_MESSAGE, data: { content: '중계 설정(N8N_COMMAND_WEBHOOK_URL, RELAY_SECRET)이 비어 있습니다.', flags: EPHEMERAL } });
  }

  // 응답을 먼저 보내고, n8n 호출은 응답 뒤에 마저 끝냄
  waitUntil(
    fetch(hook, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-relay-secret': process.env.RELAY_SECRET },
      body: JSON.stringify({
        command: it.data && it.data.name,
        options: (it.data && it.data.options) || [],
        applicationId: it.application_id,
        token: it.token,
        userId,
        channelId: it.channel_id,
        guildId: it.guild_id,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch((e) => console.error('n8n 호출 실패', e)),
  );

  return json({ type: DEFERRED_CHANNEL_MESSAGE });
}
