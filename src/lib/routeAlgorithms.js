const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clampInt = (value, min, max) =>
  Math.round(clamp(Number.isFinite(value) ? value : min, min, max));

const copyPoint = (point) => ({ ...point });
const CACHE_MAX_SIZE = 64;

const stablePointNumber = (value) =>
  Number.isFinite(Number(value)) ? Number(value).toFixed(6) : "0.000000";

const getPointsCacheKey = (points) =>
  points
    .map((point) => `${stablePointNumber(point.x)}:${stablePointNumber(point.y)}`)
    .join("|");

const setLimitedCacheValue = (cache, key, value) => {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, value);
};

const distanceMatrixCache = new Map();
const exactRouteCache = new Map();

const TASKS = {
  tsp: {
    key: "tsp",
    label: "Коммивояжер",
    closed: true,
    fixedEndpoints: false,
  },
  hamiltonian_chain: {
    key: "hamiltonian_chain",
    label: "Гамильтонова цепь",
    closed: false,
    fixedEndpoints: false,
  },
  shortest_route: {
    key: "shortest_route",
    label: "Кратчайший маршрут",
    closed: false,
    fixedEndpoints: true,
  },
};

export const TASK_OPTIONS = Object.values(TASKS).map((item) => ({
  key: item.key,
  label: item.label,
}));

export const getTaskLabel = (taskKey) =>
  TASKS[taskKey]?.label || TASKS.tsp.label;

const resolveTask = (taskKey) => TASKS[taskKey] || TASKS.tsp;

const getDistanceMatrix = (points) => {
  const cacheKey = getPointsCacheKey(points);
  const cached = distanceMatrixCache.get(cacheKey);
  if (cached) return cached;

  const n = points.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const d = Math.hypot(dx, dy);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  setLimitedCacheValue(distanceMatrixCache, cacheKey, matrix);
  return matrix;
};

const getOpenLengthFromOrder = (distanceMatrix, order) => {
  if (order.length <= 1) return 0;
  let length = 0;
  for (let i = 0; i < order.length - 1; i += 1) {
    length += distanceMatrix[order[i]][order[i + 1]];
  }
  return length;
};

const getClosedLengthFromOrder = (distanceMatrix, order) => {
  if (order.length <= 1) return 0;
  let length = getOpenLengthFromOrder(distanceMatrix, order);
  length += distanceMatrix[order[order.length - 1]][order[0]];
  return length;
};

const getLengthByTask = (distanceMatrix, order, task) =>
  task.closed
    ? getClosedLengthFromOrder(distanceMatrix, order)
    : getOpenLengthFromOrder(distanceMatrix, order);

const buildRouteFromOrder = (points, order, task) => {
  if (order.length === 0) return [];
  const route = order.map((index) => copyPoint(points[index]));
  if (task.closed) route.push(copyPoint(points[order[0]]));
  return route;
};

const buildInitialOrder = (n, task) => {
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);
  if (!task.fixedEndpoints) return Array.from({ length: n }, (_, i) => i);

  const middle = [];
  for (let i = 1; i < n - 1; i += 1) middle.push(i);
  return [0, ...middle, n - 1];
};

const reverseSegment = (order, start, end) => {
  let left = start;
  let right = end;
  while (left < right) {
    const temp = order[left];
    order[left] = order[right];
    order[right] = temp;
    left += 1;
    right -= 1;
  }
};

const buildNearestNeighborOrder = (distanceMatrix, task) => {
  const n = distanceMatrix.length;
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);

  const start = 0;
  const end = task.fixedEndpoints ? n - 1 : -1;
  const used = Array(n).fill(false);
  const order = [start];
  used[start] = true;
  if (task.fixedEndpoints) used[end] = true;

  let current = start;
  while (order.length < (task.fixedEndpoints ? n - 1 : n)) {
    let bestNode = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i += 1) {
      if (used[i]) continue;
      const d = distanceMatrix[current][i];
      if (d < bestDist - 1e-12 || (Math.abs(d - bestDist) <= 1e-12 && i < bestNode)) {
        bestDist = d;
        bestNode = i;
      }
    }
    if (bestNode < 0) break;
    order.push(bestNode);
    used[bestNode] = true;
    current = bestNode;
  }

  if (task.fixedEndpoints) order.push(end);
  return order;
};

const improveOrderWith2Opt = (distanceMatrix, initialOrder, task) => {
  const n = initialOrder.length;
  if (n <= 3) return initialOrder.slice();

  const order = initialOrder.slice();
  let improved = true;
  while (improved) {
    improved = false;
    const iStart = task.closed ? 1 : 1;
    const iEnd = task.closed ? n - 2 : n - 3;
    for (let i = iStart; i <= iEnd; i += 1) {
      const kStart = i + 1;
      const kEnd = task.closed ? n - 1 : n - 2;
      for (let k = kStart; k <= kEnd; k += 1) {
        const a = order[i - 1];
        const b = order[i];
        const c = order[k];
        const d = task.closed
          ? order[(k + 1) % n]
          : order[k + 1];

        if (d === undefined) continue;

        const current = distanceMatrix[a][b] + distanceMatrix[c][d];
        const candidate = distanceMatrix[a][c] + distanceMatrix[b][d];
        if (candidate + 1e-12 < current) {
          reverseSegment(order, i, k);
          improved = true;
        }
      }
    }
  }
  return order;
};

