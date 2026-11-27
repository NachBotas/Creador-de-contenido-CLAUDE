import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Para poder subir los exports de Sort Feed (CSV o Excel)
  experimental: { serverActions: { bodySizeLimit: "15mb" } },
};

export default nextConfig;
