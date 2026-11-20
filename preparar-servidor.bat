@echo off
setlocal
cd /d "%~dp0"

set DESTINO=dist-servidor

echo ================================================
echo  JH7 Marketing - pacote standalone para o servidor
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org.
  pause
  exit /b 1
)

if not exist "package-lock.json" (
  echo package-lock.json nao encontrado. Rode "npm install" uma vez antes.
  pause
  exit /b 1
)

echo [1/4] Limpando "%DESTINO%"...
if exist "%DESTINO%" rmdir /s /q "%DESTINO%"
mkdir "%DESTINO%"

echo [2/4] Copiando o codigo...
xcopy "src" "%DESTINO%\src\" /E /I /Q /Y >nul || goto :erro
xcopy "public" "%DESTINO%\public\" /E /I /Q /Y >nul || goto :erro
xcopy "drizzle" "%DESTINO%\drizzle\" /E /I /Q /Y >nul || goto :erro
xcopy "scripts" "%DESTINO%\scripts\" /E /I /Q /Y >nul || goto :erro

for %%F in (package.json package-lock.json tsconfig.json next.config.ts drizzle.config.ts components.json next-env.d.ts) do (
  if exist "%%F" copy /Y "%%F" "%DESTINO%\%%F" >nul
)
if exist ".env.example" copy /Y ".env.example" "%DESTINO%\.env.example" >nul

echo [3/4] Escrevendo instrucoes...
set NOTAS=%DESTINO%\LEIA-ME.txt
> "%NOTAS%" echo JH7 Marketing - pacote standalone
>> "%NOTAS%" echo ============================================================
>> "%NOTAS%" echo.
>> "%NOTAS%" echo Vai neste pacote: codigo, public/, migracoes, scripts e as
>> "%NOTAS%" echo configuracoes. NAO vai node_modules, .next, banco, uploads
>> "%NOTAS%" echo nem segredos.
>> "%NOTAS%" echo.
>> "%NOTAS%" echo POR QUE O BUILD E FEITO NO SERVIDOR:
>> "%NOTAS%" echo   better-sqlite3 e sharp sao binarios nativos. Compilados no
>> "%NOTAS%" echo   Windows nao rodam no Linux. O "npm run build" no servidor
>> "%NOTAS%" echo   gera os binarios certos.
>> "%NOTAS%" echo.
>> "%NOTAS%" echo 1) Envie esta pasta ao servidor e entre nela (ex.: /var/www/jh7).
>> "%NOTAS%" echo.
>> "%NOTAS%" echo 2) Crie o .env.local e preencha:
>> "%NOTAS%" echo      cp .env.example .env.local
>> "%NOTAS%" echo      nano .env.local
>> "%NOTAS%" echo.
>> "%NOTAS%" echo    DATA_DIR=/var/lib/jh7
>> "%NOTAS%" echo      Banco e uploads, FORA do codigo: atualizar o sistema nao
>> "%NOTAS%" echo      apaga os dados.
>> "%NOTAS%" echo.
>> "%NOTAS%" echo    SESSION_SECRET=
>> "%NOTAS%" echo      node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
>> "%NOTAS%" echo.
>> "%NOTAS%" echo    ADMIN_EMAIL e ADMIN_PASSWORD: usuario do primeiro acesso.
>> "%NOTAS%" echo.
>> "%NOTAS%" echo 3) Instale e gere o build de producao:
>> "%NOTAS%" echo      npm ci
>> "%NOTAS%" echo      npm run build
>> "%NOTAS%" echo.
>> "%NOTAS%" echo 4) Prepare o banco (as migracoes rodam sozinhas na subida,
>> "%NOTAS%" echo    mas aqui o erro aparece na hora):
>> "%NOTAS%" echo      npm run db:migrate
>> "%NOTAS%" echo      npm run db:seed
>> "%NOTAS%" echo.
>> "%NOTAS%" echo 5) Copie os estaticos para dentro do standalone:
>> "%NOTAS%" echo      cp -r public .next/standalone/
>> "%NOTAS%" echo      cp -r .next/static .next/standalone/.next/
>> "%NOTAS%" echo      cp -r drizzle .next/standalone/
>> "%NOTAS%" echo      mkdir -p /var/lib/jh7/uploads
>> "%NOTAS%" echo.
>> "%NOTAS%" echo 6) Suba o servidor:
>> "%NOTAS%" echo      cd .next/standalone
>> "%NOTAS%" echo      DATA_DIR=/var/lib/jh7 PORT=3000 HOSTNAME=0.0.0.0 node server.js
>> "%NOTAS%" echo.
>> "%NOTAS%" echo    Para manter rodando use systemd ou pm2, por exemplo:
>> "%NOTAS%" echo      pm2 start server.js --name jh7
>> "%NOTAS%" echo    Coloque nginx ou Apache na frente e habilite HTTPS.
>> "%NOTAS%" echo.
>> "%NOTAS%" echo 7) Depois do primeiro acesso, troque a senha do admin em
>> "%NOTAS%" echo    Configuracoes.
>> "%NOTAS%" echo.
>> "%NOTAS%" echo ATUALIZAR O SISTEMA:
>> "%NOTAS%" echo   - envie o codigo novo por cima, sem tocar em /var/lib/jh7
>> "%NOTAS%" echo   - npm ci e npm run build
>> "%NOTAS%" echo   - repita os "cp" do passo 5 e reinicie o processo
>> "%NOTAS%" echo   - migracoes novas entram sozinhas na subida
>> "%NOTAS%" echo.
>> "%NOTAS%" echo BACKUP: a pasta /var/lib/jh7 inteira (jh7.db + uploads).

echo [4/4] Pronto.
echo.
echo Pasta "%DESTINO%" criada. Envie-a e siga o LEIA-ME.txt.
pause
exit /b 0

:erro
echo.
echo Falhou ao copiar arquivos. Feche programas usando a pasta e tente de novo.
pause
exit /b 1
