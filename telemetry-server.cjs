const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 9001 });

console.log("Mock telemetry server running on ws://localhost:9001");

setInterval(() => {
  const data = {
    position: { x: Math.random() * 5, y: 0, z: Math.random() * 5 },
    rotation: { yaw: Math.random() * Math.PI },
    velocity: Math.random(),
    sensors: {
      lidar: [
        Math.random().toFixed(2),
        Math.random().toFixed(2),
        Math.random().toFixed(2)
      ],
      touch: Math.random() > 0.5
    }
  };

  wss.clients.forEach((client) => {
    client.send(JSON.stringify(data));
  });
}, 500);
