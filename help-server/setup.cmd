@echo off
rem Help 서버(Claude CLI) 한 번에 준비: Claude Code CLI 설치/최신화 → git pull → 서버 실행. 내용은 setup.ps1 (더블클릭으로 실행하려고 .cmd 로 감쌈)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
pause