const buildExactTspOrder = (distanceMatrix) => {
  const n = distanceMatrix.length;
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);

  const size = 1 << n;
  const allMask = size - 1;
  const totalStates = size * n;
  const dp = new Float64Array(totalStates);
  const parent = new Int32Array(totalStates);
  dp.fill(Number.POSITIVE_INFINITY);
  parent.fill(-1);

  dp[1 * n + 0] = 0;

  for (let mask = 1; mask <= allMask; mask += 1) {
    if ((mask & 1) === 0) continue;
    const offset = mask * n;
    for (let last = 0; last < n; last += 1) {
      if ((mask & (1 << last)) === 0) continue;
      const base = dp[offset + last];
      if (!Number.isFinite(base)) continue;
      for (let next = 1; next < n; next += 1) {
        const bit = 1 << next;
        if ((mask & bit) !== 0) continue;
        const nextMask = mask | bit;
        const nextOffset = nextMask * n;
        const candidate = base + distanceMatrix[last][next];
        if (candidate < dp[nextOffset + next]) {
          dp[nextOffset + next] = candidate;
          parent[nextOffset + next] = last;
        }
      }
    }
  }

  let bestEnd = -1;
  let bestCost = Number.POSITIVE_INFINITY;
  const allOffset = allMask * n;
  for (let last = 1; last < n; last += 1) {
    const cost = dp[allOffset + last] + distanceMatrix[last][0];
    if (cost < bestCost) {
      bestCost = cost;
      bestEnd = last;
    }
  }

  if (bestEnd < 0) return buildInitialOrder(n, TASKS.tsp);

  const order = Array(n).fill(0);
  let mask = allMask;
  let current = bestEnd;
  for (let i = n - 1; i >= 1; i -= 1) {
    order[i] = current;
    const prev = parent[mask * n + current];
    mask ^= 1 << current;
    current = prev;
  }
  order[0] = 0;
  return order;
};

const buildExactFixedEndpointsOrder = (distanceMatrix) => {
  const n = distanceMatrix.length;
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);
  if (n === 2) return [0, 1];

  const size = 1 << n;
  const allMask = size - 1;
  const end = n - 1;
  const endBit = 1 << end;
  const preEndMask = allMask ^ endBit;

  const totalStates = size * n;
  const dp = new Float64Array(totalStates);
  const parent = new Int32Array(totalStates);
  dp.fill(Number.POSITIVE_INFINITY);
  parent.fill(-1);

  dp[1 * n + 0] = 0;

  for (let mask = 1; mask <= allMask; mask += 1) {
    if ((mask & 1) === 0) continue;
    const offset = mask * n;
    for (let last = 0; last < n; last += 1) {
      if ((mask & (1 << last)) === 0) continue;
      const base = dp[offset + last];
      if (!Number.isFinite(base)) continue;

      for (let next = 1; next < n; next += 1) {
        const bit = 1 << next;
        if ((mask & bit) !== 0) continue;
        if (next === end && mask !== preEndMask) continue;

        const nextMask = mask | bit;
        const nextOffset = nextMask * n;
        const candidate = base + distanceMatrix[last][next];
        if (candidate < dp[nextOffset + next]) {
          dp[nextOffset + next] = candidate;
          parent[nextOffset + next] = last;
        }
      }
    }
  }

  if (!Number.isFinite(dp[allMask * n + end])) {
    return buildInitialOrder(n, TASKS.shortest_route);
  }

  const order = Array(n).fill(0);
  let mask = allMask;
  let current = end;
  for (let i = n - 1; i >= 0; i -= 1) {
    order[i] = current;
    if (i === 0) break;
    const prev = parent[mask * n + current];
    mask ^= 1 << current;
    current = prev;
  }
  return order;
};

const EXACT_SOLVER_MAX_POINTS = 18;
const isExactTask = (task) =>
  task.key === "tsp" || task.key === "shortest_route";

const optimizeExactTaskRoute = (points, task) => {
  const n = points.length;
  if (n <= 1) return points.map(copyPoint);

  const cacheKey = `${task.key}|${getPointsCacheKey(points)}`;
  const cached = exactRouteCache.get(cacheKey);
  if (cached) return cached.map(copyPoint);

  const distanceMatrix = getDistanceMatrix(points);
  let order;

  if (n <= EXACT_SOLVER_MAX_POINTS) {
    order =
      task.key === "tsp"
        ? buildExactTspOrder(distanceMatrix)
        : buildExactFixedEndpointsOrder(distanceMatrix);
  } else {
    // Deterministic fallback for large N where exact DP is too expensive.
    const initialOrder = buildNearestNeighborOrder(distanceMatrix, task);
    order = improveOrderWith2Opt(distanceMatrix, initialOrder, task);
  }

  const route = buildRouteFromOrder(points, order, task);
  setLimitedCacheValue(exactRouteCache, cacheKey, route.map(copyPoint));
  return route;
};

