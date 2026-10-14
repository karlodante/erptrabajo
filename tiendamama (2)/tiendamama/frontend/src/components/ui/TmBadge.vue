<template>
  <span
    :class="[
      'inline-flex', 'items-center', 'gap-1.5', 'whitespace-nowrap', 'rounded-full', 'font-semibold',
      'transition-colors', 'duration-150', 'ease-soft', 'relative',
      sizeClasses,
      toneClasses,
      pulse ? 'after:absolute after:inset-0 after:rounded-full after:bg-current after:opacity-20 after:animate-ping after:-z-0' : '',
    ]"
  >
    <span
      v-if="dot"
      class="relative w-1.5 h-1.5 rounded-full bg-current -ml-0.5 z-10"
      aria-hidden="true"
    />
    <component
      v-if="icon"
      :is="icon"
      class="w-[1em] h-[1em] -mx-0.5"
    />
    <span class="z-10 leading-none"><slot /></span>
  </span>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  tone: {
    type: String,
    default: "neutral",
    validator: (v) =>
      ["success", "warning", "danger", "info", "primary", "neutral", "secondary"].includes(v),
  },
  size: {
    type: String,
    default: "sm",
    validator: (v) => ["sm", "md", "lg"].includes(v),
  },
  dot:   { type: Boolean, default: false },
  pulse: { type: Boolean, default: false },
  icon:  { type: [Object, Function, String], default: null },
});

const toneMap = {
  success:   "bg-success-50  text-success-700 ring-1 ring-success-500/20",
  warning:   "bg-warning-50  text-warning-700 ring-1 ring-warning-500/25",
  danger:    "bg-danger-50   text-danger-700  ring-1 ring-danger-500/25",
  info:      "bg-primary-50 text-primary-700 ring-1 ring-primary-500/20",
  primary:   "bg-primary-600 text-white ring-1 ring-primary-700/40",
  secondary: "bg-secondary-50 text-secondary-700 ring-1 ring-secondary-500/25",
  neutral:   "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-500/10",
};
const sizeMap = {
  sm: "h-5 px-2 text-micro tracking-wide",
  md: "h-6 px-2.5 text-caption-xs",
  lg: "h-7 px-3 text-caption",
};
const toneClasses = computed(() => toneMap[props.tone]);
const sizeClasses = computed(() => sizeMap[props.size]);
</script>
