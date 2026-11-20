@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org e rode de novo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install || goto :erro
)

echo Iniciando o sistema em http://localhost:3000
echo Para encerrar, pressione Ctrl+C nesta janela.
call npm run dev || goto :erro
exit /b 0

:erro
echo.
echo Falhou ao iniciar. Veja as mensagens acima.
pause
exit /b 1