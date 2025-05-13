@echo off
cd /d "%~dp0"

:: Solicita a mensagem de commit
set /p msg=Digite a mensagem do commit: 

:: Adiciona e envia os arquivos
git add .
git commit -m "%msg%"
git push

pause
