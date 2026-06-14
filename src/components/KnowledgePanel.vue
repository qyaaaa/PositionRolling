<template>
  <section class="tab-panel knowledge-panel" :class="{ active }" id="knowledgePanel" data-panel="knowledge" aria-labelledby="knowledge-title">
    <div class="section-heading">
      <div>
        <h2 id="knowledge-title">交易知识</h2>
        <p>从订单流到常用指标，重点放在 TradingView 里如何观察、确认和避坑。</p>
      </div>
    </div>

    <div class="knowledge-layout">
      <aside class="knowledge-nav" aria-label="知识目录">
        <button
          v-for="topic in topics"
          :key="topic.id"
          class="knowledge-topic"
          :class="{ active: topic.id === activeTopic }"
          type="button"
          :aria-current="topic.id === activeTopic ? 'page' : undefined"
          @click="activeTopic = topic.id"
        >
          <span>{{ topic.label }}</span>
        </button>
      </aside>

      <CandlePatterns v-if="activeTopic === 'candles'" class="knowledge-article" />

      <article v-else class="knowledge-article">
        <div class="knowledge-hero">
          <p class="panel-kicker">{{ article.kicker }}</p>
          <h3>{{ article.title }}</h3>
          <p>{{ article.intro }}</p>
        </div>

        <div class="knowledge-grid">
          <section v-for="block in article.blocks" :key="block.title" class="knowledge-block">
            <h4>{{ block.title }}</h4>
            <ol v-if="block.ordered">
              <li v-for="item in block.items" :key="item">{{ item }}</li>
            </ol>
            <ul v-else>
              <li v-for="item in block.items" :key="item">{{ item }}</li>
            </ul>
          </section>
        </div>

        <div v-if="article.signals?.length" class="signal-strip" :aria-label="`${article.title}信号示例`">
          <div v-for="signal in article.signals" :key="signal.title">
            <span>{{ signal.title }}</span>
            <strong>{{ signal.text }}</strong>
          </div>
        </div>

        <div v-if="article.examples?.length" class="tradingview-examples">
          <section v-for="example in article.examples" :key="example.title" class="knowledge-block">
            <h4>{{ example.title }}</h4>
            <p class="example-market">{{ example.market }}</p>
            <KnowledgeMiniChart :type="example.chart" />
            <ol>
              <li v-for="step in example.steps" :key="step">{{ step }}</li>
            </ol>
          </section>
        </div>

        <section class="knowledge-note">
          <h4>使用边界</h4>
          <p>{{ article.note }}</p>
        </section>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import KnowledgeMiniChart from "./KnowledgeMiniChart.vue";
import CandlePatterns from "./CandlePatterns.vue";

defineProps({
  active: {
    type: Boolean,
    default: false,
  },
});

const activeTopic = ref("order-flow");

const topics = [
  { id: "order-flow", label: "订单流" },
  { id: "price-action", label: "价格行为" },
  { id: "candles", label: "蜡烛形态" },
  { id: "macd", label: "MACD" },
  { id: "rsi", label: "RSI" },
  { id: "moving-average", label: "MA / EMA" },
  { id: "bollinger", label: "布林带" },
];

