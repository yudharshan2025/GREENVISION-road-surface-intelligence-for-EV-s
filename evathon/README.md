# GreenVision — EV Road-Energy Analytics Dashboard

A real-time dashboard that visualizes road roughness (RRI) and battery stress (BSI) from Arduino serial data. Built for hackathon demos with a dark "Tesla-style" UI.

## Architecture

```
Arduino (9600 baud) → Serial → Python Backend → CSV + JSON API → Frontend (Leaflet + Chart.js)
```

- **Data Format**: `RRI,BSI,ROAD_CONDITION,BATTERY_STATUS\n` (e.g., `0.45,12.2,SMOOTH,NORMAL`)
- **Zero cloud**: All logic runs locally; CDN-only for libraries.

## Directory Structure

```
GreenVision/
├── backend/serial_reader.py   # Serial listener + Flask API
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── dashboard.js
│   └── map.js
├── data/ev_data.csv
└── README.md
```

## Setup

### 1. Python Backend

```bash
cd GreenVision
pip install pyserial flask flask-cors
python backend/serial_reader.py
```

**Mock mode**: If no Arduino is detected, the backend auto-switches to simulated data so the demo never fails.

### 2. Arduino Sketch (Optional)

Send lines at 9600 baud in the format:

```
RRI,BSI,ROAD_CONDITION,BATTERY_STATUS
```

Example:

```c
void loop() {
  float rri = 0.45;
  float bsi = 12.2;
  Serial.print(rri); Serial.print(",");
  Serial.print(bsi); Serial.print(",");
  Serial.print("SMOOTH"); Serial.print(",");
  Serial.println("NORMAL");
  delay(1000);
}
```

### 3. Frontend

Serve the frontend folder via any static server, or open `index.html` directly (CORS may block API calls; use a server):

```bash
cd frontend
npx serve . -p 3000
```

Or with Python:

```bash
cd frontend
python -m http.server 3000
```

Open `http://localhost:3000`.

### 4. API

- **GET /api/data** — Latest readings as JSON for polling.
- **GET /api/status** — Health check and mock mode flag.

## Demo Guide (Judging)

1. Start backend: `python backend/serial_reader.py`
2. Start frontend: `npx serve frontend -p 3000` (from project root)
3. Open `http://localhost:3000`
4. With or without Arduino, the dashboard updates every 1 second:
   - KPI cards show RRI, BSI, road condition, battery status
   - Red border alerts when BSI > 20 or road is ROUGH
   - Charts show rolling 20-point history
   - Map shows RRI color-coded path (green/yellow/red)
   - Route Energy Score = avg(RRI) × simulated distance

## Data Keys (Backend ↔ Frontend)

| Key | Type | Description |
|-----|------|-------------|
| timestamp | string | ISO-8601 UTC |
| rri | float | Road Roughness Index (0–1) |
| bsi | float | Battery Stress Index (%) |
| road_condition | string | SMOOTH / MODERATE / ROUGH |
| battery_status | string | NORMAL / ELEVATED / CRITICAL |

## License

MIT
