@echo off
chcp 65001 >nul
echo ========================================
echo   AI 代理服务器需要单独部署
echo ========================================
echo.
echo 当前 mini-program AI 聊天功能需要一个后端 API 服务。
echo 在微信开发者工具控制台设置:
echo   wx.setStorageSync('agent_dev_url', 'https://你的服务器地址/api/chat')
echo.
pause
