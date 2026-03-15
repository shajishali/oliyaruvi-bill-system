# Restart the backend - stops any existing Node process on port 5000 and starts fresh
$port = 5000
$pids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
  Select-Object -ExpandProperty OwningProcess -Unique | 
  Where-Object { $_ -gt 0 -and (Get-Process -Id $_ -ErrorAction SilentlyContinue).ProcessName -eq 'node' }
foreach ($pid in $pids) {
  Write-Host "Stopping existing backend (PID $pid)..."
  Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}
Write-Host "Starting backend..."
npm start
