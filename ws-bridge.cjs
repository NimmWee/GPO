const WebSocket = require("ws");

const TELEMETRY_PORT = 9001;
const ROUTE_PORT = 9002;
const ENABLE_MOCK_TELEMETRY = process.env.MOCK_TELEMETRY === "1";
const TELEMETRY_IDLE_MS = 2500;

// 9001: telemetry from controller -> broadcast to UI clients
const telemetryWss = new WebSocket.Server({ port: TELEMETRY_PORT });
const telemetryClients = new Set();
const telemetrySenders = new Set();

let telemetryCount = 0;
let lastRealTelemetryAt = 0;
let mockPhase = 0;

const broadcastTelemetry = (payload, exclude = null) => {
  for (const client of telemetryClients) {
    if (client === exclude) continue;
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
};

const buildMockTelemetry = () => {
  mockPhase += 0.2;
  const radius = 3.8;
  const x = radius * Math.cos(mockPhase);
  const y = radius * Math.sin(mockPhase);
  const z = 0;
  const yaw = mockPhase + Math.PI / 2;

  return {
    type: "telemetry",
    x,
    y,
    z,
    yaw,
  };
};

telemetryWss.on("connection", (ws) => {
  telemetryClients.add(ws);
  console.log("[telemetry] client connected");

  ws.on("message", (data) => {
    telemetrySenders.add(ws);
    lastRealTelemetryAt = Date.now();
    const text = typeof data === "string" ? data : data.toString();
    telemetryCount += 1;
    if (telemetryCount % 20 === 1) {
      console.log(`[telemetry] msg ${telemetryCount} size=${text.length}`);
    }
    // Broadcast any telemetry to all other clients
    broadcastTelemetry(text, ws);
  });

  ws.on("close", () => {
    telemetryClients.delete(ws);
    telemetrySenders.delete(ws);
    console.log("[telemetry] client disconnected");
  });
});

setInterval(() => {
  if (!ENABLE_MOCK_TELEMETRY) return;
  if (telemetryClients.size === 0) return;
  if (Date.now() - lastRealTelemetryAt < TELEMETRY_IDLE_MS) return;

  const payload = JSON.stringify(buildMockTelemetry());
  for (const client of telemetryClients) {
    if (telemetrySenders.has(client)) continue;
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}, 250);

// 9002: route from UI -> forward to controller
// UI should connect to ws://127.0.0.1:9002/ui
const routeWss = new WebSocket.Server({ port: ROUTE_PORT });
let controllerConn = null;
const uiRouteClients = new Set();

routeWss.on("connection", (ws, req) => {
  const url = req?.url || "/";
  const isUi = url.startsWith("/ui");
  if (isUi) uiRouteClients.add(ws);
  else controllerConn = ws;

  console.log(
    `[route] client connected (${isUi ? "ui" : "controller"})`
  );

  ws.on("message", (data) => {
    if (!isUi) return;
    const text = data.toString();
    if (controllerConn && controllerConn.readyState === WebSocket.OPEN) {
      controllerConn.send(text);
    } else {
      console.log("[route] controller not connected; route dropped");
    }
  });

  ws.on("close", () => {
    if (isUi) uiRouteClients.delete(ws);
    if (controllerConn === ws) controllerConn = null;
    console.log("[route] client disconnected");
  });
});

console.log(
  `[bridge] telemetry ws://127.0.0.1:${TELEMETRY_PORT}, route ws://127.0.0.1:${ROUTE_PORT}`
);
if (ENABLE_MOCK_TELEMETRY) {
  console.log("[bridge] mock telemetry is enabled (MOCK_TELEMETRY=1)");
}
