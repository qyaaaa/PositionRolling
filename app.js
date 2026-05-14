const defaultState = {
  schemaVersion: 8,
  direction: "long",
  equity: 100,
  leverage: 25,
  maintenanceRate: 0.5,
  feeRate: 0.04,
  targetPrice: 0.145,
  stopPrice: 0.088,
  legs: [
    { price: 0.1, leverage: 25 },
    { price: 0.104, leverage: 25 },
    { price: 0.108, leverage: 20 },
    { price: 0.112, leverage: 20 },
    { price: 0.116, leverage: 15 },
    { price: 0.12, leverage: 10 },
    { price: 0.124, leverage: 5 },
    { price: 0.128, leverage: 5 },
    { price: 0.132, leverage: 3 },
    { price: 0.136, leverage: 3 },
  ],
};

const defaultLeverageSteps = [25, 25, 20, 20, 15, 10, 5, 5, 3, 3];

const fields = [
  "direction",
  "equity",
  "leverage",
  "maintenanceRate",
  "feeRate",
  "targetPrice",
  "stopPrice",
];

let state = loadState();

const $ = (id) => document.getElementById(id);
const money = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compact = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

function loadState() {
  try {
    const stored = localStorage.getItem("position-rolling-state");
    const parsed = stored ? JSON.parse(stored) : null;
    return parsed?.schemaVersion === defaultState.schemaVersion
      ? normalizeState({ ...defaultState, ...parsed })
      : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeState(value) {
  return {
    ...value,
    legs: (value.legs || defaultState.legs).map((leg) => ({
      price: toNumber(leg.price),
      leverage: Math.max(toNumber(leg.leverage, value.leverage || defaultState.leverage), 1),
    })),
  };
}

function persist() {
  localStorage.setItem("position-rolling-state", JSON.stringify(state));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pct(value) {
  return toNumber(value) / 100;
}

function priceChange(price, basePrice) {
  if (!price || !basePrice) return 0;
  return ((price - basePrice) / basePrice) * 100;
}

function signedCoinPnl(price, avgEntry, quantity, direction) {
  if (!price || !avgEntry || !quantity) return 0;
  return direction === "long"
    ? (quantity * (price - avgEntry)) / price
    : (quantity * (avgEntry - price)) / price;
}

function feeInCoin(notionalUsd, price, feeRate) {
  if (!notionalUsd || !price) return 0;
  return (notionalUsd * feeRate) / price;
}

function liquidationPriceForCoinMargin(entryPrice, leverage, maintenanceRate, direction) {
  if (!entryPrice || !leverage) return 0;
  if (direction === "long") {
    return (entryPrice * leverage * (1 + maintenanceRate)) / (1 + leverage);
  }
  if (leverage <= 1) return 0;
  return (entryPrice * leverage * (1 - maintenanceRate)) / (leverage - 1);
}

function solveBreakEvenPrice(entryPrice, quantity, realizedPnl, notionalUsd, feeRate, direction) {
  if (!entryPrice || !quantity || !notionalUsd) return 0;
  let low = entryPrice * 0.01;
  let high = entryPrice * 4;

  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    const pnl = realizedPnl + signedCoinPnl(mid, entryPrice, quantity, direction) - feeInCoin(notionalUsd, mid, feeRate);
    if (direction === "long") {
      if (pnl >= 0) high = mid;
      else low = mid;
    } else if (pnl >= 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

function calculate() {
  const equityUsd = Math.max(toNumber(state.equity), 0);
  const feeRate = pct(state.feeRate);
  const maintenanceRate = pct(state.maintenanceRate);
  const validLegs = state.legs
    .map((leg) => ({
      price: Math.max(toNumber(leg.price), 0),
      leverage: Math.max(toNumber(leg.leverage, state.leverage), 1),
    }))
    .filter((leg) => leg.price > 0);
  const basePrice = validLegs[0]?.price || 0;
  const initialCoinEquity = basePrice > 0 ? equityUsd / basePrice : 0;
  let rollingEquity = initialCoinEquity;
  let previousPosition = null;
  let realizedPnl = 0;
  let realizedFees = 0;
  let totalOpenFees = 0;

  const enriched = validLegs.map((leg) => {
    const transitionPnl = previousPosition
      ? signedCoinPnl(leg.price, previousPosition.price, previousPosition.quantity, state.direction)
      : 0;
    const transitionFee = previousPosition ? feeInCoin(previousPosition.notional, leg.price, feeRate) : 0;

    realizedPnl += transitionPnl - transitionFee;
    realizedFees += transitionFee;
    rollingEquity = Math.max(rollingEquity + transitionPnl - transitionFee, 0);

    const margin = rollingEquity;
    const quantity = margin * leg.leverage;
    const notional = quantity * leg.price;
    const row = {
      ...leg,
      changePercent: priceChange(leg.price, basePrice),
      transitionPnl,
      transitionFee,
      margin,
      notional,
      quantity,
      liquidationPrice: liquidationPriceForCoinMargin(leg.price, leg.leverage, maintenanceRate, state.direction),
    };

    totalOpenFees += feeInCoin(notional, leg.price, feeRate);
    previousPosition = row;
    return row;
  });

  const currentPosition = enriched.at(-1) || null;
  const totalNotional = currentPosition?.notional || 0;
  const totalQuantity = currentPosition?.quantity || 0;
  const marginUsed = currentPosition?.margin || 0;
  const avgEntry = currentPosition?.price || 0;
  const averageLeverage = currentPosition?.leverage || 0;
  const openFee = currentPosition ? feeInCoin(currentPosition.notional, currentPosition.price, feeRate) : 0;
  const closeFee = currentPosition ? feeInCoin(currentPosition.notional, currentPosition.price, feeRate) : 0;
  const estimatedFees = totalOpenFees + realizedFees + closeFee;
  const usedWithFees = marginUsed + openFee;
  const availableCash = currentPosition ? 0 : initialCoinEquity;
  const capitalUsage = marginUsed > 0 ? 1 : 0;
  const liquidationPrice = liquidationPriceForCoinMargin(avgEntry, averageLeverage, maintenanceRate, state.direction);
  const breakEvenPrice = solveBreakEvenPrice(avgEntry, totalQuantity, realizedPnl, totalNotional, feeRate, state.direction);
  const targetCloseFee = feeInCoin(totalNotional, toNumber(state.targetPrice), feeRate);
  const stopCloseFee = feeInCoin(totalNotional, toNumber(state.stopPrice), feeRate);
  const targetPnl =
    realizedPnl + signedCoinPnl(toNumber(state.targetPrice), avgEntry, totalQuantity, state.direction) - targetCloseFee;
  const stopPnl =
    realizedPnl + signedCoinPnl(toNumber(state.stopPrice), avgEntry, totalQuantity, state.direction) - stopCloseFee;

  return {
    enriched,
    totalNotional,
    totalQuantity,
    marginUsed,
    avgEntry,
    averageLeverage,
    openFee,
    closeFee,
    estimatedFees,
    usedWithFees,
    availableCash,
    capitalUsage,
    realizedPnl,
    rollingEquity,
    initialCoinEquity,
    equityUsd,
    liquidationPrice,
    breakEvenPrice,
    targetPnl,
    stopPnl,
  };
}

function formatMoney(value) {
  if (!Number.isFinite(value) || value === 0) return value === 0 ? "0.00" : "-";
  return money.format(value);
}

function formatCoin(value) {
  if (!Number.isFinite(value) || value === 0) return value === 0 ? "0.0000" : "-";
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}

function formatPrice(value) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  const digits = value < 10 ? 4 : 2;
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: value < 10 ? 6 : 2,
  }).format(value);
}

function formatQuantity(value) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return compact.format(value);
}

function coinToUsd(coinAmount, price) {
  if (!Number.isFinite(coinAmount) || !Number.isFinite(price)) return 0;
  return coinAmount * price;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function renderRows() {
  const body = $("legsBody");
  body.innerHTML = "";
  const result = calculate();
  const basePrice = state.legs.find((leg) => toNumber(leg.price) > 0)?.price || 0;

  state.legs.forEach((leg, index) => {
    const computed = result.enriched[index];
    const change = priceChange(toNumber(leg.price), toNumber(basePrice));
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="row-index">#${index + 1}</td>
      <td><input class="leg-input" type="number" min="0" step="0.0001" inputmode="decimal" value="${leg.price}" data-index="${index}" data-key="price" aria-label="第 ${index + 1} 笔成交价"></td>
      <td class="readonly-cell ${change >= 0 ? "positive" : "negative"}" data-change="${index}">${formatPercent(change)}</td>
      <td class="readonly-cell ${computed?.transitionPnl >= 0 ? "positive" : "negative"}" data-profit="${index}">${formatCoin(computed?.transitionPnl || 0)}</td>
      <td class="readonly-cell" data-margin="${index}">${formatCoin(computed?.margin || 0)}</td>
      <td class="readonly-cell" data-margin-usdt="${index}">${formatMoney(coinToUsd(computed?.margin || 0, computed?.price || toNumber(leg.price)))}</td>
      <td><input class="leg-input" type="number" min="1" step="1" inputmode="numeric" value="${leg.leverage ?? state.leverage}" data-index="${index}" data-key="leverage" aria-label="第 ${index + 1} 笔杠杆倍数"></td>
      <td class="readonly-cell" data-liquidation="${index}">${formatPrice(computed?.liquidationPrice || 0)}</td>
      <td><button class="delete-button" type="button" data-delete="${index}" title="删除第 ${index + 1} 笔" aria-label="删除第 ${index + 1} 笔">×</button></td>
    `;
    body.appendChild(row);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderMetrics(result) {
  $("totalNotional").textContent = formatMoney(result.totalNotional);
  $("totalQuantity").textContent = formatQuantity(result.totalQuantity);
  $("avgEntry").textContent = formatPrice(result.avgEntry);
  $("averageLeverage").textContent = result.averageLeverage > 0 ? `${result.averageLeverage.toFixed(2)}x` : "-";
  $("marginUsed").textContent = formatMoney(coinToUsd(result.marginUsed, result.avgEntry));
  $("capitalUsage").textContent = `${(result.capitalUsage * 100).toFixed(2)}%`;
  $("availableCash").textContent = formatMoney(coinToUsd(result.availableCash, result.avgEntry || toNumber(state.targetPrice)));
  $("liquidationPrice").textContent = formatPrice(result.liquidationPrice);
  $("breakEvenPrice").textContent = formatPrice(result.breakEvenPrice);
  $("estimatedFees").textContent = formatCoin(result.estimatedFees);
  setPnl("targetPnl", result.targetPnl, result.marginUsed);
  setPnl("stopPnl", result.stopPnl, result.marginUsed);
  renderRisk(result);
}

function setPnl(id, pnl, marginUsed) {
  const el = $(id);
  const roe = marginUsed > 0 ? (pnl / marginUsed) * 100 : 0;
  el.textContent = `${formatCoin(pnl)} (${roe.toFixed(2)}%)`;
  el.classList.toggle("positive", pnl >= 0);
  el.classList.toggle("negative", pnl < 0);
}

function renderRisk(result) {
  const badge = $("riskBadge");
  const usage = result.capitalUsage;
  badge.className = "risk-badge";
  if (usage >= 0.99) {
    badge.textContent = "满仓";
    badge.classList.add("warn");
  } else if (result.availableCash < 0 || usage > 0.85) {
    badge.textContent = "高风险";
    badge.classList.add("danger");
  } else if (usage > 0.65) {
    badge.textContent = "偏紧";
    badge.classList.add("warn");
  } else {
    badge.textContent = "可用";
  }
}

function renderChart(result) {
  const canvas = $("ladderChart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(rect.width * dpr, 320);
  canvas.height = 300 * dpr;
  ctx.scale(dpr, dpr);

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  ctx.clearRect(0, 0, width, height);

  const prices = [
    ...result.enriched.map((leg) => leg.price),
    result.avgEntry,
    result.liquidationPrice,
    toNumber(state.targetPrice),
    toNumber(state.stopPrice),
  ].filter((price) => Number.isFinite(price) && price > 0);

  if (!prices.length) {
    drawEmptyChart(ctx, width, height);
    return;
  }

  const legPrices = result.enriched.map((leg) => leg.price).filter((price) => Number.isFinite(price) && price > 0);
  const scalePrices = legPrices.length ? legPrices : prices;
  const min = Math.min(...scalePrices);
  const max = Math.max(...scalePrices);
  const padding = Math.max((max - min) * 0.12, max * 0.015);
  const low = Math.max(min - padding, 0);
  const high = max + padding;
  const chart = {
    left: width < 620 ? 38 : 54,
    right: width < 620 ? 38 : 54,
    top: 42,
    axisY: Math.round(height * 0.58),
    bottom: height - 54,
  };
  const range = high - low || 1;
  const x = (price) =>
    chart.left + Math.min(Math.max((price - low) / range, 0), 1) * (width - chart.left - chart.right);

  drawAxis(ctx, width, height, low, high, chart);
  drawLadderPath(ctx, result.enriched, x, chart);
  drawPriceLines(ctx, result, x, chart, height);
  result.enriched.forEach((leg, index) => {
    drawMarker(ctx, x(leg.price), chart.axisY, "#f4f7fb", `#${index + 1}`, leg.price, {
      flip: index % 2 === 1,
      leverage: leg.leverage,
      changePercent: leg.changePercent,
      showPrice: width >= 760 || index % 2 === 0,
      showChange: width >= 620,
    });
  });
}

