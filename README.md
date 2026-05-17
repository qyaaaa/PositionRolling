# Position Rolling

Vue 版纯前端币本位滚仓计算器，面向合约/杠杆仓位的分批加仓方案测算。项目使用 Vite 启动，也可以构建后部署到 GitHub Pages。

## V1.0 首版范围

- 基础参数：做多/做空、账户权益 USDT、新档默认杠杆、维持保证金率、手续费率、目标价、止损价。
- 滚仓表格：按成交价和本档杠杆录入多笔滚仓计划，先按首仓价把 USDT 本金换算为 DOGE 保证金，再把上一档 DOGE 收益并入本金后按 DOGE 币数全仓投入，并展示每次滚仓后的强平价。
- 核心计算：当前 USDT 名义价值、仓位 DOGE 数量、当前入场价、当前杠杆、当前 DOGE 保证金、资金占用、剩余可用。
- 风险测算：预估强平价、盈亏平衡价、目标价盈亏、止损价盈亏、双边费用估算。
- 可视化：价格阶梯图展示开仓/加仓、均价、强平、目标与止损位置。
- 交易知识：新增知识 Tab，先补充订单流交易基础。
- 易用功能：DOGE 每 4% 一档的 10 档降杠杆示例、涨幅展示、示例数据重置、复制计算结果、本地自动保存。

## 版本方案

| 版本 | 目标 | 主要能力 |
| --- | --- | --- |
| V1.0 | 可用的静态 MVP | 单方案滚仓计算、分档杠杆、风险摘要、价格阶梯、复制结果 |
| V1.1 | 方案管理 | 多方案保存/对比、JSON 导入导出、移动端快捷录入 |
| V1.2 | 更贴近实盘 | 逐仓/全仓切换、资金费率、滑点、部分止盈/减仓模型 |
| V1.3 | 行情增强 | 可选行情接口、标记价格、实时风险提醒 |
| V2.0 | 决策工作台 | 策略模板、回撤压力测试、收益风险曲线、账户级仓位总览 |

## 计算说明

当前强平价为币本位简化估算模型，适合做滚仓方案预演，不等同于交易所最终强平价格。不同交易所会受到合约面值、标记价格、维持保证金阶梯、资金费率、手续费扣除方式、逐仓/全仓设置等影响。

## 使用方式

```bash
npm install
npm start
```

然后访问终端输出的本地地址，默认通常是 `http://localhost:5173`。

常用命令：

```bash
npm run dev
npm run build
npm run preview
```

## 文件结构

- `index.html`：Vite 入口，只挂载 Vue 应用。
- `src/App.vue`：应用壳、顶部 Tab、全局状态、复制和重置逻辑。
- `src/components/CalculatorPanel.vue`：滚仓计算 Tab，包括基础参数、K 线图和滚仓计划表。
- `src/components/KnowledgePanel.vue`：交易知识 Tab，当前先放订单流交易内容。
- `src/components/InspectorPanel.vue`：右侧仓位摘要、风险线和版本方案。
- `src/components/ChartCanvas.vue`：TradingView 风格 K 线 canvas。
- `src/utils/position.js`：滚仓、币本位盈亏、强平、格式化等计算函数。
- `src/utils/chart.js`：canvas 图表绘制函数。
- `styles.css`：夜间模式、计算器、知识面板和响应式样式。

## 本地调试

运行 `npm start` 后，Vite 会监听源码变化并自动刷新页面。新增知识主题时，优先扩展 `src/components/KnowledgePanel.vue`，需要新增计算能力时放到 `src/utils/position.js`。
