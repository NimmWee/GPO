export const CANVAS_WIDTH = 880;
export const CANVAS_HEIGHT = 720;
export const WAREHOUSE_WIDTH = 30;
export const WAREHOUSE_HEIGHT = 18;
export const WAREHOUSE_PADDING = 56;
export const WAREHOUSE_DIMENSIONS_LABEL = "18 x 30 м";
export const WAREHOUSE_REFERENCE_LABEL = "Проект магазина Магнит 18x30";
export const WAREHOUSE_REFERENCE_URL =
  "https://injstroys.ru/gotovye-proekty-iz-metallokonstrukczij/proekty-magazinov/proekt-magazina-magnit/";
export const HALF_WIDTH = WAREHOUSE_WIDTH / 2;
export const HALF_HEIGHT = WAREHOUSE_HEIGHT / 2;
export const SCALE = Math.min(
  (CANVAS_WIDTH - WAREHOUSE_PADDING * 2) / WAREHOUSE_WIDTH,
  (CANVAS_HEIGHT - WAREHOUSE_PADDING * 2) / WAREHOUSE_HEIGHT
);
export const DRAWING_WIDTH = WAREHOUSE_WIDTH * SCALE;
export const DRAWING_HEIGHT = WAREHOUSE_HEIGHT * SCALE;
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
    label: "Ограничивающие точки",
    shortLabel: "L",
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
export const ROBOT_CLEARANCE_MARGIN = 0.28;

const EPS = 1e-9;

export const FLOOR_ZONES = [
  {
    x: -15,
    y: -9,
    width: 7.4,
    height: 4.6,
    label: "Торговый вход / тамбур",
    fill: "#fef3c7",
    stroke: "#d97706",
  },
  {
    x: -7.1,
    y: -9,
    width: 9.6,
    height: 4.6,
    label: "Прикассовая зона",
    fill: "#fee2e2",
    stroke: "#ef4444",
  },
  {
    x: 2.9,
    y: -9,
    width: 6.5,
    height: 4.6,
    label: "Экспедиция",
    fill: "#e0f2fe",
    stroke: "#0284c7",
  },
  {
    x: 9.9,
    y: -9,
    width: 5.1,
    height: 4.6,
    label: "Служебный блок",
    fill: "#ede9fe",
    stroke: "#7c3aed",
  },
  {
    x: -15,
    y: 6.1,
    width: 6.2,
    height: 2.9,
    label: "Приемка товара",
    fill: "#ffedd5",
    stroke: "#f97316",
  },
  {
    x: 8.2,
    y: 6.1,
    width: 6.8,
    height: 2.9,
    label: "Паллетное хранение",
    fill: "#dcfce7",
    stroke: "#16a34a",
  },
];

export const STATIC_BLOCKS = [
  {
    key: "checkout-line",
    kind: "barrier",
    x: -6.1,
    y: -4.35,
    width: 7.2,
    height: 0.8,
    label: "Кассовая линия",
    fill: "#fca5a5",
    stroke: "#b91c1c",
  },
  {
    key: "cold-room",
    kind: "room",
    x: -15,
    y: 6.15,
    width: 4.7,
    height: 2.85,
    label: "Холодильная",
    fill: "#bae6fd",
    stroke: "#0369a1",
  },
  {
    key: "admin-room",
    kind: "room",
    x: 10.1,
    y: -9,
    width: 3.1,
    height: 2.25,
    label: "Админ",
    fill: "#ddd6fe",
    stroke: "#6d28d9",
  },
  {
    key: "staff-room",
    kind: "room",
    x: 10.1,
    y: -6.45,
    width: 3.1,
    height: 2.05,
    label: "Персонал",
    fill: "#e9d5ff",
    stroke: "#7e22ce",
  },
  {
    key: "utility-room",
    kind: "room",
    x: 13.55,
    y: -9,
    width: 1.45,
    height: 4.6,
    label: "Щитовая",
    fill: "#fecaca",
    stroke: "#b91c1c",
  },
  {
    key: "shelf-a",
    kind: "shelf",
    x: -12.2,
    y: -0.1,
    width: 2.55,
    height: 5.45,
    label: "Стеллаж A",
    fill: "#d6d3d1",
    stroke: "#57534e",
  },
  {
    key: "shelf-b",
    kind: "shelf",
    x: -6.55,
    y: -0.1,
    width: 2.55,
    height: 5.45,
    label: "Стеллаж B",
    fill: "#d6d3d1",
    stroke: "#57534e",
  },
  {
    key: "shelf-c",
    kind: "shelf",
    x: -0.9,
    y: -0.1,
    width: 2.55,
    height: 5.45,
    label: "Стеллаж C",
    fill: "#d6d3d1",
    stroke: "#57534e",
  },
  {
    key: "shelf-d",
    kind: "shelf",
    x: 4.75,
    y: -0.1,
    width: 2.55,
    height: 5.45,
    label: "Стеллаж D",
    fill: "#d6d3d1",
    stroke: "#57534e",
  },
  {
    key: "shelf-e",
    kind: "shelf",
    x: 10.4,
    y: -0.1,
    width: 2.35,
    height: 5.45,
    label: "Стеллаж E",
    fill: "#d6d3d1",
    stroke: "#57534e",
  },
];

