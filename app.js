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
let chartPointer = null;

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
  canvas.height = 360 * dpr;
  ctx.scale(dpr, dpr);

  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  ctx.clearRect(0, 0, width, height);

  if (!result.enriched.length) {
    drawEmptyChart(ctx, width, height);
    return;
  }

  const candles = buildRollingCandles(result.enriched);
  const prices = [
    ...candles.flatMap((candle) => [candle.high, candle.low, candle.open, candle.close]),
    result.avgEntry,
    result.liquidationPrice,
    toNumber(state.targetPrice),
    toNumber(state.stopPrice),
  ].filter((price) => Number.isFinite(price) && price > 0);

  if (!prices.length) {
    drawEmptyChart(ctx, width, height);
    return;
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padding = Math.max((max - min) * 0.08, max * 0.012);
  const low = Math.max(min - padding, 0);
  const high = max + padding;
  const chart = {
    left: 18,
    right: width < 620 ? 62 : 78,
    top: 30,
    priceBottom: height - 38,
    leverageLabelY: height - 52,
    timeY: height - 12,
  };
  const range = high - low || 1;
  const xForIndex = (index) =>
    chart.left +
    (result.enriched.length === 1 ? 0.5 : index / (result.enriched.length - 1)) * (width - chart.left - chart.right);
  const yForPrice = (price) =>
    chart.priceBottom - Math.min(Math.max((price - low) / range, 0), 1) * (chart.priceBottom - chart.top);
  const hoverIndex = chartPointer ? getHoverIndex(chartPointer, candles.length, xForIndex, chart, width) : null;

  drawTvBackground(ctx, width, height, chart);
  drawTvGrid(ctx, width, chart, low, high, yForPrice, candles, xForIndex);
  drawTvHeader(ctx, candles, hoverIndex);
  drawTvRiskLines(ctx, result, yForPrice, chart, width);
  drawTvCandles(ctx, candles, xForIndex, yForPrice, chart, width, hoverIndex);
  drawTvLeverageLabels(ctx, candles, xForIndex, chart, hoverIndex);
  drawTvTimeAxis(ctx, candles, xForIndex, chart);
  drawTvCrosshair(ctx, chartPointer, hoverIndex, candles, xForIndex, yForPrice, chart, width, height);
}

function drawEmptyChart(ctx, width, height) {
  ctx.fillStyle = "#8b9aae";
  ctx.font = "700 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("添加滚仓批次后显示价格阶梯", width / 2, height / 2);
}

function buildRollingCandles(legs) {
  return legs.map((leg, index) => {
    const previousPrice =
      legs[index - 1]?.price || leg.price * (state.direction === "long" ? 0.98 : 1.02);
    const open = previousPrice;
    const close = leg.price;
    const body = Math.max(Math.abs(close - open), leg.price * 0.006);
    const high = Math.max(open, close) + body * 0.48;
    const low = Math.max(Math.min(open, close) - body * 0.48, leg.price * 0.01);

    return {
      ...leg,
      close,
      high,
      index,
      low,
      open,
    };
  });
}

function drawTvBackground(ctx, width, height, chart) {
  ctx.fillStyle = "#0d131b";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#1f2a36";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width - chart.right, chart.top);
  ctx.lineTo(width - chart.right, chart.priceBottom);
  ctx.moveTo(chart.left, chart.priceBottom);
  ctx.lineTo(width - chart.right, chart.priceBottom);
  ctx.stroke();
}

function drawTvGrid(ctx, width, chart, low, high, yForPrice, candles, xForIndex) {
  const priceTicks = 5;
  ctx.strokeStyle = "rgba(139, 154, 174, 0.14)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#7d8b9d";
  ctx.font = "700 11px system-ui";

  for (let i = 0; i <= priceTicks; i += 1) {
    const price = high - ((high - low) / priceTicks) * i;
    const y = yForPrice(price);
    ctx.beginPath();
    ctx.moveTo(chart.left, y);
    ctx.lineTo(width - chart.right, y);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillText(formatPrice(price), width - chart.right + 8, y + 4);
  }

  const stride = Math.max(Math.ceil(candles.length / 6), 1);
  candles.forEach((_, index) => {
    if (index % stride !== 0 && index !== candles.length - 1) return;
    const x = xForIndex(index);
    ctx.beginPath();
    ctx.moveTo(x, chart.top);
    ctx.lineTo(x, chart.priceBottom);
    ctx.stroke();
  });
}

