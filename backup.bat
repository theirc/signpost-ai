@echo off
setlocal enabledelayedexpansion

if "%~1"=="" (
    echo Add a text as parameter.
    echo Example: backup.bat Test backup file
    exit /b 1
)
set "texto=%*"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "dt=%%I"
set "YYYY=%dt:~0,4%"
set "MM=%dt:~4,2%"
set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%"
set "MIN=%dt:~10,2%"

set "timestamp=%YYYY%%MM%%DD%_%HH%%MIN%"

set "baseDir=%~dp0..\.back\signpost-ai\"
if not exist "%baseDir%" mkdir "%baseDir%"
set "dest=%baseDir%\%timestamp% - %texto%"
mkdir "%dest%"

echo Directory Created: %dest%

set "excluir=node_modules build dist .git"

echo Copying files...
for /d %%D in (*) do (
    set "skip=0"
    for %%E in (%excluir%) do (
        if /I "%%D"=="%%E" set "skip=1"
    )
    if !skip! equ 0 (
        xcopy "%%D" "%dest%\%%D" /E /I /Y >nul
    )
)

for %%F in (*) do (
    if /I not "%%~nxF"=="%~nx0" (
        copy "%%F" "%dest%\" >nul
    )
)

echo Backup finished in "%dest%"
