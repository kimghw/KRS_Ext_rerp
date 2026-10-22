# Help 서버(Claude CLI) 한 번에 준비 — setup.cmd 가 부른다. 설정 페이지 › LLM 설정 › LLM 연결과 패널 제목 줄의 AI 아이콘이 이 파일을 가리킨다 (2026-10-21 사용자
# "API 입력이 된 상태라면 브릿지를 연결해서 CLI 를 설치하고 깃도 최신화 … git 도 클릭하면 cli 가 최신 버전 다운 받아서 설치").
# 하는 일: [1/3] Claude Code CLI 가 없으면 공식 설치(https://claude.ai/install.ps1), 있으면 최신화(claude update)
#          [2/3] 이 저장소 git pull --ff-only (확장 · 서버 최신화)
#          [3/3] Help 서버 실행(node help-server/server.js) — 이 창을 열어 둔 동안 동작
# 확장(브라우저)은 이 PC 에 프로그램을 설치할 수 없어서, 이 파일을 더블클릭하는 한 번의 손이 필요하다. 설치 명령은 code.claude.com/docs/en/setup 의 것.
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Need($cmd, $msg) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Write-Host "[X] $msg"; exit 1 } }
Need node 'Node.js 22 이상이 필요합니다: https://nodejs.org (LTS)'
Need git 'git 이 필요합니다: https://git-scm.com/downloads/win'

$found = Get-Command claude -ErrorAction SilentlyContinue
$local = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
$claude = if ($found) { $found.Source } elseif (Test-Path $local) { $local } else { $null }
if ($claude) {
  Write-Host "[1/3] Claude Code CLI 최신화 — $claude"
  & $claude update
} else {
  Write-Host '[1/3] Claude Code CLI 설치 — https://claude.ai/install.ps1 (진행 표시 없이 몇 분 걸릴 수 있음)'
  Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
  $claude = $local
}
if (-not (Test-Path $claude) -and -not (Get-Command $claude -ErrorAction SilentlyContinue)) { Write-Host '[X] claude 를 찾지 못했습니다 — 새 터미널에서 claude --version 을 확인하세요'; exit 1 }
Write-Host ('    claude ' + (& $claude --version))

Write-Host '[2/3] 저장소 최신화 — git pull --ff-only'
git pull --ff-only

Write-Host '[3/3] Help 서버 실행 — 이 창을 닫으면 멈춥니다. 로그인이 안 돼 있으면 다른 터미널에서 claude 를 실행해 /login'
node help-server/server.js
