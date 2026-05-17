<template>
  <main class="app-shell" :class="{ 'knowledge-shell': activeTab === 'knowledge' }">
    <section class="workspace" aria-labelledby="app-title">
      <nav class="app-tabs" aria-label="功能切换">
        <button
          class="tab-button"
          :class="{ active: activeTab === 'calculator' }"
          type="button"
          :aria-selected="String(activeTab === 'calculator')"
          @click="activeTab = 'calculator'"
        >
          滚仓计算
        </button>
        <button
          class="tab-button"
          :class="{ active: activeTab === 'knowledge' }"
          type="button"
          :aria-selected="String(activeTab === 'knowledge')"
          @click="activeTab = 'knowledge'"
        >
          交易知识
        </button>
      </nav>

      <CalculatorPanel
        :active="activeTab === 'calculator'"
        :result="result"
        :state="state"
        @delete-leg="deleteLeg"
        @export="exportResult"
        @add-leg="addLeg"
        @reset="reset"
      />
      <KnowledgePanel :active="activeTab === 'knowledge'" />
    </section>

    <InspectorPanel v-if="activeTab === 'calculator'" :result="result" :state="state" />
  </main>

  <div class="toast" :class="{ show: toastVisible }" role="status" aria-live="polite">{{ toastMessage }}</div>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import CalculatorPanel from "./components/CalculatorPanel.vue";
import InspectorPanel from "./components/InspectorPanel.vue";
import KnowledgePanel from "./components/KnowledgePanel.vue";
import {
  calculate,
  cloneDefaultState,
  coinToUsd,
  defaultLeverageSteps,
  formatCoin,
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  loadSavedState,
  roundPrice,
  saveState,
  toNumber,
} from "./utils/position.js";

const state = reactive(loadSavedState());
const activeTab = ref("calculator");
const toastMessage = ref("");
const toastVisible = ref(false);
let toastTimer = 0;

const result = computed(() => calculate(state));

watch(
  state,
  () => {
    saveState(state);
  },
  { deep: true },
);

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
}

function deleteLeg(index) {
  state.legs.splice(index, 1);
  if (!state.legs.length) state.legs.push({ price: 0, leverage: state.leverage });
}

function reset() {
  Object.assign(state, cloneDefaultState());
  showToast("已恢复示例数据");
}

async function exportResult() {
  const current = result.value;
  const lines = [
    "Position Rolling 计算结果",
    `方向：${state.direction === "long" ? "做多" : "做空"}`,
    `账户权益：${formatMoney(state.equity)} USDT`,
    `初始币本位保证金：${formatCoin(current.initialCoinEquity)} DOGE`,
    `投入方式：按首仓价把 USDT 本金换算为 DOGE 保证金，之后逐档全仓复投`,
    `当前杠杆：${current.averageLeverage.toFixed(2)}x`,
    `总名义价值：${formatMoney(current.totalNotional)} USDT`,
    `仓位数量：${formatQuantity(current.totalQuantity)} DOGE`,
    `持仓均价：${formatPrice(current.avgEntry)}`,
    `当前保证金：${formatMoney(coinToUsd(current.marginUsed, current.avgEntry))} USDT`,
    `剩余可用：${formatMoney(coinToUsd(current.availableCash, current.avgEntry || toNumber(state.targetPrice)))} USDT`,
    `预估强平价：${formatPrice(current.liquidationPrice)}`,
    `盈亏平衡价：${formatPrice(current.breakEvenPrice)}`,
    `目标价盈亏：${formatCoin(current.targetPnl)} DOGE`,
    `止损价盈亏：${formatCoin(current.stopPnl)} DOGE`,
    "滚仓档位：",
    ...current.enriched.map(
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
  toastMessage.value = message;
  toastVisible.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastVisible.value = false;
  }, 2200);
}
</script>
