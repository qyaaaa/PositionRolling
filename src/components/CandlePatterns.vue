<template>
  <div class="candle-gallery">
    <div class="knowledge-hero">
      <p class="panel-kicker">Candlestick Patterns</p>
      <h3>蜡烛形态图谱</h3>
      <p>
        蜡烛线（K 线）记录一段时间的开高低收。下面按「单根 / 两根 / 三根」分组列出常见形态，配示意图、含义和使用要点。形态只有出现在关键价位、且顺着大方向时才更可靠。
      </p>
    </div>

    <div class="candle-legend">
      <span><i class="swatch bull"></i>阳线（收盘 &gt; 开盘）</span>
      <span><i class="swatch bear"></i>阴线（收盘 &lt; 开盘）</span>
      <span>影线越长，说明该方向被拒绝得越明显。</span>
    </div>

    <section v-for="group in groups" :key="group.title" class="candle-group">
      <h4 class="candle-group-title">{{ group.title }}</h4>
      <p class="candle-group-desc">{{ group.desc }}</p>
      <div class="candle-grid">
        <article v-for="pattern in group.patterns" :key="pattern.name" class="candle-card">
          <div class="candle-card-head">
            <h5>{{ pattern.name }}</h5>
            <span class="candle-tag" :class="pattern.bias">{{ pattern.tag }}</span>
          </div>
          <p class="candle-en">{{ pattern.en }}</p>
          <svg class="candle-svg" :viewBox="`0 0 ${svgW(pattern)} 120`" role="img" :aria-label="pattern.name">
            <line class="mid-line" :x1="0" y1="60" :x2="svgW(pattern)" y2="60" />
            <g v-for="(c, i) in pattern.candles" :key="i">
              <line class="wick" :x1="cx(i)" :y1="y(c.h)" :x2="cx(i)" :y2="y(c.l)" :class="dir(c)" />
              <rect
                class="body"
                :class="dir(c)"
                :x="cx(i) - 9"
                :y="y(Math.max(c.o, c.c))"
                width="18"
                :height="Math.max(2, Math.abs(y(c.o) - y(c.c)))"
              />
            </g>
          </svg>
          <p class="candle-desc">{{ pattern.desc }}</p>
        </article>
      </div>
    </section>

    <section class="knowledge-note">
      <h4>使用边界</h4>
      <p>
        蜡烛形态是「概率提示」，不是「必然信号」。三条原则：① 看位置——同样的形态在关键支撑阻力处才有意义，区间中间参考价值低；② 看周期——大周期形态比小周期更可靠，小周期噪音多；③ 看确认——多数反转形态需要下一根 K 线配合（如收破/收回某个价位）才算成立。高杠杆滚仓时，形态只决定「是否入场」，止损永远放在形态失效处，不能因为「画得像」就重仓硬扛。
      </p>
    </section>
  </div>
</template>

<script setup>
// 价格用 0-100 表示，y 轴在 SVG 里翻转；上方留白便于显示影线
const TOP = 12;
const BOT = 108;

function y(value) {
  return BOT - (value / 100) * (BOT - TOP);
}

function cx(index) {
  return 26 + index * 34;
}

function svgW(pattern) {
  return cx(pattern.candles.length - 1) + 26;
}

function dir(c) {
  return c.c >= c.o ? "bull" : "bear";
}