const ROBOT_LANES = [
  { x: -15, y: -2.9, width: 30, height: 1.45, label: "Главный поперечный коридор" },
  { x: -15, y: 2.45, width: 30, height: 1.4, label: "Верхний поперечный коридор" },
  { x: -15, y: 6.55, width: 30, height: 1.1, label: "Коридор приемки" },
  { x: -14.25, y: -4.1, width: 1.65, height: 9.8, label: "Левый обход" },
  { x: -8.55, y: -4.1, width: 1.85, height: 9.8, label: "Проход A/B" },
  { x: -2.9, y: -4.1, width: 1.85, height: 9.8, label: "Проход B/C" },
  { x: 2.75, y: -4.1, width: 1.85, height: 9.8, label: "Проход C/D" },
  { x: 8.4, y: -4.1, width: 1.85, height: 9.8, label: "Проход D/E" },
  { x: 13.35, y: -4.1, width: 1.25, height: 9.8, label: "Правый обход" },
];

const TURN_POCKETS = [
  { x: -14.45, y: -3.3, width: 2.2, height: 2.2 },
  { x: -9.05, y: -3.15, width: 2.0, height: 2.0 },
  { x: -3.4, y: -3.15, width: 2.0, height: 2.0 },
  { x: 2.25, y: -3.15, width: 2.0, height: 2.0 },
  { x: 7.9, y: -3.15, width: 2.0, height: 2.0 },
  { x: 12.65, y: -3.15, width: 1.95, height: 2.0 },
  { x: -14.45, y: 2.1, width: 2.2, height: 2.2 },
  { x: 12.65, y: 2.1, width: 1.95, height: 2.2 },
];

const AISLE_LINES = [
  { type: "horizontal", y: -2.2 },
  { type: "horizontal", y: 3.05 },
  { type: "horizontal", y: 7.05 },
  { type: "vertical", x: -13.45 },
  { type: "vertical", x: -7.6 },
  { type: "vertical", x: -1.95 },
  { type: "vertical", x: 3.7 },
  { type: "vertical", x: 9.35 },
  { type: "vertical", x: 13.95 },
];

export const worldToCanvas = (x, y) => ({
  x: DRAWING_LEFT + (x + HALF_WIDTH) * SCALE,
  y: DRAWING_TOP + (HALF_HEIGHT - y) * SCALE,
});

export const canvasToWorld = (x, y) => ({
  x: (x - DRAWING_LEFT) / SCALE - HALF_WIDTH,
  y: HALF_HEIGHT - (y - DRAWING_TOP) / SCALE,
});

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const isInsideWarehouse = (point) =>
  point.x >= -HALF_WIDTH &&
  point.x <= HALF_WIDTH &&
  point.y >= -HALF_HEIGHT &&
  point.y <= HALF_HEIGHT;

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

export const drawDiamond = (ctx, x, y, radius) => {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
};

export const pointEquals = (a, b) =>
  Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS;

const pointOnSegment = (point, a, b) => {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > EPS) return false;
  const dot = (point.x - a.x) * (point.x - b.x) + (point.y - a.y) * (point.y - b.y);
  return dot <= EPS;
};

const orientation = (a, b, c) => {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) <= EPS) return 0;
  return value > 0 ? 1 : 2;
};

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

const pointInRect = (point, rect) =>
  point.x >= rect.x - EPS &&
  point.x <= rect.x + rect.width + EPS &&
  point.y >= rect.y - EPS &&
  point.y <= rect.y + rect.height + EPS;

const expandRect = (rect, margin) => ({
  ...rect,
  x: rect.x - margin,
  y: rect.y - margin,
  width: rect.width + margin * 2,
  height: rect.height + margin * 2,
});

