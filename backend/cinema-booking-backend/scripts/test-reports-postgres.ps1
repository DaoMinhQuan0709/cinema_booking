param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
    [string]$Tests = 'AdminReportPostgresTests'
)

$ErrorActionPreference = 'Stop'
$artifactRoot = Join-Path ([IO.Path]::GetTempPath()) ('cinema-report-postgres-' + [guid]::NewGuid().ToString('N'))
$cluster = Join-Path $artifactRoot 'data'
$serverStarted = $false
$pushedLocation = $false
$previousEnv = @{}
foreach ($name in @('CINEMA_TEST_DB_URL', 'CINEMA_TEST_DB_USER', 'CINEMA_TEST_DB_PASSWORD')) {
    $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    foreach ($binary in @('initdb.exe', 'pg_ctl.exe')) {
        if (-not (Test-Path -LiteralPath (Join-Path $PostgresBin $binary))) { throw "Không tìm thấy $binary trong $PostgresBin" }
    }
    New-Item -ItemType Directory -Path $artifactRoot | Out-Null
    # Cụm hoàn toàn mới trong temp, chỉ nghe loopback; không đọc cấu hình/credential ứng dụng.
    & (Join-Path $PostgresBin 'initdb.exe') -D $cluster -U report_test --auth=trust --no-locale -E UTF8 *> (Join-Path $artifactRoot 'initdb.log')
    if ($LASTEXITCODE -ne 0) { throw "Không khởi tạo được PostgreSQL thử. Xem $artifactRoot" }
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $testPort = $listener.LocalEndpoint.Port
    $listener.Stop()
    # Không dùng -Wait: PowerShell có thể chờ luôn cây tiến trình chứa postgres nền.
    $startup = Start-Process -FilePath (Join-Path $PostgresBin 'pg_ctl.exe') -WindowStyle Hidden -PassThru -ArgumentList @(
        '-D', "`"$cluster`"", '-l', "`"$(Join-Path $artifactRoot 'server.log')`"", '-o', "`"-p $testPort -h 127.0.0.1 -F`"", '-w', 'start'
    ) -RedirectStandardOutput (Join-Path $artifactRoot 'start.log') -RedirectStandardError (Join-Path $artifactRoot 'start-error.log')
    $null = $startup.Handle
    $startup.WaitForExit()
    $startup.Refresh()
    if ($startup.ExitCode -ne 0) { throw "Không chạy được PostgreSQL thử. Xem $artifactRoot" }
    $serverStarted = $true
    $env:CINEMA_TEST_DB_URL = "jdbc:postgresql://127.0.0.1:$testPort/postgres"
    $env:CINEMA_TEST_DB_USER = 'report_test'
    $env:CINEMA_TEST_DB_PASSWORD = ''
    Push-Location (Split-Path $PSScriptRoot -Parent)
    $pushedLocation = $true
    Write-Host "PostgreSQL tạm: 127.0.0.1:$testPort; log: $artifactRoot"
    & .\mvnw.cmd "-Dtest=$Tests" test
    if ($LASTEXITCODE -ne 0) { throw 'Kiểm thử báo cáo không đạt.' }
} finally {
    if ($pushedLocation) { Pop-Location }
    if ($serverStarted -or (Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid'))) {
        $shutdown = Start-Process -FilePath (Join-Path $PostgresBin 'pg_ctl.exe') -WindowStyle Hidden -PassThru -ArgumentList @('-D', "`"$cluster`"", '-m', 'fast', '-w', 'stop') `
            -RedirectStandardOutput (Join-Path $artifactRoot 'stop.log') -RedirectStandardError (Join-Path $artifactRoot 'stop-error.log')
        $null = $shutdown.Handle
        $shutdown.WaitForExit()
        $shutdown.Refresh()
        if ($shutdown.ExitCode -ne 0) { Write-Warning "Chưa dừng được cụm thử ở $cluster" }
    }
    foreach ($name in $previousEnv.Keys) { [Environment]::SetEnvironmentVariable($name, $previousEnv[$name], 'Process') }
    Write-Host "Giữ log và dữ liệu thử tại $artifactRoot; không xóa database ứng dụng."
}