const groups = [
  {
    title: "单根 K 线",
    desc: "一根 K 线反映这段时间多空的瞬时较量，重点看实体大小和影线方向。",
    patterns: [
      {
        name: "大阳线",
        en: "Bullish Marubozu",
        tag: "强势看涨",
        bias: "bull",
        desc: "实体长、几乎无影线，买方全程主导，常见于趋势启动或突破。",
        candles: [{ o: 25, c: 80, h: 82, l: 23 }],
      },
      {
        name: "大阴线",
        en: "Bearish Marubozu",
        tag: "强势看跌",
        bias: "bear",
        desc: "实体长、几乎无影线，卖方全程主导，常见于破位下杀。",
        candles: [{ o: 80, c: 25, h: 82, l: 23 }],
      },
      {
        name: "锤子线",
        en: "Hammer",
        tag: "看涨反转",
        bias: "bull",
        desc: "小实体 + 长下影，出现在下跌末端关键支撑，代表下方买盘承接。",
        candles: [{ o: 70, c: 78, h: 82, l: 30 }],
      },
      {
        name: "上吊线",
        en: "Hanging Man",
        tag: "看跌反转",
        bias: "bear",
        desc: "形似锤子但出现在上涨末端，长下影暗示高位抛压开始出现。",
        candles: [{ o: 70, c: 64, h: 82, l: 30 }],
      },
      {
        name: "倒锤子",
        en: "Inverted Hammer",
        tag: "看涨反转",
        bias: "bull",
        desc: "小实体 + 长上影，出现在低位，多方尝试反攻，需次根确认。",
        candles: [{ o: 30, c: 38, h: 78, l: 28 }],
      },
      {
        name: "射击之星",
        en: "Shooting Star",
        tag: "看跌反转",
        bias: "bear",
        desc: "小实体 + 长上影，出现在高位关键阻力，上攻被拒，警惕反转。",
        candles: [{ o: 38, c: 30, h: 80, l: 28 }],
      },
      {
        name: "十字星",
        en: "Doji",
        tag: "多空均衡",
        bias: "neutral",
        desc: "开盘≈收盘，多空胶着、方向待定，在关键位常预示变盘。",
        candles: [{ o: 55, c: 54, h: 78, l: 32 }],
      },
      {
        name: "蜻蜓十字",
        en: "Dragonfly Doji",
        tag: "偏看涨",
        bias: "bull",
        desc: "开收都在高位、长下影，下探被全数收回，低位出现偏多。",
        candles: [{ o: 70, c: 70, h: 72, l: 30 }],
      },
      {
        name: "墓碑十字",
        en: "Gravestone Doji",
        tag: "偏看跌",
        bias: "bear",
        desc: "开收都在低位、长上影，上攻被全数打回，高位出现偏空。",
        candles: [{ o: 40, c: 40, h: 80, l: 38 }],
      },
      {
        name: "纺锤线",
        en: "Spinning Top",
        tag: "动能减弱",
        bias: "neutral",
        desc: "小实体 + 上下影都不短，多空都没占到便宜，趋势动能转弱。",
        candles: [{ o: 52, c: 58, h: 78, l: 32 }],
      },
    ],
  },
  {
    title: "两根 K 线",
    desc: "两根组合看「后一根如何对待前一根」，吞没和孕线是最核心的两类。",
    patterns: [
      {
        name: "看涨吞没",
        en: "Bullish Engulfing",
        tag: "看涨反转",
        bias: "bull",
        desc: "阳线实体完全包住前一根阴线，买方反客为主，低位出现意义更大。",
        candles: [
          { o: 60, c: 45, h: 64, l: 42 },
          { o: 42, c: 66, h: 70, l: 40 },
        ],
      },
      {
        name: "看跌吞没",
        en: "Bearish Engulfing",
        tag: "看跌反转",
        bias: "bear",
        desc: "阴线实体完全包住前一根阳线，卖方反客为主，高位出现意义更大。",
        candles: [
          { o: 45, c: 60, h: 63, l: 41 },
          { o: 64, c: 40, h: 66, l: 36 },
        ],
      },
      {
        name: "刺透形态",
        en: "Piercing Line",
        tag: "看涨反转",
        bias: "bull",
        desc: "阴线后阳线低开高走，收回前根实体一半以上，低位转强信号。",
        candles: [
          { o: 64, c: 44, h: 68, l: 42 },
          { o: 40, c: 58, h: 62, l: 38 },
        ],
      },
      {
        name: "乌云盖顶",
        en: "Dark Cloud Cover",
        tag: "看跌反转",
        bias: "bear",
        desc: "阳线后阴线高开低走，吃掉前根实体一半以上，高位转弱信号。",
        candles: [
          { o: 40, c: 60, h: 62, l: 36 },
          { o: 64, c: 46, h: 68, l: 42 },
        ],
      },
      {
        name: "看涨孕线",
        en: "Bullish Harami",
        tag: "看涨反转",
        bias: "bull",
        desc: "大阴线后一根小实体被其包含，抛压衰竭、动能转弱，需确认。",
        candles: [
          { o: 68, c: 36, h: 72, l: 32 },
          { o: 46, c: 54, h: 58, l: 44 },
        ],
      },
      {
        name: "看跌孕线",
        en: "Bearish Harami",
        tag: "看跌反转",
        bias: "bear",
        desc: "大阳线后一根小实体被其包含，买盘衰竭、动能转弱，需确认。",
        candles: [
          { o: 36, c: 68, h: 72, l: 32 },
          { o: 54, c: 46, h: 58, l: 44 },
        ],
      },
    ],
  },
  {
    title: "三根 K 线",
    desc: "三根组合给出更完整的反转或延续故事，确认度通常高于单根。",
    patterns: [
      {
        name: "早晨之星",
        en: "Morning Star",
        tag: "看涨反转",
        bias: "bull",
        desc: "大阴线 + 小实体星线 + 大阳线，下跌见底、买方接管的经典底部组合。",
        candles: [
          { o: 70, c: 42, h: 74, l: 40 },
          { o: 38, c: 36, h: 42, l: 32 },
          { o: 40, c: 70, h: 74, l: 38 },
        ],
      },
      {
        name: "黄昏之星",
        en: "Evening Star",
        tag: "看跌反转",
        bias: "bear",
        desc: "大阳线 + 小实体星线 + 大阴线，上涨见顶、卖方接管的经典顶部组合。",
        candles: [
          { o: 30, c: 58, h: 60, l: 26 },
          { o: 62, c: 64, h: 68, l: 58 },
          { o: 60, c: 30, h: 62, l: 26 },
        ],
      },
      {
        name: "红三兵",
        en: "Three White Soldiers",
        tag: "看涨延续",
        bias: "bull",
        desc: "三根依次抬高的阳线，买方稳步推进，趋势健康延续的强势信号。",
        candles: [
          { o: 30, c: 46, h: 49, l: 28 },
          { o: 44, c: 60, h: 63, l: 42 },
          { o: 58, c: 74, h: 77, l: 56 },
        ],
      },
      {
        name: "三只乌鸦",
        en: "Three Black Crows",
        tag: "看跌延续",
        bias: "bear",
        desc: "三根依次走低的阴线，卖方稳步打压，趋势转弱或加速下行信号。",
        candles: [
          { o: 74, c: 58, h: 76, l: 55 },
          { o: 60, c: 44, h: 62, l: 41 },
          { o: 46, c: 30, h: 48, l: 27 },
        ],
      },
    ],
  },
  {
    title: "进阶组合（多根）",
    desc: "三法、塔形、岛形等多根形态信息量更大，需要整段结构配合，确认度高但出现频率低。",
    patterns: [
      {
        name: "上升三法",
        en: "Rising Three Methods",
        tag: "看涨延续",
        bias: "bull",
        desc: "大阳线后几根小阴线在其区间内回调，再以大阳线创新高，上涨中继。",
        candles: [
          { o: 25, c: 65, h: 68, l: 23 },
          { o: 60, c: 52, h: 62, l: 50 },
          { o: 55, c: 48, h: 57, l: 46 },
          { o: 50, c: 44, h: 52, l: 42 },
          { o: 46, c: 78, h: 81, l: 44 },
        ],
      },
      {
        name: "下降三法",
        en: "Falling Three Methods",
        tag: "看跌延续",
        bias: "bear",
        desc: "大阴线后几根小阳线在其区间内反抽，再以大阴线创新低，下跌中继。",
        candles: [
          { o: 75, c: 35, h: 78, l: 32 },
          { o: 40, c: 48, h: 50, l: 38 },
          { o: 45, c: 52, h: 54, l: 43 },
          { o: 50, c: 56, h: 58, l: 48 },
          { o: 54, c: 22, h: 56, l: 19 },
        ],
      },
      {
        name: "塔形顶",
        en: "Tower Top",
        tag: "看跌反转",
        bias: "bear",
        desc: "大阳线后高位横盘一簇小实体，再以大阴线下杀，缓慢见顶的转折。",
        candles: [
          { o: 30, c: 62, h: 64, l: 28 },
          { o: 62, c: 64, h: 67, l: 60 },
          { o: 64, c: 62, h: 67, l: 60 },
          { o: 63, c: 61, h: 65, l: 59 },
          { o: 60, c: 28, h: 62, l: 26 },
        ],
      },
      {
        name: "塔形底",
        en: "Tower Bottom",
        tag: "看涨反转",
        bias: "bull",
        desc: "大阴线后低位横盘一簇小实体，再以大阳线拉起，缓慢见底的转折。",
        candles: [
          { o: 70, c: 38, h: 72, l: 36 },
          { o: 38, c: 36, h: 41, l: 34 },
          { o: 36, c: 38, h: 41, l: 34 },
          { o: 37, c: 39, h: 42, l: 35 },
          { o: 40, c: 72, h: 74, l: 38 },
        ],
      },
      {
        name: "顶部岛形反转",
        en: "Island Reversal (Top)",
        tag: "看跌反转",
        bias: "bear",
        desc: "向上跳空后高位停留，再向下跳空，留下孤立“岛屿”，强烈见顶信号。",
        candles: [
          { o: 25, c: 40, h: 42, l: 23 },
          { o: 62, c: 72, h: 74, l: 60 },
          { o: 72, c: 64, h: 76, l: 62 },
          { o: 42, c: 28, h: 44, l: 26 },
        ],
      },
      {
        name: "底部岛形反转",
        en: "Island Reversal (Bottom)",
        tag: "看涨反转",
        bias: "bull",
        desc: "向下跳空后低位停留，再向上跳空，留下孤立“岛屿”，强烈见底信号。",
        candles: [
          { o: 75, c: 60, h: 77, l: 58 },
          { o: 38, c: 28, h: 40, l: 26 },
          { o: 28, c: 36, h: 38, l: 24 },
          { o: 58, c: 72, h: 74, l: 56 },
        ],
      },
    ],
  },
];
</script>

