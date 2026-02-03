/**
 * GreenVision — Dashboard Logic
 * Polls Python API, updates KPIs, charts, and alerts.
 */

const API_URL = "http://127.0.0.1:5000/api/data";
const POLL_INTERVAL_MS = 1000;
const ROLLING_WINDOW = 20;

// State
let rriHistory = [];
let bsiHistory = [];
let lastData = null;
let chartRri = null;
let chartBsi = null;

// DOM refs
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const valueRri = document.getElementById("valueRri");
const valueBsi = document.getElementById("valueBsi");
const valueRoad = document.getElementById("valueRoad");
const valueBattery = document.getElementById("valueBattery");
const routeEnergyScore = document.getElementById("routeEnergyScore");
const kpiRri = document.getElementById("kpiRri");
const kpiBsi = document.getElementById("kpiBsi");
const kpiRoad = document.getElementById("kpiRoad");
const kpiBattery = document.getElementById("kpiBattery");

// Chart.js defaults
Chart.defaults.color = "#94a3b8";
Chart.defaults.borderColor = "rgba(148, 163, 184, 0.15)";
Chart.defaults.font.family = "'Inter', 'Roboto', sans-serif";

function setStatus(connected, mock = false) {
  statusDot.className = "status-dot" + (connected ? " connected" : " error");
  statusText.textContent = connected
    ? (mock ? "Mock mode (simulated)" : "Live")
    : "Disconnected";
}

function updateKpiCards(data) {
  if (!data) return;
  valueRri.textContent = data.rri != null ? data.rri.toFixed(2) : "—";
  valueBsi.textContent = data.bsi != null ? data.bsi.toFixed(1) : "—";
  valueRoad.textContent = data.road_condition || "—";
  valueBattery.textContent = data.battery_status || "—";

  // Dynamic alerts: BSI > 20 or ROAD_CONDITION == 'ROUGH'
  const alertBsi = data.bsi != null && data.bsi > 20;
  const alertRoad = (data.road_condition || "").toUpperCase() === "ROUGH";
  kpiBsi.classList.toggle("alert", alertBsi);
  kpiRoad.classList.toggle("alert", alertRoad);
}

function computeRouteEnergyScore() {
  if (rriHistory.length === 0) return 0;
  const avgRri = rriHistory.reduce((a, b) => a + b, 0) / rriHistory.length;
  const distance = getSimulatedDistance();
  return (avgRri * distance).toFixed(2);
}

function getSimulatedDistance() {
  return Math.max(1, rriHistory.length * 0.05);
}

function updateCharts() {
  const labels = Array.from({ length: rriHistory.length }, (_, i) => i.toString());

  if (chartRri) {
    chartRri.data.labels = labels;
    chartRri.data.datasets[0].data = rriHistory;
    chartRri.update("none");
  }

  if (chartBsi) {
    chartBsi.data.labels = labels;
    chartBsi.data.datasets[0].data = bsiHistory;
    chartBsi.update("none");
  }
}

function initCharts() {
  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: {
        min: 0,
        grid: { color: "rgba(148, 163, 184, 0.08)" },
      },
    },
  };

  chartRri = new Chart(document.getElementById("chartRri"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: { ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, max: 1 } } },
  });

  chartBsi = new Chart(document.getElementById("chartBsi"), {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: { ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, max: 30 } } },
  });
}

async function fetchData() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(res.statusText);
    const json = await res.json();
    setStatus(true, json.mock_mode || false);

    const data = json.data || [];
    if (data.length === 0) return;

    const latest = data[data.length - 1];
    lastData = {
      rri: latest.rri,
      bsi: latest.bsi,
      road_condition: latest.road_condition,
      battery_status: latest.battery_status,
    };

    updateKpiCards(lastData);

    rriHistory.push(latest.rri);
    bsiHistory.push(latest.bsi);
    if (rriHistory.length > ROLLING_WINDOW) rriHistory.shift();
    if (bsiHistory.length > ROLLING_WINDOW) bsiHistory.shift();

    updateCharts();
    routeEnergyScore.textContent = computeRouteEnergyScore();

    if (typeof updateMapPath === "function") {
      updateMapPath(latest.rri);
    }
  } catch (err) {
    setStatus(false);
    console.warn("API fetch failed:", err.message);
  }
}

function updateDashboard() {
  fetchData();
}

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  updateDashboard();
  setInterval(updateDashboard, POLL_INTERVAL_MS);
});
