<template>
  <canvas ref="canvasRef" id="ladderChart" width="960" height="360" @mousemove="updatePointer" @mouseleave="clearPointer"></canvas>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { renderRollingChart } from "../utils/chart.js";

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

const canvasRef = ref(null);
const pointer = ref(null);

function draw() {
  if (!props.active || !canvasRef.value) return;
  renderRollingChart(canvasRef.value, props.result, props.state, pointer.value);
}

function updatePointer(event) {
  const rect = canvasRef.value.getBoundingClientRect();
  pointer.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  draw();
}

function clearPointer() {
  pointer.value = null;
  draw();
}

function drawAfterLayout() {
  nextTick(draw);
}

watch(
  () => [props.result, props.active],
  drawAfterLayout,
  { deep: true },
);

onMounted(() => {
  drawAfterLayout();
  window.addEventListener("resize", drawAfterLayout);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", drawAfterLayout);
});
</script>
