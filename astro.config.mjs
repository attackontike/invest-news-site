import { defineConfig } from 'astro/config';

// Vercel 정적 배포: 어댑터 없이 dist/ 를 그대로 배포합니다.
// 운영 도메인은 Vercel이 넣어 주는 환경변수에서 자동으로 가져옵니다.
const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export default defineConfig({
  site: prod ? `https://${prod}` : 'http://localhost:4321',
  trailingSlash: 'never',
});
