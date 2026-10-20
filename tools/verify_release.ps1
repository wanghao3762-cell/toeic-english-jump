param(
  [string]$BaseUrl='https://wanghao3762-cell.github.io/toeic-english-jump/',
  [string]$Release='latest'
)
$ErrorActionPreference='Stop'
$rootForRelease=Split-Path -Parent $PSScriptRoot
# Explicit Unicode filename keeps this script compatible with PowerShell 5.1 without a BOM.
$standaloneNameForRelease=([string]::Concat([char[]]@(0x6258,0x4e1a,0x82f1,0x8bed,0x8df3,0x4e00,0x8df3)))+'.html'
$filesForRelease=@('index.html','vocabulary.js','learning.js','ascent.js','memory.js','comfort.js','app.js','data/vocabulary.json',$standaloneNameForRelease)
$digestForRelease=[System.Security.Cryptography.SHA256]::Create()
try {
  foreach($nameForRelease in $filesForRelease) {
    $encodedForRelease=($nameForRelease.Split('/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'
    $urlForRelease=$BaseUrl.TrimEnd('/')+'/'+$encodedForRelease+'?release='+[Uri]::EscapeDataString($Release)
    $responseForRelease=Invoke-WebRequest -UseBasicParsing -Uri $urlForRelease -TimeoutSec 30
    $localForRelease=[IO.File]::ReadAllText((Join-Path $rootForRelease $nameForRelease),[Text.Encoding]::UTF8).Replace("`r`n","`n")
    $remoteForRelease=if($responseForRelease.Content -is [byte[]]){[Text.Encoding]::UTF8.GetString($responseForRelease.Content)}else{[string]$responseForRelease.Content}
    $remoteForRelease=$remoteForRelease.Replace("`r`n","`n")
    $localHashForRelease=[BitConverter]::ToString($digestForRelease.ComputeHash([Text.Encoding]::UTF8.GetBytes($localForRelease))).Replace('-','').ToLowerInvariant()
    $remoteHashForRelease=[BitConverter]::ToString($digestForRelease.ComputeHash([Text.Encoding]::UTF8.GetBytes($remoteForRelease))).Replace('-','').ToLowerInvariant()
    if([int]$responseForRelease.StatusCode -ne 200 -or $localHashForRelease -ne $remoteHashForRelease){throw "Published content does not match: $nameForRelease"}
    if($responseForRelease.Headers['Content-Disposition'] -match 'attachment'){throw "Published content downloads instead of rendering: $nameForRelease"}
    [pscustomobject]@{file=$nameForRelease;status=[int]$responseForRelease.StatusCode;sha256=$remoteHashForRelease;matches=$true} | ConvertTo-Json -Compress
  }
} finally {$digestForRelease.Dispose()}
