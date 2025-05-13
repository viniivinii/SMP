@echo off
setlocal

:: Caminho do repositório
cd /d "C:\Users\vinicius.silva\OneDrive - gagreciclagem.com\Expedição\memory-tool"

:: Mensagem do commit
set /p msg="Digite a mensagem do commit: "

echo.
echo ===> Adicionando arquivos...
git add .

echo.
echo ===> Commitando com a mensagem: %msg%
git commit -m "%msg%"

echo.
echo ===> Fazendo pull com rebase...
git pull origin main --rebase
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo Houve erro ao tentar aplicar o rebase. Verificando pasta .vscode...

    IF EXIST ".vscode" (
        echo Tentando excluir a pasta .vscode...
        rmdir /s /q ".vscode"
    )

    echo Tentando novamente o rebase...
    git pull origin main --rebase
)

echo.
echo ===> Enviando para o GitHub...
git push origin main

echo.
echo Processo finalizado!
pause
