# Программа кассы Kemal Usman на ПК магазина: задача Windows «Kemal касса» — запускается при входе в Windows,
# работает в фоне, после сбоя перезапускается. Повторный запуск скрипта безопасен (задача пересоздаётся).
#   powershell -ExecutionPolicy Bypass -File install-agent.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path "$here\agent.env")) { throw "Нет файла agent.env рядом со скриптом — скопируйте agent.env.example и заполните." }
$pyw = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
if (-not $pyw) { throw "Не найден Python (pythonw.exe). Установите Python 3 с python.org." }
& ($pyw -replace 'pythonw.exe$', 'python.exe') -m pip install --quiet --disable-pip-version-check httpx pywin32
$action = New-ScheduledTaskAction -Execute $pyw -Argument "`"$here\kassa_agent.py`" run" -WorkingDirectory $here
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Kemal касса' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'Kemal касса'
Start-Sleep -Seconds 8
Write-Host "Задача «Kemal касса»: $((Get-ScheduledTask -TaskName 'Kemal касса').State). Журнал: $here\logs\kassa_agent.log"
