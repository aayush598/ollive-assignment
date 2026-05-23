import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "drizzle-orm"],
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
