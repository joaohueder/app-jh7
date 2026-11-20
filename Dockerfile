# Build em dois estágios: compila no primeiro e leva para a imagem final só o
# pacote standalone (server.js + node_modules rastreados).
#
# better-sqlite3 é binário nativo: o build PRECISA rodar na mesma arquitetura da
# imagem final (aqui, linux/musl x64). Nunca publique o .next compilado no
# Windows — ele não sobe no container.

FROM node:22-alpine AS deps
WORKDIR /app
# better-sqlite3 tem prebuild para musl; libc6-compat evita falha de dlopen.
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# --ignore-scripts: better-sqlite3 já traz o binário linuxmusl-x64 no pacote.
# Sem isso o npm tenta compilar com node-gyp e a imagem não tem Python.
RUN npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
# drizzle-kit/tsx são devDependencies: o build precisa delas, o runtime não.
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Banco e uploads fora da imagem, num volume — atualizar o sistema não apaga
# os dados. Aponte o volume do painel para /data.
ENV DATA_DIR=/data

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /data && chown nextjs:nodejs /data

# public/, .next/static e drizzle/ já vêm copiados pelo postbuild.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]