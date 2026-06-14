<template>
  <figure class="mini-chart" :aria-label="chartTitle">
    <svg viewBox="0 0 320 180" role="img">
      <defs>
        <linearGradient id="miniFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="rgba(53, 208, 170, 0.22)" />
          <stop offset="1" stop-color="rgba(53, 208, 170, 0.02)" />
        </linearGradient>
      </defs>
      <rect class="mini-bg" width="320" height="180" rx="6" />
      <g class="mini-grid">
        <path d="M20 38H300M20 76H300M20 114H300M20 152H300" />
        <path d="M72 20V158M124 20V158M176 20V158M228 20V158M280 20V158" />
      </g>

      <template v-if="type === 'breakout'">
        <path class="zone blue" d="M20 80H300" />
        <text x="226" y="76">前高/突破位</text>
        <path class="price-line" d="M28 126L58 120L88 112L118 105L148 98L178 90L208 64L238 78L268 70L296 52" />
        <g class="candles up">
          <rect x="198" y="68" width="13" height="38" /><path d="M204.5 58V116" />
          <rect x="228" y="76" width="13" height="26" /><path d="M234.5 66V112" />
          <rect x="258" y="54" width="13" height="32" /><path d="M264.5 44V94" />
        </g>
        <path class="tag-line" d="M210 62L244 36" />
        <text x="246" y="34">放量突破后回踩</text>
      </template>

      <template v-else-if="type === 'absorption'">
        <path class="zone amber" d="M20 56H300" />
        <text x="226" y="52">前高/VAH</text>
        <path class="price-line" d="M30 132L58 118L86 104L114 92L142 78L170 64L198 58L226 56L254 70L286 96" />
        <g class="candles mixed">
          <rect x="180" y="54" width="14" height="34" /><path d="M187 38V104" />
          <rect x="210" y="50" width="14" height="25" /><path d="M217 34V96" />
          <rect x="240" y="68" width="14" height="35" /><path d="M247 56V116" />
        </g>
        <text x="32" y="32">大买单成交</text>
        <text x="32" y="48">价格不再上推</text>
      </template>

      <template v-else-if="type === 'support'">
        <path class="zone green" d="M20 126H300" />
        <text x="218" y="122">VAL / 前低</text>
        <path class="price-line" d="M28 58L58 72L88 91L118 104L148 128L178 112L208 104L238 92L268 84L296 72" />
        <g class="candles up">
          <rect x="138" y="116" width="14" height="24" /><path d="M145 102V152" />
          <rect x="168" y="104" width="14" height="28" /><path d="M175 92V142" />
        </g>
        <text x="28" y="150">放量下探后收回</text>
      </template>

      <template v-else-if="type === 'macd-pullback'">
        <path class="price-line" d="M26 118L58 98L90 82L122 70L154 88L186 74L218 58L250 50L294 42" />
        <path class="indicator-line green" d="M26 137L58 130L90 118L122 105L154 112L186 98L218 82L250 70L294 58" />
        <path class="zero-line" d="M20 146H300" />
        <g class="histogram positive">
          <rect x="66" y="132" width="10" height="14" /><rect x="96" y="122" width="10" height="24" />
          <rect x="156" y="136" width="10" height="10" /><rect x="216" y="116" width="10" height="30" />
        </g>
        <text x="206" y="32">回踩后动能再放大</text>
      </template>

      <template v-else-if="type === 'macd-divergence'">
        <path class="price-line" d="M28 122L70 88L112 96L154 68L196 78L238 52L286 60" />
        <path class="indicator-line red" d="M28 144L70 120L112 130L154 112L196 126L238 118L286 132" />
        <path class="tag-line" d="M154 68L238 52" />
        <path class="tag-line red" d="M154 112L238 118" />
        <text x="34" y="34">价格新高</text>
        <text x="198" y="148">动能不新高</text>
      </template>

      <template v-else-if="type === 'rsi-trend'">
        <path class="price-line" d="M28 128L62 108L96 86L130 76L164 92L198 74L232 62L266 50L296 42" />
        <path class="zero-line" d="M20 112H300" />
        <text x="24" y="108">RSI 50</text>
        <path class="indicator-line green" d="M28 132L62 98L96 78L130 72L164 94L198 82L232 68L266 56L296 48" />
        <text x="198" y="140">回踩守住强弱线</text>
      </template>

      <template v-else-if="type === 'rsi-range'">
        <path class="zone amber" d="M20 58H300" />
        <path class="zone green" d="M20 130H300" />
        <text x="24" y="54">70</text><text x="24" y="126">30</text>
        <path class="indicator-line blue" d="M28 96L64 58L100 88L136 130L172 98L208 60L244 92L284 128" />
        <path class="price-line muted" d="M28 102L64 72L100 92L136 122L172 96L208 72L244 94L284 118" />
      </template>

      <template v-else-if="type === 'ema-support'">
        <path class="indicator-line green" d="M24 132L64 116L104 100L144 86L184 76L224 64L296 48" />
        <path class="indicator-line blue" d="M24 150L64 136L104 122L144 108L184 96L224 86L296 72" />
        <path class="price-line" d="M28 126L64 108L100 84L136 94L172 70L208 80L244 56L288 42" />
        <text x="34" y="36">回踩 20 EMA</text>
      </template>

      <template v-else-if="type === 'ma-chop'">
        <path class="indicator-line green" d="M22 92L62 86L102 96L142 88L182 94L222 86L296 92" />
        <path class="indicator-line blue" d="M22 102L62 96L102 88L142 98L182 90L222 100L296 94" />
        <path class="indicator-line amber" d="M22 96L62 102L102 94L142 100L182 88L222 96L296 90" />
        <path class="price-line muted" d="M28 116L64 78L100 118L136 76L172 112L208 82L244 120L286 84" />
        <text x="76" y="36">均线缠绕 = 噪音区</text>
      </template>

      <template v-else-if="type === 'bb-squeeze'">
        <path class="band upper" d="M24 78L64 76L104 80L144 84L184 70L224 48L296 36" />
        <path class="band middle" d="M24 98L64 96L104 98L144 100L184 88L224 68L296 52" />
        <path class="band lower" d="M24 118L64 116L104 116L144 116L184 106L224 88L296 72" />
        <path class="price-line" d="M28 98L64 100L100 96L136 102L172 94L208 70L244 54L288 42" />
        <text x="34" y="36">收窄后放量扩张</text>
      </template>

      <template v-else-if="type === 'pa-structure'">
        <path class="price-line" d="M26 140L52 110L80 132L110 92L140 116L170 70L200 100L232 52L262 84L296 40" />
        <g class="dot-marks">
          <circle cx="52" cy="110" r="3.2" /><circle cx="110" cy="92" r="3.2" />
          <circle cx="170" cy="70" r="3.2" /><circle cx="232" cy="52" r="3.2" />
        </g>
        <text x="40" y="32">高点抬高 / 低点抬高 = 上升结构</text>
        <text x="150" y="150">跌破前低 = 结构转弱</text>
      </template>

      <template v-else-if="type === 'pin-bar'">
        <path class="zone green" d="M20 132H300" />
        <text x="214" y="128">关键支撑</text>
        <path class="price-line" d="M28 64L60 80L92 98L124 116L156 132L188 104L220 86L252 72L292 56" />
        <g class="candles up">
          <rect x="150" y="120" width="14" height="12" /><path d="M157 110V152" />
          <rect x="182" y="98" width="14" height="14" /><path d="M189 90V120" />
        </g>
        <text x="30" y="40">长下影 = 下方买单承接</text>
      </template>

      <template v-else-if="type === 'sr-flip'">
        <path class="zone blue" d="M20 86H300" />
        <text x="206" y="82">阻力转支撑</text>
        <path class="price-line" d="M26 128L56 116L86 100L116 88L146 70L176 84L206 92L236 80L266 64L296 48" />
        <g class="candles up">
          <rect x="168" y="80" width="13" height="20" /><path d="M174.5 72V112" />
          <rect x="198" y="84" width="13" height="16" /><path d="M204.5 76V112" />
        </g>
        <path class="tag-line" d="M204 88L242 60" />
        <text x="244" y="58">突破后回踩不破</text>
      </template>

      <template v-else-if="type === 'level-prior'">
        <path class="zone blue" d="M20 58H300" />
        <text x="228" y="54">前高（阻力）</text>
        <path class="zone green" d="M20 132H300" />
        <text x="228" y="128">前低（支撑）</text>
        <path class="price-line" d="M28 96L60 72L92 60L112 70L140 96L168 120L196 132L224 122L252 100L286 70" />
        <path class="tag-line" d="M104 60L138 40" />
        <text x="140" y="38">触前高被打回</text>
      </template>

      <template v-else-if="type === 'level-zone'">
        <rect class="demand-zone" x="20" y="112" width="280" height="26" />
        <text x="210" y="108">需求区（大单起涨点）</text>
        <path class="price-line" d="M30 124L52 118L72 122L92 78L112 56L140 70L168 96L196 120L220 126L248 96L286 60" />
        <path class="tag-line" d="M92 78L70 50" />
        <text x="30" y="46">放量拉走</text>
        <path class="tag-line" d="M210 124L240 144" />
        <text x="186" y="156">回到区内承接反弹</text>
      </template>

      <template v-else-if="type === 'level-round'">
        <path class="zone amber" d="M20 84H300" />
        <text x="206" y="80">1.0000 整数关口</text>
        <path class="price-line" d="M28 128L60 116L92 100L124 90L156 84L184 86L212 92L244 78L276 60L296 52" />
        <g class="candles up">
          <rect x="150" y="82" width="13" height="14" /><path d="M156.5 64V104" />
          <rect x="206" y="86" width="13" height="12" /><path d="M212.5 70V108" />
        </g>
        <text x="30" y="40">刺穿后快速收回 = 假突破</text>
      </template>

      <template v-else-if="type === 'level-gap'">
        <rect class="gap-zone" x="20" y="86" width="280" height="22" />
        <text x="226" y="82">跳空缺口</text>
        <g class="candles up">
          <rect x="60" y="112" width="13" height="20" /><path d="M66.5 104V140" />
          <rect x="92" y="60" width="13" height="22" /><path d="M98.5 52V90" />
          <rect x="124" y="48" width="13" height="18" /><path d="M130.5 40V72" />
        </g>
        <path class="price-line" d="M150 56L182 70L214 88L246 100L276 96L296 86" />
        <text x="172" y="138">价格回到缺口区回补</text>
      </template>

      <template v-else>
        <path class="band upper" d="M24 62L64 60L104 64L144 62L184 60L224 64L296 62" />
        <path class="band middle" d="M24 94L64 94L104 96L144 94L184 94L224 96L296 94" />
        <path class="band lower" d="M24 126L64 128L104 126L144 128L184 126L224 128L296 126" />
        <path class="price-line muted" d="M28 96L64 64L100 92L136 126L172 96L208 62L244 94L284 124" />
        <text x="44" y="152">横向带内，离轨后回归</text>
      </template>
    </svg>
  </figure>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  type: {
    type: String,
    required: true,
  },
});

const titles = {
  breakout: "突破回踩示意图",
  absorption: "高位吸收示意图",
  support: "低位承接示意图",
  "macd-pullback": "MACD 趋势回踩示意图",
  "macd-divergence": "MACD 背离示意图",
  "rsi-trend": "RSI 趋势强弱示意图",
  "rsi-range": "RSI 震荡区间示意图",
  "ema-support": "EMA 动态支撑示意图",
  "ma-chop": "均线缠绕示意图",
  "bb-squeeze": "布林带挤压突破示意图",
  "bb-range": "布林带区间回归示意图",
  "pa-structure": "市场结构示意图",
  "pin-bar": "关键 K 线反转示意图",
  "sr-flip": "支撑阻力转换示意图",
  "level-prior": "前高前低示意图",
  "level-zone": "供需区示意图",
  "level-round": "整数关口示意图",
  "level-gap": "缺口回补示意图",
};

const chartTitle = computed(() => titles[props.type] || "交易图表示意图");
</script>
