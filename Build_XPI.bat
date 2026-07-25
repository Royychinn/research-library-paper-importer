@echo off
setlocal
cd /d "%~dp0"
python "%~dp0build_xpi.py"
echo Built Research_Library_Paper_Importer.xpi
pause
