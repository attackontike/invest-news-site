// ===== 바꿀 값은 이 노드에만 있습니다 =====
// trust: 매체 기본 신뢰도(1~5), grade: 출처 등급(공시/통신사/해설/커뮤니티)
return [{
  json: {
    supabaseUrl: 'https://YOUR-PROJECT.supabase.co', // Supabase → Project Settings → API의 Project URL

    collectHours: 48, // 이보다 오래된 기사는 모으지 않음
    perSourceMax: 15, // 한 번 실행에 피드(검색어)당 최대 기사 수
    totalMax: 120, // 한 번 실행에 전체 최대 기사 수

    // 관심 종목(Supabase watchlist) 뉴스: 국내는 네이버, 미국은 Google News에서 종목마다 검색
    watchNewsMax: 20, // 검색할 관심 종목 최대 수
    watchNaverDisplay: 10, // 국내 관심 종목 1개당 네이버 검색 결과 수

    // 1) 매체 RSS
    feeds: [
      { name: '연합뉴스 경제', source: '연합뉴스', url: 'https://www.yna.co.kr/rss/economy.xml', market: 'KR', trust: 4, grade: '통신사' },
      { name: '한국경제 증권', source: '한국경제', url: 'https://www.hankyung.com/feed/finance', market: 'KR', trust: 4, grade: '해설' },
      { name: '매일경제 증권', source: '매일경제', url: 'https://www.mk.co.kr/rss/50200011/', market: 'KR', trust: 4, grade: '해설' },
      { name: 'CNBC Finance', source: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664', market: 'US', trust: 4, grade: '해설' },
      { name: 'MarketWatch', source: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', market: 'US', trust: 4, grade: '해설' },
      { name: 'Yahoo Finance', source: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', market: 'US', trust: 3, grade: '해설' },
    ],

    // 2) Google News 검색 (최근 1일). 매체명은 기사마다 붙어 오며 아래 sources 표로 신뢰도를 정함
    googleNews: [
      { q: '코스피 OR 코스닥', market: 'KR' },
      { q: '금리 환율 증시', market: 'KR' },
      { q: 'stock market Wall Street', market: 'US' },
      { q: 'Federal Reserve rates', market: 'US' },
      { q: 'site:reuters.com markets', market: 'US' },
    ],

    // 3) 네이버 뉴스 검색 API (자격 증명 "Naver API"가 필요). 비우면 건너뜀
    naverQueries: ['코스피', '코스닥', '증시', '환율', '금리'],
    naverDisplay: 30,
    // 네이버 원문 주소의 도메인 → 매체명
    naverDomains: {
      'yna.co.kr': '연합뉴스', 'einfomax.co.kr': '연합인포맥스', 'hankyung.com': '한국경제', 'mk.co.kr': '매일경제',
      'sedaily.com': '서울경제', 'edaily.co.kr': '이데일리', 'mt.co.kr': '머니투데이', 'news.mt.co.kr': '머니투데이',
      'fnnews.com': '파이낸셜뉴스', 'asiae.co.kr': '아시아경제', 'heraldcorp.com': '헤럴드경제', 'biz.chosun.com': '조선비즈',
      'chosun.com': '조선일보', 'joongang.co.kr': '중앙일보', 'donga.com': '동아일보', 'hani.co.kr': '한겨레', 'khan.co.kr': '경향신문',
      'news1.kr': '뉴스1', 'newsis.com': '뉴시스', 'thebell.co.kr': '더벨', 'bloter.net': '블로터', 'ytn.co.kr': 'YTN', 'yonhapnewstv.co.kr': '연합뉴스TV',
    },

    // 매체명 → 신뢰도·등급 (Google News, 네이버 공통). 목록에 없는 매체는 unknownSource 값
    sources: {
      '연합뉴스': [4, '통신사'], '연합인포맥스': [5, '통신사'], '뉴스1': [3, '통신사'], '뉴시스': [3, '통신사'],
      '한국경제': [4, '해설'], '매일경제': [4, '해설'], '서울경제': [3, '해설'], '이데일리': [3, '해설'], '머니투데이': [3, '해설'],
      '파이낸셜뉴스': [3, '해설'], '아시아경제': [3, '해설'], '헤럴드경제': [3, '해설'], '조선비즈': [3, '해설'], '더벨': [4, '해설'],
      '조선일보': [4, '해설'], '중앙일보': [4, '해설'], '동아일보': [4, '해설'], '한겨레': [4, '해설'], '경향신문': [4, '해설'],
      'Reuters': [5, '통신사'], 'Associated Press': [5, '통신사'], 'AP News': [5, '통신사'], 'Bloomberg': [5, '통신사'], 'Bloomberg.com': [5, '통신사'],
      'The Wall Street Journal': [5, '해설'], 'Financial Times': [5, '해설'], 'CNBC': [4, '해설'], 'MarketWatch': [4, '해설'],
      'Barron\'s': [4, '해설'], 'Yahoo Finance': [3, '해설'], 'Investopedia': [3, '해설'], 'Seeking Alpha': [2, '커뮤니티'], 'The Motley Fool': [2, '커뮤니티'],
    },
    unknownSource: [2, '해설'],
  },
}];
