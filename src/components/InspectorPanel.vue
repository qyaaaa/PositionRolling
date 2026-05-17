<template>
  <aside class="inspector" aria-label="计算结果">
    <section class="result-panel">
      <p class="panel-kicker">Result</p>
      <h2>仓位摘要</h2>
      <div class="metrics">
        <div>
          <span>总名义价值</span>
          <strong>{{ formatMoney(result.totalNotional) }}</strong>
        </div>
        <div>
          <span>仓位数量</span>
          <strong>{{ formatQuantity(result.totalQuantity) }}</strong>
        </div>
        <div>
          <span>持仓均价</span>
          <strong>{{ formatPrice(result.avgEntry) }}</strong>
        </div>
        <div>
          <span>当前杠杆</span>
          <strong>{{ result.averageLeverage > 0 ? `${result.averageLeverage.toFixed(2)}x` : "-" }}</strong>
        </div>
        <div>
          <span>当前保证金 USDT</span>
          <strong>{{ formatMoney(coinToUsd(result.marginUsed, result.avgEntry)) }}</strong>
        </div>
        <div>
          <span>资金占用</span>
          <strong>{{ (result.capitalUsage * 100).toFixed(2) }}%</strong>
        </div>
        <div>
          <span>剩余可用</span>
          <strong>{{ formatMoney(coinToUsd(result.availableCash, result.avgEntry || toNumber(state.targetPrice))) }}</strong>
        </div>
      </div>
    </section>

    <section class="risk-panel">
      <div class="risk-head">
        <div>
          <p class="panel-kicker">Risk</p>
          <h2>风险线</h2>
        </div>
        <span class="risk-badge" :class="riskClass">{{ riskText }}</span>
      </div>
      <dl class="risk-list">
        <div>
          <dt>预估强平价</dt>
          <dd>{{ formatPrice(result.liquidationPrice) }}</dd>
        </div>
        <div>
          <dt>盈亏平衡价</dt>
          <dd>{{ formatPrice(result.breakEvenPrice) }}</dd>
        </div>
        <div>
          <dt>目标价盈亏</dt>
          <dd :class="result.targetPnl >= 0 ? 'positive' : 'negative'">{{ pnlText(result.targetPnl) }}</dd>
        </div>
        <div>
          <dt>止损价盈亏</dt>
          <dd :class="result.stopPnl >= 0 ? 'positive' : 'negative'">{{ pnlText(result.stopPnl) }}</dd>
        </div>
        <div>
          <dt>预计费用 DOGE</dt>
          <dd>{{ formatCoin(result.estimatedFees) }}</dd>
        </div>
      </dl>
    </section>

    <section class="version-panel">
      <p class="panel-kicker">Plan</p>
      <h2>首版方案</h2>
      <ol>
        <li>V1.0：静态计算器、分档杠杆、均价/保证金/盈亏/风险线。</li>
        <li>V1.1：加入导入导出、方案对比、移动端快捷输入。</li>
        <li>V1.2：加入行情接口、资金费率、逐仓/全仓模型切换。</li>
      </ol>
    </section>
  </aside>
</template>

<script setup>
import { computed } from "vue";
import { coinToUsd, formatCoin, formatMoney, formatPrice, formatQuantity, toNumber } from "../utils/position.js";

const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
  state: {
    type: Object,
    required: true,
  },
});

const riskText = computed(() => {
  if (props.result.capitalUsage >= 0.99) return "满仓";
  if (props.result.availableCash < 0 || props.result.capitalUsage > 0.85) return "高风险";
  if (props.result.capitalUsage > 0.65) return "偏紧";
  return "可用";
});

const riskClass = computed(() => {
  if (riskText.value === "高风险") return "danger";
  if (riskText.value === "满仓" || riskText.value === "偏紧") return "warn";
  return "";
});

function pnlText(pnl) {
  const roe = props.result.marginUsed > 0 ? (pnl / props.result.marginUsed) * 100 : 0;
  return `${formatCoin(pnl)} (${roe.toFixed(2)}%)`;
}
</script>
