param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
    [string]$Tests = '',
    [switch]$SkipFrontendChecks,
    [switch]$SkipBrowser
)

$ErrorActionPreference = 'Stop'
$backend = Split-Path $PSScriptRoot -Parent
$frontend = [IO.Path]::GetFullPath((Join-Path $backend '..\..\frontend'))
$artifactRoot = Join-Path ([IO.Path]::GetTempPath()) ('cinema-admin-acceptance-' + [guid]::NewGuid().ToString('N'))
$cluster = Join-Path $artifactRoot 'data'
$containerName = 'cinema-admin-test-' + [guid]::NewGuid().ToString('N')
$containerId = $null
$serverStarted = $false
$previousEnv = @{}
$names = @('CINEMA_TEST_DB_URL', 'CINEMA_TEST_DB_USER', 'CINEMA_TEST_DB_PASSWORD', 'CINEMA_TEST_REDIS',
    'CINEMA_TEST_REDIS_HOST', 'CINEMA_TEST_REDIS_PORT', 'CINEMA_TEST_HTTP', 'CINEMA_TEST_BROWSER',
    'CINEMA_TEST_ARTIFACTS', 'SPRING_APPLICATION_JSON')
foreach ($name in $names) { $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

function Invoke-PgControl([string[]]$ControlArgs, [string]$LogName) {
    # Không dùng -Wait vì PowerShell có thể chờ cả tiến trình PostgreSQL nền.
    $control = Start-Process -FilePath (Join-Path $PostgresBin 'pg_ctl.exe') -WindowStyle Hidden -PassThru -ArgumentList $ControlArgs `
        -RedirectStandardOutput (Join-Path $artifactRoot "$LogName.log") -RedirectStandardError (Join-Path $artifactRoot "$LogName-error.log")
    $null = $control.Handle
    $control.WaitForExit()
    $control.Refresh()
    if ($control.ExitCode -ne 0) { throw "pg_ctl $LogName thất bại; xem $artifactRoot" }
}

try {
    foreach ($binary in @('initdb.exe', 'pg_ctl.exe')) {
        if (-not (Test-Path -LiteralPath (Join-Path $PostgresBin $binary))) { throw "Không tìm thấy $binary trong $PostgresBin" }
    }
    New-Item -ItemType Directory -Path $artifactRoot | Out-Null
    if (-not $SkipFrontendChecks) {
        Push-Location $frontend
        try {
            foreach ($task in @('lint', 'test', 'build', 'test:admin-browser', 'test:admin-movies-browser',
                    'test:admin-showtimes-browser', 'test:admin-reports-browser', 'test:admin-sync-browser',
                    'test:checkout-browser', 'test:chatbot-browser')) {
                & npm.cmd run $task
                if ($LASTEXITCODE -ne 0) { throw "Frontend không đạt: $task" }
            }
        } finally { Pop-Location }
    }
    # Cụm mới trong temp; không dùng DB, schema, mật khẩu hay cổng ứng dụng.
    & (Join-Path $PostgresBin 'initdb.exe') -D $cluster -U admin_test --auth=trust --no-locale -E UTF8 *> (Join-Path $artifactRoot 'initdb.log')
    if ($LASTEXITCODE -ne 0) { throw 'Không khởi tạo được PostgreSQL thử.' }
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $testPort = $listener.LocalEndpoint.Port
    $listener.Stop()
    Invoke-PgControl @('-D', "`"$cluster`"", '-l', "`"$(Join-Path $artifactRoot 'server.log')`"", '-o', "`"-p $testPort -h 127.0.0.1 -F`"", '-w', 'start') 'start'
    $serverStarted = $true

    # Container Redis mới, không volume; Docker cấp cổng ngẫu nhiên chỉ ở loopback.
    $created = & docker run --detach --name $containerName --publish '127.0.0.1::6379' redis:7-alpine redis-server --save '""' --appendonly no
    if ($LASTEXITCODE -ne 0) { throw 'Không khởi động được Redis thử.' }
    $containerId = "$created".Trim()
    $binding = & docker port $containerId 6379/tcp
    if ($LASTEXITCODE -ne 0 -or "$binding" -notmatch '^127\.0\.0\.1:(\d+)$') { throw 'Cổng Redis thử không hợp lệ.' }
    $redisPort = [int]$Matches[1]
    $ping = & docker exec $containerId redis-cli ping
    if ($LASTEXITCODE -ne 0 -or $ping -ne 'PONG') { throw 'Redis thử chưa sẵn sàng.' }

    $env:CINEMA_TEST_DB_URL = "jdbc:postgresql://127.0.0.1:$testPort/postgres"
    $env:CINEMA_TEST_DB_USER = 'admin_test'
    $env:CINEMA_TEST_DB_PASSWORD = ''
    $env:CINEMA_TEST_REDIS = 'true'
    $env:CINEMA_TEST_REDIS_HOST = '127.0.0.1'
    $env:CINEMA_TEST_REDIS_PORT = "$redisPort"
    $env:CINEMA_TEST_HTTP = 'true'
    $env:CINEMA_TEST_BROWSER = (-not $SkipBrowser).ToString().ToLowerInvariant()
    $env:CINEMA_TEST_ARTIFACTS = $artifactRoot
    $env:SPRING_APPLICATION_JSON = @{
        'spring.datasource.url' = $env:CINEMA_TEST_DB_URL
        'spring.datasource.username' = 'admin_test'
        'spring.datasource.password' = ''
        'spring.jpa.hibernate.ddl-auto' = 'update'
        'spring.data.redis.host' = '127.0.0.1'
        'spring.data.redis.port' = $redisPort
        'spring.data.redis.password' = ''
        'application.galaxy.enabled' = $false
        'application.galaxy.details.enabled' = $false
        'application.galaxy.base-url' = 'http://127.0.0.1:9'
        'application.gemini.api-key' = 'kiem-thu-khong-goi-api-ngoai'
        'application.gemini.api-url' = 'http://127.0.0.1:9'
        'application.payment.vnpay.query.enabled' = $false
        'application.payment.vnpay.query.scheduler-enabled' = $false
        'spring.mail.host' = '127.0.0.1'
        'spring.mail.port' = 9
        'application.jwt.secret-key' = 'khoa-chi-danh-cho-nghiem-thu-admin-doc-lap-2026'
        'logging.level.root' = 'WARN'
        'logging.level.org.springframework' = 'WARN'
        'logging.level.org.hibernate' = 'WARN'
        'logging.level.com.cinema.booking' = 'INFO'
        'debug' = $false
    } | ConvertTo-Json -Compress
    Write-Host "PostgreSQL thử: 127.0.0.1:$testPort; Redis thử: 127.0.0.1:$redisPort; log: $artifactRoot"
    Push-Location $backend
    try {
        $mavenArgs = @('test')
        if ($Tests) { $mavenArgs = @("-Dtest=$Tests", 'test') }
        & .\mvnw.cmd @mavenArgs | Tee-Object -FilePath (Join-Path $artifactRoot 'maven.log') | Where-Object {
            $_ -match '^\[(INFO|ERROR|WARNING)\]|Tests run:|AssertionFailed|Exception:|BUILD (SUCCESS|FAILURE)'
        }
        if ($LASTEXITCODE -ne 0) { throw 'Nghiệm thu backend không đạt.' }
    } finally { Pop-Location }
} finally {
    if ($containerId) {
        # Chỉ dọn container vừa tạo; không đụng Redis đang dùng ở cổng 6379.
        & docker rm --force $containerId | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Warning "Chưa dọn được container thử $containerId" }
    }
    if ($serverStarted -or (Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid'))) {
        Invoke-PgControl @('-D', "`"$cluster`"", '-m', 'fast', '-w', 'stop') 'stop'
    }
    foreach ($name in $previousEnv.Keys) { [Environment]::SetEnvironmentVariable($name, $previousEnv[$name], 'Process') }
    Write-Host "Giữ log/dữ liệu thử tại $artifactRoot; không xóa database ứng dụng."
}
