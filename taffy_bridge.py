import json
import os
import requests
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

API_KEY = os.environ.get("LLM_API_KEY", "")
API_URL = os.environ.get("LLM_API_URL", "https://api.openai.com/v1/chat/completions")
MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")

SYSTEM_PROMPT = u"""你是 Taffy，一个旅行路线规划助手。用户正在使用微信小程序规划旅行。
你需要帮助用户：添加途经点、删除站点、重新排序、搜索美食、查看路线、收藏路线等。

回复格式要求：
1. 先给用户友好简洁的文字回复
2. 如果用户要求执行具体操作，在回复末尾用 ---ACTIONS--- 分隔，后面跟 JSON 数组

支持的动作(action)类型:
- add: 添加途经点, 需要 name(地点名), lat(纬度), lng(经度)
- remove: 删除途经点, 需要 index(从0开始的下标)
- reorder: 重新排序, 需要 indices(新顺序的序号数组,如[0,2,1,3])
- clear: 清空所有途经点
- setCity: 切换城市, 需要 name(城市名)
- search: 搜索地点, 需要 keyword(关键词), 可选 city(城市)
- nearby: 搜附近美食, 需要 keyword(美食类型), 可选 pointIndex(途经点序号)
- route: 查看交通路线
- optimize: 智能优化路线
- loadFav: 加载收藏路线, 可选 id 或 name
- deleteFav: 删除收藏路线, 可选 id 或 name
- saveCurrent: 收藏当前路线, 可选 name(路线名)

示例:
用户: 帮我把第三个点删了
回复: 好的，已为你删除第三个地点喵~ 
---ACTIONS---
[{"type":"remove","index":2}]

用户: 附近有什么好吃的
回复: 正在帮你搜索附近美食喵~
---ACTIONS---
[{"type":"nearby","keyword":"美食|餐厅"}]
"""


def build_context(data):
    ctx = data.get("context", {})
    points = ctx.get("points", [])
    city = ctx.get("city", u"未知")
    routes = ctx.get("savedRoutes", [])

    lines = [f"当前城市: {city}"]
    if points:
        lines.append("当前路线途经点:")
        for i, p in enumerate(points):
            lines.append(f"  {i}. {p.get('name', '?')} (纬度:{p.get('lat')}, 经度:{p.get('lng')})")
    if routes:
        lines.append("已收藏路线:")
        for r in routes:
            lines.append(f"  - {r.get('name')} ({r.get('count', 0)}个点, {r.get('city', '')}, id:{r.get('id', '')})")
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

    ctx_text = build_context(data)
    user_msg = f"{ctx_text}\n\n用户说: {message}"

    try:
        resp = requests.post(
            API_URL,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                "temperature": 0.7,
                "max_tokens": 2000,
            },
            timeout=60,
        )
        resp.raise_for_status()
        body = resp.json()
        raw = body["choices"][0]["message"]["content"]
    except requests.exceptions.ConnectionError:
        return jsonify({"reply": "AI 服务连接失败，请确保服务器已启动喵~", "actions": []})
    except Exception as e:
        return jsonify({"reply": f"请求异常: {str(e)[:100]}", "actions": []})

    reply, actions = parse_response(raw)
    return jsonify({"reply": reply, "actions": actions})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    print("=" * 40)
    print("  Taffy AI Bridge Server")
    print(f"  API: http://127.0.0.1:5520/api/chat")
    print(f"  LLM: {MODEL}")
    print("=" * 40)
    app.run(host="0.0.0.0", port=5520, debug=False)