const buildMutableNodes = (n, task) => {
  if (n <= 0) return [];
  if (!task.fixedEndpoints) return Array.from({ length: n }, (_, i) => i);
  if (n <= 2) return [];
  return Array.from({ length: n - 2 }, (_, i) => i + 1);
};

const shuffleArray = (input) => {
  const array = input.slice();
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};

const buildOrderFromGenes = (genes, n, task) => {
  if (!task.fixedEndpoints) return genes.slice();
  if (n <= 1) return [0].slice(0, n);
  if (n === 2) return [0, 1];
  return [0, ...genes, n - 1];
};

const buildGenesFromOrder = (order, task) => {
  if (!task.fixedEndpoints) return order.slice();
  if (order.length <= 2) return [];
  return order.slice(1, -1);
};

const buildRandomGenes = (n, task) => shuffleArray(buildMutableNodes(n, task));

const evaluateGenes = (
  genes,
  distanceMatrix,
  task,
  localSearchPasses = 0
) => {
  const n = distanceMatrix.length;
  let order = buildOrderFromGenes(genes, n, task);
  for (let i = 0; i < localSearchPasses; i += 1) {
    order = improveOrderWith2Opt(distanceMatrix, order, task);
  }
  const length = getLengthByTask(distanceMatrix, order, task);
  return {
    genes: buildGenesFromOrder(order, task),
    order,
    length,
  };
};

const orderedCrossoverGenes = (first, second) => {
  const m = first.length;
  if (m <= 1) return first.slice();

  const left = Math.floor(Math.random() * m);
  const right = left + Math.floor(Math.random() * (m - left));
  const child = Array(m).fill(null);
  const used = new Set();

  for (let i = left; i <= right; i += 1) {
    child[i] = first[i];
    used.add(first[i]);
  }

  let secondIndex = 0;
  for (let i = 0; i < m; i += 1) {
    if (child[i] !== null) continue;
    while (secondIndex < m && used.has(second[secondIndex])) {
      secondIndex += 1;
    }
    if (secondIndex < m) {
      child[i] = second[secondIndex];
      used.add(second[secondIndex]);
      secondIndex += 1;
    }
  }

  for (let i = 0; i < m; i += 1) {
    if (child[i] === null) child[i] = first[i];
  }

  return child;
};

const mutateGenes = (genes, mutationRate) => {
  const out = genes.slice();
  if (out.length <= 1) return out;

  if (Math.random() < mutationRate) {
    const i = Math.floor(Math.random() * out.length);
    let j = Math.floor(Math.random() * out.length);
    if (j === i) j = (j + 1) % out.length;
    const temp = out[i];
    out[i] = out[j];
    out[j] = temp;
  }

  if (out.length > 3 && Math.random() < mutationRate * 0.6) {
    const i = Math.floor(Math.random() * (out.length - 1));
    const j = i + 1 + Math.floor(Math.random() * (out.length - i - 1));
    reverseSegment(out, i, j);
  }

  return out;
};

const selectTournament = (population, tournamentSize) => {
  let best = null;
  for (let i = 0; i < tournamentSize; i += 1) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (!best || candidate.length < best.length) best = candidate;
  }
  return best || population[0];
};

const hammingDistance = (a, b) => {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) d += 1;
  }
  return d + Math.abs(a.length - b.length);
};

const buildDiverseRefSet = (population, refSetSize) => {
  if (population.length <= refSetSize) return population.slice();

  const sorted = population.slice().sort((a, b) => a.length - b.length);
  const bestCount = Math.max(1, Math.ceil(refSetSize / 2));
  const selected = sorted.slice(0, bestCount);
  const pool = sorted.slice(bestCount);

  while (selected.length < refSetSize && pool.length > 0) {
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < pool.length; i += 1) {
      let minDist = Number.POSITIVE_INFINITY;
      for (const item of selected) {
        const dist = hammingDistance(pool[i].genes, item.genes);
        if (dist < minDist) minDist = dist;
      }
      if (minDist > bestScore) {
        bestScore = minDist;
        bestIdx = i;
      }
    }
    selected.push(pool[bestIdx]);
    pool.splice(bestIdx, 1);
  }

  return selected;
};

const pickByWeight = (weights) => {
  const total = weights.reduce((acc, value) => acc + value, 0);
  if (total <= 0) return Math.floor(Math.random() * weights.length);

  let threshold = Math.random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    threshold -= weights[i];
    if (threshold <= 0) return i;
  }
  return weights.length - 1;
};

const DEFAULT_ACO_PARAMS = {
  max_iterations: 200,
  max_iterations_without_improvement: 48,
  elite_ants_count: 5,
  evaporation: 0.0001,
  pheromone0: 1,
  q: 5,
  tests_count: 1,
};

