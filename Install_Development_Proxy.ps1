$ErrorActionPreference = "Stop"

$pluginRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginId = "research-library-paper-importer@ychin.com"
$profileRoot = Join-Path $env:APPDATA "Zotero\Zotero"
$profilesIni = Join-Path $profileRoot "profiles.ini"

if (Get-Process -Name "zotero" -ErrorAction SilentlyContinue) {
    throw "请先完全退出 Zotero，然后再运行这个脚本。"
}

if (!(Test-Path -LiteralPath $profilesIni)) {
    throw "找不到 Zotero profiles.ini: $profilesIni"
}

$profilePath = $null
foreach ($line in Get-Content -LiteralPath $profilesIni -Encoding UTF8) {
    if ($line -match "^Path=(.+)$") {
        $profilePath = $Matches[1]
        break
    }
}
if (!$profilePath) {
    throw "无法从 profiles.ini 读取 Zotero profile 路径。"
}

$profileDir = Join-Path $profileRoot $profilePath
$extensionsDir = Join-Path $profileDir "extensions"
$prefs = Join-Path $profileDir "prefs.js"

New-Item -ItemType Directory -Path $extensionsDir -Force | Out-Null

$proxyFile = Join-Path $extensionsDir $pluginId
Set-Content -LiteralPath $proxyFile -Value $pluginRoot -Encoding ASCII

if (Test-Path -LiteralPath $prefs) {
    $backup = "$prefs.research-library-backup"
    Copy-Item -LiteralPath $prefs -Destination $backup -Force
    $kept = Get-Content -LiteralPath $prefs -Encoding UTF8 | Where-Object {
        $_ -notmatch 'extensions\.lastAppBuildId' -and $_ -notmatch 'extensions\.lastAppVersion'
    }
    Set-Content -LiteralPath $prefs -Value $kept -Encoding UTF8
}

Write-Host "已创建 Zotero 开发代理插件：$proxyFile"
Write-Host "现在重新打开 Zotero，在 Tools -> Add-ons 中应能看到 Research Library Paper Importer。"
