import type { NextConfig } from "next";

// Demo-Modus (SIN-1623) darf nie in Produktion laufen: dort gäbe es weder Login noch echte Daten.
if (process.env.NEXT_PUBLIC_DEMO_MODE === "on" && process.env.VERCEL_ENV === "production") {
  throw new Error("NEXT_PUBLIC_DEMO_MODE=on ist in Produktion nicht erlaubt.");
}

const nextConfig: NextConfig = {
  // Der Browser darf sw.js nie aus dem HTTP-Cache bedienen, sonst kommen Updates nicht an.
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
};

export default nextConfig;
