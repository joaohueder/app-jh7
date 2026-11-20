import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deploy como aplicação standalone: o build gera `.next/standalone` com só
  // o necessário para rodar `node server.js`, sem `npm install` no servidor.
  output: "standalone",
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