const DEFAULT_CUCKOO_PARAMS = {
  nests: 30,
  discovery_probability: 0.25,
  max_iterations: 200,
  alpha: 0.12,
  beta: 1.5,
};

const DEFAULT_GENETIC_PARAMS = {
  population_size: 90,
  generations: 260,
  crossover_rate: 0.9,
  mutation_rate: 0.18,
  elitism_count: 5,
  tournament_size: 4,
  local_search_passes: 1,
};

const DEFAULT_ANNEALING_PARAMS = {
  initial_temperature: 45,
  minimum_temperature: 0.001,
  cooling_rate: 0.996,
  max_iterations: 5000,
  adaptation_interval: 120,
};

const DEFAULT_SCATTER_PARAMS = {
  population_size: 70,
  refset_size: 12,
  max_iterations: 130,
  max_no_improvement: 28,
  subset_pairs_limit: 40,
  mutation_rate: 0.2,
  local_search_passes: 1,
};

const sanitizeAcoParams = (raw) => {
  const p = { ...DEFAULT_ACO_PARAMS, ...(raw || {}) };
  return {
    maxIterations: clampInt(p.max_iterations, 1, 5000),
    maxNoImprove: clampInt(p.max_iterations_without_improvement, 1, 2000),
    eliteAntsCount: clampInt(p.elite_ants_count, 1, 50),
    evaporation: clamp(Number(p.evaporation), 0.000001, 0.95),
    pheromone0: clamp(Number(p.pheromone0), 0.000001, 1e6),
    q: clamp(Number(p.q), 0.000001, 1e6),
    testsCount: clampInt(p.tests_count, 1, 20),
  };
};

const sanitizeGeneticParams = (raw) => {
  const p = { ...DEFAULT_GENETIC_PARAMS, ...(raw || {}) };
  return {
    populationSize: clampInt(p.population_size, 8, 1200),
    generations: clampInt(p.generations, 1, 10000),
    crossoverRate: clamp(Number(p.crossover_rate), 0, 1),
    mutationRate: clamp(Number(p.mutation_rate), 0, 1),
    elitismCount: clampInt(p.elitism_count, 0, 100),
    tournamentSize: clampInt(p.tournament_size, 2, 20),
    localSearchPasses: clampInt(p.local_search_passes, 0, 4),
  };
};

const sanitizeAnnealingParams = (raw) => {
  const p = { ...DEFAULT_ANNEALING_PARAMS, ...(raw || {}) };
  return {
    initialTemperature: clamp(Number(p.initial_temperature), 0.000001, 1000000),
    minimumTemperature: clamp(Number(p.minimum_temperature), 0.0000001, 10000),
    coolingRate: clamp(Number(p.cooling_rate), 0.8, 0.99999),
    maxIterations: clampInt(p.max_iterations, 1, 200000),
    adaptationInterval: clampInt(p.adaptation_interval, 10, 2000),
  };
};

const sanitizeScatterParams = (raw) => {
  const p = { ...DEFAULT_SCATTER_PARAMS, ...(raw || {}) };
  return {
    populationSize: clampInt(p.population_size, 10, 1200),
    refSetSize: clampInt(p.refset_size, 4, 80),
    maxIterations: clampInt(p.max_iterations, 1, 3000),
    maxNoImprove: clampInt(p.max_no_improvement, 1, 800),
    subsetPairsLimit: clampInt(p.subset_pairs_limit, 1, 500),
    mutationRate: clamp(Number(p.mutation_rate), 0, 1),
    localSearchPasses: clampInt(p.local_search_passes, 0, 4),
  };
};

const buildAcoOrder = (pheromone, distances, task) => {
  const n = distances.length;
  const alpha = 1.0;
  const beta = 3.0;
  const start = task.fixedEndpoints ? 0 : Math.floor(Math.random() * n);
  const end = task.fixedEndpoints ? n - 1 : -1;

  const order = [start];
  const visited = Array(n).fill(false);
  visited[start] = true;
  let current = start;

  while (order.length < n) {
    const candidates = [];
    const weights = [];

    for (let next = 0; next < n; next += 1) {
      if (visited[next]) continue;
      if (task.fixedEndpoints && next === end && order.length < n - 1) continue;
      const tau = Math.pow(pheromone[current][next], alpha);
      const eta = Math.pow(1 / Math.max(distances[current][next], 1e-9), beta);
      candidates.push(next);
      weights.push(tau * eta);
    }

    if (candidates.length === 0) {
      for (let next = 0; next < n; next += 1) {
        if (!visited[next]) {
          candidates.push(next);
          weights.push(1);
        }
      }
    }

    const selected = candidates[pickByWeight(weights)];
    order.push(selected);
    visited[selected] = true;
    current = selected;
  }

  return order;
};

