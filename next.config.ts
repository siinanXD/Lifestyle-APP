import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Der Browser darf sw.js nie aus dem HTTP-Cache bedienen, sonst kommen Updates nicht an.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
};

export default nextConfig;
