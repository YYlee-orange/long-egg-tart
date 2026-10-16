param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot
$gameUrl = 'http://127.0.0.1:4173/'
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$availableNode = Get-Command node -ErrorAction SilentlyContinue
$nodeExecutable = if ($availableNode) { $availableNode.Source } else { $bundledNode }
if (-not (Test-Path -LiteralPath $nodeExecutable)) { throw '需要 Node.js 才能运行原型。' }
$alreadyRunning = $false
try { $alreadyRunning = (Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 2).Content -match 'id="stage"' } catch {}
if (-not $alreadyRunning) {
  $runtimeDirectory = Join-Path $projectDirectory '.runtime'
  New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
  $serverScript = Join-Path $projectDirectory 'scripts\serve.mjs'
  $serverProcess = Start-Process -FilePath $nodeExecutable -ArgumentList @('"' + $serverScript + '"') -WorkingDirectory $projectDirectory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDirectory 'server.log') -RedirectStandardError (Join-Path $runtimeDirectory 'server-error.log')
  $serverProcess.Id | Set-Content -LiteralPath (Join-Path $runtimeDirectory 'server.pid')
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 100
    try {
      if ((Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 2).Content -match 'id="stage"') { $alreadyRunning = $true; break }
    } catch {}
  }
  if (-not $alreadyRunning) { throw '原型服务未能启动，请查看 .runtime/server-error.log。' }
}
if (-not $NoBrowser) { Start-Process $gameUrl }
