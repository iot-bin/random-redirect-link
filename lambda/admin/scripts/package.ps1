param(
    [switch]$IncludeSdk
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distDirectory = Join-Path $projectRoot "dist"
$bundlePath = Join-Path $distDirectory "index.mjs"
$buildScript = if ($IncludeSdk) { "build:self-contained" } else { "build" }
$zipName = if ($IncludeSdk) {
    "random-redirect-link-admin-self-contained.zip"
} else {
    "random-redirect-link-admin.zip"
}
$zipPath = Join-Path $distDirectory $zipName
$pnpmCommand = Get-Command "pnpm" -ErrorAction Stop

Push-Location $projectRoot
try {
    & $pnpmCommand.Source run test
    if ($LASTEXITCODE -ne 0) {
        throw "Lambda tests failed."
    }

    & $pnpmCommand.Source run $buildScript
    if ($LASTEXITCODE -ne 0) {
        throw "Lambda build failed."
    }

    Compress-Archive `
        -LiteralPath $bundlePath `
        -DestinationPath $zipPath `
        -CompressionLevel Optimal `
        -Force

    Write-Output "Created deployment package: $zipPath"
} finally {
    Pop-Location
}
