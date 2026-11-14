param([string]$XamppRoot = 'C:\xampp')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$outputDir = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$result = Join-Path $outputDir 'configurar-red-local.log'
try {
  if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Ejecuta este script como administrador para configurar el acceso desde el celular.'
  }
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $apache = Join-Path $XamppRoot 'apache\bin\httpd.exe'
  if (-not (Test-Path -LiteralPath $apache)) { throw 'No se encontró Apache en XAMPP.' }
  $definitions = @(
    @{Name='Bimbo-RedLocal-Web'; DisplayName='Bimbo web - Wi-Fi y punto de acceso'; Program=$node; Port='5173-5183'},
    @{Name='Bimbo-RedLocal-Dolibarr'; DisplayName='Dolibarr Bimbo - Red local 8081'; Program=$apache; Port='8081'}
  )
  foreach ($rule in $definitions) {
    if (Get-NetFirewallRule -Name $rule.Name -ErrorAction SilentlyContinue) {
      Set-NetFirewallRule -Name $rule.Name -DisplayName $rule.DisplayName -Enabled True -Direction Inbound -Action Allow -Profile Any -Program $rule.Program -Protocol TCP -LocalPort $rule.Port -LocalAddress Any -RemoteAddress LocalSubnet | Out-Null
    } else {
      New-NetFirewallRule -Name $rule.Name -DisplayName $rule.DisplayName -Enabled True -Direction Inbound -Action Allow -Profile Any -Program $rule.Program -Protocol TCP -LocalPort $rule.Port -LocalAddress Any -RemoteAddress LocalSubnet | Out-Null
    }
  }
  'OK: acceso permitido solo desde la subred local a la web Bimbo y Dolibarr.' | Set-Content -LiteralPath $result
} catch {
  ('ERROR: ' + $_.Exception.Message) | Set-Content -LiteralPath $result
  exit 1
}