const optimizeAcoRoute = (points, rawParams, task) => {
  const n = points.length;
  if (n <= 1) return points.map(copyPoint);

  const params = sanitizeAcoParams(rawParams);
  const distances = getDistanceMatrix(points);
  const pheromone = Array.from({ length: n }, () =>
    Array(n).fill(params.pheromone0)
  );
  const antsPerIteration = clampInt(n * params.testsCount, n, 240);
  const minPheromone = 1e-9;

  let bestOrder = buildInitialOrder(n, task);
  let bestLength = getLengthByTask(distances, bestOrder, task);
  let noImproveIterations = 0;

  for (let iter = 0; iter < params.maxIterations; iter += 1) {
    const tours = [];
    let improved = false;

    for (let ant = 0; ant < antsPerIteration; ant += 1) {
      const order = buildAcoOrder(pheromone, distances, task);
      const length = getLengthByTask(distances, order, task);
      tours.push({ order, length });

      if (length < bestLength) {
        bestLength = length;
        bestOrder = order.slice();
        improved = true;
      }
    }

    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        pheromone[i][j] = Math.max(
          minPheromone,
          pheromone[i][j] * (1 - params.evaporation)
        );
      }
    }

    const elite = tours
      .slice()
      .sort((a, b) => a.length - b.length)
      .slice(0, params.eliteAntsCount);

    for (const tour of elite) {
      const deposit = params.q / Math.max(tour.length, 1e-9);
      const edgeCount = task.closed ? n : n - 1;
      for (let i = 0; i < edgeCount; i += 1) {
        const a = tour.order[i];
        const b = task.closed
          ? tour.order[(i + 1) % n]
          : tour.order[i + 1];
        if (b === undefined) continue;
        pheromone[a][b] += deposit;
        pheromone[b][a] += deposit;
      }
    }

    if (improved) noImproveIterations = 0;
    else noImproveIterations += 1;

    if (noImproveIterations >= params.maxNoImprove) break;
  }

  return buildRouteFromOrder(points, bestOrder, task);
};

const gamma = (z) => {
  const p = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));

  const t = z - 1;
  let x = 0.9999999999998099;
  for (let i = 0; i < p.length; i += 1) {
    x += p[i] / (t + i + 1);
  }
  const g = 7;
  const w = t + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(w, t + 0.5) * Math.exp(-w) * x;
};

const gaussianRandom = () => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const levyVector = (beta, size) => {
  const numerator = gamma(1 + beta) * Math.sin((Math.PI * beta) / 2);
  const denominator =
    gamma((1 + beta) / 2) * beta * Math.pow(2, (beta - 1) / 2);
  const sigma = Math.pow(numerator / denominator, 1 / beta);

  const step = () => {
    const u = gaussianRandom() * sigma;
    const v = gaussianRandom();
    return u / Math.pow(Math.abs(v) + 1e-12, 1 / beta);
  };

  return Array.from({ length: size }, () => step());
};

const sanitizeCuckooParams = (raw) => {
  const p = { ...DEFAULT_CUCKOO_PARAMS, ...(raw || {}) };
  return {
    nests: clampInt(p.nests, 5, 250),
    discoveryProbability: clamp(Number(p.discovery_probability), 0.01, 0.9),
    maxIterations: clampInt(p.max_iterations, 1, 5000),
    alpha: clamp(Number(p.alpha), 0.001, 2),
    beta: clamp(Number(p.beta), 1.1, 1.99),
  };
};

const randomKeys = (size) =>
  Array.from({ length: size }, () => Math.random());

const keysToOrder = (keys, task) => {
  if (!task.fixedEndpoints || keys.length <= 2) {
    return keys
      .map((value, index) => ({ index, value }))
      .sort((a, b) => a.value - b.value)
      .map((item) => item.index);
  }

  const middle = [];
  for (let i = 1; i < keys.length - 1; i += 1) {
    middle.push({ index: i, value: keys[i] });
  }
  middle.sort((a, b) => a.value - b.value);
  return [0, ...middle.map((item) => item.index), keys.length - 1];
};

const evaluateKeys = (keys, distances, task) => {
  const order = keysToOrder(keys, task);
  const length = getLengthByTask(distances, order, task);
  return { keys, order, length };
};

const optimizeCuckooRoute = (points, rawParams, task) => {
  const n = points.length;
  if (n <= 1) return points.map(copyPoint);

  const params = sanitizeCuckooParams(rawParams);
  const distances = getDistanceMatrix(points);

  const nests = Array.from({ length: params.nests }, () =>
    evaluateKeys(randomKeys(n), distances, task)
  );
  let best = nests.reduce((acc, nest) =>
    nest.length < acc.length ? nest : acc
  );

  for (let iter = 0; iter < params.maxIterations; iter += 1) {
    for (let i = 0; i < nests.length; i += 1) {
      const source = nests[i];
      const levy = levyVector(params.beta, n);
      const candidateKeys = source.keys.map((value, idx) => {
        const attract = 0.15 * (best.keys[idx] - value);
        const noise = 0.02 * gaussianRandom();
        const moved = value + params.alpha * levy[idx] + attract + noise;
        return clamp(moved, 0, 1);
      });

      const candidate = evaluateKeys(candidateKeys, distances, task);
      const randomNestIndex = Math.floor(Math.random() * nests.length);
      if (candidate.length < nests[randomNestIndex].length) {
        nests[randomNestIndex] = candidate;
      }
    }

    const abandonCount = Math.floor(params.discoveryProbability * nests.length);
    if (abandonCount > 0) {
      const worst = nests
        .map((nest, idx) => ({ idx, length: nest.length }))
        .sort((a, b) => b.length - a.length)
        .slice(0, abandonCount);
      for (const item of worst) {
        nests[item.idx] = evaluateKeys(randomKeys(n), distances, task);
      }
    }

    const iterBest = nests.reduce((acc, nest) =>
      nest.length < acc.length ? nest : acc
    );
    if (iterBest.length < best.length) best = iterBest;
  }

  return buildRouteFromOrder(points, best.order, task);
};

