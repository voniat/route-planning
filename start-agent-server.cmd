@echo off
chcp 65001 >nul
echo ========================================
echo   Taffy AI 桥接服务器启动
echo ========================================
echo.
echo 请确保已安装依赖: pip install flask requests
echo.
echo [1/2] 在新终端启动 OpenCode Server:
echo       opencode serve --port 4096 --cors http://localhost:*
echo.
echo [2/2] 启动 Taffy Bridge:
echo       python taffy_bridge.py
echo.
echo API 地址: http://127.0.0.1:5520/api/chat
echo 微信开发者工具需勾选: 详情 - 本地设置 - 不校验合法域名
echo.
pause
