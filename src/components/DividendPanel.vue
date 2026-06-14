<template>
  <div class="tab-panel" :class="{ active }" id="dividendPanel" data-panel="dividend">
    <header class="topbar">
      <div>
        <p class="eyebrow">Dividend Reinvestment</p>
        <h1>股票股息复投动态推演</h1>
      </div>
      <div class="topbar-actions">
        <button class="icon-button" type="button" title="重置示例数据" aria-label="重置示例数据" @click="reset">↺</button>
        <button class="ghost-button" type="button" @click="exportResult">复制结果</button>
      </div>
    </header>

    <section class="control-grid" aria-label="基础参数">
      <label class="field">
        <span>初始投资 (元)</span>
        <input v-model.number="form.initialCapital" type="number" min="0" step="100" inputmode="decimal" />
      </label>
      <label class="field">
        <span>初始股价 (元)</span>
        <input v-model.number="form.price" type="number" min="0.01" step="0.01" inputmode="decimal" />
      </label>
      <label class="field">
        <span>当前股息率 %</span>
        <input v-model.number="form.dividendYield" type="number" min="0" step="0.01" inputmode="decimal" />
      </label>
      <label class="field">
        <span>股息年增长率 %</span>
        <input v-model.number="form.dividendGrowth" type="number" step="0.1" inputmode="decimal" />
      </label>
      <label class="field">
        <span>股价年增长率 %</span>
        <input v-model.number="form.priceGrowth" type="number" step="0.1" inputmode="decimal" />
      </label>
      <label class="field">
        <span>分红频率</span>
        <select v-model.number="form.frequency">
          <option :value="1">每年</option>
          <option :value="2">每半年</option>
          <option :value="4">每季度</option>
          <option :value="12">每月</option>
        </select>
      </label>
      <label class="field">
        <span>分红税率 %</span>
        <input v-model.number="form.taxRate" type="number" min="0" step="0.1" inputmode="decimal" />
      </label>
      <label class="field">
        <span>推演年限</span>
        <input v-model.number="form.years" type="number" min="1" max="60" step="1" inputmode="numeric" />
      </label>
      <label class="field">
        <span>股息复投</span>
        <select v-model="form.reinvest">
          <option :value="true">复投买入</option>
          <option :value="false">现金留存</option>
        </select>
      </label>
      <label class="field">
        <span>是否买入零股</span>
        <select v-model="form.fractional">
          <option :value="true">允许零股</option>
          <option :value="false">仅整股</option>
        </select>
      </label>
    </section>

    <section class="visual-section">
      <div class="section-heading">
        <div>
          <h2>资产增长曲线</h2>
          <p>对比「复投」与「不复投」两种情形的总资产（持仓市值 + 累计现金股息）。</p>
        </div>
      </div>
      <svg
        class="growth-chart"
        :viewBox="`0 0 ${chartW} ${chartH}`"
        role="img"
        aria-label="资产增长曲线"
        @mousemove="onChartMove"
        @mouseleave="onChartLeave"
      >
        <!-- Y 轴网格线与金额刻度 -->
        <g class="grid">
          <g v-for="tick in chart.yTicks" :key="`y${tick.value}`">
            <line :x1="chart.padL" :y1="tick.y" :x2="chartW - chart.padR" :y2="tick.y" />
            <text :x="chart.padL - 8" :y="tick.y + 4" text-anchor="end">{{ tick.label }}</text>
          </g>
        </g>
        <!-- X 轴年份刻度 -->
        <g class="axis-x">
          <text v-for="tick in chart.xTicks" :key="`x${tick.year}`" :x="tick.x" :y="chartH - 6" text-anchor="middle">
            {{ tick.year }}
          </text>
        </g>
        <!-- 不复投：区域 + 线 -->
        <polygon :points="chart.cashArea" class="area-cash" />
        <polyline :points="chart.cashLine" class="line-cash" />
        <!-- 复投：区域 + 线 -->
        <polygon :points="chart.reinvestArea" class="area-reinvest" />
        <polyline :points="chart.reinvestLine" class="line-reinvest" />
        <!-- 端点标注 -->
        <g v-if="chart.reinvestEnd">
          <circle :cx="chart.reinvestEnd.x" :cy="chart.reinvestEnd.y" r="3.5" fill="var(--accent)" />
          <text :x="chart.reinvestEnd.x - 6" :y="chart.reinvestEnd.y - 8" text-anchor="end" class="endpoint reinvest">
            {{ chart.reinvestEnd.label }}
          </text>
        </g>
        <g v-if="chart.cashEnd">
          <circle :cx="chart.cashEnd.x" :cy="chart.cashEnd.y" r="3" fill="var(--blue)" />
          <text :x="chart.cashEnd.x - 6" :y="chart.cashEnd.y + 16" text-anchor="end" class="endpoint cash">
            {{ chart.cashEnd.label }}
          </text>
        </g>
        <!-- 悬停游标与提示框 -->
        <g v-if="hover" class="hover-layer">
          <line :x1="hover.x" :y1="chart.padT" :x2="hover.x" :y2="chart.padT + chart.plotH" class="hover-guide" />
          <circle :cx="hover.x" :cy="hover.cashY" r="4" class="hover-dot cash" />
          <circle :cx="hover.x" :cy="hover.riY" r="4" class="hover-dot reinvest" />
          <g :transform="`translate(${hover.boxX}, ${hover.boxY})`">
            <rect class="hover-box" :width="hover.boxW" :height="hover.boxH" rx="6" />
            <text class="hover-title" x="10" y="18">第 {{ hover.year }} 年</text>
            <text class="hover-row reinvest" x="10" y="36">复投：{{ fmtMoney(hover.riTotal) }} 元</text>
            <text class="hover-row cash" x="10" y="52">不复投：{{ fmtMoney(hover.cashTotal) }} 元</text>
            <text class="hover-row diff" x="10" y="68">差额：+{{ fmtMoney(hover.diff) }} 元</text>
          </g>
        </g>
      </svg>
      <div class="chart-legend">
        <span><i class="dot avg"></i>复投总资产 {{ fmtMoney(final.total) }} 元</span>
        <span><i class="dot target"></i>不复投总资产 {{ fmtMoney(cashResult.rows.at(-1)?.total || 0) }} 元</span>
        <span><i class="dot entry"></i>本金 {{ fmtMoney(form.initialCapital) }} 元 · 期末翻 {{ chart.multiple }}x</span>
      </div>
    </section>

    <section class="metrics" aria-label="推演结果">
      <div>
        <span>期末持股数</span>
        <strong>{{ fmtShares(final.shares) }} 股</strong>
      </div>
      <div>
        <span>期末持仓市值</span>
        <strong>{{ fmtMoney(final.marketValue) }} 元</strong>
      </div>
      <div>
        <span>累计税后股息</span>
        <strong>{{ fmtMoney(final.cumDividend) }} 元</strong>
      </div>
      <div>
        <span>期末总资产</span>
        <strong>{{ fmtMoney(final.total) }} 元</strong>
      </div>
      <div>
        <span>总回报率</span>
        <strong :class="final.totalReturn >= 0 ? 'positive' : 'negative'">{{ fmtPct(final.totalReturn) }}</strong>
      </div>
      <div>
        <span>年化收益率 (CAGR)</span>
        <strong :class="final.cagr >= 0 ? 'positive' : 'negative'">{{ fmtPct(final.cagr) }}</strong>
      </div>
      <div>
        <span>期末股息率 (成本)</span>
        <strong>{{ fmtPct(final.yieldOnCost) }}</strong>
      </div>
      <div>
        <span>复投增益</span>
        <strong class="positive">{{ fmtMoney(final.reinvestGain) }} 元</strong>
      </div>
    </section>

    <section class="table-section">
      <div class="section-heading">
        <div>
          <h2>逐年推演</h2>
          <p>每年末的持股、股价、当年股息、复投买入及总资产变化。</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>年份</th>
              <th>股价</th>
              <th>持股数</th>
              <th>持仓市值</th>
              <th>当年税后股息</th>
              <th>复投买入</th>
              <th>累计股息</th>
              <th>总资产</th>
              <th>成本股息率</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.year">
              <td class="row-index">第 {{ row.year }} 年</td>
              <td class="readonly-cell">{{ fmtMoney(row.price) }}</td>
              <td class="readonly-cell">{{ fmtShares(row.shares) }}</td>
              <td class="readonly-cell">{{ fmtMoney(row.marketValue) }}</td>
              <td class="readonly-cell positive">{{ fmtMoney(row.dividend) }}</td>
              <td class="readonly-cell">{{ form.reinvest ? fmtShares(row.boughtShares) + ' 股' : '—' }}</td>
              <td class="readonly-cell">{{ fmtMoney(row.cumDividend) }}</td>
              <td class="readonly-cell">{{ fmtMoney(row.total) }}</td>
              <td class="readonly-cell">{{ fmtPct(row.yieldOnCost) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";

defineProps({
  active: {
    type: Boolean,
    default: false,
  },
});

const STORAGE_KEY = "dividend-reinvest-state";

function defaultForm() {
  return {
    initialCapital: 100000,
    price: 10,
    dividendYield: 5,
    dividendGrowth: 6,
    priceGrowth: 4,
    frequency: 4,
    taxRate: 20,
    years: 20,
    reinvest: true,
    fractional: true,
  };
}

function loadForm() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultForm(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultForm();
}

const form = reactive(loadForm());

watch(
  form,
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  },
  { deep: true },
);

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// 推演核心：按分红频率逐期复利，复投在每个分红期买入
function project(reinvest) {
  const initialCapital = Math.max(num(form.initialCapital), 0);
  const startPrice = Math.max(num(form.price), 0.0001);
  const yieldRate = num(form.dividendYield) / 100;
  const divGrowth = num(form.dividendGrowth) / 100;
  const priceGrowth = num(form.priceGrowth) / 100;
  const freq = Math.max(num(form.frequency, 1), 1);
  const tax = Math.min(Math.max(num(form.taxRate) / 100, 0), 1);
  const years = Math.min(Math.max(Math.round(num(form.years, 1)), 1), 60);

  let shares = initialCapital / startPrice;
  if (!form.fractional) shares = Math.floor(shares);
  const cost = initialCapital;

  // 每股年股息（第 1 年）
  let dividendPerShare = startPrice * yieldRate;

  const rows = [];
  let cumDividend = 0;

  for (let year = 1; year <= years; year += 1) {
    let yearDividend = 0;
    let boughtShares = 0;

    for (let period = 0; period < freq; period += 1) {
      // 期内价格按年增长率平滑插值
      const elapsed = year - 1 + period / freq;
      const price = startPrice * Math.pow(1 + priceGrowth, elapsed);
      const perPeriodDiv = (dividendPerShare / freq) * (1 - tax);
      const cashFlow = shares * perPeriodDiv;
      yearDividend += cashFlow;

      if (reinvest && price > 0) {
        let bought = cashFlow / price;
        if (!form.fractional) bought = Math.floor(bought);
        shares += bought;
        boughtShares += bought;
      }
    }

    if (!reinvest) cumDividend += yearDividend;
    else cumDividend += yearDividend; // 复投时也累计，用于对比/统计

    const endPrice = startPrice * Math.pow(1 + priceGrowth, year);
    const marketValue = shares * endPrice;
    const cashHeld = reinvest ? 0 : cumDividend;
    const total = marketValue + cashHeld;

    rows.push({
      year,
      price: endPrice,
      shares,
      marketValue,
      dividend: yearDividend,
      boughtShares,
      cumDividend,
      cashHeld,
      total,
      yieldOnCost: cost > 0 ? (yearDividend / cost) * 100 : 0,
    });

    // 下一年每股股息按增长率提升
    dividendPerShare *= 1 + divGrowth;
  }

  return { rows, cost };
}

const reinvestResult = computed(() => project(true));
const cashResult = computed(() => project(false));

const rows = computed(() => (form.reinvest ? reinvestResult.value.rows : cashResult.value.rows));

const final = computed(() => {
  const r = rows.value.at(-1);
  const cost = (form.reinvest ? reinvestResult.value : cashResult.value).cost;
  if (!r) {
    return {
      shares: 0,
      marketValue: 0,
      cumDividend: 0,
      total: 0,
      totalReturn: 0,
      cagr: 0,
      yieldOnCost: 0,
      reinvestGain: 0,
    };
  }
  const years = r.year;
  const totalReturn = cost > 0 ? ((r.total - cost) / cost) * 100 : 0;
  const cagr = cost > 0 && r.total > 0 ? (Math.pow(r.total / cost, 1 / years) - 1) * 100 : 0;
  const reinvestGain = reinvestResult.value.rows.at(-1).total - cashResult.value.rows.at(-1).total;
  return {
    shares: r.shares,
    marketValue: r.marketValue,
    cumDividend: form.reinvest ? r.cumDividend : r.cashHeld,
    total: r.total,
    totalReturn,
    cagr,
    yieldOnCost: r.yieldOnCost,
    reinvestGain,
  };
});

// 图表
const chartW = 640;
const chartH = 260;

// 紧凑金额（万/亿），用于坐标轴和端点标注
function fmtCompact(value) {
  const v = num(value);
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(2)}亿`;
  if (Math.abs(v) >= 1e4) return `${(v / 1e4).toFixed(1)}万`;
  return v.toFixed(0);
}

// 取“漂亮”的刻度步长
function niceStep(rough) {
  const pow = Math.pow(10, Math.floor(Math.log10(rough || 1)));
  const norm = (rough || 1) / pow;
  let step;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 5) step = 5;
  else step = 10;
  return step * pow;
}

const chart = computed(() => {
  const padL = 56;
  const padR = 70;
  const padT = 14;
  const padB = 26;
  const ri = reinvestResult.value.rows;
  const cash = cashResult.value.rows;
  const principal = Math.max(num(form.initialCapital), 0);

  const allTotals = [...ri.map((r) => r.total), ...cash.map((r) => r.total), principal];
  const rawMax = Math.max(...allTotals, 1);

  // Y 轴：0 到 略高于最大值，5 段漂亮刻度
  const step = niceStep(rawMax / 5);
  const yMax = Math.ceil(rawMax / step) * step;

  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const n = Math.max(ri.length, cash.length);

  const xAt = (i) => padL + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const yAt = (v) => padT + plotH - (v / yMax) * plotH;

  const toLine = (rows) => rows.map((r, i) => `${xAt(i).toFixed(1)},${yAt(r.total).toFixed(1)}`).join(" ");
  const toArea = (rows) => {
    if (!rows.length) return "";
    const base = yAt(0).toFixed(1);
    const pts = rows.map((r, i) => `${xAt(i).toFixed(1)},${yAt(r.total).toFixed(1)}`).join(" ");
    return `${xAt(0).toFixed(1)},${base} ${pts} ${xAt(rows.length - 1).toFixed(1)},${base}`;
  };

  const yTicks = [];
  for (let v = 0; v <= yMax + 1e-6; v += step) {
    yTicks.push({ value: v, y: Number(yAt(v).toFixed(1)), label: fmtCompact(v) });
  }

  // X 轴：最多约 8 个年份标签
  const xTicks = [];
  if (n > 0) {
    const stride = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < n; i += stride) {
      xTicks.push({ year: ri[i]?.year ?? i + 1, x: Number(xAt(i).toFixed(1)) });
    }
    const lastIdx = n - 1;
    if (!xTicks.some((t) => t.year === (ri[lastIdx]?.year ?? n))) {
      xTicks.push({ year: ri[lastIdx]?.year ?? n, x: Number(xAt(lastIdx).toFixed(1)) });
    }
  }

  const riLast = ri.at(-1);
  const cashLast = cash.at(-1);
  const multiple = principal > 0 && riLast ? (riLast.total / principal).toFixed(1) : "0";

  const riPoints = ri.map((r, i) => ({ x: xAt(i), y: yAt(r.total), total: r.total, year: r.year }));
  const cashPoints = cash.map((r, i) => ({ x: xAt(i), y: yAt(r.total), total: r.total, year: r.year }));

  return {
    padL,
    padR,
    padT,
    plotH,
    plotW,
    n,
    xAt,
    yAt,
    yTicks,
    xTicks,
    riPoints,
    cashPoints,
    reinvestLine: toLine(ri),
    cashLine: toLine(cash),
    reinvestArea: toArea(ri),
    cashArea: toArea(cash),
    reinvestEnd: riLast ? { x: xAt(ri.length - 1), y: yAt(riLast.total), label: fmtCompact(riLast.total) } : null,
    cashEnd: cashLast ? { x: xAt(cash.length - 1), y: yAt(cashLast.total), label: fmtCompact(cashLast.total) } : null,
    multiple,
  };
});

// 悬停交互
const hoverIndex = ref(-1);

const hover = computed(() => {
  const c = chart.value;
  const i = hoverIndex.value;
  if (i < 0 || !c.riPoints[i]) return null;
  const ri = c.riPoints[i];
  const cash = c.cashPoints[i] || ri;
  const x = ri.x;
  // tooltip 框宽高，靠近右边界时翻转到左侧
  const boxW = 150;
  const boxH = 76;
  const flip = x + 12 + boxW > chartW - c.padR + 60;
  const boxX = flip ? x - 12 - boxW : x + 12;
  return {
    x,
    year: ri.year,
    riY: ri.y,
    cashY: cash.y,
    riTotal: ri.total,
    cashTotal: cash.total,
    diff: ri.total - cash.total,
    boxX,
    boxY: Math.min(c.padT + 4, ri.y - 10),
    boxW,
    boxH,
  };
});

function onChartMove(event) {
  const c = chart.value;
  if (!c.n) return;
  const svg = event.currentTarget;
  const rect = svg.getBoundingClientRect();
  // 把鼠标位置映射到 viewBox 坐标（preserveAspectRatio=xMidYMid meet）
  const scale = Math.min(rect.width / chartW, rect.height / chartH);
  const offsetX = (rect.width - chartW * scale) / 2;
  const vbX = (event.clientX - rect.left - offsetX) / scale;
  const ratio = (vbX - c.padL) / (c.plotW || 1);
  let idx = Math.round(ratio * (c.n - 1));
  idx = Math.max(0, Math.min(c.n - 1, idx));
  hoverIndex.value = idx;
}

function onChartLeave() {
  hoverIndex.value = -1;
}

// 格式化
function fmtMoney(value) {
  return num(value).toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}
function fmtShares(value) {
  return num(value).toLocaleString("zh-CN", { maximumFractionDigits: form.fractional ? 2 : 0 });
}
function fmtPct(value) {
  return `${num(value).toFixed(2)}%`;
}

function reset() {
  Object.assign(form, defaultForm());
}

async function exportResult() {
  const f = final.value;
  const lines = [
    "股票股息复投动态推演",
    `初始投资：${fmtMoney(form.initialCapital)} 元 / 初始股价：${form.price} 元`,
    `股息率：${form.dividendYield}% / 股息增长：${form.dividendGrowth}% / 股价增长：${form.priceGrowth}%`,
    `分红频率：${form.frequency} 次/年 / 税率：${form.taxRate}% / 年限：${form.years} 年`,
    `复投方式：${form.reinvest ? "复投买入" : "现金留存"}`,
    "",
    `期末持股：${fmtShares(f.shares)} 股`,
    `期末总资产：${fmtMoney(f.total)} 元`,
    `总回报率：${fmtPct(f.totalReturn)} / 年化：${fmtPct(f.cagr)}`,
    `复投相对不复投增益：${fmtMoney(f.reinvestGain)} 元`,
  ];
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
  } catch {
    /* ignore */
  }
}
</script>

<style scoped>
.growth-chart {
  display: block;
  width: 100%;
  height: 300px;
  margin-bottom: 12px;
}
.growth-chart .grid line {
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 1;
}
.growth-chart .grid text,
.growth-chart .axis-x text {
  fill: var(--muted, #8b97a5);
  font-size: 11px;
  font-weight: 700;
}
.growth-chart .line-reinvest {
  fill: none;
  stroke: var(--accent, #35d0aa);
  stroke-width: 2.5;
  stroke-linejoin: round;
}
.growth-chart .line-cash {
  fill: none;
  stroke: var(--blue, #5aa0ff);
  stroke-width: 2;
  stroke-dasharray: 6 5;
  stroke-linejoin: round;
}
.growth-chart .area-reinvest {
  fill: var(--accent, #35d0aa);
  opacity: 0.12;
}
.growth-chart .area-cash {
  fill: var(--blue, #5aa0ff);
  opacity: 0.08;
}
.growth-chart .endpoint {
  font-size: 12px;
  font-weight: 900;
}
.growth-chart .endpoint.reinvest {
  fill: var(--accent, #35d0aa);
}
.growth-chart .endpoint.cash {
  fill: var(--blue, #5aa0ff);
}
.growth-chart .hover-guide {
  stroke: rgba(255, 255, 255, 0.35);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.growth-chart .hover-dot.reinvest {
  fill: var(--accent, #35d0aa);
  stroke: #04100d;
  stroke-width: 1.5;
}
.growth-chart .hover-dot.cash {
  fill: var(--blue, #5aa0ff);
  stroke: #04100d;
  stroke-width: 1.5;
}
.growth-chart .hover-box {
  fill: rgba(8, 14, 20, 0.95);
  stroke: rgba(255, 255, 255, 0.14);
  stroke-width: 1;
}
.growth-chart .hover-title {
  fill: var(--ink, #e7edf3);
  font-size: 12px;
  font-weight: 900;
}
.growth-chart .hover-row {
  font-size: 11.5px;
  font-weight: 800;
}
.growth-chart .hover-row.reinvest {
  fill: var(--accent, #35d0aa);
}
.growth-chart .hover-row.cash {
  fill: var(--blue, #5aa0ff);
}
.growth-chart .hover-row.diff {
  fill: var(--muted, #8b97a5);
}
.positive {
  color: var(--accent, #35d0aa);
}
.negative {
  color: var(--danger, #ff6b74);
}
</style>
