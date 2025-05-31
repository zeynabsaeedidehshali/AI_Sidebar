@echo off
cd /d C:\Users\mozha\Documents\ai-sidebar-extension

REM Abort if there's a merge conflict
IF EXIST .git\MERGE_HEAD (
  echo === MERGE CONFLICT: Resolve it first ===
  exit /b 1
)

REM Get timestamp
for /f %%i in ('powershell -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set msg=auto-commit %%i

git pull --rebase origin main
git add -A

REM Check for staged changes
git diff --cached --quiet
IF %ERRORLEVEL% NEQ 0 (
  git commit -m "%msg%"
  git push origin main
) ELSE (
  echo === No changes to commit ===
)
