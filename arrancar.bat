@echo off
setlocal

cd /d "%~dp0"

if not exist "backend\app.py" (
  echo No se encontro backend\app.py.
  pause
  exit /b 1
)

if not exist "frontend\package.json" (
  echo No se encontro frontend\package.json.
  pause
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  echo No se encontro Python en PATH.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo No se encontro npm en PATH.
  pause
  exit /b 1
)

echo Iniciando backend en 0.0.0.0:5000...
start "Backend Flask" cmd /k "cd /d ""%~dp0backend"" && python app.py"
echo Iniciando frontend en 0.0.0.0:4200...
start "Frontend Angular" cmd /k "cd /d ""%~dp0frontend"" && npm start"

echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:4200
echo Red local: http://IP-DE-MI-PC:5000 y http://IP-DE-MI-PC:4200
echo.
echo Usa la IP de tu PC para acceder desde otros equipos de la misma red.
pause