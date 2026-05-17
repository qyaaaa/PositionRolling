import { formatPercent, formatPrice, toNumber } from "./position.js";

export function renderRollingChart(canvas, result, state, chartPointer) {
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

  const candles = buildRollingCandles(result.enriched, state.direction);
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

  drawTvBackground(ctx, width, chart);
  drawTvGrid(ctx, width, chart, low, high, yForPrice, candles, xForIndex);
  drawTvHeader(ctx, candles, hoverIndex);
  drawTvRiskLines(ctx, result, state, yForPrice, chart, width);
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

function buildRollingCandles(legs, direction) {
  return legs.map((leg, index) => {
    const previousPrice = legs[index - 1]?.price || leg.price * (direction === "long" ? 0.98 : 1.02);
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

function drawTvBackground(ctx, width, chart) {
  ctx.fillStyle = "#0d131b";
  ctx.fillRect(0, 0, width, chart.priceBottom + 38);

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

function drawTvRiskLines(ctx, result, state, yForPrice, chart, width) {
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

  candles.forEach((_, index) => {
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
