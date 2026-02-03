/**
 * GreenVision — Leaflet Map & Path Logic
 * RRI-based color-coded polyline (Green/Yellow/Red).
 * Simulated lat/lng progression when no GPS.
 */

let map = null;
let pathLayer = null;
let pathPoints = [];
const BASE_LAT = 6.9271;
const BASE_LNG = 79.8612;
const STEP = 0.00015;

function getRriColor(rri) {
  if (rri == null || isNaN(rri)) return "#94a3b8";
  if (rri < 0.4) return "#22c55e";
  if (rri < 0.6) return "#eab308";
  return "#ef4444";
}

function simulateNextPoint(rri) {
  const last = pathPoints[pathPoints.length - 1];
  let lat, lng;
  if (!last) {
    lat = BASE_LAT;
    lng = BASE_LNG;
  } else {
    lat = last.lat + (Math.random() - 0.5) * STEP * 2;
    lng = last.lng + STEP * (0.8 + Math.random() * 0.4);
  }
  return { lat, lng, rri };
}

function initMap() {
  if (map) return;
  map = L.map("map", {
    zoomControl: true,
  }).setView([BASE_LAT, BASE_LNG], 15);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(map);

  pathLayer = L.layerGroup().addTo(map);
}

function updateMapPath(rri) {
  if (!map) initMap();
  if (rri == null || isNaN(rri)) return;

  const pt = simulateNextPoint(rri);
  pathPoints.push(pt);

  const maxPoints = 100;
  if (pathPoints.length > maxPoints) pathPoints.shift();

  pathLayer.clearLayers();

  if (pathPoints.length < 2) return;

  const segments = [];
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const a = pathPoints[i];
    const b = pathPoints[i + 1];
    const color = getRriColor(b.rri);
    const line = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
      color,
      weight: 5,
      opacity: 0.9,
    });
    line.bindTooltip(`RRI: ${(b.rri || 0).toFixed(2)}`, {
      permanent: false,
      direction: "top",
      className: "greenvision-tooltip",
    });
    segments.push(line);
  }

  segments.forEach((line) => pathLayer.addLayer(line));

  const last = pathPoints[pathPoints.length - 1];
  L.marker([last.lat, last.lng], {
    icon: L.divIcon({
      className: "path-marker",
      html: '<div style="width:12px;height:12px;border-radius:50%;background:#38bdf8;border:2px solid #fff;"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    }),
  }).addTo(pathLayer);

  map.fitBounds(pathLayer.getBounds(), { padding: [20, 20] });
}

document.addEventListener("DOMContentLoaded", initMap);