const articles = {
  "order-flow": {
    kicker: "Order Flow",
    title: "订单流交易",
    intro:
      "订单流不是预测指标，而是观察买卖双方在当下如何成交：谁在主动打单，哪里有流动性，价格到关键位置后是否被接受。在 TradingView 里可以用成交量、Volume Profile、Footprint/Delta 类工具做近似观察。",
    blocks: [
      {
        title: "核心观察",
        items: [
          "主动买入/卖出：成交是打到卖一还是砸到买一。",
          "盘口厚度：挂单是否真实承接，还是被快速撤掉。",
          "成交量 Delta：同一段价格内主动买卖力量的差值。",
          "吸收与扫单：大成交后价格不动，通常比成交量本身更关键。",
        ],
      },
      {
        title: "TradingView 工具配置",
        ordered: true,
        items: [
          "主图保留 K 线和成交量，先看价格是否放量离开关键区。",
          "添加 Visible Range Volume Profile，观察当前可视区的高成交量区、低成交量区和 POC。",
          "如果账号和品种支持，打开 Volume Footprint，看单根 K 线内部的买卖量、Delta 和失衡。",
          "没有 Footprint 时，可用 Volume Delta/CVD 类指标辅助，但要把它当近似信号。",
        ],
      },
      {
        title: "基础流程",
        ordered: true,
        items: [
          "先标出前高/前低、区间上下沿、VWAP、Volume Profile 的 POC/VAH/VAL。",
          "价格靠近关键位时，观察成交量是否放大，以及放量后价格是否真正离开该区域。",
          "突破后回踩不破，且回踩量缩，说明价格可能被市场接受。",
          "大量主动买入但价格不上涨，或大量主动卖出但价格不下跌，要优先考虑吸收。",
        ],
      },
    ],
    signals: [
      { title: "上攻确认", text: "主动买入放量 + 卖盘被连续吃掉" },
      { title: "假突破", text: "扫过高点后 Delta 转弱，价格回到区间内" },
      { title: "吸收", text: "大额买单成交，但价格无法继续抬升" },
    ],
    examples: [
      {
        title: "例子 1：突破是否有效",
        market: "TradingView：DOGEUSDT 15m，叠加成交量和 Visible Range Volume Profile。",
        chart: "breakout",
        steps: [
          "先把前高和 Volume Profile 的低成交量区标出来。",
          "价格突破前高时，如果成交量明显放大，并快速穿过低成交量区，说明上方流动性被扫掉。",
          "突破后回踩前高不破，成交量缩小，K 线收回上方，可以视为突破被接受。",
          "如果突破后马上跌回区间，且 Footprint/Delta 转弱，更像是假突破。",
        ],
      },
      {
        title: "例子 2：高位吸收",
        market: "TradingView：上涨末端，观察连续放量阳线和上影线。",
        chart: "absorption",
        steps: [
          "价格来到前高或 VAH 附近，成交量连续放大。",
          "如果主动买入很多，但 K 线实体变短、上影线变长，说明卖方可能在高位吸收买盘。",
          "下一根 K 线跌破放量 K 线低点，通常比单纯“成交量大”更有意义。",
          "这种位置不适合追多，更适合等回踩确认或降低杠杆。",
        ],
      },
      {
        title: "例子 3：低位承接",
        market: "TradingView：价格回到 VAL、前低或高成交量区下沿。",
        chart: "support",
        steps: [
          "下跌到关键支撑时，先看是否出现放量但价格不再继续下穿。",
          "如果长下影线出现，并且后续 K 线收回关键位上方，说明下方卖单可能被吸收。",
          "再次回踩时量能缩小，结构不破，可以作为小仓试错点。",
          "跌破关键位且无法收回时，承接失败，优先按失效处理。",
        ],
      },
    ],
    note:
      "TradingView 的订单流观察适合做入场与离场确认，但不同市场的数据源、账号权限和指标实现会影响精度。高杠杆滚仓时，订单流只能决定“是否执行”，不能替代失效价、仓位规模和强平距离管理。",
  },
  "price-action": {
    kicker: "Price Action",
    title: "价格行为学",
    intro:
      "价格行为学（Price Action）是只看价格本身、不依赖指标的分析方法。它关注 K 线形态、市场结构、关键价位之间的关系，核心假设是：所有信息最终都反映在价格上，行情如何反应比指标数值更重要。",
    blocks: [
      {
        title: "三大支柱",
        items: [
          "市场结构：用高点（H）和低点（L）的位置判断趋势，上升=高点抬高且低点抬高，下降=高点降低且低点降低。",
          "关键价位：前高前低、供需区、整数关口、缺口，是价格容易反应的地方。",
          "K 线形态：针形线（Pin Bar）、吞没（Engulfing）、内包线（Inside Bar）等，反映多空在某根 K 线内的较量。",
          "结构 + 价位 + 形态三者共振时，信号质量最高。",
        ],
      },
      {
        title: "市场结构判读",
        ordered: true,
        items: [
          "先在较大周期标出明显的摆动高点和摆动低点。",
          "顺着高低点连线判断当前是上升、下降还是震荡结构。",
          "结构被打破（BOS：跌破前低或突破前高）往往是趋势延续或转折的早期信号。",
          "区分“真突破结构”和“假突破后回归”，后者常是反向陷阱。",
        ],
      },
      {
        title: "关键价位详解：前高 / 前低",
        items: [
          "定义：前一段行情留下的明显高点（前高）和低点（前低），也就是市场记忆最深的转折点。",
          "为什么有效：上次在这里逆转过的人会记得，挂单和情绪都会聚集，价格再到这里容易出现反应。",
          "常见反应：前高常先当阻力（被打回），一旦放量突破并回踩不破，前高会“阻力转支撑”；前低反之。",
          "用法：把最近几个摆动前高前低标成水平线，只在这些线附近找入场和止损，而不是在半空中开仓。",
        ],
      },
      {
        title: "关键价位详解：供需区",
        items: [
          "定义：价格曾经快速、大幅离开的那一小段区域（一根或几根大实体起涨/起跌的起点），代表有大单堆积。",
          "和支撑阻力的区别：支撑阻力是“一条线”，供需区是“一个带”，更接近订单流里大单留下的脚印。",
          "怎么找：在图上找“盘整一下→突然一根大阳/大阴拉走”的位置，盘整那一小块就是需求区（涨前）或供给区（跌前）。",
          "用法：价格第一次回到供需区时反应通常最强；同一个区被反复测试后会逐渐失效（订单被消耗）。",
        ],
      },
      {
        title: "关键价位详解：整数关口",
        items: [
          "定义：心理整数价位，如 1.0000、100、50000 这类逢整逢半（含 .50）的价格。",
          "为什么有效：人天然爱在整数挂止盈止损和挂单，订单密度高，价格到这里容易卡顿或反复。",
          "常见现象：价格常在整数关口附近“假突破”——刺穿几个点扫掉止损后再快速收回。",
          "用法：把整数关口当作“需要留意的区域”而非精确点位，结合 K 线形态确认，别单凭一个整数就开仓。",
        ],
      },
      {
        title: "关键价位详解：缺口",
        items: [
          "定义：相邻两根 K 线之间没有成交的价格真空，多由跳空高开/低开形成（股票常见，币圈多在周末或大事件后）。",
          "回补倾向：很多缺口会被“回补”，即价格日后回到缺口区间走一遍，因此缺口边缘常成为目标位或支撑阻力。",
          "类型差异：突破缺口（趋势启动，常不急于回补）和衰竭缺口（趋势末端，回补概率高）含义相反，要结合位置判断。",
          "用法：把缺口上下沿标出来，既可当回补目标，也可当回踩后的进出参考，但别假设“缺口必补”。",
        ],
      },
      {
        title: "常见 K 线形态",
        items: [
          "针形线 / 锤子线：长影线方向被拒绝，实体小，出现在关键位更有意义。",
          "吞没形态：后一根 K 线实体完全包住前一根，代表力量反转。",
          "内包线：当前 K 线被前一根完全包含，代表波动收缩、酝酿方向。",
          "单根形态不能脱离位置看，区间中间出现的针形线参考价值很低。",
        ],
      },
    ],
    signals: [
      { title: "趋势延续", text: "回踩关键位出现顺势针形线，且不破前低/前高" },
      { title: "结构转折", text: "跌破上升结构前低后，反抽不过原低点" },
      { title: "假突破", text: "刺破关键位后快速收回，留下长影线" },
    ],
    examples: [
      {
        title: "例子 1：用市场结构判断趋势",
        market: "TradingView：任意品种，先看裸 K，标出摆动高低点。",
        chart: "pa-structure",
        steps: [
          "把明显的摆动高点和低点逐个标记出来。",
          "高点和低点持续抬高，确认为上升结构，只在回踩时找顺势机会。",
          "一旦价格跌破最近的摆动低点，上升结构被破坏，要降低做多预期。",
          "结构不清晰（高低点交错）时，按震荡处理，不强行定方向。",
        ],
      },
      {
        title: "例子 2：关键位的针形线",
        market: "TradingView：价格回到前低或供需区下沿。",
        chart: "pin-bar",
        steps: [
          "先确认价格来到一个事先标好的关键支撑，而不是半空中。",
          "出现长下影线、实体小的针形线，说明下方有买单承接。",
          "下一根 K 线收在针形线高点之上，信号才算确认。",
          "止损放在针形线影线之外，失效就认错，不硬扛。",
        ],
      },
      {
        title: "例子 3：突破回踩（阻力转支撑）",
        market: "TradingView：价格突破前高后回踩原阻力位。",
        chart: "sr-flip",
        steps: [
          "价格放量突破前高这一关键阻力位。",
          "回踩到原阻力位附近，不再跌破，说明阻力已转为支撑。",
          "回踩出现止跌 K 线（如针形、吞没）后顺势进场。",
          "如果回踩直接跌穿原阻力，突破被否定，按假突破处理。",
        ],
      },
      {
        title: "关键价位 1：前高 / 前低",
        market: "TradingView：把最近的摆动前高、前低画成水平线。",
        chart: "level-prior",
        steps: [
          "标出最近一两个明显的摆动前高（阻力）和前低（支撑）。",
          "价格第一次触碰前高常被打回，触碰前低常获支撑。",
          "放量突破前高并回踩不破时，前高转为支撑，可顺势跟进。",
          "只在这些线附近找入场和止损，不在半空中开仓。",
        ],
      },
      {
        title: "关键价位 2：供需区",
        market: "TradingView：找“盘整→一根大实体拉走”的起点。",
        chart: "level-zone",
        steps: [
          "在大阳/大阴启动前的那一小段盘整区，框成需求区或供给区。",
          "价格第一次回到该区时反应通常最强，可结合止跌 K 线进场。",
          "止损放在区的另一侧，跌穿区就说明大单已被吃掉、区失效。",
          "同一个区被反复测试后逐渐变弱，不要无限次复用。",
        ],
      },
      {
        title: "关键价位 3：整数关口",
        market: "TradingView：在整数/半整数价位画水平线。",
        chart: "level-round",
        steps: [
          "把附近的整数关口（如 1.0000、0.5000）标成参考区域。",
          "留意价格在关口附近卡顿、反复，或刺穿几点后快速收回。",
          "刺穿后收回是典型假突破，可反向考虑或等真突破确认。",
          "把整数当“区域”而非精确点，必须配合 K 线形态再决策。",
        ],
      },
      {
        title: "关键价位 4：缺口",
        market: "TradingView：跳空高开/低开后留下的价格真空。",
        chart: "level-gap",
        steps: [
          "把缺口的上沿和下沿画出来，作为潜在目标和支撑阻力。",
          "很多缺口会被回补，价格回到缺口区可观察是否承接或受阻。",
          "区分突破缺口（趋势启动，常不急补）和衰竭缺口（末端，易补）。",
          "把缺口当参考而非铁律，别假设“缺口必补”而逆势硬扛。",
        ],
      },
    ],
    note:
      "价格行为学的优势是直接、通用、不滞后，但主观性强，需要大量看盘训练。它和指标不冲突：指标负责过滤环境，价格行为负责精确入场和失效判断。高杠杆滚仓时，先用结构确认方向，再用 K 线形态找低风险入场点，止损永远放在结构失效处。",
  },
  macd: {
    kicker: "Momentum",
    title: "MACD",
    intro:
      "MACD 用快慢 EMA 的差值观察趋势动能，适合判断一段行情的加速、减速和背离。它比均线更关注动能变化，但本质上仍然是滞后指标。",
    blocks: [
      {
        title: "组成",
        items: [
          "DIF：快 EMA 减慢 EMA，常见参数是 12 EMA - 26 EMA。",
          "DEA：DIF 的平滑线，常见参数是 9。",
          "柱状图：DIF 与 DEA 的差值，反映动能扩张或收缩。",
          "零轴：DIF 在零轴上方偏多，下方偏空，但不能机械当作买卖点。",
        ],
      },
      {
        title: "TradingView 使用",
        ordered: true,
        items: [
          "指标里搜索 MACD，默认参数先不用急着改。",
          "先判断 DIF/DEA 在零轴上方还是下方，再看柱状图是否持续放大。",
          "上涨中柱体缩短，说明多头动能减弱；下跌中柱体缩短，说明空头动能减弱。",
          "背离需要配合结构确认，例如跌破前低失败或突破前高失败。",
        ],
      },
    ],
    signals: [
      { title: "多头延续", text: "DIF/DEA 在零轴上方，回踩后柱体再次放大" },
      { title: "动能衰减", text: "价格创新高，但 MACD 柱体或 DIF 不创新高" },
      { title: "空头延续", text: "DIF/DEA 在零轴下方，反弹后柱体再次向下放大" },
    ],
    examples: [
      {
        title: "例子 1：趋势中找回踩",
        market: "TradingView：DOGEUSDT 1h，MACD 保持在零轴上方。",
        chart: "macd-pullback",
        steps: [
          "价格处于上升结构，MACD 在零轴上方。",
          "回踩时柱体缩短，但 DIF 没有跌破零轴。",
          "价格回到短期均线附近后重新放量，柱体再次变长。",
          "这种情况更适合顺势试多，而不是看到回调就做空。",
        ],
      },
      {
        title: "例子 2：顶背离",
        market: "TradingView：价格连续新高，但 MACD 高点降低。",
        chart: "macd-divergence",
        steps: [
          "先确认价格确实创出新高。",
          "再看 MACD 的 DIF 或柱体高点是否没有同步创新高。",
          "等价格跌破最近一个小级别低点，背离才更有执行意义。",
          "背离不是立刻反转信号，只是动能变弱的警报。",
        ],
      },
    ],
    note:
      "MACD 不适合在窄幅震荡里频繁追金叉死叉，噪音会很多。更稳的用法是先看市场结构，再用 MACD 判断动能是否支持这段结构。",
  },
  rsi: {
    kicker: "Relative Strength",
    title: "RSI",
    intro:
      "RSI 衡量一段时间内上涨和下跌力度的相对强弱，常用来观察超买、超卖、背离和趋势强弱区间。它不是“到 70 必跌、到 30 必涨”的按钮。",
    blocks: [
      {
        title: "核心读法",
        items: [
          "70 以上常被视作偏热，30 以下常被视作偏冷。",
          "强趋势中 RSI 可以长时间维持高位或低位。",
          "RSI 背离更适合做风险提醒，而不是单独开仓依据。",
          "50 附近常可作为强弱分水岭，上方偏多，下方偏弱。",
        ],
      },
      {
        title: "TradingView 使用",
        ordered: true,
        items: [
          "指标里搜索 Relative Strength Index，默认 14 周期即可起步。",
          "趋势行情看 40-50 是否能守住，震荡行情看 30/70 的反向反应。",
          "配合支撑阻力：RSI 到超卖区但价格没到关键支撑，信号质量会下降。",
          "观察 RSI 与价格是否同时创新高/新低，用来判断动能是否跟上。",
        ],
      },
    ],
    signals: [
      { title: "强势回调", text: "价格回踩，RSI 守住 40-50 后重新上行" },
      { title: "超买钝化", text: "RSI 长时间高于 70，说明趋势强，不宜盲目摸顶" },
      { title: "底背离", text: "价格新低，RSI 不新低，随后价格收回关键位" },
    ],
    examples: [
      {
        title: "例子 1：趋势强弱过滤",
        market: "TradingView：DOGEUSDT 4h，RSI 长时间在 50 上方。",
        chart: "rsi-trend",
        steps: [
          "如果价格保持高低点上移，RSI 也多数时间在 50 上方，说明多头结构较稳。",
          "回调时 RSI 不破 40，价格也守住前高回踩位，顺势信号更干净。",
          "如果 RSI 跌破 40 且价格跌回区间，趋势可能已经变弱。",
        ],
      },
      {
        title: "例子 2：震荡区反向",
        market: "TradingView：横盘区间，RSI 在 30-70 往返。",
        chart: "rsi-range",
        steps: [
          "先确认价格处于区间震荡，而不是单边趋势。",
          "价格到区间下沿，RSI 接近 30 后拐头，可以观察反弹机会。",
          "价格到区间上沿，RSI 接近 70 后拐头，可以观察止盈或反向机会。",
        ],
      },
    ],
    note:
      "RSI 在趋势和震荡里的用法不同。趋势里不要因为超买就急着做空，震荡里也不要因为 RSI 过 50 就追单，必须先判断行情环境。",
  },
  "moving-average": {
    kicker: "Moving Average",
    title: "MA / EMA 均线",
    intro:
      "MA 和 EMA 都是均线工具，适合合并学习。MA 更平滑，EMA 对近期价格反应更快。它们主要用于判断趋势方向、动态支撑阻力和多周期节奏。",
    blocks: [
      {
        title: "MA 与 EMA 的区别",
        items: [
          "MA：简单移动平均，每个周期权重相同，反应更慢也更稳。",
          "EMA：指数移动平均，近期价格权重更高，反应更快。",
          "短周期均线看节奏，长周期均线看方向。",
          "均线越多越不一定越好，常用两到三条足够。",
        ],
      },
      {
        title: "TradingView 使用",
        ordered: true,
        items: [
          "指标里添加 Moving Average 或 Exponential Moving Average。",
          "常见组合：20/60/120 MA，或 20/50/200 EMA。",
          "先看价格在均线上方还是下方，再看均线斜率。",
          "均线密集缠绕代表震荡，均线发散才更像趋势展开。",
        ],
      },
    ],
    signals: [
      { title: "趋势延续", text: "价格在上升均线上方运行，回踩不破后继续上行" },
      { title: "震荡警告", text: "多条均线反复交叉，说明趋势信号质量低" },
      { title: "方向切换", text: "价格跌破长均线并反抽失败，结构可能转弱" },
    ],
    examples: [
      {
        title: "例子 1：20 EMA 动态支撑",
        market: "TradingView：DOGEUSDT 1h，添加 20 EMA 和 60 EMA。",
        chart: "ema-support",
        steps: [
          "上涨趋势中，价格多次回踩 20 EMA 后继续上行。",
          "回踩时成交量缩小，说明卖压没有明显扩大。",
          "再次站回短均线并突破小级别高点，可作为顺势信号。",
          "如果跌破 60 EMA 并反抽不过，趋势节奏要重新评估。",
        ],
      },
      {
        title: "例子 2：均线缠绕不交易",
        market: "TradingView：横盘区间，20/60/120 均线互相缠绕。",
        chart: "ma-chop",
        steps: [
          "均线没有明显斜率，价格上下穿越均线。",
          "这时金叉死叉容易反复失效。",
          "更适合等价格离开区间，或用区间上下沿做计划。",
        ],
      },
    ],
    note:
      "MA/EMA 是趋势过滤器，不是精确入场器。高杠杆滚仓时，均线可以帮助判断是否顺势，但入场仍要看关键价位、止损距离和强平距离。",
  },
  bollinger: {
    kicker: "Volatility",
    title: "布林带",
    intro:
      "布林带用中轨和上下轨描述价格波动范围。它最有价值的地方不是“碰上轨就空、碰下轨就多”，而是观察波动收缩、扩张和价格是否沿轨运行。",
    blocks: [
      {
        title: "组成",
        items: [
          "中轨：通常是 20 周期均线。",
          "上轨/下轨：中轨加减标准差，常见参数是 2。",
          "带宽：上下轨距离，代表波动率扩张或收缩。",
          "沿轨：强趋势中价格会贴着上轨或下轨运行。",
        ],
      },
      {
        title: "TradingView 使用",
        ordered: true,
        items: [
          "指标里搜索 Bollinger Bands，先使用默认 20、2 参数。",
          "观察带宽是否明显收窄，收窄后通常会迎来波动扩张。",
          "突破上轨后不立刻回落，且中轨上行，说明趋势可能在加速。",
          "跌破下轨后快速收回，配合支撑位，可能是短线假跌破。",
        ],
      },
    ],
    signals: [
      { title: "挤压", text: "带宽长期收窄，价格等待方向选择" },
      { title: "沿轨", text: "价格贴上轨或下轨运行，代表趋势强，不宜逆势硬扛" },
      { title: "回归中轨", text: "震荡环境里，价格离轨后回到中轨附近" },
    ],
    examples: [
      {
        title: "例子 1：布林带挤压突破",
        market: "TradingView：DOGEUSDT 30m，布林带明显收窄。",
        chart: "bb-squeeze",
        steps: [
          "先确认上下轨变窄，K 线波动压缩。",
          "价格放量突破上轨，同时中轨开始抬升。",
          "如果回踩不跌回中轨下方，可以视作波动扩张被接受。",
          "如果突破后快速回到带内，可能是假突破。",
        ],
      },
      {
        title: "例子 2：震荡中回归中轨",
        market: "TradingView：区间震荡，布林带横向运行。",
        chart: "bb-range",
        steps: [
          "中轨走平，价格在上下轨之间往返。",
          "触及上轨但无法突破区间高点，可以考虑止盈或降低仓位。",
          "触及下轨但守住区间低点，可以观察反弹到中轨的机会。",
        ],
      },
    ],
    note:
      "布林带要先区分趋势和震荡。趋势里沿轨是强势表现，震荡里离轨才更可能回归；混用这两种逻辑会很容易追在错误位置。",
  },
};

const article = computed(() => articles[activeTopic.value]);
</script>