function drawEmptyChart(ctx, width, height) {
  ctx.fillStyle = "#8b9aae";
  ctx.font = "700 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("添加滚仓批次后显示价格阶梯", width / 2, height / 2);
}

function drawAxis(ctx, width, height, low, high, chart) {
  const { left, right, axisY, bottom } = chart;
  ctx.strokeStyle = "#263241";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i += 1) {
    const x = left + ((width - left - right) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(x, axisY - 74);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(244, 247, 251, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, axisY);
  ctx.lineTo(width - right, axisY);
  ctx.stroke();

  ctx.fillStyle = "#8b9aae";
  ctx.font = "700 12px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(formatPrice(low), left, bottom + 26);
  ctx.textAlign = "right";
  ctx.fillText(formatPrice(high), width - right, bottom + 26);

  ctx.fillStyle = "#f4f7fb";
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("价格升高 → 杠杆降低", width / 2, 20);
}

function drawLadderPath(ctx, legs, xForPrice, chart) {
  if (!legs.length) return;
  const points = legs.map((leg) => ({
    x: xForPrice(leg.price),
    y: chart.axisY,
  }));

  ctx.strokeStyle = "rgba(53, 208, 170, 0.5)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  ctx.lineCap = "butt";
}

function drawMarker(ctx, x, y, color, label, price, options = {}) {
  const { showPrice = true, showChange = true, flip = false, leverage, changePercent } = options;
  const changeY = flip ? y + 84 : y - 74;
  const leverageY = flip ? y + 66 : y - 56;
  const labelY = flip ? y + 48 : y - 38;
  const priceY = flip ? y + 30 : y - 20;

  ctx.strokeStyle = "rgba(53, 208, 170, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, flip ? y + 10 : y - 10);
  ctx.lineTo(x, flip ? y + 30 : y - 24);
  ctx.stroke();

  ctx.strokeStyle = "rgba(5, 7, 10, 0.9)";
  ctx.lineWidth = 3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 8.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();

  ctx.fillStyle = "#f4f7fb";
  ctx.font = "800 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(label, x, labelY);
  if (leverage) {
    ctx.fillStyle = "#35d0aa";
    ctx.font = "900 12px system-ui";
    ctx.fillText(`${leverage}x`, x, leverageY);
  }
  if (showPrice) {
    ctx.fillStyle = "#8b9aae";
    ctx.font = "750 11px system-ui";
    ctx.fillText(formatPrice(price), x, priceY);
  }
  if (showChange) {
    ctx.fillStyle = "#72f0cf";
    ctx.font = "800 10px system-ui";
    ctx.fillText(formatPercent(changePercent), x, changeY);
  }
}

function drawPriceLines(ctx, result, xForPrice, chart, height) {
  const markers = [
    { price: result.liquidationPrice, color: "#ff6b74", label: "强平", lane: 0 },
    { price: result.avgEntry, color: "#35d0aa", label: "当前", lane: 1 },
    { price: toNumber(state.targetPrice), color: "#74a7ff", label: "目标", lane: 2 },
    { price: toNumber(state.stopPrice), color: "#f2b84b", label: "止损", lane: 3 },
  ];

  markers
    .filter((marker) => Number.isFinite(marker.price) && marker.price > 0)
    .forEach((marker) => drawLineMarker(ctx, xForPrice(marker.price), chart, height, marker.color, marker.label, marker.lane));
}

function drawLineMarker(ctx, x, chart, height, color, label, lane = 0) {
  const top = 36 + lane * 16;
  const bottom = chart.bottom;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = color;
  ctx.font = "900 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(label, x, Math.max(20, top - 7));
}

function renderResults() {
  fields.forEach((field) => {
    const el = $(field);
    if (el && document.activeElement !== el) el.value = state[field];
  });
  const result = calculate();
  renderMetrics(result);
  renderChart(result);
  persist();
}

function render() {
  renderRows();
  renderResults();
}

function updateField(event) {
  const { id, value } = event.target;
  if (!fields.includes(id)) return;
  state[id] = id === "direction" ? value : toNumber(value);
  render();
}

function updateLeg(event) {
  const target = event.target;
  const index = Number(target.dataset.index);
  const key = target.dataset.key;
  if (!Number.isInteger(index) || !key) return;
  state.legs[index][key] = toNumber(target.value);
  refreshComputedRows();
  renderResults();
}

function refreshComputedRows() {
  const result = calculate();
  const basePrice = state.legs.find((leg) => toNumber(leg.price) > 0)?.price || 0;

  state.legs.forEach((leg, index) => {
    const changeCell = document.querySelector(`[data-change="${index}"]`);
    const profitCell = document.querySelector(`[data-profit="${index}"]`);
    const marginCell = document.querySelector(`[data-margin="${index}"]`);
    const marginUsdtCell = document.querySelector(`[data-margin-usdt="${index}"]`);
    const liquidationCell = document.querySelector(`[data-liquidation="${index}"]`);
    const computed = result.enriched[index];
    const change = priceChange(toNumber(leg.price), toNumber(basePrice));

    if (changeCell) {
      changeCell.textContent = formatPercent(change);
      changeCell.classList.toggle("positive", change >= 0);
      changeCell.classList.toggle("negative", change < 0);
    }
    if (profitCell) {
      profitCell.textContent = formatCoin(computed?.transitionPnl || 0);
      profitCell.classList.toggle("positive", (computed?.transitionPnl || 0) >= 0);
      profitCell.classList.toggle("negative", (computed?.transitionPnl || 0) < 0);
    }
    if (marginCell) marginCell.textContent = formatCoin(computed?.margin || 0);
    if (marginUsdtCell) {
      marginUsdtCell.textContent = formatMoney(coinToUsd(computed?.margin || 0, computed?.price || toNumber(leg.price)));
    }
    if (liquidationCell) liquidationCell.textContent = formatPrice(computed?.liquidationPrice || 0);
  });
}

function addLeg() {
  const last = state.legs.at(-1) || {
    price: toNumber(state.targetPrice) || 0.1,
    leverage: toNumber(state.leverage, 25),
  };
  const priceMultiplier = state.direction === "long" ? 1.04 : 0.96;
  const nextIndex = state.legs.length;
  state.legs.push({
    price: roundPrice(last.price * priceMultiplier),
    leverage: defaultLeverageSteps[nextIndex] || Math.max(toNumber(last.leverage, state.leverage), 1),
  });
  render();
}

function roundPrice(value) {
  const digits = value < 10 ? 10000 : 100;
  return Math.max(Math.round(value * digits) / digits, 0);
}

function deleteLeg(event) {
  const index = Number(event.target.dataset.delete);
  if (!Number.isInteger(index)) return;
  state.legs.splice(index, 1);
  if (!state.legs.length) state.legs.push({ price: 0, leverage: state.leverage });
  render();
}

function reset() {
  state = structuredClone(defaultState);
  render();
  showToast("已恢复示例数据");
}

async function exportResult() {
  const result = calculate();
  const lines = [
    "Position Rolling 计算结果",
    `方向：${state.direction === "long" ? "做多" : "做空"}`,
    `账户权益：${formatMoney(state.equity)} USDT`,
    `初始币本位保证金：${formatCoin(result.initialCoinEquity)} DOGE`,
    `投入方式：按首仓价把 USDT 本金换算为 DOGE 保证金，之后逐档全仓复投`,
    `当前杠杆：${result.averageLeverage.toFixed(2)}x`,
    `总名义价值：${formatMoney(result.totalNotional)} USDT`,
    `仓位数量：${formatQuantity(result.totalQuantity)} DOGE`,
    `持仓均价：${formatPrice(result.avgEntry)}`,
    `当前保证金：${formatMoney(coinToUsd(result.marginUsed, result.avgEntry))} USDT`,
    `剩余可用：${formatMoney(coinToUsd(result.availableCash, result.avgEntry || toNumber(state.targetPrice)))} USDT`,
    `预估强平价：${formatPrice(result.liquidationPrice)}`,
    `盈亏平衡价：${formatPrice(result.breakEvenPrice)}`,
    `目标价盈亏：${formatCoin(result.targetPnl)} DOGE`,
    `止损价盈亏：${formatCoin(result.stopPnl)} DOGE`,
    "滚仓档位：",
    ...result.enriched.map(
      (leg, index) =>
        `#${index + 1} ${formatPrice(leg.price)} / 涨幅 ${formatPercent(leg.changePercent)} / 本次收益 ${formatCoin(leg.transitionPnl)} DOGE / 全仓投入币数 ${formatCoin(leg.margin)} DOGE / 折合 ${formatMoney(coinToUsd(leg.margin, leg.price))} USDT / ${leg.leverage}x / 强平 ${formatPrice(leg.liquidationPrice)}`,
    ),
  ];

  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    showToast("结果已复制到剪贴板");
  } catch {
    const text = lines.join("\n");
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    showToast(copied ? "结果已复制到剪贴板" : "复制失败，请检查浏览器权限");
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

fields.forEach((field) => {
  $(field).addEventListener("input", updateField);
  $(field).addEventListener("change", updateField);
});
$("legsBody").addEventListener("input", updateLeg);
$("legsBody").addEventListener("click", deleteLeg);
$("addLegButton").addEventListener("click", addLeg);
$("resetButton").addEventListener("click", reset);
$("exportButton").addEventListener("click", exportResult);
window.addEventListener("resize", () => renderChart(calculate()));

render();
