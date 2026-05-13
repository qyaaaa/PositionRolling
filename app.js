const defaultState = {
  direction: "long",
  equity: 10000,
  leverage: 5,
  maintenanceRate: 0.5,
  feeRate: 0.04,
  reserveRate: 15,
  targetPrice: 73500,
  stopPrice: 61200,
  legs: [
    { price: 65000, margin: 800, note: "首仓" },
    { price: 63000, margin: 650, note: "回踩补仓" },
    { price: 60000, margin: 550, note: "深回撤滚入" },
  ],
};

const fields = [
  "direction",
  "equity",
  "leverage",
  "maintenanceRate",
  "feeRate",
  "reserveRate",
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
    return stored ? { ...defaultState, ...JSON.parse(stored) } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
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

function signedPnl(price, avgEntry, quantity, direction) {
  if (!price || !avgEntry || !quantity) return 0;
  return direction === "long"
    ? (price - avgEntry) * quantity
    : (avgEntry - price) * quantity;
}

function calculate() {
  const leverage = Math.max(toNumber(state.leverage, 1), 1);
  const equity = Math.max(toNumber(state.equity), 0);
  const feeRate = pct(state.feeRate);
  const maintenanceRate = pct(state.maintenanceRate);
  const reserveCash = equity * pct(state.reserveRate);
  const validLegs = state.legs
    .map((leg) => ({
      price: Math.max(toNumber(leg.price), 0),
      margin: Math.max(toNumber(leg.margin), 0),
      note: leg.note || "",
    }))
    .filter((leg) => leg.price > 0 && leg.margin > 0);

  const enriched = validLegs.map((leg) => {
    const notional = leg.margin * leverage;
    return {
      ...leg,
      notional,
      quantity: notional / leg.price,
    };
  });

  const totalNotional = enriched.reduce((sum, leg) => sum + leg.notional, 0);
  const totalQuantity = enriched.reduce((sum, leg) => sum + leg.quantity, 0);
  const marginUsed = enriched.reduce((sum, leg) => sum + leg.margin, 0);
  const avgEntry = totalQuantity > 0 ? totalNotional / totalQuantity : 0;
  const openFee = totalNotional * feeRate;
  const closeFee = totalNotional * feeRate;
  const estimatedFees = openFee + closeFee;
  const usedWithFees = marginUsed + openFee;
  const availableCash = equity - reserveCash - usedWithFees;
  const capitalUsage = equity > 0 ? usedWithFees / equity : 0;
  const maintenanceMargin = totalNotional * maintenanceRate;
  const liquidationMove = totalQuantity > 0 ? Math.max(marginUsed - maintenanceMargin, 0) / totalQuantity : 0;
  const liquidationPrice =
    totalQuantity > 0
      ? state.direction === "long"
        ? Math.max(avgEntry - liquidationMove, 0)
        : avgEntry + liquidationMove
      : 0;
  const breakEvenMove = totalQuantity > 0 ? estimatedFees / totalQuantity : 0;
  const breakEvenPrice =
    totalQuantity > 0
      ? state.direction === "long"
        ? avgEntry + breakEvenMove
        : Math.max(avgEntry - breakEvenMove, 0)
      : 0;
  const targetPnl = signedPnl(toNumber(state.targetPrice), avgEntry, totalQuantity, state.direction) - closeFee;
  const stopPnl = signedPnl(toNumber(state.stopPrice), avgEntry, totalQuantity, state.direction) - closeFee;

  return {
    enriched,
    totalNotional,
    totalQuantity,
    marginUsed,
    avgEntry,
    openFee,
    closeFee,
    estimatedFees,
    usedWithFees,
    availableCash,
    capitalUsage,
    reserveCash,
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

function formatPrice(value) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return money.format(value);
}

function formatQuantity(value) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return compact.format(value);
}

function renderRows() {
  const body = $("legsBody");
  body.innerHTML = "";

  state.legs.forEach((leg, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="row-index">#${index + 1}</td>
      <td><input class="leg-input" type="number" min="0" step="0.01" inputmode="decimal" value="${leg.price}" data-index="${index}" data-key="price" aria-label="第 ${index + 1} 笔成交价"></td>
      <td><input class="leg-input" type="number" min="0" step="0.01" inputmode="decimal" value="${leg.margin}" data-index="${index}" data-key="margin" aria-label="第 ${index + 1} 笔追加保证金"></td>
      <td><input class="note-input" type="text" value="${escapeHtml(leg.note || "")}" data-index="${index}" data-key="note" aria-label="第 ${index + 1} 笔备注"></td>
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
  $("marginUsed").textContent = formatMoney(result.marginUsed);
  $("capitalUsage").textContent = `${(result.capitalUsage * 100).toFixed(2)}%`;
  $("availableCash").textContent = formatMoney(result.availableCash);
  $("liquidationPrice").textContent = formatPrice(result.liquidationPrice);
  $("breakEvenPrice").textContent = formatPrice(result.breakEvenPrice);
  $("estimatedFees").textContent = formatMoney(result.estimatedFees);
  setPnl("targetPnl", result.targetPnl, result.marginUsed);
  setPnl("stopPnl", result.stopPnl, result.marginUsed);
  renderRisk(result);
}

function setPnl(id, pnl, marginUsed) {
  const el = $(id);
  const roe = marginUsed > 0 ? (pnl / marginUsed) * 100 : 0;
  el.textContent = `${formatMoney(pnl)} (${roe.toFixed(2)}%)`;
  el.classList.toggle("positive", pnl >= 0);
  el.classList.toggle("negative", pnl < 0);
}

function renderRisk(result) {
  const badge = $("riskBadge");
  const usage = result.capitalUsage;
  badge.className = "risk-badge";
  if (result.availableCash < 0 || usage > 0.85) {
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
  canvas.height = 260 * dpr;
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

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const padding = Math.max((max - min) * 0.12, max * 0.015);
  const low = Math.max(min - padding, 0);
  const high = max + padding;
  const x = (price) => 44 + ((price - low) / Math.max(high - low, 1)) * (width - 88);

  drawAxis(ctx, width, height, low, high);
  result.enriched.forEach((leg, index) => {
    drawMarker(ctx, x(leg.price), 98 + (index % 2) * 42, "#17201b", `#${index + 1}`, leg.price);
  });
  if (result.avgEntry > 0) drawLineMarker(ctx, x(result.avgEntry), height, "#0f8b72", "均价");
  if (result.liquidationPrice > 0) drawLineMarker(ctx, x(result.liquidationPrice), height, "#b73535", "强平");
  if (toNumber(state.targetPrice) > 0) drawLineMarker(ctx, x(toNumber(state.targetPrice)), height, "#3267a8", "目标");
  if (toNumber(state.stopPrice) > 0) drawLineMarker(ctx, x(toNumber(state.stopPrice)), height, "#b7791f", "止损");
}

function drawEmptyChart(ctx, width, height) {
  ctx.fillStyle = "#66736c";
  ctx.font = "700 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("添加滚仓批次后显示价格阶梯", width / 2, height / 2);
}

function drawAxis(ctx, width, height, low, high) {
  const y = height - 56;
  ctx.strokeStyle = "#d9d3c7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(36, y);
  ctx.lineTo(width - 36, y);
  ctx.stroke();

  ctx.fillStyle = "#66736c";
  ctx.font = "700 12px system-ui";
  ctx.textAlign = "left";
  ctx.fillText(formatPrice(low), 36, y + 28);
  ctx.textAlign = "right";
  ctx.fillText(formatPrice(high), width - 36, y + 28);
}

function drawMarker(ctx, x, y, color, label, price) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#17201b";
  ctx.font = "800 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - 14);
  ctx.fillStyle = "#66736c";
  ctx.font = "700 11px system-ui";
  ctx.fillText(formatPrice(price), x, y + 24);
}

function drawLineMarker(ctx, x, height, color, label) {
  const top = 28;
  const bottom = height - 56;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, bottom);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = "900 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(label, x, top - 8);
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
  state.legs[index][key] = key === "note" ? target.value : toNumber(target.value);
  renderResults();
}

function addLeg() {
  const last = state.legs.at(-1) || { price: toNumber(state.targetPrice) || 100, margin: 100, note: "" };
  const priceMultiplier = state.direction === "long" ? 0.97 : 1.03;
  state.legs.push({
    price: Math.max(Math.round(last.price * priceMultiplier * 100) / 100, 0),
    margin: last.margin,
    note: "新增滚仓",
  });
  render();
}

function deleteLeg(event) {
  const index = Number(event.target.dataset.delete);
  if (!Number.isInteger(index)) return;
  state.legs.splice(index, 1);
  if (!state.legs.length) state.legs.push({ price: 0, margin: 0, note: "" });
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
    `杠杆：${state.leverage}x`,
    `总名义价值：${formatMoney(result.totalNotional)} USDT`,
    `总数量：${formatQuantity(result.totalQuantity)}`,
    `持仓均价：${formatPrice(result.avgEntry)}`,
    `已用保证金：${formatMoney(result.marginUsed)} USDT`,
    `剩余可用：${formatMoney(result.availableCash)} USDT`,
    `预估强平价：${formatPrice(result.liquidationPrice)}`,
    `盈亏平衡价：${formatPrice(result.breakEvenPrice)}`,
    `目标价盈亏：${formatMoney(result.targetPnl)} USDT`,
    `止损价盈亏：${formatMoney(result.stopPnl)} USDT`,
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
