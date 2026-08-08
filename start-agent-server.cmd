@echo off
chcp 65001 >nul
echo ========================================
echo   Taffy AI 桥接服务器启动
echo ========================================
echo.
echo 使用前请先设置环境变量（或用默认 OpenAI）:
echo   set LLM_API_KEY=your-api-key
echo   set LLM_API_URL=https://api.openai.com/v1/chat/completions
echo   set LLM_MODEL=gpt-4o-mini
echo.
echo 也支持其他 OpenAI 兼容 API（如 DeepSeek、通义千问等）
echo.
echo [1/1] 启动 Taffy Bridge:
echo       python taffy_bridge.py
echo.
echo API 地址: http://127.0.0.1:5520/api/chat
echo 微信开发者工具需勾选: 详情 - 本地设置 - 不校验合法域名
echo.
echo 依赖安装: pip install flask flask-cors requests
echo.
pause
