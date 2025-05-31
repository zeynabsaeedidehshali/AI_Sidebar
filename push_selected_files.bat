@echo off
cd /d C:\Users\mozha\Documents\ai-sidebar-extension

REM Abort if there's a merge conflict
IF EXIST .git\MERGE_HEAD (
  echo === MERGE CONFLICT: Resolve it first ===
  exit /b 1
)

REM Get timestamp
for /f %%i in ('powershell -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set msg=upload-fixed-files %%i

REM Pull latest changes
git pull --rebase origin main

REM Stage only the desired files
git add background.js content.js manifest.json options.html options.js sidebar.css sidebar.html sidebar.js

REM Commit and push if there are changes
git diff --cached --quiet
IF %ERRORLEVEL% NEQ 0 (
  git commit -m "%msg%"
  git push origin main
) ELSE (
  echo === No changes in tracked files to commit ===
)
