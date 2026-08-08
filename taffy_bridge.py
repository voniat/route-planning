import json
import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

OPENCODE_URL = os.environ.get("OPENCODE_URL", "http://127.0.0.1:4096")

SYSTEM_PROMPT = u"""你是 Taffy，一个旅行路线规划助手。用户正在使用微信小程序规划旅行路线。

你需要帮助用户完成以下操作：
- 添加途经点、删除站点、重新排序路线
- 搜索美食、查看交通路线
- 收藏路线、加载收藏、删除收藏

回复格式：先给用户友好简洁的文字回复，如果用户需要执行操作，在末尾用 ---ACTIONS--- 分隔，后面跟 JSON 动作数组。

支持的动作:
- add: 添加地点, 需 name, lat, lng
- remove: 删除, 需 index (从0开始)
- reorder: 重排, 需 indices (新顺序数组)
- clear: 清空
- setCity: 切换城市, 需 name
- search: 搜索, 需 keyword, 可选 city
- nearby: 附近美食, 需 keyword, 可选 pointIndex
- route: 查看路线
- optimize: 智能排序
- loadFav: 加载收藏, 可选 id 或 name
- deleteFav: 删除收藏, 可选 id 或 name
- saveCurrent: 收藏当前路线, 可选 name

示例回复:
好的喵~ 已为你删除！
---ACTIONS---
[{"type":"remove","index":2}]
"""


def build_context_text(data):
    ctx = data.get("context", {})
    points = ctx.get("points", [])
    city = ctx.get("city", u"未知")
    routes = ctx.get("savedRoutes", [])

    lines = [f"当前城市: {city}"]
    if points:
        lines.append("途经点列表:")
        for i, p in enumerate(points):
            lines.append(f"  {i}. {p.get('name', '?')} ({p.get('lat')}, {p.get('lng')})")
    if routes:
        lines.append("已收藏路线:")
        for r in routes:
            lines.append(f"  - {r.get('name')} ({r.get('count', 0)}站, {r.get('city', '')}, id={r.get('id', '')})")
    return "\n".join(lines)


def parse_response(text):
    if "---ACTIONS---" not in text:
        return text, []

    parts = text.split("---ACTIONS---", 1)
    reply = parts[0].strip()
    try:
        actions = json.loads(parts[1].strip())
        if not isinstance(actions, list):
            actions = []
    except (json.JSONDecodeError, ValueError):
        actions = []
    return reply, actions


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"reply": "请发送一条消息喵~", "actions": []})

    ctx_text = build_context_text(data)
    user_msg = f"{ctx_text}\n\n用户: {message}"

    try:
        resp = requests.post(
            f"{OPENCODE_URL}/session/{data.get('uid', 'wx')}/message",
            json={
                "parts": [{"type": "text", "text": user_msg}],
                "system": SYSTEM_PROMPT,
            },
            timeout=120,
        )
        if resp.status_code == 200:
            body = resp.json()
            full_text = ""
            if isinstance(body, dict):
                parts = body.get("parts", [])
                for p in parts:
                    if isinstance(p, dict) and p.get("type") == "text":
                        full_text += p.get("text", "")
            if not full_text:
                full_text = body.get("text", "") if isinstance(body, dict) else str(body)
            raw = full_text
        else:
            raw = f"服务器返回异常 (HTTP {resp.status_code})"
    except requests.exceptions.ConnectionError:
        return jsonify({"reply": "TAFFY 服务未启动喵~\n请在终端运行: opencode serve --port 4096", "actions": []})
    except Exception as e:
        return jsonify({"reply": f"请求异常: {str(e)[:100]}", "actions": []})

    reply, actions = parse_response(raw)
    return jsonify({"reply": reply, "actions": actions})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    print("=" * 45)
    print("  Taffy Bridge -> OpenCode")
    print(f"  OpenCode: {OPENCODE_URL}")
    print(f"  Listen:   http://127.0.0.1:5520/api/chat")
    print("=" * 45)
    print()
    print("  确保 opencode 已启动:")
    print("    opencode serve --port 4096")
    print()
    app.run(host="0.0.0.0", port=5520, debug=False)
