export default class TelemetryClient {
  constructor(url, onMessage) {
    this.url = url;
    this.onMessage = onMessage;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("Telemetry WebSocket connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      } catch (e) {
        console.error("Telemetry parse error:", e);
      }
    };

    this.ws.onclose = () => {
      console.log("Telemetry WebSocket closed, reconnecting...");
      setTimeout(() => this.connect(), 1000);
    };
  }

  disconnect() {
    if (this.ws) this.ws.close();
  }
}
