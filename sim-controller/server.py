"""
Sim controller companion server (Windows).

- Serves the button pad + music dashboard to the phone/tablet at
  http://localhost:8000 (the phone reaches it through `adb reverse`).
- Sends button presses to Assetto Corsa as key presses.
  Map the same keys in AC: Settings > Controls.
- Reads the current media session (title, artist, position, album art) from
  Windows. This works for YouTube Music in the browser or the desktop app.

Run:        python server.py
Demo mode:  python server.py --demo   (fake music, key presses are only printed)
"""

import asyncio
import json
import sys
import time
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel

BASE = Path(__file__).parent
CONFIG = json.loads((BASE / "config.json").read_text(encoding="utf-8"))
DEMO = "--demo" in sys.argv

app = FastAPI()


# --------------------------------------------------------------------------
# Media (Windows System Media Transport Controls, via winsdk)
# --------------------------------------------------------------------------

_media_manager = None
_art = {"key": None, "bytes": None, "type": "image/png", "version": 0}


async def media_manager():
    global _media_manager
    if _media_manager is None:
        from winsdk.windows.media.control import (
            GlobalSystemMediaTransportControlsSessionManager as Manager,
        )
        _media_manager = await Manager.request_async()
    return _media_manager


async def _read_thumbnail(props):
    from winsdk.windows.storage.streams import Buffer, DataReader, InputStreamOptions

    stream = await props.thumbnail.open_read_async()
    size = stream.size
    buf = Buffer(size)
    await stream.read_async(buf, size, InputStreamOptions.READ_AHEAD)
    reader = DataReader.from_buffer(buf)
    data = bytearray(buf.length)
    reader.read_bytes(data)
    return bytes(data), (stream.content_type or "image/png")


async def media_now_playing():
    if DEMO:
        t = time.time() % 192
        return {"title": "Midnight Drive", "artist": "Example Artist", "playing": True,
                "position": round(t), "duration": 192, "art": None,
                "shuffle": False, "repeat": 0}
    try:
        mgr = await media_manager()
        session = mgr.get_current_session()
        if session is None:
            return None
        props = await session.try_get_media_properties_async()
        info = session.get_playback_info()
        timeline = session.get_timeline_properties()

        key = f"{props.title}|{props.artist}"
        if key != _art["key"]:
            _art["key"], _art["bytes"] = key, None
            _art["version"] += 1
            if props.thumbnail is not None:
                try:
                    _art["bytes"], _art["type"] = await _read_thumbnail(props)
                except Exception:
                    _art["bytes"] = None

        return {
            "title": props.title or "",
            "artist": props.artist or "",
            "playing": info.playback_status == 4,  # 4 = playing, 5 = paused
            "position": round(timeline.position.total_seconds()),
            "duration": round(timeline.end_time.total_seconds()),
            "art": f"/art?v={_art['version']}" if _art["bytes"] else None,
            "shuffle": bool(info.is_shuffle_active),
            "repeat": int(info.auto_repeat_mode or 0),
        }
    except Exception:
        return None


async def media_command(name: str):
    if DEMO:
        print(f"[demo] media {name}")
        return True
    mgr = await media_manager()
    session = mgr.get_current_session()
    if session is None:
        return False
    if name == "play_pause":
        await session.try_toggle_play_pause_async()
    elif name == "next":
        await session.try_skip_next_async()
    elif name == "prev":
        await session.try_skip_previous_async()
    elif name == "shuffle":
        info = session.get_playback_info()
        await session.try_change_shuffle_active_async(not bool(info.is_shuffle_active))
    elif name == "repeat":
        info = session.get_playback_info()
        current = int(info.auto_repeat_mode or 0)  # 0 none, 1 track, 2 list
        await session.try_change_auto_repeat_mode_async((current + 1) % 3)
    else:
        return False
    return True


# --------------------------------------------------------------------------
# Keyboard injection into Assetto Corsa
# --------------------------------------------------------------------------

def press_key(key: str):
    if DEMO:
        print(f"[demo] key {key}")
        return
    import pydirectinput  # Windows only

    pydirectinput.press(key)


# --------------------------------------------------------------------------
# HTTP / WebSocket routes
# --------------------------------------------------------------------------

MEDIA_COMMANDS = {"play_pause", "next", "prev", "shuffle", "repeat"}


@app.get("/")
async def index():
    return FileResponse(BASE / "web" / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/config")
async def config():
    return JSONResponse({"buttons": CONFIG["buttons"]})


@app.get("/art")
async def art():
    if not _art["bytes"]:
        return Response(status_code=404)
    return Response(_art["bytes"], media_type=_art["type"])


class ButtonPress(BaseModel):
    name: str


@app.post("/button")
async def button(p: ButtonPress):
    if p.name in MEDIA_COMMANDS:
        return {"ok": await media_command(p.name)}
    entry = CONFIG["buttons"].get(p.name)
    if not entry:
        return JSONResponse({"ok": False, "error": "unknown button"}, status_code=400)
    press_key(entry["key"])
    return {"ok": True}


@app.websocket("/ws")
async def ws(socket: WebSocket):
    await socket.accept()
    try:
        while True:
            await socket.send_text(json.dumps({"media": await media_now_playing()}))
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        return


if __name__ == "__main__":
    if DEMO:
        print("Demo mode: fake music, key presses are only printed.")
    uvicorn.run(app, host="127.0.0.1", port=CONFIG.get("port", 8000))
