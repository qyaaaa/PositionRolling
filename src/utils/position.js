export const defaultState = {
  schemaVersion: 9,
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

export const defaultLeverageSteps = [25, 25, 20, 20, 15, 10, 5, 5, 3, 3];

const money = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

export function cloneDefaultState() {
  return structuredClone(defaultState);
}

export function normalizeState(value) {
  return {
    ...value,
    legs: (value.legs || defaultState.legs).map((leg) => ({
      price: toNumber(leg.price),
      leverage: Math.max(toNumber(leg.leverage, value.leverage || defaultState.leverage), 1),
    })),
  };
}

export function loadSavedState() {
  try {
    const stored = localStorage.getItem("position-rolling-state");
    const parsed = stored ? JSON.parse(stored) : null;
    return parsed?.schemaVersion === defaultState.schemaVersion
      ? normalizeState({ ...cloneDefaultState(), ...parsed })
      : cloneDefaultState();
  } catch {
    return cloneDefaultState();
  }
}

export function saveState(state) {
  localStorage.setItem("position-rolling-state", JSON.stringify(state));
}

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function pct(value) {
  return toNumber(value) / 100;
}

export function priceChange(price, basePrice) {
  if (!price || !basePrice) return 0;
  return ((price - basePrice) / basePrice) * 100;
}

export function signedCoinPnl(price, avgEntry, quantity, direction) {
  if (!price || !avgEntry || !quantity) return 0;
  return direction === "long"
    ? (quantity * (price - avgEntry)) / price
    : (quantity * (avgEntry - price)) / price;
}

export function feeInCoin(notionalUsd, price, feeRate) {
  if (!notionalUsd || !price) return 0;
  return (notionalUsd * feeRate) / price;
}

export function liquidationPriceForCoinMargin(entryPrice, leverage, maintenanceRate, direction) {
  if (!entryPrice || !leverage) return 0;
  if (direction === "long") {
    return (entryPrice * leverage * (1 + maintenanceRate)) / (1 + leverage);
  }
  if (leverage <= 1) return 0;
  return (entryPrice * leverage * (1 - maintenanceRate)) / (leverage - 1);
}

export function solveBreakEvenPrice(entryPrice, quantity, realizedPnl, notionalUsd, feeRate, direction) {
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

export function calculate(state) {
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

export function roundPrice(value) {
  const digits = value < 10 ? 10000 : 100;
  return Math.max(Math.round(value * digits) / digits, 0);
}

export function formatMoney(value) {
  if (!Number.isFinite(value) || value === 0) return value === 0 ? "0.00" : "-";
  return money.format(value);
}

export function formatCoin(value) {
  if (!Number.isFinite(value) || value === 0) return value === 0 ? "0.0000" : "-";
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}

export function formatPrice(value) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  const digits = value < 10 ? 4 : 2;
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: value < 10 ? 6 : 2,
  }).format(value);
}

export function formatQuantity(value) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return compact.format(value);
}

export function coinToUsd(coinAmount, price) {
  if (!Number.isFinite(coinAmount) || !Number.isFinite(price)) return 0;
  return coinAmount * price;
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
