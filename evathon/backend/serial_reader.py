"""
GreenVision - EV Road-Energy Analytics Backend
Serial data ingestion engine with local API server.
Supports Arduino serial input and mock mode for demos.
"""

import json
import os
import random
import threading
import time
from datetime import datetime
from pathlib import Path

try:
    import serial
    import serial.tools.list_ports
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False

from flask import Flask, jsonify
from flask_cors import CORS

# --- Configuration ---
BAUD_RATE = 9600
DATA_DIR = Path(__file__).parent.parent / "data"
CSV_PATH = DATA_DIR / "ev_data.csv"
POLL_INTERVAL = 0.1  # 100ms for serial reads
API_PORT = 5000

# In-memory buffer (last N readings for API responses)
DATA_BUFFER = []
BUFFER_SIZE = 100
MOCK_MODE = False

# --- Flask App ---
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


def ensure_data_dir():
    """Ensure data directory and CSV file exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not CSV_PATH.exists():
        with open(CSV_PATH, "w", encoding="utf-8") as f:
            f.write("timestamp,rri,bsi,road_condition,battery_status\n")


def append_to_csv(timestamp: str, rri: float, bsi: float, road_condition: str, battery_status: str):
    """Append a data row to ev_data.csv with ISO-8601 timestamp."""
    try:
        with open(CSV_PATH, "a", encoding="utf-8") as f:
            f.write(f"{timestamp},{rri},{bsi},{road_condition},{battery_status}\n")
    except (IOError, OSError) as e:
        print(f"[WARN] CSV write failed: {e}")


def generate_mock_data() -> dict:
    """Generate simulated serial data for demo when Arduino is unavailable."""
    rri = round(random.uniform(0.2, 0.8), 2)
    bsi = round(random.uniform(8.0, 25.0), 1)
    conditions = ["SMOOTH", "MODERATE", "ROUGH"]
    road = random.choices(conditions, weights=[0.5, 0.35, 0.15])[0]
    battery = random.choice(["NORMAL", "NORMAL", "ELEVATED", "CRITICAL"])
    return {"rri": rri, "bsi": bsi, "road_condition": road, "battery_status": battery}


def parse_serial_line(line: str) -> dict | None:
    """Parse line format: RRI,BSI,ROAD_CONDITION,BATTERY_STATUS"""
    try:
        line = line.strip()
        if not line:
            return None
        parts = line.split(",")
        if len(parts) != 4:
            return None
        rri = float(parts[0].strip())
        bsi = float(parts[1].strip())
        road = parts[2].strip().upper()
        battery = parts[3].strip().upper()
        return {"rri": rri, "bsi": bsi, "road_condition": road, "battery_status": battery}
    except (ValueError, IndexError):
        return None


def process_and_store(data: dict):
    """Add to buffer and persist to CSV."""
    ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    append_to_csv(ts, data["rri"], data["bsi"], data["road_condition"], data["battery_status"])
    DATA_BUFFER.append({
        "timestamp": ts,
        "rri": data["rri"],
        "bsi": data["bsi"],
        "road_condition": data["road_condition"],
        "battery_status": data["battery_status"],
    })
    if len(DATA_BUFFER) > BUFFER_SIZE:
        DATA_BUFFER.pop(0)


def serial_listener():
    """Background thread: read from serial or generate mock data."""
    global MOCK_MODE
    ser = None

    # Try to detect Arduino
    if SERIAL_AVAILABLE:
        ports = list(serial.tools.list_ports.comports())
        arduino_port = None
        for p in ports:
            if "Arduino" in p.description or "CH340" in p.description or "USB" in p.description:
                arduino_port = p.device
                break
        if arduino_port:
            try:
                ser = serial.Serial(arduino_port, BAUD_RATE, timeout=0.1)
                MOCK_MODE = False
                print(f"[INFO] Connected to Arduino on {arduino_port}")
            except (serial.SerialException, OSError) as e:
                print(f"[WARN] Serial open failed: {e}. Using mock mode.")
                ser = None
                MOCK_MODE = True
        else:
            print("[INFO] No Arduino detected. Using simulated serial data (mock mode).")
            MOCK_MODE = True
    else:
        print("[WARN] pyserial not installed. Using mock mode.")
        MOCK_MODE = True

    while True:
        try:
            if ser and ser.is_open:
                if ser.in_waiting:
                    raw = ser.readline().decode("utf-8", errors="ignore")
                    parsed = parse_serial_line(raw)
                    if parsed:
                        process_and_store(parsed)
            else:
                # Mock mode
                mock = generate_mock_data()
                process_and_store(mock)
        except serial.SerialException as e:
            print(f"[ERROR] Serial error: {e}. Switching to mock mode.")
            try:
                if ser:
                    ser.close()
            except Exception:
                pass
            ser = None
            MOCK_MODE = True
        except Exception as e:
            print(f"[ERROR] Listener error: {e}")
        time.sleep(POLL_INTERVAL)


# --- API Routes ---

@app.route("/api/data")
def api_data():
    """Serve latest readings as JSON for frontend polling."""
    return jsonify({
        "data": list(DATA_BUFFER),
        "mock_mode": MOCK_MODE,
    })


@app.route("/api/status")
def api_status():
    """Health check and mode info."""
    return jsonify({
        "status": "ok",
        "mock_mode": MOCK_MODE,
        "buffer_size": len(DATA_BUFFER),
    })


def main():
    ensure_data_dir()
    t = threading.Thread(target=serial_listener, daemon=True)
    t.start()
    print(f"[INFO] API server on http://127.0.0.1:{API_PORT}")
    app.run(host="127.0.0.1", port=API_PORT, threaded=True, debug=False)


if __name__ == "__main__":
    main()
