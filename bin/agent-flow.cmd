@echo off
rem agent-flow 的 Windows 包装（cmd / PowerShell 均可调用）：需要 Node.js >= 18
where node >nul 2>nul || (echo agent-flow 需要 Node.js ^>= 18：https://nodejs.org 1>&2 & exit /b 1)
node "%~dp0agent-flow.mjs" %*
