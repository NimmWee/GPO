export const CANVAS_WIDTH = 880;
export const CANVAS_HEIGHT = 720;
export const MAP_WORLD_WIDTH = 30;
export const MAP_WORLD_HEIGHT = 24;
export const MAP_PADDING = 56;
export const HALF_WIDTH = MAP_WORLD_WIDTH / 2;
export const HALF_HEIGHT = MAP_WORLD_HEIGHT / 2;
export const SCALE = Math.min(
  (CANVAS_WIDTH - MAP_PADDING * 2) / MAP_WORLD_WIDTH,
  (CANVAS_HEIGHT - MAP_PADDING * 2) / MAP_WORLD_HEIGHT
);
export const DRAWING_WIDTH = MAP_WORLD_WIDTH * SCALE;
export const DRAWING_HEIGHT = MAP_WORLD_HEIGHT * SCALE;
export const DRAWING_LEFT = (CANVAS_WIDTH - DRAWING_WIDTH) / 2;
export const DRAWING_TOP = (CANVAS_HEIGHT - DRAWING_HEIGHT) / 2;

export const POINT_KIND_META = {
  visit: {
    key: "visit",
    label: "Точки для посещения",
    shortLabel: "V",
    color: "#dc2626",
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
  },
  limit: {
    key: "limit",
    label: "Ограничивающий контур",
    shortLabel: "Z",
    color: "#2563eb",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
  },
};

export const POINT_KIND_OPTIONS = [POINT_KIND_META.visit, POINT_KIND_META.limit];

export const POINT_TASKS = [
  "Ожидание 2 сек",
  "Сканирование",
  "Забрать объект",
  "Сбросить объект",
  "Сделать фото",
];

export const DEFAULT_POINT_TASK = POINT_TASKS[0];
export const CONTROLLER_MIN_SEGMENT = 0.12;
export const CONTROLLER_LOOP_CLOSURE_EPS = 0.2;
export const SAFE_POINT_MARGIN = 0.35;

const EPS = 1e-9;
const ZONE_COLORS = [
  { stroke: "#2563eb", fill: "rgba(37, 99, 235, 0.12)", badge: "bg-blue-500" },
  { stroke: "#7c3aed", fill: "rgba(124, 58, 237, 0.12)", badge: "bg-violet-500" },
  { stroke: "#0891b2", fill: "rgba(8, 145, 178, 0.12)", badge: "bg-cyan-500" },
  { stroke: "#ea580c", fill: "rgba(234, 88, 12, 0.12)", badge: "bg-orange-500" },
  { stroke: "#16a34a", fill: "rgba(22, 163, 74, 0.12)", badge: "bg-emerald-500" },
  { stroke: "#db2777", fill: "rgba(219, 39, 119, 0.12)", badge: "bg-pink-500" },
];

const copyPoint = (point) => ({ ...point });
const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

export const getZoneColor = (index) => ZONE_COLORS[index % ZONE_COLORS.length];

export const worldToCanvas = (x, y) => ({
  x: DRAWING_LEFT + (x + HALF_WIDTH) * SCALE,
  y: DRAWING_TOP + (HALF_HEIGHT - y) * SCALE,
});

export const canvasToWorld = (x, y) => ({
  x: (x - DRAWING_LEFT) / SCALE - HALF_WIDTH,
  y: HALF_HEIGHT - (y - DRAWING_TOP) / SCALE,
});

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const isInsideMap = (point) =>
  point.x >= -HALF_WIDTH &&
  point.x <= HALF_WIDTH &&
  point.y >= -HALF_HEIGHT &&
  point.y <= HALF_HEIGHT;

const clampPointToMap = (point) => ({
  x: clampNumber(point.x, -HALF_WIDTH + SAFE_POINT_MARGIN, HALF_WIDTH - SAFE_POINT_MARGIN),
  y: clampNumber(point.y, -HALF_HEIGHT + SAFE_POINT_MARGIN, HALF_HEIGHT - SAFE_POINT_MARGIN),
});

export const sanitizeRouteForController = (route, taskKey) => {
  const cleaned = [];

  for (const point of route) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const candidate = { x, y };
    if (!cleaned.length || dist(cleaned[cleaned.length - 1], candidate) >= CONTROLLER_MIN_SEGMENT) {
      cleaned.push(candidate);
    }
  }

  if (
    taskKey === "tsp" &&
    cleaned.length > 1 &&
    dist(cleaned[0], cleaned[cleaned.length - 1]) <= CONTROLLER_LOOP_CLOSURE_EPS
  ) {
    cleaned.pop();
  }

  return cleaned;
};

