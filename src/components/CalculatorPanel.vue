<template>
  <div class="tab-panel" :class="{ active }" id="calculatorPanel" data-panel="calculator">
    <header class="topbar">
      <div>
        <p class="eyebrow">Position Rolling</p>
        <h1 id="app-title">滚仓计算器</h1>
      </div>
      <div class="topbar-actions" data-panel-action="calculator">
        <button class="icon-button" type="button" title="重置示例数据" aria-label="重置示例数据" @click="$emit('reset')">↺</button>
        <button class="primary-button" type="button" @click="$emit('add-leg')">添加一笔</button>
      </div>
    </header>

    <section class="control-grid" aria-label="基础参数">
      <label class="field">
        <span>方向</span>
        <select v-model="state.direction">
          <option value="long">做多</option>
          <option value="short">做空</option>
        </select>
      </label>
      <label class="field">
        <span>账户权益 USDT</span>
        <input v-model.number="state.equity" type="number" min="0" step="0.01" inputmode="decimal" />
      </label>
      <label class="field">
        <span>新档默认杠杆</span>
        <input v-model.number="state.leverage" type="number" min="1" step="1" inputmode="numeric" />
      </label>
      <label class="field">
        <span>维持保证金率 %</span>
        <input v-model.number="state.maintenanceRate" type="number" min="0" step="0.01" inputmode="decimal" />
      </label>
      <label class="field">
        <span>单边手续费率 %</span>
        <input v-model.number="state.feeRate" type="number" min="0" step="0.001" inputmode="decimal" />
      </label>
      <label class="field">
        <span>目标价</span>
        <input v-model.number="state.targetPrice" type="number" min="0" step="0.0001" inputmode="decimal" />
      </label>
      <label class="field">
        <span>止损价</span>
        <input v-model.number="state.stopPrice" type="number" min="0" step="0.0001" inputmode="decimal" />
      </label>
    </section>

    <section class="visual-section" aria-labelledby="chart-title">
      <div class="section-heading">
        <div>
          <h2 id="chart-title">价格阶梯图</h2>
          <p>类似 TradingView 的 K 线视图，右侧价格轴、底部档位轴，悬浮查看单档数据。</p>
        </div>
      </div>
      <ChartCanvas :active="active" :result="result" :state="state" />
      <div class="chart-legend">
        <span><i class="dot entry"></i>滚仓档位</span>
        <span><i class="dot avg"></i>当前价</span>
        <span><i class="dot danger"></i>预估强平</span>
        <span><i class="dot target"></i>目标/止损</span>
      </div>
    </section>

    <section class="table-section" aria-labelledby="legs-title">
      <div class="section-heading">
        <div>
          <h2 id="legs-title">滚仓计划</h2>
          <p>100 USDT 按首仓价换算为 DOGE 保证金，每上涨 4% 一档全仓复投。</p>
        </div>
        <button class="ghost-button" type="button" @click="$emit('export')">复制结果</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>批次</th>
              <th>触发/成交价</th>
              <th>涨幅</th>
              <th>本次收益</th>
              <th>全仓投入 DOGE</th>
              <th>折合 USDT</th>
              <th>本档杠杆</th>
              <th>强平价</th>
              <th aria-label="删除"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(leg, index) in state.legs" :key="index">
              <td class="row-index">#{{ index + 1 }}</td>
              <td>
                <input
                  v-model.number="leg.price"
                  class="leg-input"
                  type="number"
                  min="0"
                  step="0.0001"
                  inputmode="decimal"
                  :aria-label="`第 ${index + 1} 笔成交价`"
                />
              </td>
              <td class="readonly-cell" :class="changeFor(leg) >= 0 ? 'positive' : 'negative'">
                {{ formatPercent(changeFor(leg)) }}
              </td>
              <td class="readonly-cell" :class="computedLeg(index)?.transitionPnl >= 0 ? 'positive' : 'negative'">
                {{ formatCoin(computedLeg(index)?.transitionPnl || 0) }}
              </td>
              <td class="readonly-cell">{{ formatCoin(computedLeg(index)?.margin || 0) }}</td>
              <td class="readonly-cell">
                {{ formatMoney(coinToUsd(computedLeg(index)?.margin || 0, computedLeg(index)?.price || toNumber(leg.price))) }}
              </td>
              <td>
                <input
                  v-model.number="leg.leverage"
                  class="leg-input"
                  type="number"
                  min="1"
                  step="1"
                  inputmode="numeric"
                  :aria-label="`第 ${index + 1} 笔杠杆倍数`"
                />
              </td>
              <td class="readonly-cell">{{ formatPrice(computedLeg(index)?.liquidationPrice || 0) }}</td>
              <td>
                <button class="delete-button" type="button" :title="`删除第 ${index + 1} 笔`" :aria-label="`删除第 ${index + 1} 笔`" @click="$emit('delete-leg', index)">
                  ×
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import ChartCanvas from "./ChartCanvas.vue";
import { coinToUsd, formatCoin, formatMoney, formatPercent, formatPrice, priceChange, toNumber } from "../utils/position.js";

const props = defineProps({
  active: {
    type: Boolean,
    default: true,
  },
  result: {
    type: Object,
    required: true,
  },
  state: {
    type: Object,
    required: true,
  },
});

defineEmits(["add-leg", "delete-leg", "export", "reset"]);

function basePrice() {
  return props.state.legs.find((leg) => toNumber(leg.price) > 0)?.price || 0;
}

function changeFor(leg) {
  return priceChange(toNumber(leg.price), toNumber(basePrice()));
}

function computedLeg(index) {
  return props.result.enriched[index] || null;
}
</script>
