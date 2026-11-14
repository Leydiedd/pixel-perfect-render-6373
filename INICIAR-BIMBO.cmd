@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Bimbo - Inicio local y celular
echo Enciende Apache y MySQL en XAMPP antes de continuar.
echo Detectando la red y preparando el sistema...
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instala la misma version usada por el proyecto.
  pause
  exit /b 1
)
if not exist "node_modules\" (
  call npm ci
  if errorlevel 1 goto error
)
if not exist ".output\server\index.mjs" (
  call npm run build
  if errorlevel 1 goto error
)
node scripts/serve-lan.mjs
if errorlevel 1 goto error
exit /b 0
:error
echo.
echo Revisa el mensaje de error anterior. No se modificaron los datos de Dolibarr.
pause
exit /b 1
