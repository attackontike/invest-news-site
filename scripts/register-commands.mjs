// Discord 슬래시 명령 등록 (명령을 추가·변경할 때 한 번 실행)
//
// PowerShell:
//   $env:DISCORD_APP_ID="애플리케이션 ID"
//   $env:DISCORD_BOT_TOKEN="봇 토큰"
//   $env:DISCORD_GUILD_ID="서버 ID"
//   node scripts/register-commands.mjs
//
// 서버(guild) 명령으로 등록하므로 바로 나타납니다. 같은 이름은 덮어쓰고, 목록에 없는 명령은 지워집니다.

const { DISCORD_APP_ID: app, DISCORD_BOT_TOKEN: token, DISCORD_GUILD_ID: guild } = process.env;
if (!app || !token || !guild) {
  console.error('DISCORD_APP_ID, DISCORD_BOT_TOKEN, DISCORD_GUILD_ID 환경변수를 먼저 설정하세요.');
  process.exit(1);
}

const SUB = 1;
const STRING = 3;

const commands = [
  {
    name: 'watch',
    name_localizations: { ko: '관심종목' },
    description: 'Manage watchlist',
    description_localizations: { ko: '관심 종목을 추가·삭제하거나 목록을 봅니다' },
    options: [
      {
        type: SUB,
        name: 'add',
        name_localizations: { ko: '추가' },
        description: 'Add a stock',
        description_localizations: { ko: '관심 종목 추가' },
        options: [
          { type: STRING, name: 'symbol', name_localizations: { ko: '종목' }, description: 'Name, code or ticker', description_localizations: { ko: '종목명, 종목코드(005930) 또는 티커(NVDA)' }, required: true, max_length: 40 },
          { type: STRING, name: 'label', name_localizations: { ko: '이름' }, description: 'Display name', description_localizations: { ko: '화면에 보일 이름 (예: 엔비디아). 비우면 기본 이름' }, required: false, max_length: 30 },
        ],
      },
      {
        type: SUB,
        name: 'remove',
        name_localizations: { ko: '삭제' },
        description: 'Remove a stock',
        description_localizations: { ko: '관심 종목 삭제' },
        options: [
          { type: STRING, name: 'symbol', name_localizations: { ko: '종목' }, description: 'Name, code or ticker', description_localizations: { ko: '종목명, 종목코드 또는 티커' }, required: true, max_length: 40 },
        ],
      },
      {
        type: SUB,
        name: 'list',
        name_localizations: { ko: '목록' },
        description: 'Show watchlist',
        description_localizations: { ko: '관심 종목 목록 보기' },
      },
    ],
  },
  {
    name: 'research',
    name_localizations: { ko: '리서치' },
    description: 'Research a topic',
    description_localizations: { ko: '주제·종목을 조사해 리포트를 만듭니다 (1~3분)' },
    options: [
      { type: STRING, name: 'topic', name_localizations: { ko: '주제' }, description: 'Topic or stock', description_localizations: { ko: '예: 삼성전자 HBM, 엔비디아 실적, 미국 금리 인하 영향' }, required: true, max_length: 100 },
    ],
  },
];

const res = await fetch(`https://discord.com/api/v10/applications/${app}/guilds/${guild}/commands`, {
  method: 'PUT',
  headers: { authorization: `Bot ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(commands),
});
const body = await res.text();
if (!res.ok) {
  console.error(`등록 실패 ${res.status}: ${body}`);
  console.error('401이면 봇 토큰, 403이면 봇을 서버에 초대했는지(applications.commands), 404면 앱·서버 ID를 확인하세요.');
  process.exit(1);
}
console.log(`등록 완료: ${JSON.parse(body).map((c) => '/' + c.name).join(', ')}`);
