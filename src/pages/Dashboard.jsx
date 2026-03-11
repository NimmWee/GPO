import { useEffect, useRef, useState } from "react";
import {
  ALGORITHM_OPTIONS,
  getAlgorithmFields,
  getAlgorithmLabel,
  getDefaultAlgorithmParams,
  getTaskLabel,
  optimizeRouteWithAlgorithm,
  TASK_OPTIONS,
} from "../lib/routeAlgorithms";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_POINT_TASK,
  POINT_KIND_META,
  POINT_KIND_OPTIONS,
  POINT_TASKS,
  buildObstacleAwareRoute,
  canvasToWorld,
  dist,
  drawDiamond,
  drawPlannerBackground,
  getZoneColor,
  isInsideMap,
  pointInAnyPolygon,
  projectPointOutsidePolygons,
  routeCrossesAnyLimitPolygon,
  sanitizeRouteForController,
  worldToCanvas,
} from "../lib/zonePlanner";

const TELEMETRY_WS_URL = "ws://127.0.0.1:9001";
const ROUTE_WS_URL = "ws://127.0.0.1:9002/ui";
const INITIAL_ZONE = { id: "zone-1", name: "Зона 1", closed: false };
const DRAG_HIT_RADIUS = 14;

const toFiniteNumber = (value) => {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const pickNumber = (...values) => {
  for (const value of values) {
    const n = toFiniteNumber(value);
    if (n !== null) return n;
  }
  return null;
};

const normalizeTelemetry = (raw, prev) => {
  if (!raw || typeof raw !== "object") return null;

  const x = pickNumber(raw.x, raw.position?.x, raw.pose?.x);
  const y = pickNumber(raw.y, raw.position?.y, raw.position?.z, raw.pose?.y);
  const z = pickNumber(raw.z, raw.position?.z, raw.pose?.z, prev.z, 0);
  const yaw = pickNumber(
    raw.yaw,
    raw.rotation?.yaw,
    raw.pose?.yaw,
    raw.heading,
    prev.yaw,
    0
  );

  if (x === null || y === null) return null;
  return { x, y, z, yaw };
};

const normalizeAngle = (value) => {
  let angle = value;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
};

const decodeWsData = async (data) => {
  if (typeof data === "string") return data;
  if (data instanceof Blob) return data.text();
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  return String(data);
};

export default function Dashboard() {
  const canvasRef = useRef(null);
  const routeWsRef = useRef(null);
  const dragStateRef = useRef({ pointIndex: null, moved: false, preventClick: false });
  const telemetryTargetRef = useRef({ x: 0, y: 0, z: 0, yaw: 0 });
  const telemetryRenderRef = useRef({ x: 0, y: 0, z: 0, yaw: 0 });
  const drawStateRef = useRef({
    visitEntries: [],
    plannedVisitEntries: [],
    zoneEntries: [],
    optimizedRoute: [],
    routeBlocked: false,
    hoveredPointIndex: null,
  });

  const [points, setPoints] = useState([]);
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [status, setStatus] = useState("");
  const [expandedPoint, setExpandedPoint] = useState(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null);
  const [telemetryWsUp, setTelemetryWsUp] = useState(false);
  const [routeWsUp, setRouteWsUp] = useState(false);
  const [telemetry, setTelemetry] = useState({ x: 0, y: 0, z: 0, yaw: 0 });
  const [routeTaskKey, setRouteTaskKey] = useState("tsp");
  const [algorithmKey, setAlgorithmKey] = useState("aco");
  const [activePointKind, setActivePointKind] = useState("visit");
  const [limitZones, setLimitZones] = useState([INITIAL_ZONE]);
  const [activeLimitZoneId, setActiveLimitZoneId] = useState(INITIAL_ZONE.id);
  const [nextZoneNumber, setNextZoneNumber] = useState(2);
  const [algorithmParams, setAlgorithmParams] = useState(() =>
    Object.fromEntries(
      ALGORITHM_OPTIONS.map((option) => [
        option.key,
        getDefaultAlgorithmParams(option.key),
      ])
    )
  );

  const visitEntries = [];
  const zoneEntries = limitZones.map((zone, zoneIndex) => ({
    ...zone,
    zoneIndex,
    color: getZoneColor(zoneIndex),
    points: [],
  }));
  const zoneLookup = new Map(zoneEntries.map((zone) => [zone.id, zone]));

  points.forEach((point, index) => {
    if (point.kind === "visit") {
      visitEntries.push({
        point,
        index,
        order: visitEntries.length + 1,
      });
      return;
    }

    const zone = zoneLookup.get(point.zoneId) || zoneEntries[0];
    if (!zone) return;
    zone.points.push({
      point,
      index,
      order: zone.points.length + 1,
    });
  });

  const polygons = zoneEntries
    .filter((zone) => zone.closed && zone.points.length >= 3)
    .map((zone) => ({
      id: zone.id,
      name: zone.name,
      zoneIndex: zone.zoneIndex,
      color: zone.color,
      points: zone.points.map((entry) => ({ x: entry.point.x, y: entry.point.y })),
    }));
  const plannedVisitEntries = visitEntries.map((entry) => {
    const projection = projectPointOutsidePolygons(entry.point, polygons);
    return {
      ...entry,
      plannedPoint: projection.point,
      adjusted: projection.adjusted,
    };
  });
  const visitPoints = plannedVisitEntries.map((entry) => entry.plannedPoint);
  const visitsInsideLimit = plannedVisitEntries.filter((entry) =>
    pointInAnyPolygon(entry.point, polygons)
  );
  const adjustedVisits = plannedVisitEntries.filter((entry) => entry.adjusted);
  const routeBlocked =
    optimizedRoute.length > 1 && routeCrossesAnyLimitPolygon(optimizedRoute, polygons);
  const routeLength = optimizedRoute.reduce(
    (sum, point, index, route) => (index ? sum + dist(route[index - 1], point) : 0),
    0
  );
  const algorithmFields = getAlgorithmFields(algorithmKey);
  const selectedAlgorithmParams =
    algorithmParams[algorithmKey] || getDefaultAlgorithmParams(algorithmKey);
  const activeZoneName =
    zoneEntries.find((zone) => zone.id === activeLimitZoneId)?.name || "Зона";

  useEffect(() => {
    const nextVisitEntries = [];
    const nextPlannedVisitEntries = [];
    const nextZoneEntries = limitZones.map((zone, zoneIndex) => ({
      ...zone,
      zoneIndex,
      color: getZoneColor(zoneIndex),
      points: [],
    }));
    const zoneMap = new Map(nextZoneEntries.map((zone) => [zone.id, zone]));

    points.forEach((point, index) => {
      if (point.kind === "visit") {
        const entry = {
          point,
          index,
          order: nextVisitEntries.length + 1,
        };
        nextVisitEntries.push(entry);
        return;
      }

      const zone = zoneMap.get(point.zoneId) || nextZoneEntries[0];
      if (!zone) return;
      zone.points.push({
        point,
        index,
        order: zone.points.length + 1,
      });
    });

    const nextPolygons = nextZoneEntries
      .filter((zone) => zone.closed && zone.points.length >= 3)
      .map((zone) => ({
        id: zone.id,
        name: zone.name,
        zoneIndex: zone.zoneIndex,
        color: zone.color,
        points: zone.points.map((entry) => ({ x: entry.point.x, y: entry.point.y })),
      }));

    nextVisitEntries.forEach((entry) => {
      const projection = projectPointOutsidePolygons(entry.point, nextPolygons);
      nextPlannedVisitEntries.push({
        ...entry,
        plannedPoint: projection.point,
        adjusted: projection.adjusted,
      });
    });

    drawStateRef.current = {
      visitEntries: nextVisitEntries,
      plannedVisitEntries: nextPlannedVisitEntries,
      zoneEntries: nextZoneEntries,
      optimizedRoute,
      routeBlocked,
      hoveredPointIndex,
    };
  }, [hoveredPointIndex, limitZones, optimizedRoute, points, routeBlocked]);

  useEffect(() => {
    let closed = false;
    let ws = null;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(TELEMETRY_WS_URL);
      ws.onopen = () => setTelemetryWsUp(true);
      ws.onmessage = async (message) => {
        try {
          const payload = JSON.parse(await decodeWsData(message.data));
          setTelemetry((prev) => {
            const normalized = normalizeTelemetry(payload, prev);
            if (!normalized) return prev;
            telemetryTargetRef.current = normalized;
            return normalized;
          });
        } catch {
          // Ignore malformed payloads.
        }
      };
      ws.onclose = () => {
        setTelemetryWsUp(false);
        if (!closed) setTimeout(connect, 1000);
      };
      ws.onerror = () => setTelemetryWsUp(false);
    };

    connect();
    return () => {
      closed = true;
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    let closed = false;

    const connect = () => {
      if (closed) return;
      const ws = new WebSocket(ROUTE_WS_URL);
      routeWsRef.current = ws;
      ws.onopen = () => setRouteWsUp(true);
      ws.onclose = () => {
        setRouteWsUp(false);
        routeWsRef.current = null;
        if (!closed) setTimeout(connect, 1000);
      };
      ws.onerror = () => setRouteWsUp(false);
    };

    connect();
    return () => {
      closed = true;
      setRouteWsUp(false);
      if (routeWsRef.current) routeWsRef.current.close();
    };
  }, []);

  useEffect(() => {
    let raf = 0;

    const loop = () => {
      if (!canvasRef.current) {
        raf = window.requestAnimationFrame(loop);
        return;
      }

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) {
        raf = window.requestAnimationFrame(loop);
        return;
      }

      const target = telemetryTargetRef.current;
      const current = telemetryRenderRef.current;
      const state = drawStateRef.current;
      const plannedMap = new Map(
        state.plannedVisitEntries.map((entry) => [entry.index, entry])
      );
      const hoveredPointIndex = state.hoveredPointIndex;
      const alpha = 0.35;

      current.x += (target.x - current.x) * alpha;
      current.y += (target.y - current.y) * alpha;
      current.z += (target.z - current.z) * alpha;
      current.yaw += normalizeAngle(target.yaw - current.yaw) * alpha;

      drawPlannerBackground(ctx);

      state.zoneEntries.forEach((zone) => {
        if (zone.points.length > 1) {
          ctx.setLineDash([10, 8]);
          ctx.strokeStyle = zone.color.stroke;
          ctx.lineWidth = 3;
          ctx.beginPath();

          zone.points.forEach((entry, index) => {
            const point = worldToCanvas(entry.point.x, entry.point.y);
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          });

          if (zone.closed && zone.points.length >= 3) {
            const first = worldToCanvas(zone.points[0].point.x, zone.points[0].point.y);
            ctx.lineTo(first.x, first.y);
            ctx.fillStyle = zone.color.fill;
            ctx.fill();
          }

          ctx.stroke();
          ctx.setLineDash([]);
        }

        zone.points.forEach((entry) => {
          const point = worldToCanvas(entry.point.x, entry.point.y);
          ctx.fillStyle = zone.color.stroke;
          drawDiamond(ctx, point.x, point.y, 12);
          ctx.fill();
          ctx.strokeStyle = "#eff6ff";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = "700 10px 'Segoe UI', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${zone.zoneIndex + 1}.${entry.order}`, point.x, point.y);
        });

        if (zone.points.length) {
          const anchor = worldToCanvas(zone.points[0].point.x, zone.points[0].point.y);
          ctx.fillStyle = zone.color.stroke;
          ctx.font = "700 11px 'Segoe UI', sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.fillText(zone.closed ? `${zone.name} (замкнута)` : `${zone.name} (открыта)`, anchor.x + 14, anchor.y - 10);
        }
      });

      if (state.optimizedRoute.length > 1) {
        ctx.strokeStyle = state.routeBlocked ? "#dc2626" : "#0f766e";
        ctx.lineWidth = 5;
        ctx.beginPath();
        state.optimizedRoute.forEach((point, index) => {
          const currentPoint = worldToCanvas(point.x, point.y);
          if (index === 0) ctx.moveTo(currentPoint.x, currentPoint.y);
          else ctx.lineTo(currentPoint.x, currentPoint.y);
        });
        ctx.stroke();
      }

      state.visitEntries.forEach((entry) => {
        const plannedEntry = plannedMap.get(entry.index);
        const point = worldToCanvas(entry.point.x, entry.point.y);
        const hovered = hoveredPointIndex === entry.index;

        if (plannedEntry?.adjusted) {
          const projected = worldToCanvas(
            plannedEntry.plannedPoint.x,
            plannedEntry.plannedPoint.y
          );
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(projected.x, projected.y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "#f59e0b";
          ctx.beginPath();
          ctx.arc(projected.x, projected.y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = "#92400e";
          ctx.font = "700 11px 'Segoe UI', sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.fillText(`V${entry.order} -> S${entry.order}`, projected.x + 12, projected.y - 8);

          if (hovered) {
            ctx.strokeStyle = "rgba(245, 158, 11, 0.9)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(projected.x, projected.y, 14, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        if (hovered) {
          ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 18, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = "#1d4ed8";
          ctx.font = "700 11px 'Segoe UI', sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.fillText(`V${entry.order}`, point.x + 14, point.y - 12);
        }

        ctx.fillStyle = POINT_KIND_META.visit.color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "700 12px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
        ctx.strokeText(String(entry.order), point.x, point.y);
        ctx.fillStyle = "#fff";
        ctx.fillText(String(entry.order), point.x, point.y);
      });

      const robot = worldToCanvas(current.x, current.y);
      ctx.fillStyle = "#16a34a";
      ctx.beginPath();
      ctx.arc(robot.x, robot.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(robot.x, robot.y);
      ctx.lineTo(robot.x + Math.cos(current.yaw) * 24, robot.y - Math.sin(current.yaw) * 24);
      ctx.stroke();

      raf = window.requestAnimationFrame(loop);
    };

    loop();
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const resetZones = () => {
    setLimitZones([INITIAL_ZONE]);
    setActiveLimitZoneId(INITIAL_ZONE.id);
    setNextZoneNumber(2);
  };

  const createZone = () => {
    const zone = { id: `zone-${nextZoneNumber}`, name: `Зона ${nextZoneNumber}`, closed: false };
    setLimitZones((prev) => [...prev, zone]);
    setActiveLimitZoneId(zone.id);
    setNextZoneNumber((prev) => prev + 1);
    setActivePointKind("limit");
    setStatus(`Создана ${zone.name}.`);
  };

  const toggleZoneClosed = (zoneId) => {
    const target = zoneEntries.find((zone) => zone.id === zoneId);
    if (!target) return;

    if (!target.closed && target.points.length < 3) {
      setStatus("Чтобы замкнуть зону, нужно минимум три точки.");
      return;
    }

    setLimitZones((prev) =>
      prev.map((zone) =>
        zone.id === zoneId ? { ...zone, closed: !zone.closed } : zone
      )
    );
    setOptimizedRoute([]);
    setStatus(
      target.closed ? `${target.name} открыта для редактирования.` : `${target.name} замкнута.`
    );
  };

  const clearZone = (zoneId) => {
    setPoints((prev) => prev.filter((point) => point.kind !== "limit" || point.zoneId !== zoneId));
    setLimitZones((prev) =>
      prev.map((zone) => (zone.id === zoneId ? { ...zone, closed: false } : zone))
    );
    setOptimizedRoute([]);
    setStatus("Точки выбранной зоны очищены.");
  };

  const removeZone = (zoneId) => {
    if (limitZones.length === 1) {
      clearZone(zoneId);
      return;
    }

    const nextZones = limitZones.filter((zone) => zone.id !== zoneId);
    setLimitZones(nextZones);
    setPoints((prev) => prev.filter((point) => point.kind !== "limit" || point.zoneId !== zoneId));
    if (activeLimitZoneId === zoneId) setActiveLimitZoneId(nextZones[0].id);
    setOptimizedRoute([]);
    setStatus("Ограничивающая зона удалена.");
  };

  const updateAlgorithmParam = (field, rawValue) => {
    const parsed = field.integer ? parseInt(rawValue, 10) : parseFloat(rawValue);
    if (!Number.isFinite(parsed)) return;

    setAlgorithmParams((prev) => ({
      ...prev,
      [algorithmKey]: {
        ...getDefaultAlgorithmParams(algorithmKey),
        ...prev[algorithmKey],
        [field.key]: parsed,
      },
    }));
    setOptimizedRoute([]);
  };

  const getPointIndexAtCanvasPosition = (canvasX, canvasY) => {
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      const rendered = worldToCanvas(point.x, point.y);
      if (Math.hypot(rendered.x - canvasX, rendered.y - canvasY) <= DRAG_HIT_RADIUS) {
        return index;
      }
    }

    return -1;
  };

  const movePoint = (pointIndex, nextPoint) => {
    if (!isInsideMap(nextPoint)) return false;

    const currentPoint = points[pointIndex];
    if (!currentPoint) return false;

    setPoints((prev) =>
      prev.map((point, index) =>
        index === pointIndex ? { ...point, x: nextPoint.x, y: nextPoint.y } : point
      )
    );
    setOptimizedRoute([]);
    return true;
  };

  const handleCanvasMouseDown = (event) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const pointIndex = getPointIndexAtCanvasPosition(canvasX, canvasY);

    if (pointIndex < 0) return;

    dragStateRef.current = {
      pointIndex,
      moved: false,
      preventClick: false,
    };
  };

  const handleCanvasMouseMove = (event) => {
    if (!canvasRef.current) return;
    const { pointIndex } = dragStateRef.current;
    if (pointIndex === null) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const nextPoint = canvasToWorld(event.clientX - rect.left, event.clientY - rect.top);
    const moved = movePoint(pointIndex, nextPoint);
    if (moved) dragStateRef.current.moved = true;
  };

  const finishDragging = () => {
    const { pointIndex } = dragStateRef.current;
    if (pointIndex === null) return;

    dragStateRef.current = {
      pointIndex: null,
      moved: false,
      preventClick: true,
    };
  };

  const addPointFromCanvas = (event) => {
    if (!canvasRef.current) return;

    if (dragStateRef.current.preventClick) {
      dragStateRef.current.preventClick = false;
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const point = canvasToWorld(event.clientX - rect.left, event.clientY - rect.top);

    if (!isInsideMap(point)) {
      setStatus("Кликните внутри старой карты.");
      return;
    }

    if (activePointKind === "limit") {
      const activeZone = zoneEntries.find((zone) => zone.id === activeLimitZoneId);
      if (activeZone?.closed) {
        setStatus("Зона уже замкнута. Нажмите «Открыть», чтобы добавить или поправить точки.");
        return;
      }
    }

    setPoints((prev) => [
      ...prev,
      {
        ...point,
        kind: activePointKind,
        zoneId: activePointKind === "limit" ? activeLimitZoneId : null,
        task: activePointKind === "visit" ? DEFAULT_POINT_TASK : null,
      },
    ]);
    setExpandedPoint(null);
    setOptimizedRoute([]);
    setStatus(
      activePointKind === "visit"
        ? "Добавлена точка для посещения."
        : `Добавлена точка в ${activeZoneName}.`
    );
  };

  const clearPoints = (kind = null) => {
    if (kind === "limit") resetZones();
    setPoints((prev) => (kind ? prev.filter((point) => point.kind !== kind) : []));
    setExpandedPoint(null);
    setOptimizedRoute([]);
    setStatus(
      kind === "visit"
        ? "Точки маршрута очищены."
        : kind === "limit"
          ? "Все ограничивающие зоны очищены."
          : "Все точки очищены."
    );
  };

  const deletePoint = (index) => {
    setPoints((prev) => prev.filter((_, pointIndex) => pointIndex !== index));
    setExpandedPoint(null);
    setOptimizedRoute([]);
  };

  const updatePointTask = (index, task) => {
    setPoints((prev) =>
      prev.map((point, pointIndex) => (pointIndex === index ? { ...point, task } : point))
    );
    setOptimizedRoute([]);
  };

  const optimizeRoute = () => {
    if (visitPoints.length < 2) {
      setStatus("Добавьте хотя бы две точки для посещения.");
      return;
    }

    try {
      const rawRoute = optimizeRouteWithAlgorithm(
        visitPoints,
        algorithmKey,
        selectedAlgorithmParams,
        routeTaskKey
      );
      const routed = buildObstacleAwareRoute(rawRoute, polygons);

      if (!routed) {
        setOptimizedRoute([]);
        setStatus("Не удалось построить обход вокруг ограничивающих зон.");
        return;
      }

      const blocked = routeCrossesAnyLimitPolygon(routed, polygons);
      setOptimizedRoute(routed);
      setStatus(
        blocked
          ? "Маршрут построен, но все еще пересекает ограничивающий контур."
          : adjustedVisits.length
            ? `Маршрут построен: ${getTaskLabel(routeTaskKey)} (${getAlgorithmLabel(algorithmKey)}). ${adjustedVisits.length} точек автоматически сдвинуты к ближайшей безопасной позиции.`
            : `Маршрут построен: ${getTaskLabel(routeTaskKey)} (${getAlgorithmLabel(algorithmKey)}).`
      );
    } catch {
      setStatus("Не удалось построить маршрут.");
    }
  };

  const sendRoute = () => {
    if (!optimizedRoute.length) {
      setStatus("Сначала постройте маршрут.");
      return;
    }

    if (routeBlocked) {
      setStatus("Маршрут все еще пересекает ограничивающий контур.");
      return;
    }

    const routeForController = sanitizeRouteForController(optimizedRoute, routeTaskKey);
    if (routeForController.length < 2) {
      setStatus("Маршрут слишком короткий после очистки.");
      return;
    }

    const payload = {
      type: "route",
      algorithm: { key: algorithmKey, task: routeTaskKey, params: selectedAlgorithmParams },
      route: routeForController.map((point) => ({ x: point.x, y: point.y })),
    };

    const sendPayload = (socket) => {
      socket.send(JSON.stringify(payload));
      setStatus(`Маршрут отправлен (${routeForController.length} точек).`);
    };

    const ws = routeWsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      const temp = new WebSocket(ROUTE_WS_URL);
      routeWsRef.current = temp;
      temp.onopen = () => {
        setRouteWsUp(true);
        sendPayload(temp);
      };
      temp.onclose = () => setRouteWsUp(false);
      temp.onerror = () => {
        setRouteWsUp(false);
        setStatus("Ошибка соединения с маршрутом.");
      };
      return;
    }

    sendPayload(ws);
  };

  const cardCls = "rounded-2xl bg-white/90 backdrop-blur border border-stone-200 shadow-sm p-4";
  const inputCls = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm";
  const selectCls = "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm";
  const rowCls = "flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 cursor-pointer";
  const zonePanelCardCls = "rounded-[26px] bg-white/96 backdrop-blur border border-sky-100 shadow-[0_18px_50px_rgba(125,211,252,0.18)] p-4";
  const zoneCardBaseCls = "rounded-2xl border p-3 bg-white shadow-sm";

  return (
    <div className="flex h-screen bg-stone-100 text-stone-900">
      <aside className="w-[360px] p-5 overflow-auto border-r border-stone-200 bg-gradient-to-b from-stone-50 via-slate-50 to-stone-100 space-y-4">
        <div className={cardCls}>
          <div className="text-[11px] uppercase tracking-[0.22em] text-stone-500 mb-2">Старая карта</div>
          <h2 className="text-2xl font-bold leading-tight">Маршрутный планировщик на координатной сетке</h2>
          <p className="mt-2 text-sm text-stone-600">
            Карта снова нейтральная, как раньше. Теперь можно создавать несколько
            отдельных ограничивающих зон, замыкать их кнопкой и перетаскивать точки
            мышкой прямо на холсте. Если точка посещения оказалась внутри замкнутой зоны,
            маршрут автоматически переносит посещение к ближайшей безопасной точке снаружи.
          </p>
        </div>

        <div className={cardCls}>
          <div className="text-xs text-stone-600 mb-2">Режим добавления точки</div>
          <div className="grid grid-cols-2 gap-2">
            {POINT_KIND_OPTIONS.map((option) => {
              const active = activePointKind === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => setActivePointKind(option.key)}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? `${option.border} ${option.bg} shadow-sm`
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <div className={`text-xs uppercase tracking-[0.2em] ${active ? option.text : "text-stone-400"}`}>
                    {option.shortLabel}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{option.label}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <button onClick={() => clearPoints("visit")} className="rounded-xl border border-stone-200 bg-white px-3 py-2 hover:bg-stone-50">
              Очистить маршрутные
            </button>
            <button onClick={() => clearPoints("limit")} className="rounded-xl border border-stone-200 bg-white px-3 py-2 hover:bg-stone-50">
              Очистить зоны
            </button>
          </div>
        </div>

        <div className={cardCls}>
          <div className="text-xs text-stone-600 mb-1">Задача маршрута</div>
          <select className={selectCls} value={routeTaskKey} onChange={(event) => {
            setRouteTaskKey(event.target.value);
            setOptimizedRoute([]);
            setStatus("");
          }}>
            {TASK_OPTIONS.map((task) => (
              <option key={task.key} value={task.key}>{task.label}</option>
            ))}
          </select>
          <div className="text-xs text-stone-600 mt-3 mb-1">Алгоритм</div>
          <select className={selectCls} value={algorithmKey} onChange={(event) => {
            setAlgorithmKey(event.target.value);
            setOptimizedRoute([]);
            setStatus("");
          }}>
            {ALGORITHM_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
          {status && (
            <div className={`mt-3 text-sm ${routeBlocked ? "text-rose-700" : "text-emerald-700"}`}>
              {status}
            </div>
          )}
        </div>

        <div className={cardCls}>
          <h3 className="text-sm font-semibold mb-3">Параметры алгоритма</h3>
          <div className="space-y-3">
            {algorithmFields.map((field) => (
              <label key={field.key}>
                <div className="text-xs text-stone-600 mb-1">{field.label}</div>
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={selectedAlgorithmParams[field.key]}
                  className={inputCls}
                  onChange={(event) => updateAlgorithmParam(field, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className={cardCls}>
          <button onClick={optimizeRoute} className="w-full h-11 rounded-xl bg-orange-600 text-white font-semibold hover:bg-orange-700 transition">
            Построить маршрут
          </button>
          <button onClick={sendRoute} className="mt-2 w-full h-11 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition">
            Отправить маршрут
          </button>
          <button onClick={() => clearPoints()} className="mt-2 w-full h-11 rounded-xl border border-stone-200 bg-white font-semibold hover:bg-stone-50 transition">
            Очистить всё
          </button>
          {optimizedRoute.length > 0 && (
            <p className="mt-3 text-sm">
              Длина маршрута: <b>{routeLength.toFixed(2)} м</b>
            </p>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-stone-200 p-5">
        <div className="max-w-[980px] mx-auto">
          <div className="relative rounded-[28px] border border-stone-300 bg-white/80 shadow-xl p-4">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onClick={addPointFromCanvas}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={finishDragging}
              onMouseLeave={finishDragging}
              className="w-full h-auto rounded-[24px] border border-stone-200 bg-stone-100 cursor-crosshair"
            />
            <div className="absolute left-8 bottom-8 rounded-2xl bg-white/88 backdrop-blur border border-stone-200 px-4 py-3 text-xs text-stone-700 shadow-sm space-y-2">
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-rose-600" />Точки для посещения</div>
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rotate-45 bg-blue-600" />Активная ограничивающая зона</div>
            <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full bg-amber-500" />Автосдвинутая безопасная точка</div>
            <div className="flex items-center gap-2"><span className={`inline-block w-7 h-[3px] rounded-full ${routeBlocked ? "bg-rose-600" : "bg-teal-700"}`} />{routeBlocked ? "Маршрут задевает ограничение" : "Маршрут с обходом зон"}</div>
          </div>
          <div className="absolute right-8 top-8 rounded-2xl bg-white/88 backdrop-blur border border-stone-200 px-4 py-3 text-xs text-stone-700 shadow-sm space-y-1">
            <div>Маршрутных точек: {visitEntries.length}</div>
            <div>Запретных зон: {limitZones.length}</div>
            <div>Готовых контуров: {polygons.length}</div>
            <div>Автосдвинутых точек: {adjustedVisits.length}</div>
            <div>Активная зона: {activeZoneName}</div>
          </div>
          </div>
        </div>
      </main>

      <aside className="w-[400px] p-5 overflow-auto border-l border-sky-100 bg-gradient-to-b from-sky-50 via-white to-cyan-50 space-y-4">
        <div className={zonePanelCardCls}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-sky-700">Активная зона</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{activeZoneName}</div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>{zoneEntries.find((zone) => zone.id === activeLimitZoneId)?.closed ? "Замкнута" : "Открыта"}</div>
              <div className="mt-1">
                Точек: {zoneEntries.find((zone) => zone.id === activeLimitZoneId)?.points.length || 0}
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-600 space-y-1">
            <div>В открытую зону можно добавлять и двигать точки.</div>
            <div>Замкнутая зона участвует в обходе маршрута.</div>
            <div>Если точка посещения попала внутрь, маршрут вынесет ее к ближайшей безопасной позиции.</div>
          </div>
        </div>

        <div className={zonePanelCardCls}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Ограничивающие зоны</h3>
              <div className="mt-1 text-xs text-slate-500">Светлая панель управления контурами и их статусами</div>
            </div>
            <button onClick={createZone} className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700">
              Новая зона
            </button>
          </div>
          <div className="space-y-2">
            {zoneEntries.map((zone) => {
              const active = zone.id === activeLimitZoneId;
              return (
                <div
                  key={zone.id}
                  className={`${zoneCardBaseCls} ${active ? "border-sky-300 bg-gradient-to-br from-sky-50 to-white" : "border-sky-100 bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button className="flex-1 text-left min-w-0" onClick={() => {
                      setActiveLimitZoneId(zone.id);
                      setActivePointKind("limit");
                    }}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-3 h-3 rounded-full ${zone.color.badge}`} />
                        <span className="text-sm font-semibold text-slate-900">{zone.name}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          zone.closed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}>
                          {zone.closed ? "Замкнута" : "Открыта"}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <div>Точек: {zone.points.length}</div>
                        <div>{zone.points.length >= 3 ? "Контур готов" : "Нужно 3 точки"}</div>
                      </div>
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => toggleZoneClosed(zone.id)} className="rounded-md border border-sky-200 px-2 py-1 text-[11px] text-sky-700 hover:bg-sky-50">
                        {zone.closed ? "Открыть" : "Замкнуть"}
                      </button>
                      <button onClick={() => clearZone(zone.id)} className="rounded-md border border-stone-200 px-2 py-1 text-[11px] hover:bg-stone-50">
                        Очистить
                      </button>
                      <button onClick={() => removeZone(zone.id)} className="rounded-md border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50">
                        Удалить
                      </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={zonePanelCardCls}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold">Точки для посещения</h3>
            <span className="text-xs text-stone-500">{visitEntries.length} шт.</span>
          </div>
          <div className="space-y-2">
            {visitEntries.map((entry) => {
              const expanded = expandedPoint === entry.index;
              const hovered = hoveredPointIndex === entry.index;
              const plannedEntry = plannedVisitEntries.find((item) => item.index === entry.index);
              return (
                <div key={entry.index}>
                  <div
                    className={`${rowCls} ${hovered ? "border-sky-300 bg-sky-50 shadow-sm" : ""}`}
                    onClick={() => setExpandedPoint(expanded ? null : entry.index)}
                    onMouseEnter={() => setHoveredPointIndex(entry.index)}
                    onMouseLeave={() => setHoveredPointIndex((current) => (current === entry.index ? null : current))}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        V{entry.order} ({entry.point.x.toFixed(2)}, {entry.point.y.toFixed(2)})
                      </div>
                      <div className="inline-flex mt-1 px-2 py-0.5 rounded-full border text-[11px] bg-rose-50 border-rose-200 text-rose-700">
                        {POINT_KIND_META.visit.label}
                      </div>
                      {plannedEntry?.adjusted && (
                        <div className="inline-flex mt-1 ml-2 px-2 py-0.5 rounded-full border text-[11px] bg-amber-50 border-amber-200 text-amber-700">
                          Автосдвиг
                        </div>
                      )}
                    </div>
                    <button onClick={(event) => {
                      event.stopPropagation();
                      deletePoint(entry.index);
                    }} className="flex items-center justify-center w-7 h-7 rounded-md border border-red-300 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white transition">
                      x
                    </button>
                  </div>
                  {expanded && (
                    <div className="mt-2 ml-2 p-3 rounded-xl border border-stone-200 bg-white space-y-2">
                      <div className="text-sm">x: {entry.point.x.toFixed(4)}, y: {entry.point.y.toFixed(4)}</div>
                      {plannedEntry?.adjusted && (
                        <div className="text-xs text-amber-700">
                          Безопасная точка маршрута: x=
                          {plannedEntry?.plannedPoint.x.toFixed(4)}
                          , y=
                          {plannedEntry?.plannedPoint.y.toFixed(4)}
                        </div>
                      )}
                      <label>
                        <div className="text-xs text-stone-500 mb-1">Операция</div>
                        <select className={selectCls} value={entry.point.task || DEFAULT_POINT_TASK} onChange={(event) => updatePointTask(entry.index, event.target.value)}>
                          {POINT_TASKS.map((task) => (
                            <option key={task} value={task}>{task}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
            {!visitEntries.length && <div className="text-sm text-stone-500">Добавьте на карте точки, которые нужно посетить.</div>}
          </div>
        </div>

        <div className={zonePanelCardCls}>
          <h3 className="text-sm font-semibold mb-2">Контроль ограничений</h3>
          <div className="space-y-2 text-sm text-stone-700">
            <div>Точек внутри зон: <b>{visitsInsideLimit.length}</b></div>
            <div>Контуров, готовых для обхода: <b>{polygons.length}</b></div>
            <div>Точек с автосдвигом: <b>{adjustedVisits.length}</b></div>
            <div>Маршрут пересекает контур: <b>{routeBlocked ? "да" : "нет"}</b></div>
          </div>
          <div className="mt-3 text-xs text-stone-500 space-y-1">
            <div>Точки посещения внутри замкнутой зоны не блокируют маршрут, а автоматически выносятся наружу.</div>
            <div>В обходе участвуют только замкнутые зоны.</div>
            <div>Любую точку можно перетащить мышкой по карте, чтобы быстро поправить контур.</div>
            <div>Если обход построить нельзя, маршрут не отправляется.</div>
          </div>
        </div>

        <div className={zonePanelCardCls}>
          <h3 className="text-sm font-semibold mb-2">Телеметрия</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>x: {telemetry.x.toFixed(2)}</div>
            <div>y: {telemetry.y.toFixed(2)}</div>
            <div>z: {telemetry.z.toFixed(2)}</div>
            <div>yaw: {telemetry.yaw.toFixed(2)}</div>
          </div>
          <div className="mt-3 text-xs text-stone-600">
            WS Telemetry: <span className={telemetryWsUp ? "text-emerald-700" : "text-red-600"}>{telemetryWsUp ? "connected" : "disconnected"}</span>
          </div>
          <div className="text-xs text-stone-600">
            WS Route: <span className={routeWsUp ? "text-emerald-700" : "text-red-600"}>{routeWsUp ? "connected" : "disconnected"}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
