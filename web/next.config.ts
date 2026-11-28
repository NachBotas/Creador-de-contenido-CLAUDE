import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Para poder subir los exports de Sort Feed (CSV o Excel)
  experimental: { serverActions: { bodySizeLimit: "15mb" } },
  // ffmpeg (para convertir los reels que Instagram manda en VP9 con el audio aparte)
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  outputFileTracingIncludes: {
    "/api/reel/[id]/descargar": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
  },
};

export default nextConfig;
