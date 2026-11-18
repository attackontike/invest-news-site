// ===== 바꿀 값은 이 노드에만 있습니다 =====
const now = new Date();
const kst = (d) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const cfg = {
  githubOwner: 'YOUR-GITHUB-ID',
  githubRepo: 'invest-news-site',
  githubBranch: 'main',
  supabaseUrl: 'https://YOUR-PROJECT.supabase.co',
  ecosKey: '', // 한국은행 ECOS 인증키 (주소 안에 들어가는 방식이라 자격 증명 대신 여기에 넣습니다)
  embeddingModel: 'gemini-embedding-001',
  embedDim: 768,

  // 미국 지표 (FRED). transform: level 그대로, yoy 전년 대비 %, diff 전월 대비 변화
  // change: last 직전 값과 비교, lastDifferent 값이 바뀌기 전과 비교 (기준금리처럼 자주 안 바뀌는 지표)
  fred: [
    { id: 'DFEDTARU', name: '미국 기준금리 (상단)', unit: '%', transform: 'level', change: 'lastDifferent', limit: 400 },
    { id: 'CPIAUCSL', name: '미국 소비자물가 (전년비)', unit: '%', transform: 'yoy', limit: 40 },
    { id: 'CPILFESL', name: '미국 근원 소비자물가 (전년비)', unit: '%', transform: 'yoy', limit: 40 },
    { id: 'UNRATE', name: '미국 실업률', unit: '%', transform: 'level', limit: 30 },
    { id: 'PAYEMS', name: '미국 비농업 고용 (전월비)', unit: '천 명', transform: 'diff', limit: 30 },
    { id: 'DGS10', name: '미국 10년물 국채금리', unit: '%', transform: 'level', limit: 80 },
    { id: 'DGS2', name: '미국 2년물 국채금리', unit: '%', transform: 'level', limit: 80 },
    // market: 'KR'을 붙이면 사이트의 한국 쪽에 표시
    { id: 'DEXUSEU', name: '유로/달러 환율', unit: '달러', transform: 'level', limit: 80, market: 'KR' },
    // group: 'sentiment' → 사이트 "시장 심리" 구역에 표시
    { id: 'VIXCLS', name: 'VIX 변동성 지수', unit: 'pt', transform: 'level', limit: 80, group: 'sentiment' },
    { id: 'BAMLH0A0HYM2', name: '미국 하이일드 스프레드', unit: '%', transform: 'level', limit: 80, group: 'sentiment' },
    { id: 'T10Y2Y', name: '장단기 금리차 (10년-2년)', unit: '%', transform: 'level', limit: 80, group: 'sentiment' },
    { id: 'DTWEXBGS', name: '달러인덱스 (광의)', unit: 'pt', transform: 'level', limit: 80, group: 'sentiment' },
    { id: 'STLFSI4', name: '금융 스트레스 지수 (주간)', unit: 'pt', transform: 'level', limit: 30, group: 'sentiment' },
    // group: 'index' → 첫 화면 시장 요약에 표시 (주가 지수, 전 거래일 종가)
    { id: 'SP500', name: 'S&P 500 지수', unit: 'pt', transform: 'level', limit: 80, group: 'index' },
    { id: 'NASDAQCOM', name: '나스닥 종합지수', unit: 'pt', transform: 'level', limit: 80, group: 'index' },
  ],
  // 한국 지표 (ECOS). stat 통계표 코드, cycle D(일)·M(월), item 항목 코드
  ecos: [
    { stat: '722Y001', cycle: 'D', item: '0101000', name: '한국 기준금리', unit: '%', transform: 'level', change: 'lastDifferent', days: 400 },
    { stat: '731Y001', cycle: 'D', item: '0000001', name: '원/달러 환율', unit: '원', transform: 'level', days: 90 },
    { stat: '817Y002', cycle: 'D', item: '010200000', name: '국고채 3년', unit: '%', transform: 'level', days: 90 },
    { stat: '901Y009', cycle: 'M', item: '0', name: '한국 소비자물가 (전년비)', unit: '%', transform: 'yoy', months: 30 },
    { stat: '731Y001', cycle: 'D', item: '0000002', name: '원/엔 환율 (100엔)', unit: '원', transform: 'level', days: 90 },
    { stat: '731Y001', cycle: 'D', item: '0000003', name: '원/유로 환율', unit: '원', transform: 'level', days: 90 },
    { stat: '731Y001', cycle: 'D', item: '0000053', name: '원/위안 환율', unit: '원', transform: 'level', days: 90 },
    { stat: '802Y001', cycle: 'D', item: '0001000', name: '코스피 지수', unit: 'pt', transform: 'level', days: 90, group: 'index' },
    { stat: '802Y001', cycle: 'D', item: '0089000', name: '코스닥 지수', unit: 'pt', transform: 'level', days: 90, group: 'index' },
  ],

  // FRED 발표 일정 중 챙길 것: [이름에 들어 있는 말, 한국어 이름, 중요도 1~3, 미국 동부 시각]
  fredReleases: [
    ['Consumer Price Index', '미국 소비자물가(CPI)', 3, '08:30'],
    ['Employment Situation', '미국 고용보고서', 3, '08:30'],
    ['Producer Price Index', '미국 생산자물가(PPI)', 2, '08:30'],
    ['Gross Domestic Product', '미국 GDP', 2, '08:30'],
    ['Personal Income and Outlays', '미국 PCE 물가', 2, '08:30'],
    ['Advance Monthly Sales for Retail', '미국 소매판매', 2, '08:30'],
    ['Job Openings and Labor Turnover', '미국 구인·이직(JOLTS)', 1, '10:00'],
  ],
  // 직접 넣는 일정 (FOMC, 한국은행 금통위 등 1년에 몇 번 정해지는 것). 날짜는 각 기관 홈페이지에서 확인해 추가
  //   미국: { date: '미국 날짜', timeEt: '14:00', market: 'US', name: 'FOMC 금리 결정', importance: 3 }  → 한국 시간으로 바꿔 저장
  //   한국: { date: '2026-11-27', time: '10:00', market: 'KR', name: '한국은행 기준금리 결정', importance: 3 }
  manualEvents: [],
  // 매달 같은 날 나오는 일정
  monthlyEvents: [{ day: 1, time: '09:00', market: 'KR', name: '수출입 동향 (산업통상자원부)', importance: 2 }],
  eventDays: 30, // 앞으로 며칠 치 일정을 저장할지
};

return [{
  json: {
    ...cfg,
    nowIso: now.toISOString(),
    today: kst(now),
    until: kst(new Date(now.getTime() + cfg.eventDays * 86400_000)),
  },
}];