function drawTvHeader(ctx, candles, hoverIndex) {
  const candle = candles[hoverIndex ?? candles.length - 1];
  const up = candle.close >= candle.open;
  const color = up ? "#26a69a" : "#ef5350";
  const change = ((candle.close - candle.open) / candle.open) * 100;

  ctx.fillStyle = "#d7dee8";
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("DOGEUSDT · Rolling Plan · 4% tier", 18, 19);

  ctx.font = "800 11px system-ui";
  ctx.fillStyle = "#8b9aae";
  ctx.fillText(`O ${formatPrice(candle.open)}`, 18, 38);
  ctx.fillText(`H ${formatPrice(candle.high)}`, 102, 38);
  ctx.fillText(`L ${formatPrice(candle.low)}`, 186, 38);
  ctx.fillStyle = color;
  ctx.fillText(`C ${formatPrice(candle.close)}  ${formatPercent(change)}`, 270, 38);
}

function drawTvRiskLines(ctx, result, yForPrice, chart, width) {
  const markers = [
    { price: toNumber(state.targetPrice), color: "#2962ff", label: "目标" },
    { price: result.avgEntry, color: "#26a69a", label: "当前" },
    { price: result.liquidationPrice, color: "#ef5350", label: "强平" },
    { price: toNumber(state.stopPrice), color: "#f6b84b", label: "止损" },
  ];

  markers
    .filter((marker) => Number.isFinite(marker.price) && marker.price > 0)
    .forEach((marker) => {
      const y = yForPrice(marker.price);
      ctx.strokeStyle = marker.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(chart.left, y);
      ctx.lineTo(width - chart.right, y);
      ctx.stroke();
      ctx.setLineDash([]);

      const text = `${marker.label} ${formatPrice(marker.price)}`;
      ctx.font = "900 11px system-ui";
      const labelWidth = ctx.measureText(text).width + 12;
      ctx.fillStyle = marker.color;
      roundRect(ctx, width - chart.right + 5, y - 10, labelWidth, 20, 4);
      ctx.fill();
      ctx.fillStyle = "#071016";
      ctx.textAlign = "left";
      ctx.fillText(text, width - chart.right + 11, y + 4);
    });
}

function drawTvCandles(ctx, candles, xForIndex, yForPrice, chart, width, hoverIndex) {
  const stepWidth = candles.length > 1 ? (width - chart.left - chart.right) / (candles.length - 1) : 72;
  const candleWidth = Math.max(Math.min(stepWidth * 0.58, 34), 10);

  candles.forEach((candle, index) => {
    const x = xForIndex(index);
    const highY = yForPrice(candle.high);
    const lowY = yForPrice(candle.low);
    const openY = yForPrice(candle.open);
    const closeY = yForPrice(candle.close);
    const top = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(closeY - openY), 5);
    const up = candle.close >= candle.open;
    const color = up ? "#26a69a" : "#ef5350";

    ctx.globalAlpha = hoverIndex === null || hoverIndex === index ? 1 : 0.56;
    ctx.strokeStyle = color;
    ctx.lineWidth = hoverIndex === index ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    ctx.fillStyle = up ? "rgba(38, 166, 154, 0.9)" : "rgba(239, 83, 80, 0.9)";
    ctx.fillRect(x - candleWidth / 2, top, candleWidth, bodyHeight);
    ctx.strokeRect(x - candleWidth / 2, top, candleWidth, bodyHeight);
    ctx.globalAlpha = 1;
  });
}