const optimizeGeneticRoute = (points, rawParams, task) => {
  const n = points.length;
  if (n <= 1) return points.map(copyPoint);

  const params = sanitizeGeneticParams(rawParams);
  const distanceMatrix = getDistanceMatrix(points);
  const mutableCount = buildMutableNodes(n, task).length;
  if (mutableCount <= 1) {
    return buildRouteFromOrder(points, buildInitialOrder(n, task), task);
  }

  const populationSize = Math.max(params.populationSize, params.elitismCount + 2);
  let population = Array.from({ length: populationSize }, () =>
    evaluateGenes(
      buildRandomGenes(n, task),
      distanceMatrix,
      task,
      params.localSearchPasses
    )
  );

  const nnGenes = buildGenesFromOrder(
    buildNearestNeighborOrder(distanceMatrix, task),
    task
  );
  population[0] = evaluateGenes(
    nnGenes,
    distanceMatrix,
    task,
    params.localSearchPasses
  );

  let best = population.reduce((acc, item) =>
    item.length < acc.length ? item : acc
  );

  for (let gen = 0; gen < params.generations; gen += 1) {
    const sorted = population.slice().sort((a, b) => a.length - b.length);
    const eliteCount = Math.min(params.elitismCount, sorted.length);
    const nextPopulation = sorted.slice(0, eliteCount);

    while (nextPopulation.length < populationSize) {
      const parentA = selectTournament(sorted, params.tournamentSize);
      const parentB = selectTournament(sorted, params.tournamentSize);

      let childGenesA = parentA.genes.slice();
      let childGenesB = parentB.genes.slice();

      if (Math.random() < params.crossoverRate && childGenesA.length > 1) {
        childGenesA = orderedCrossoverGenes(parentA.genes, parentB.genes);
        childGenesB = orderedCrossoverGenes(parentB.genes, parentA.genes);
      }

      childGenesA = mutateGenes(childGenesA, params.mutationRate);
      nextPopulation.push(
        evaluateGenes(
          childGenesA,
          distanceMatrix,
          task,
          params.localSearchPasses
        )
      );

      if (nextPopulation.length < populationSize) {
        childGenesB = mutateGenes(childGenesB, params.mutationRate);
        nextPopulation.push(
          evaluateGenes(
            childGenesB,
            distanceMatrix,
            task,
            params.localSearchPasses
          )
        );
      }
    }

    population = nextPopulation;
    const generationBest = population.reduce((acc, item) =>
      item.length < acc.length ? item : acc
    );
    if (generationBest.length < best.length) best = generationBest;
  }

  return buildRouteFromOrder(points, best.order, task);
};

const optimizeAnnealingRoute = (points, rawParams, task) => {
  const n = points.length;
  if (n <= 1) return points.map(copyPoint);

  const params = sanitizeAnnealingParams(rawParams);
  const distanceMatrix = getDistanceMatrix(points);
  const mutableCount = buildMutableNodes(n, task).length;
  if (mutableCount <= 1) {
    return buildRouteFromOrder(points, buildInitialOrder(n, task), task);
  }

  const initialGenes = buildGenesFromOrder(
    buildNearestNeighborOrder(distanceMatrix, task),
    task
  );
  let current = evaluateGenes(initialGenes, distanceMatrix, task, 1);
  let best = current;
  let temperature = params.initialTemperature;
  let coolingRate = params.coolingRate;
  let accepted = 0;

  for (
    let iter = 1;
    iter <= params.maxIterations && temperature > params.minimumTemperature;
    iter += 1
  ) {
    let candidateGenes = mutateGenes(current.genes, 1);
    if (
      candidateGenes.length === current.genes.length &&
      candidateGenes.every((value, idx) => value === current.genes[idx])
    ) {
      candidateGenes = mutateGenes(current.genes, 1);
    }

    const candidate = evaluateGenes(candidateGenes, distanceMatrix, task, 0);
    const delta = candidate.length - current.length;
    const acceptProb = Math.exp(-delta / Math.max(temperature, 1e-12));

    if (delta < 0 || Math.random() < acceptProb) {
      current = candidate;
      accepted += 1;
      if (current.length < best.length) best = current;
    }

    if (iter % params.adaptationInterval === 0) {
      const acceptRatio = accepted / params.adaptationInterval;
      if (acceptRatio > 0.6) {
        coolingRate = clamp(coolingRate * 0.97, 0.85, 0.99999);
      } else if (acceptRatio < 0.1) {
        coolingRate = clamp(coolingRate * 1.02, 0.85, 0.99999);
      }
      accepted = 0;
    }

    temperature *= coolingRate;
  }

  return buildRouteFromOrder(points, best.order, task);
};

