"""
Sim controller companion server (Windows).

- Reads Assetto Corsa telemetry from its shared memory
  (acpmf_physics, acpmf_graphics, acpmf_static).
- Reads the current media session (title, artist, position, album art) from
  Windows. This works for YouTube Music in the browser or the desktop app.
- Serves the dashboard to the phone/tablet at http://localhost:8000
  (the phone reaches it through `adb reverse`).
- Receives button presses from the dashboard and sends them to Assetto Corsa
  as key presses. Map the same keys in AC: Settings > Controls.

Run:        python server.py
Demo mode:  python server.py --demo   (fake telemetry and music, no AC needed)
"""

import asyncio
import json
import math
import mmap
import struct
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
# Assetto Corsa telemetry (shared memory, Windows only)
#
# SPageFilePhysics:   4 gas f, 8 brake f, 12 fuel f, 16 gear i, 20 rpms i, 28 speedKmh f
# SPageFileGraphic:   4 status i (0 off, 1 replay, 2 live, 3 pause),
#                     12 currentTime wchar[15], 42 lastTime wchar[15], 72 bestTime wchar[15]
# SPageFileStatic:    412 maxRpm i
# --------------------------------------------------------------------------

def _open_map(name: str, size: int):
    try:
        return mmap.mmap(-1, size, name, access=mmap.ACCESS_READ)
    except (OSError, TypeError):
        # TypeError: the tagname argument only exists on Windows.
        return None


def _wstr(raw: bytes, offset: int, chars: int = 15) -> str:
    return raw[offset:offset + chars * 2].decode("utf-16-le", errors="ignore").split("\x00")[0]


class ACTelemetry:
    def __init__(self):
        self.physics = self.graphics = self.static = None
        self.max_rpm_seen = 0

    def read(self):
        if self.physics is None:
            self.physics = _open_map("Local\\acpmf_physics", 800)
            self.graphics = _open_map("Local\\acpmf_graphics", 1600)
            self.static = _open_map("Local\\acpmf_static", 1024)
            if self.physics is None:
                return None
        try:
            self.physics.seek(0)
            p = self.physics.read(32)
            g = b""
            if self.graphics is not None:
                self.graphics.seek(0)
                g = self.graphics.read(104)
            s = b""
            if self.static is not None:
                self.static.seek(0)
                s = self.static.read(416)
        except (OSError, ValueError):
            self.physics = self.graphics = self.static = None
            return None

        gas, brake, fuel = struct.unpack_from("fff", p, 4)
        gear, rpm = struct.unpack_from("ii", p, 16)
        speed = struct.unpack_from("f", p, 28)[0]
        status = struct.unpack_from("i", g, 4)[0] if len(g) >= 8 else 2

        max_rpm = struct.unpack_from("i", s, 412)[0] if len(s) >= 416 else 0
        self.max_rpm_seen = max(self.max_rpm_seen, rpm)
        if not 1000 <= max_rpm <= 25000:
            max_rpm = max(self.max_rpm_seen, 8000)

        return {
            "live": status in (2, 3),
            "speed": round(speed),
            "rpm": rpm,
            "max_rpm": max_rpm,
            "gear": gear - 1,  # 0 = N, -1 = R, 1.. = forward gears
            "gas": round(gas, 2),
            "brake": round(brake, 2),
            "fuel": round(fuel, 1),
            "lap": _wstr(g, 12) if len(g) >= 42 else "",
            "best": _wstr(g, 72) if len(g) >= 102 else "",
        }


class DemoTelemetry:
    """Fake lap so the dashboard can be tried without the game."""

    def __init__(self):
        self.t0 = time.time()

    def read(self):
        t = time.time() - self.t0
        wave = math.sin(t * 0.7) * math.sin(t * 0.23)
        speed = 150 + 110 * wave
        gear = max(1, min(6, round(speed / 45)))
        band = (speed - 45 * (gear - 1)) / 45
        rpm = int(4200 + 3800 * max(0.0, min(1.0, band)))
        lap = t % 102.6
        return {
            "live": True,
            "speed": round(speed),
            "rpm": rpm,
            "max_rpm": 8200,
            "gear": gear,
            "gas": round(max(0.0, min(1.0, 0.6 + wave)), 2),
            "brake": round(max(0.0, min(1.0, -wave - 0.3)), 2),
            "fuel": round(42.3 - t * 0.01, 1),
            "lap": f"{int(lap // 60)}:{lap % 60:04.1f}",
            "best": "1:42.6",
        }


telemetry = DemoTelemetry() if DEMO else ACTelemetry()


# --------------------------------------------------------------------------
# Media (Windows System Media Transport Controls, via winsdk)
# --------------------------------------------------------------------------

_media_manager = None
_art = {"key": None, "bytes": None, "type": "image/png"}


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
                "position": round(t), "duration": 192, "art": None}
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
            "art": f"/art?k={abs(hash(key))}" if _art["bytes"] else None,
        }
    except Exception:
        return None


async def media_command(name: str):
    if DEMO:
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
        current = info.auto_repeat_mode or 0  # 0 none, 1 track, 2 list
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
    return Response(_art["bytes"], media_type=_art["type"], headers={"Cache-Control": "no-store"})


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
    media, last_media = None, 0.0
    try:
        while True:
            now = time.time()
            if now - last_media > 0.5:  # media changes slowly; poll it less often
                media, last_media = await media_now_playing(), now
            await socket.send_text(json.dumps({"telemetry": telemetry.read(), "media": media}))
            await asyncio.sleep(1 / CONFIG.get("update_hz", 30))
    except WebSocketDisconnect:
        return


if __name__ == "__main__":
    if DEMO:
        print("Demo mode: fake telemetry and music.")
    uvicorn.run(app, host="127.0.0.1", port=CONFIG.get("port", 8000))