const pointOnSegment = (point, a, b) => {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > EPS) return false;
  const dot = (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y);
  return dot <= EPS;
};

const getClosestPointOnSegment = (point, a, b) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abLengthSquared = abx * abx + aby * aby;
  if (abLengthSquared <= EPS) return copyPoint(a);

  const t = clampNumber(
    ((point.x - a.x) * abx + (point.y - a.y) * aby) / abLengthSquared,
    0,
    1
  );

  return {
    x: a.x + abx * t,
    y: a.y + aby * t,
  };
};

const orientation = (a, b, c) => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) <= EPS) return 0;
  return value > 0 ? 1 : 2;
};

export const pointEquals = (a, b) =>
  Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS;

export const segmentsIntersect = (a, b, c, d) => {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(c, a, b)) return true;
  if (o2 === 0 && pointOnSegment(d, a, b)) return true;
  if (o3 === 0 && pointOnSegment(a, c, d)) return true;
  if (o4 === 0 && pointOnSegment(b, c, d)) return true;
  return false;
};

export const pointInPolygon = (point, polygon) => {
  if (polygon.length < 3) return false;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (pointOnSegment(point, a, b)) return true;

    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + EPS) + a.x;

    if (intersects) inside = !inside;
  }

  return inside;
};

export const pointInAnyPolygon = (point, polygons) =>
  polygons.some((polygon) => pointInPolygon(point, polygon.points));

const projectPointOutsidePolygon = (point, polygon, margin = SAFE_POINT_MARGIN) => {
  let bestBoundaryPoint = null;
  let bestCandidate = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const boundaryPoint = getClosestPointOnSegment(point, a, b);
    const distance = dist(point, boundaryPoint);

    if (distance > bestDistance + EPS) continue;

    const edgeX = b.x - a.x;
    const edgeY = b.y - a.y;
    const edgeLength = Math.hypot(edgeX, edgeY);
    if (edgeLength <= EPS) continue;

    const normals = [
      { x: -edgeY / edgeLength, y: edgeX / edgeLength },
      { x: edgeY / edgeLength, y: -edgeX / edgeLength },
    ];

    const outsideCandidates = normals
      .map((normal) =>
        clampPointToMap({
          x: boundaryPoint.x + normal.x * margin,
          y: boundaryPoint.y + normal.y * margin,
        })
      )
      .filter((candidate) => !pointInPolygon(candidate, polygon));

    if (!outsideCandidates.length) continue;

    const candidate = outsideCandidates.sort(
      (left, right) => dist(point, left) - dist(point, right)
    )[0];

    bestBoundaryPoint = boundaryPoint;
    bestCandidate = candidate;
    bestDistance = distance;
  }

  if (bestCandidate) return bestCandidate;
  if (bestBoundaryPoint) return clampPointToMap(bestBoundaryPoint);
  return clampPointToMap(point);
};

export const projectPointOutsidePolygons = (point, polygons, margin = SAFE_POINT_MARGIN) => {
  let current = copyPoint(point);
  let adjusted = false;

  for (let step = 0; step < polygons.length + 4; step += 1) {
    const polygon = polygons.find((item) => pointInPolygon(current, item.points));
    if (!polygon) break;
    current = projectPointOutsidePolygon(current, polygon.points, margin);
    adjusted = true;
  }

  return {
    point: current,
    adjusted,
  };
};

const isPolygonEdge = (a, b, polygon) =>
  polygon.some((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return (
      (pointEquals(a, point) && pointEquals(b, next)) ||
      (pointEquals(a, next) && pointEquals(b, point))
    );
  });

const sharesEndpointWithEdge = (a, b, p, q) =>
  pointEquals(a, p) ||
  pointEquals(a, q) ||
  pointEquals(b, p) ||
  pointEquals(b, q);

const segmentClear = (a, b, polygons) => {
  if (pointEquals(a, b)) return true;

  for (const polygon of polygons) {
    const points = polygon.points;
    const segmentIsEdge = isPolygonEdge(a, b, points);
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    if (!segmentIsEdge && pointInPolygon(middle, points)) return false;

    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      const q = points[(i + 1) % points.length];
      if (!segmentsIntersect(a, b, p, q)) continue;
      if (segmentIsEdge && isPolygonEdge(a, b, [p, q])) continue;
      if (sharesEndpointWithEdge(a, b, p, q)) continue;
      return false;
    }
  }

  return true;
};

