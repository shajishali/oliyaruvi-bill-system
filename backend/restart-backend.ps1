# Stop whatever is listening on the API port, then start the backend (avoids EADDRINUSE)
$port = if ($env:PORT) { [int]$env:PORT } else { 5000 }
$pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  Where-Object { $_ -gt 0 }
foreach ($procId in $pids) {
  Write-Host "Stopping process on port $port (PID $procId)..."
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}
if ($pids) { Start-Sleep -Milliseconds 500 }
Write-Host "Starting backend on port $port..."
npm start
