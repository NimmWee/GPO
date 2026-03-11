import { useEffect, useRef, useState } from "react";

export default function MapCanvas({ points, setPoints, route }) {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (route.length > 1) {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 3;
      ctx.beginPath();

      const first = points.find((point) => point.id === route[0]);
      if (first) {
        ctx.moveTo(first.x, first.y);

        for (let i = 1; i < route.length; i += 1) {
          const point = points.find((item) => item.id === route[i]);
          if (point) ctx.lineTo(point.x, point.y);
        }
      }

      ctx.stroke();
    }

    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#dc2626";
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = "14px Arial";
      ctx.fillText(point.id, point.x + 10, point.y - 10);
    });
  }, [points, route]);

  const handleClick = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const newId = String.fromCharCode(65 + points.length);

    setPoints([...points, { id: newId, x, y }]);
  };

  const handleMouseDown = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    points.forEach((point, index) => {
      const dx = mouseX - point.x;
      const dy = mouseY - point.y;
      if (Math.sqrt(dx * dx + dy * dy) < 10) setIsDragging(index);
    });
  };

  const handleMouseMove = (event) => {
    if (isDragging === null) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const nextPoints = [...points];
    nextPoints[isDragging].x = event.clientX - rect.left;
    nextPoints[isDragging].y = event.clientY - rect.top;
    setPoints(nextPoints);
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="border bg-white shadow"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(null)}
    />
  );
}
