import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OG 카드가 fs로 읽는 폰트가 Vercel 함수 번들에 포함되도록 명시
  outputFileTracingIncludes: {
    "/api/og/[username]": ["./assets/fonts/**"],
  },
};

export default nextConfig;