<style scoped>
.candle-gallery {
  display: grid;
  gap: 20px;
}
.candle-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: var(--muted, #8b97a5);
  font-size: 0.82rem;
  font-weight: 750;
}
.candle-legend .swatch {
  display: inline-block;
  width: 11px;
  height: 11px;
  margin-right: 6px;
  border-radius: 2px;
  vertical-align: 1px;
}
.candle-legend .swatch.bull {
  background: #26a69a;
}
.candle-legend .swatch.bear {
  background: #ef5350;
}
.candle-group-title {
  margin: 0 0 4px;
  font-size: 1.02rem;
  font-weight: 900;
  color: var(--ink, #e7edf3);
}
.candle-group-desc {
  margin: 0 0 14px;
  color: var(--muted, #8b97a5);
  font-size: 0.86rem;
}
.candle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.candle-card {
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--line, rgba(255, 255, 255, 0.1));
  border-radius: 8px;
  background: var(--surface-strong, rgba(11, 17, 24, 0.6));
}
.candle-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.candle-card-head h5 {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 900;
  color: var(--ink, #e7edf3);
}
.candle-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 850;
  white-space: nowrap;
}
.candle-tag.bull {
  color: #26a69a;
  background: rgba(38, 166, 154, 0.14);
}
.candle-tag.bear {
  color: #ef5350;
  background: rgba(239, 83, 80, 0.14);
}
.candle-tag.neutral {
  color: var(--muted, #8b97a5);
  background: rgba(255, 255, 255, 0.06);
}
.candle-en {
  margin: 0;
  color: var(--muted, #8b97a5);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.candle-svg {
  width: 100%;
  height: 110px;
  margin: 2px 0;
}
.candle-svg .mid-line {
  stroke: rgba(255, 255, 255, 0.07);
  stroke-width: 1;
  stroke-dasharray: 3 4;
}
.candle-svg .wick {
  stroke-width: 2;
}
.candle-svg .wick.bull,
.candle-svg .body.bull {
  stroke: #26a69a;
}
.candle-svg .wick.bear,
.candle-svg .body.bear {
  stroke: #ef5350;
}
.candle-svg .body.bull {
  fill: rgba(38, 166, 154, 0.85);
}
.candle-svg .body.bear {
  fill: rgba(239, 83, 80, 0.85);
}
.candle-svg .body {
  stroke-width: 1;
}
.candle-desc {
  margin: 0;
  color: var(--ink, #e7edf3);
  font-size: 0.82rem;
  line-height: 1.5;
}
</style>