const rectToPolygon = (rect) => [
  { x: rect.x, y: rect.y },
  { x: rect.x + rect.width, y: rect.y },
  { x: rect.x + rect.width, y: rect.y + rect.height },
  { x: rect.x, y: rect.y + rect.height },
];

const routeCrossesPolygon = (route, polygon) => {
  if (polygon.length < 3 || route.length < 2) return false;

  for (let i = 1; i < route.length; i += 1) {
    const a = route[i - 1];
    const b = route[i];
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

    if (pointInPolygon(middle, polygon)) return true;

    for (let edgeIndex = 0; edgeIndex < polygon.length; edgeIndex += 1) {
      const p = polygon[edgeIndex];
      const q = polygon[(edgeIndex + 1) % polygon.length];

      if (
        pointEquals(a, p) ||
        pointEquals(a, q) ||
        pointEquals(b, p) ||
        pointEquals(b, q)
      ) {
        continue;
      }

      if (segmentsIntersect(a, b, p, q)) return true;
    }
  }

  return false;
};

export const pointInStaticBlock = (point) =>
  STATIC_BLOCKS.some((block) => pointInRect(point, expandRect(block, ROBOT_CLEARANCE_MARGIN)));

export const isPointOnNavigableFloor = (point) =>
  isInsideWarehouse(point) && !pointInStaticBlock(point);

export const buildLimitPolygon = (points) =>
  points.filter((point) => point.kind === "limit").map(({ x, y }) => ({ x, y }));

export const routeCrossesLimitPolygon = (route, polygon) =>
  routeCrossesPolygon(route, polygon);

export const routeCrossesStaticBlocks = (route) =>
  STATIC_BLOCKS.some((block) =>
    routeCrossesPolygon(route, rectToPolygon(expandRect(block, ROBOT_CLEARANCE_MARGIN)))
  );

