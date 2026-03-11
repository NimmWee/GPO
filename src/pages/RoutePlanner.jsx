import { useEffect, useRef, useState } from "react";

export default function RoutePlanner() {
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [status, setStatus] = useState("");

  const mapScale = 200;
  const mapOffset = 250;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#DDD";
    ctx.beginPath();
    ctx.moveTo(mapOffset, 0);
    ctx.lineTo(mapOffset, canvas.height);
    ctx.moveTo(0, mapOffset);
    ctx.lineTo(canvas.width, mapOffset);
    ctx.stroke();

    points.forEach((point, index) => {
      const x = mapOffset + point.x * mapScale;
      const y = mapOffset - point.y * mapScale;
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "black";
      ctx.fillText(`#${index}`, x + 10, y - 10);
    });

    if (points.length > 1) {
      ctx.strokeStyle = "blue";
      ctx.beginPath();
      points.forEach((point, index) => {
        const x = mapOffset + point.x * mapScale;
        const y = mapOffset - point.y * mapScale;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }, [points]);

  const handleClick = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const x = (px - mapOffset) / mapScale;
    const y = (mapOffset - py) / mapScale;

    const newPoint = {
      x: parseFloat(x.toFixed(2)),
      y: parseFloat(y.toFixed(2)),
    };

    setPoints([...points, newPoint]);
    setStatus(`Добавлена точка x=${newPoint.x}, y=${newPoint.y}`);
  };

  const sendRoute = async () => {
    if (points.length === 0) {
      setStatus("Сначала поставьте точки.");
      return;
    }

    try {
      const response = await fetch("http://localhost:8080/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: points }),
      });

      await response.json();
      setStatus("Маршрут отправлен в Webots.");
    } catch (error) {
      console.error(error);
      setStatus("Ошибка отправки маршрута.");
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Маршрутный планировщик</h1>
      <p className="mb-2 text-gray-600">Кликните по карте, чтобы поставить точки.</p>

      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        onClick={handleClick}
        className="border shadow mb-4"
        style={{ background: "white" }}
      />

      <div className="flex gap-4">
        <button onClick={sendRoute} className="px-4 py-2 bg-blue-600 text-white rounded">
          Отправить маршрут в Webots
        </button>
        <button
          onClick={() => {
            setPoints([]);
            setStatus("Маршрут очищен.");
          }}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Очистить
        </button>
      </div>

      <p className="mt-4 text-blue-700">{status}</p>

      {points.length > 0 && (
        <div className="mt-4 p-2 bg-gray-100 rounded">
          <h2 className="font-semibold mb-2">Точки маршрута:</h2>
          {points.map((point, index) => (
            <p key={index}>
              #{index}: x={point.x}, y={point.y}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