const routeCrossesPolygon = (route, polygon) => {
  if (route.length < 2 || polygon.points.length < 3) return false;

  for (let i = 1; i < route.length; i += 1) {
    if (!segmentClear(route[i - 1], route[i], [polygon])) return true;
  }

  return false;
};

export const routeCrossesAnyLimitPolygon = (route, polygons) =>
  polygons.some((polygon) => routeCrossesPolygon(route, polygon));

const findShortestVisiblePath = (start, end, polygons) => {
  if (segmentClear(start, end, polygons)) return [copyPoint(start), copyPoint(end)];

  const nodes = [
    { point: start },
    { point: end },
    ...polygons.flatMap((polygon) => polygon.points.map((point) => ({ point }))),
  ];
  const n = nodes.length;
  const graph = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (!segmentClear(nodes[i].point, nodes[j].point, polygons)) continue;
      const weight = dist(nodes[i].point, nodes[j].point);
      graph[i].push({ to: j, weight });
      graph[j].push({ to: i, weight });
    }
  }

  const distances = Array(n).fill(Number.POSITIVE_INFINITY);
  const previous = Array(n).fill(-1);
  const visited = Array(n).fill(false);
  distances[0] = 0;

  for (let step = 0; step < n; step += 1) {
    let current = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < n; i += 1) {
      if (!visited[i] && distances[i] < bestDistance) {
        bestDistance = distances[i];
        current = i;
      }
    }

    if (current < 0 || current === 1) break;
    visited[current] = true;

    for (const edge of graph[current]) {
      const candidate = distances[current] + edge.weight;
      if (candidate + EPS < distances[edge.to]) {
        distances[edge.to] = candidate;
        previous[edge.to] = current;
      }
    }
  }

  if (!Number.isFinite(distances[1])) return null;

  const path = [];
  for (let current = 1; current !== -1; current = previous[current]) {
    path.push(copyPoint(nodes[current].point));
  }

  return path.reverse();
};

export const buildObstacleAwareRoute = (route, polygons) => {
  if (route.length <= 1 || polygons.length === 0) return route.map(copyPoint);

  const result = [];
  for (let i = 0; i < route.length - 1; i += 1) {
    const path = findShortestVisiblePath(route[i], route[i + 1], polygons);
    if (!path) return null;

    if (!result.length) result.push(...path);
    else result.push(...path.slice(1));
  }

  return result;
};

export const drawDiamond = (ctx, x, y, radius) => {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
};

export const drawPlannerBackground = (ctx) => {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#fafafa");
  gradient.addColorStop(1, "#e5e7eb");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(DRAWING_LEFT, DRAWING_TOP, DRAWING_WIDTH, DRAWING_HEIGHT);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.strokeRect(DRAWING_LEFT, DRAWING_TOP, DRAWING_WIDTH, DRAWING_HEIGHT);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.28)";
  ctx.lineWidth = 1;
  for (let x = -HALF_WIDTH; x <= HALF_WIDTH; x += 1) {
    const from = worldToCanvas(x, -HALF_HEIGHT);
    const to = worldToCanvas(x, HALF_HEIGHT);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  for (let y = -HALF_HEIGHT; y <= HALF_HEIGHT; y += 1) {
    const from = worldToCanvas(-HALF_WIDTH, y);
    const to = worldToCanvas(HALF_WIDTH, y);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  const verticalAxisTop = worldToCanvas(0, HALF_HEIGHT);
  const verticalAxisBottom = worldToCanvas(0, -HALF_HEIGHT);
  const horizontalAxisLeft = worldToCanvas(-HALF_WIDTH, 0);
  const horizontalAxisRight = worldToCanvas(HALF_WIDTH, 0);

  ctx.strokeStyle = "rgba(15, 23, 42, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(verticalAxisTop.x, verticalAxisTop.y);
  ctx.lineTo(verticalAxisBottom.x, verticalAxisBottom.y);
  ctx.moveTo(horizontalAxisLeft.x, horizontalAxisLeft.y);
  ctx.lineTo(horizontalAxisRight.x, horizontalAxisRight.y);
  ctx.stroke();

  ctx.fillStyle = "#334155";
  ctx.font = "600 12px 'Segoe UI', sans-serif";
  ctx.fillText("Y", verticalAxisTop.x + 8, verticalAxisTop.y + 18);
  ctx.fillText("X", horizontalAxisRight.x - 18, horizontalAxisRight.y - 8);
  ctx.fillText("Старая карта / координатная сетка", DRAWING_LEFT + 14, DRAWING_TOP - 14);
};