export const sanitizeRouteForController = (route, taskKey) => {
  const cleaned = [];

  for (const point of route) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const candidate = { x, y };
    if (!cleaned.length) {
      cleaned.push(candidate);
      continue;
    }

    if (dist(cleaned[cleaned.length - 1], candidate) >= CONTROLLER_MIN_SEGMENT) {
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

const drawZone = (ctx, zone) => {
  const topLeft = worldToCanvas(zone.x, zone.y + zone.height);
  const width = zone.width * SCALE;
  const height = zone.height * SCALE;

  drawRoundedRect(ctx, topLeft.x, topLeft.y, width, height, 18);
  ctx.fillStyle = zone.fill;
  ctx.fill();
  ctx.strokeStyle = zone.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#1c1917";
  ctx.font = "600 12px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(zone.label, topLeft.x + width / 2, topLeft.y + height / 2);
};

const drawShelfTexture = (ctx, block, topLeft, width, height) => {
  ctx.strokeStyle = "rgba(87, 83, 78, 0.45)";
  ctx.lineWidth = 1;
  for (let offset = 8; offset < width - 6; offset += 10) {
    ctx.beginPath();
    ctx.moveTo(topLeft.x + offset, topLeft.y + 6);
    ctx.lineTo(topLeft.x + offset, topLeft.y + height - 6);
    ctx.stroke();
  }

  ctx.fillStyle = "#292524";
  ctx.font = "700 11px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(block.label, topLeft.x + width / 2, topLeft.y + height / 2);
};

const drawStaticBlock = (ctx, block) => {
  const topLeft = worldToCanvas(block.x, block.y + block.height);
  const width = block.width * SCALE;
  const height = block.height * SCALE;
  const radius = block.kind === "barrier" ? 10 : 14;

  drawRoundedRect(ctx, topLeft.x, topLeft.y, width, height, radius);
  ctx.fillStyle = block.fill;
  ctx.fill();
  ctx.strokeStyle = block.stroke;
  ctx.lineWidth = block.kind === "shelf" ? 2 : 2.5;
  ctx.stroke();

  if (block.kind === "shelf") {
    drawShelfTexture(ctx, block, topLeft, width, height);
    return;
  }

  ctx.fillStyle = "#1f2937";
  ctx.font = "700 10px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(block.label, topLeft.x + width / 2, topLeft.y + height / 2);
};

const drawRobotLane = (ctx, lane) => {
  const topLeft = worldToCanvas(lane.x, lane.y + lane.height);
  const width = lane.width * SCALE;
  const height = lane.height * SCALE;

  drawRoundedRect(ctx, topLeft.x, topLeft.y, width, height, 14);
  ctx.fillStyle = "rgba(20, 184, 166, 0.08)";
  ctx.fill();
  ctx.strokeStyle = "rgba(13, 148, 136, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
};

const drawTurnPocket = (ctx, pocket) => {
  const topLeft = worldToCanvas(pocket.x, pocket.y + pocket.height);
  const width = pocket.width * SCALE;
  const height = pocket.height * SCALE;

  drawRoundedRect(ctx, topLeft.x, topLeft.y, width, height, 18);
  ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(5, 150, 105, 0.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const centerX = topLeft.x + width / 2;
  const centerY = topLeft.y + height / 2;
  ctx.strokeStyle = "rgba(5, 150, 105, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.min(width, height) * 0.22, 0.3, Math.PI * 1.7);
  ctx.stroke();
};

const drawAisleGuides = (ctx) => {
  ROBOT_LANES.forEach((lane) => drawRobotLane(ctx, lane));
  TURN_POCKETS.forEach((pocket) => drawTurnPocket(ctx, pocket));

  ctx.strokeStyle = "rgba(15, 118, 110, 0.3)";
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 10]);

  AISLE_LINES.forEach((line) => {
    if (line.type === "horizontal") {
      const from = worldToCanvas(-HALF_WIDTH, line.y);
      const to = worldToCanvas(HALF_WIDTH, line.y);
      ctx.beginPath();
      ctx.moveTo(from.x + 12, from.y);
      ctx.lineTo(to.x - 12, to.y);
      ctx.stroke();
      return;
    }

    const from = worldToCanvas(line.x, -4.2);
    const to = worldToCanvas(line.x, 8.4);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  });

  ctx.setLineDash([]);
};

const drawEdgeAnnotations = (ctx) => {
  const entranceLabel = worldToCanvas(-11.6, -8.55);
  const dockLabel = worldToCanvas(12.05, 8.2);
  const dockOne = worldToCanvas(10.9, 8.92);
  const dockTwo = worldToCanvas(13.2, 8.92);

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 11px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText("Вход покупателей", entranceLabel.x, entranceLabel.y);
  ctx.fillText("Ворота отгрузки", dockLabel.x, dockLabel.y);

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(entranceLabel.x - 56, entranceLabel.y + 10);
  ctx.lineTo(entranceLabel.x + 56, entranceLabel.y + 10);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(dockOne.x, dockOne.y);
  ctx.lineTo(dockTwo.x, dockTwo.y);
  ctx.stroke();
};

export const drawWarehouseBackground = (ctx) => {
  const outerGradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  outerGradient.addColorStop(0, "#f8fafc");
  outerGradient.addColorStop(0.4, "#ebe7dd");
  outerGradient.addColorStop(1, "#d6d3d1");
  ctx.fillStyle = outerGradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const floorGradient = ctx.createLinearGradient(
    DRAWING_LEFT,
    DRAWING_TOP,
    DRAWING_LEFT,
    DRAWING_TOP + DRAWING_HEIGHT
  );
  floorGradient.addColorStop(0, "#fffaf0");
  floorGradient.addColorStop(0.55, "#f8f1e5");
  floorGradient.addColorStop(1, "#efe7da");

  drawRoundedRect(ctx, DRAWING_LEFT, DRAWING_TOP, DRAWING_WIDTH, DRAWING_HEIGHT, 28);
  ctx.fillStyle = floorGradient;
  ctx.fill();
  ctx.strokeStyle = "#1c1917";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.save();
  drawRoundedRect(ctx, DRAWING_LEFT, DRAWING_TOP, DRAWING_WIDTH, DRAWING_HEIGHT, 28);
  ctx.clip();

  ctx.strokeStyle = "rgba(120, 113, 108, 0.11)";
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

  FLOOR_ZONES.forEach((zone) => drawZone(ctx, zone));
  drawAisleGuides(ctx);
  STATIC_BLOCKS.forEach((block) => drawStaticBlock(ctx, block));
  ctx.restore();

  drawEdgeAnnotations(ctx);

  ctx.fillStyle = "#1f2937";
  ctx.font = "700 18px 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(
    `${WAREHOUSE_REFERENCE_LABEL} • ${WAREHOUSE_DIMENSIONS_LABEL}`,
    DRAWING_LEFT + 18,
    DRAWING_TOP - 16
  );

  ctx.font = "600 12px 'Segoe UI', sans-serif";
  ctx.fillStyle = "#57534e";
  ctx.fillText(
    "Проходы расширены под движение робота: добавлены безопасные коридоры и разворотные карманы",
    DRAWING_LEFT + 18,
    DRAWING_TOP + DRAWING_HEIGHT + 28
  );
};