const optimizeScatterRoute = (points, rawParams, task) => {
  const n = points.length;
  if (n <= 1) return points.map(copyPoint);

  const params = sanitizeScatterParams(rawParams);
  const distanceMatrix = getDistanceMatrix(points);
  const mutableCount = buildMutableNodes(n, task).length;
  if (mutableCount <= 1) {
    return buildRouteFromOrder(points, buildInitialOrder(n, task), task);
  }

  const populationSize = Math.max(params.populationSize, params.refSetSize + 2);
  let population = Array.from({ length: populationSize }, () =>
    evaluateGenes(
      buildRandomGenes(n, task),
      distanceMatrix,
      task,
      params.localSearchPasses
    )
  );

  population[0] = evaluateGenes(
    buildGenesFromOrder(buildNearestNeighborOrder(distanceMatrix, task), task),
    distanceMatrix,
    task,
    params.localSearchPasses
  );

  let refSet = buildDiverseRefSet(
    population,
    Math.min(params.refSetSize, population.length)
  );
  let best = refSet.reduce((acc, item) =>
    item.length < acc.length ? item : acc
  );
  let noImprove = 0;

  for (
    let iter = 0;
    iter < params.maxIterations && noImprove < params.maxNoImprove;
    iter += 1
  ) {
    const pairs = [];
    for (let i = 0; i < refSet.length; i += 1) {
      for (let j = i + 1; j < refSet.length; j += 1) {
        pairs.push({
          a: refSet[i],
          b: refSet[j],
          diversity: hammingDistance(refSet[i].genes, refSet[j].genes),
        });
      }
    }

    pairs.sort((x, y) => y.diversity - x.diversity);
    const pairLimit = Math.min(params.subsetPairsLimit, pairs.length);
    const children = [];

    for (let i = 0; i < pairLimit; i += 1) {
      const pair = pairs[i];
      let genes1 = orderedCrossoverGenes(pair.a.genes, pair.b.genes);
      let genes2 = orderedCrossoverGenes(pair.b.genes, pair.a.genes);
      genes1 = mutateGenes(genes1, params.mutationRate);
      genes2 = mutateGenes(genes2, params.mutationRate);

      children.push(
        evaluateGenes(
          genes1,
          distanceMatrix,
          task,
          params.localSearchPasses
        )
      );
      children.push(
        evaluateGenes(
          genes2,
          distanceMatrix,
          task,
          params.localSearchPasses
        )
      );
    }

    if (children.length === 0) break;

    const merged = population.concat(children).sort((a, b) => a.length - b.length);
    population = merged.slice(0, populationSize);
    refSet = buildDiverseRefSet(
      merged.slice(0, Math.min(merged.length, populationSize * 2)),
      Math.min(params.refSetSize, populationSize)
    );

    const iterBest = refSet.reduce((acc, item) =>
      item.length < acc.length ? item : acc
    );
    if (iterBest.length < best.length) {
      best = iterBest;
      noImprove = 0;
    } else {
      noImprove += 1;
    }
  }

  return buildRouteFromOrder(points, best.order, task);
};

