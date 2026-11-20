# Build em dois estágios: compila no primeiro e leva para a imagem final só o
# pacote standalone (server.js + node_modules rastreados).
#
# Não há dependência nativa no projeto (o better-sqlite3 saiu junto com o
# SQLite), então o build é o mesmo em qualquer arquitetura. Ainda assim, compile
# em Linux/x64 no painel para casar com a imagem final.
#
# Versão fixa e igual à de `engines` no package.json: 24.2.0 é a única LTS
# recente disponível no registro do painel (icontainer/node) sem aviso de
# engine nas dependências.

FROM node:24.2.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: este estágio só tem package.json (sem scripts/ nem src/),
# então o postinstall não existe aqui. Não há dependência nativa para compilar.
RUN npm ci --ignore-scripts

FROM node:24.2.0-alpine AS builder
WORKDIR /app
# drizzle-kit/tsx são devDependencies: o build precisa delas, o runtime não.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# SKIP_BUILD: o postinstall já compila caso o script não tenha sido pulado;
# aqui o build é explícito para o erro aparecer com contexto.
ENV SKIP_BUILD=1
RUN npm run build

FROM node:24.2.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Uploads fora da imagem, num volume — atualizar o sistema não apaga os
# arquivos. O banco vem de DATABASE_URL (Postgres gerenciado).
ENV DATA_DIR=/data

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /data && chown nextjs:nodejs /data

# public/, .next/static e drizzle/ já vêm copiados pelo postbuild.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]