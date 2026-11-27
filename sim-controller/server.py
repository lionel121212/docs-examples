"""
Sim controller companion server (Windows).

- Reads Assetto Corsa telemetry from the shared memory (acpmf_physics).
- Reads the current media session (title / artist / play state) from Windows
  (works for YouTube Music in the browser or in the desktop app).
- Serves a small web dashboard to the phone/tablet over http://localhost:8000
  (the phone reaches it through `adb reverse`).
- Receives button presses from the dashboard and sends them as key presses to
  Assetto Corsa. Map the keys to the same actions in AC's Controls settings.

Run:  python server.py
"""

import asyncio
import json
import mmap
import os
import struct
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

BASE = Path(__file__).parent
CONFIG = json.loads((BASE / "config.json").read_text(encoding="utf-8"))

app = FastAPI()

# --------------------------------------------------------------------------
# Assetto Corsa telemetry (shared memory, Windows only)
# Layout of the SPageFilePhysics struct, first fields:
#   0  packetId int
#   4  gas float
#   8  brake float
#   12 fuel float
#   16 gear int          (0 = R, 1 = N, 2 = 1st, ...)
#   20 rpms int
#   24 steerAngle float
#   28 speedKmh float
# --------------------------------------------------------------------------

class ACTelemetry:
    def __init__(self):
        self.mem = None

    def _open(self):
        try:
            self.mem = mmap.mmap(-1, 800, "Local\\acpmf_physics", access=mmap.ACCESS_READ)
        except OSError:
            self.mem = None

    def read(self):
        if self.mem is None:
            self._open()
            if self.mem is None:
                return None
        try:
            self.mem.seek(0)
            raw = self.mem.read(32)
        except (OSError, ValueError):
            self.mem = None
            return None
        gas, brake, fuel = struct.unpack_from("fff", raw, 4)
        gear, rpm = struct.unpack_from("ii", raw, 16)
        speed = struct.unpack_from("f", raw, 28)[0]
        return {
            "speed": round(speed, 1),
            "rpm": rpm,
            "gear": gear - 1,  # 0 = N, -1 = R, 1.. = forward gears
            "gas": round(gas, 2),
            "brake": round(brake, 2),
            "fuel": round(fuel, 1),
        }


telemetry = ACTelemetry()

# --------------------------------------------------------------------------
# Media (Windows System Media Transport Controls, via winsdk)
# --------------------------------------------------------------------------

_media_manager = None


async def media_manager():
    global _media_manager
    if _media_manager is None:
        from winsdk.windows.media.control import (
            GlobalSystemMediaTransportControlsSessionManager as Manager,
        )
        _media_manager = await Manager.request_async()
    return _media_manager


async def media_now_playing():
    try:
        mgr = await media_manager()
        session = mgr.get_current_session()
        if session is None:
            return None
        props = await session.try_get_media_properties_async()
        info = session.get_playback_info()
        status = info.playback_status  # 4 = playing, 5 = paused
        return {
            "title": props.title or "",
            "artist": props.artist or "",
            "playing": status == 4,
            "app": session.source_app_user_model_id,
        }
    except Exception:
        return None


async def media_command(name: str):
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
    else:
        return False
    return True


# --------------------------------------------------------------------------
# Keyboard injection into Assetto Corsa
# --------------------------------------------------------------------------

def press_key(key: str):
    import pydirectinput  # Windows only

    pydirectinput.press(key)


# --------------------------------------------------------------------------
# HTTP / WebSocket routes
# --------------------------------------------------------------------------

@app.get("/")
async def index():
    return FileResponse(BASE / "web" / "index.html")


@app.get("/config")
async def config():
    return JSONResponse({"buttons": CONFIG["buttons"]})


class ButtonPress(BaseModel):
    name: str


@app.post("/button")
async def button(p: ButtonPress):
    if p.name in ("play_pause", "next", "prev"):
        ok = await media_command(p.name)
        return {"ok": ok}
    key = CONFIG["buttons"].get(p.name)
    if not key:
        return JSONResponse({"ok": False, "error": "unknown button"}, status_code=400)
    press_key(key)
    return {"ok": True}


@app.websocket("/ws")
async def ws(socket: WebSocket):
    await socket.accept()
    try:
        while True:
            payload = {
                "telemetry": telemetry.read(),
                "media": await media_now_playing(),
            }
            await socket.send_text(json.dumps(payload))
            await asyncio.sleep(1 / CONFIG.get("update_hz", 20))
    except WebSocketDisconnect:
        return


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=CONFIG.get("port", 8000))