const ALGORITHMS = {
  aco: {
    key: "aco",
    label: "Муравьиный алгоритм (ACO)",
    fields: [
      {
        key: "max_iterations",
        label: "Кол-во итераций",
        min: 1,
        max: 5000,
        step: 1,
        integer: true,
      },
      {
        key: "max_iterations_without_improvement",
        label: "Итераций без улучшений",
        min: 1,
        max: 2000,
        step: 1,
        integer: true,
      },
      {
        key: "elite_ants_count",
        label: "Кол-во элитных муравьев",
        min: 1,
        max: 50,
        step: 1,
        integer: true,
      },
      {
        key: "evaporation",
        label: "Испарение феромона",
        min: 0.000001,
        max: 0.95,
        step: 0.0001,
      },
      {
        key: "pheromone0",
        label: "Начальный феромон",
        min: 0.000001,
        max: 1000,
        step: 0.01,
      },
      {
        key: "q",
        label: "Коэффициент Q",
        min: 0.000001,
        max: 1000000,
        step: 0.1,
      },
      {
        key: "tests_count",
        label: "Множитель числа муравьев",
        min: 1,
        max: 20,
        step: 1,
        integer: true,
      },
    ],
    defaults: DEFAULT_ACO_PARAMS,
    optimize: optimizeAcoRoute,
  },
  cuckoo: {
    key: "cuckoo",
    label: "Метод кукушки",
    fields: [
      {
        key: "nests",
        label: "Количество гнезд",
        min: 5,
        max: 250,
        step: 1,
        integer: true,
      },
      {
        key: "discovery_probability",
        label: "Вероятность обнаружения p_a",
        min: 0.01,
        max: 0.9,
        step: 0.01,
      },
      {
        key: "max_iterations",
        label: "Максимум итераций",
        min: 1,
        max: 5000,
        step: 1,
        integer: true,
      },
      {
        key: "alpha",
        label: "Шаг Леви alpha",
        min: 0.001,
        max: 2,
        step: 0.01,
      },
      {
        key: "beta",
        label: "Параметр Леви beta",
        min: 1.1,
        max: 1.99,
        step: 0.01,
      },
    ],
    defaults: DEFAULT_CUCKOO_PARAMS,
    optimize: optimizeCuckooRoute,
  },
  genetik: {
    key: "genetik",
    label: "Генетический алгоритм",
    fields: [
      {
        key: "population_size",
        label: "Размер популяции",
        min: 8,
        max: 1200,
        step: 1,
        integer: true,
      },
      {
        key: "generations",
        label: "Поколения",
        min: 1,
        max: 10000,
        step: 1,
        integer: true,
      },
      {
        key: "crossover_rate",
        label: "Вероятность скрещивания",
        min: 0,
        max: 1,
        step: 0.01,
      },
      {
        key: "mutation_rate",
        label: "Вероятность мутации",
        min: 0,
        max: 1,
        step: 0.01,
      },
      {
        key: "elitism_count",
        label: "Элитных решений",
        min: 0,
        max: 100,
        step: 1,
        integer: true,
      },
      {
        key: "tournament_size",
        label: "Размер турнира",
        min: 2,
        max: 20,
        step: 1,
        integer: true,
      },
      {
        key: "local_search_passes",
        label: "Локальных улучшений",
        min: 0,
        max: 4,
        step: 1,
        integer: true,
      },
    ],
    defaults: DEFAULT_GENETIC_PARAMS,
    optimize: optimizeGeneticRoute,
  },
  otshig: {
    key: "otshig",
    label: "Имитация отжига",
    fields: [
      {
        key: "initial_temperature",
        label: "Начальная температура",
        min: 0.000001,
        max: 1000000,
        step: 0.1,
      },
      {
        key: "minimum_temperature",
        label: "Минимальная температура",
        min: 0.0000001,
        max: 10000,
        step: 0.0001,
      },
      {
        key: "cooling_rate",
        label: "Коэффициент охлаждения",
        min: 0.8,
        max: 0.99999,
        step: 0.0001,
      },
      {
        key: "max_iterations",
        label: "Максимум итераций",
        min: 1,
        max: 200000,
        step: 1,
        integer: true,
      },
      {
        key: "adaptation_interval",
        label: "Интервал адаптации",
        min: 10,
        max: 2000,
        step: 1,
        integer: true,
      },
    ],
    defaults: DEFAULT_ANNEALING_PARAMS,
    optimize: optimizeAnnealingRoute,
  },
  rasseivanie: {
    key: "rasseivanie",
    label: "Алгоритм рассеивания",
    fields: [
      {
        key: "population_size",
        label: "Размер популяции",
        min: 10,
        max: 1200,
        step: 1,
        integer: true,
      },
      {
        key: "refset_size",
        label: "Размер RefSet",
        min: 4,
        max: 80,
        step: 1,
        integer: true,
      },
      {
        key: "max_iterations",
        label: "Максимум итераций",
        min: 1,
        max: 3000,
        step: 1,
        integer: true,
      },
      {
        key: "max_no_improvement",
        label: "Итераций без улучшения",
        min: 1,
        max: 800,
        step: 1,
        integer: true,
      },
      {
        key: "subset_pairs_limit",
        label: "Лимит пар подмножеств",
        min: 1,
        max: 500,
        step: 1,
        integer: true,
      },
      {
        key: "mutation_rate",
        label: "Вероятность мутации",
        min: 0,
        max: 1,
        step: 0.01,
      },
      {
        key: "local_search_passes",
        label: "Локальных улучшений",
        min: 0,
        max: 4,
        step: 1,
        integer: true,
      },
    ],
    defaults: DEFAULT_SCATTER_PARAMS,
    optimize: optimizeScatterRoute,
  },
};

export const ALGORITHM_OPTIONS = Object.values(ALGORITHMS).map((item) => ({
  key: item.key,
  label: item.label,
}));

export const getAlgorithmLabel = (key) =>
  ALGORITHMS[key]?.label || ALGORITHMS.aco.label;

export const getAlgorithmFields = (key) =>
  ALGORITHMS[key]?.fields || ALGORITHMS.aco.fields;

export const getDefaultAlgorithmParams = (key) => ({
  ...(ALGORITHMS[key]?.defaults || ALGORITHMS.aco.defaults),
});

export const optimizeRouteWithAlgorithm = (
  points,
  algorithmKey,
  params,
  taskKey = "tsp"
) => {
  const algorithm = ALGORITHMS[algorithmKey] || ALGORITHMS.aco;
  const task = resolveTask(taskKey);

  if (isExactTask(task)) {
    return optimizeExactTaskRoute(points, task);
  }

  return algorithm.optimize(points, params, task);
};
