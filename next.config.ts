import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 서버를 0.0.0.0 으로 띄운 뒤 127.0.0.1 로 접속해도 정적 청크가 막히지 않게 한다.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