function drawTvLeverageLabels(ctx, candles, xForIndex, chart, hoverIndex) {
  ctx.font = "900 11px system-ui";
  ctx.textAlign = "center";
  candles.forEach((candle, index) => {
    const x = xForIndex(index);
    const hot = candle.leverage >= 15;

    ctx.globalAlpha = hoverIndex === null || hoverIndex === index ? 1 : 0.52;
    ctx.fillStyle = hot ? "#f6b84b" : "#26a69a";
    ctx.fillText(`${candle.leverage}x`, x, chart.leverageLabelY);
  });
  ctx.globalAlpha = 1;
}

function drawTvTimeAxis(ctx, candles, xForIndex, chart) {
  const stride = Math.max(Math.ceil(candles.length / 6), 1);
  ctx.fillStyle = "#7d8b9d";
  ctx.font = "750 11px system-ui";
  ctx.textAlign = "center";

  candles.forEach((candle, index) => {
    if (index % stride !== 0 && index !== candles.length - 1) return;
    ctx.fillText(`#${index + 1}`, xForIndex(index), chart.timeY);
  });
}

function drawTvCrosshair(ctx, pointer, hoverIndex, candles, xForIndex, yForPrice, chart, width, height) {
  if (!pointer || hoverIndex === null) return;
  const candle = candles[hoverIndex];
  const x = xForIndex(hoverIndex);
  const y = pointer.y;

  ctx.strokeStyle = "rgba(215, 222, 232, 0.48)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x, chart.top);
  ctx.lineTo(x, chart.priceBottom);
  ctx.moveTo(chart.left, y);
  ctx.lineTo(width - chart.right, y);
  ctx.stroke();
  ctx.setLineDash([]);

  const price = candle.close;
  const priceText = formatPrice(price);
  ctx.fillStyle = "#d7dee8";
  roundRect(ctx, width - chart.right + 5, yForPrice(price) - 10, 58, 20, 4);
  ctx.fill();
  ctx.fillStyle = "#071016";
  ctx.font = "900 11px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(priceText, width - chart.right + 11, yForPrice(price) + 4);

  const tooltip = [
    `#${hoverIndex + 1}  ${candle.leverage}x`,
    `O ${formatPrice(candle.open)}  H ${formatPrice(candle.high)}`,
    `L ${formatPrice(candle.low)}  C ${formatPrice(candle.close)}`,
    `涨幅 ${formatPercent(candle.changePercent)}`,
  ];
  const boxX = Math.min(Math.max(pointer.x + 14, chart.left), width - chart.right - 190);
  const boxY = Math.min(Math.max(pointer.y + 14, chart.top), height - 118);

  ctx.fillStyle = "rgba(13, 19, 27, 0.94)";
  ctx.strokeStyle = "rgba(139, 154, 174, 0.28)";
  roundRect(ctx, boxX, boxY, 176, 92, 6);
  ctx.fill();
  ctx.stroke();

  tooltip.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? "#d7dee8" : "#8b9aae";
    ctx.font = index === 0 ? "900 12px system-ui" : "750 11px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(line, boxX + 10, boxY + 20 + index * 18);
  });
}

function getHoverIndex(pointer, length, xForIndex, chart, width) {
  if (
    pointer.x < chart.left ||
    pointer.x > width - chart.right ||
    pointer.y < chart.top ||
    pointer.y > chart.priceBottom
  ) {
    return null;
  }

  let closest = 0;
  let distance = Infinity;
  for (let i = 0; i < length; i += 1) {
    const currentDistance = Math.abs(pointer.x - xForIndex(i));
    if (currentDistance < distance) {
      closest = i;
      distance = currentDistance;
    }
  }
  return closest;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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

function updateChartPointer(event) {
  const rect = $("ladderChart").getBoundingClientRect();
  chartPointer = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  renderChart(calculate());
}

function clearChartPointer() {
  chartPointer = null;
  renderChart(calculate());
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
$("ladderChart").addEventListener("mousemove", updateChartPointer);
$("ladderChart").addEventListener("mouseleave", clearChartPointer);
window.addEventListener("resize", () => renderChart(calculate()));

render();
