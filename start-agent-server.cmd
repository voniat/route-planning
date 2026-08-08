@echo off
chcp 65001 >nul
echo ========================================
echo   Taffy AI 桥接服务器
echo ========================================
echo.
echo 依赖: pip install flask flask-cors requests
echo.
echo [1/2] 启动 OpenCode（新终端）:
echo       opencode serve --port 4096
echo.
echo [2/2] 启动桥接（本终端）:
echo       python taffy_bridge.py
echo.
echo 微信开发者工具: 详情-本地设置-不校验合法域名
echo.
pause
