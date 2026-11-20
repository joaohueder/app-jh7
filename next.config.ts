import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deploy como aplicação standalone: o build gera `.next/standalone` com só
  // o necessário para rodar `node server.js`, sem `npm install` no servidor.
  output: "standalone",
  // Selo do build, exposto em /health. Sem ele não há como saber se o painel
  // publicou o código novo ou reaproveitou o antigo.
  env: { BUILD_ID: process.env.BUILD_ID ?? new Date().toISOString() },
  // pg abre socket TCP e usa APIs de Node: fica fora do bundle do servidor.
  serverExternalPackages: ["pg", "bcryptjs"],
  // Acesso por celular na rede local durante o desenvolvimento.
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "localhost",
    "127.0.0.1",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
