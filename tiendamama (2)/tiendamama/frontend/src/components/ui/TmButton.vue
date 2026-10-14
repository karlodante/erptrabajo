<template>
  <component
    :is="tag"
    :type="tag === 'button' ? nativeType : undefined"
    :href="href"
    :to="to"
    :disabled="disabled || loading"
    :class="baseClasses"
    class="group inline-flex items-center justify-center gap-2 select-none
           whitespace-nowrap transition-all duration-150 ease-soft rounded-lg
           focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
           focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    @click="onClick"
  >
    <svg
      v-if="loading"
      class="w-4 h-4 animate-spin opacity-80"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity=".25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
    <component v-else-if="icon" :is="icon" class="w-[1em] h-[1em] shrink-0" />

    <span v-if="$slots.default" :class="labelClasses">
      <slot />
    </span>

    <component v-if="iconRight" :is="iconRight" class="w-[1em] h-[1em] shrink-0" />
  </component>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  variant: {
    type: String,
    default: "primary",
    validator: (v) =>
      ["primary", "secondary", "danger", "ghost", "outline", "success", "warning"].includes(v),
  },
  size: {
    type: String,
    default: "md",
    validator: (v) => ["xs", "sm", "md", "lg", "icon"].includes(v),
  },
  block:     { type: Boolean, default: false },
  loading:   { type: Boolean, default: false },
  disabled:  { type: Boolean, default: false },
  icon:      { type: [Object, Function, String], default: null },
  iconRight: { type: [Object, Function, String], default: null },
  href:      { type: String,  default: null },
  target:    { type: String,  default: null },
  to:        { type: [String, Object], default: null },
  nativeType:{ type: String,  default: "button" },
});

const emit = defineEmits(["click"]);
const onClick = (e) => {
  if (props.disabled || props.loading) return;
  emit("click", e);
};

const tag = computed(() => {
  if (props.to)   return "router-link";
  if (props.href) return "a";
  return "button";
});

const variantMap = {
  primary:
    "bg-primary-600 text-white shadow-sm hover:bg-primary-700 active:bg-primary-800 " +
    "disabled:bg-primary-200 disabled:text-white/80",
  secondary:
    "bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:bg-neutral-300 " +
    "disabled:bg-neutral-100 disabled:text-neutral-400",
  danger:
    "bg-danger-500 text-white shadow-sm hover:bg-danger-600 active:bg-danger-700 " +
    "disabled:bg-danger-200 disabled:text-white/80",
  success:
    "bg-success-500 text-white hover:bg-success-600 active:bg-success-700 " +
    "disabled:bg-success-200 disabled:text-white/80",
  warning:
    "bg-warning-500 text-white hover:bg-warning-600 active:bg-warning-700 " +
    "disabled:bg-warning-200 disabled:text-neutral-600",
  outline:
    "border border-border bg-surface-elevated text-neutral-700 hover:border-primary-400 hover:text-primary-700 " +
    "hover:bg-primary-50 disabled:border-neutral-200 disabled:text-neutral-400",
  ghost:
    "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 " +
    "disabled:text-neutral-300",
};

const sizeMap = {
  xs:   "text-caption-xs h-7 px-2.5 font-semibold rounded-md",
  sm:   "text-caption h-9 px-3.5 font-semibold",
  md:   "text-body-sm h-10 px-4 font-semibold",
  lg:   "text-base h-11 px-5 font-semibold",
  icon: "h-10 w-10 p-0 font-semibold",
};
const iconSizeMap = {
  xs:   "[&>svg]:w-4 [&>svg]:h-4 text-[14px]",
  sm:   "[&>svg]:w-4 [&>svg]:h-4 text-[14px]",
  md:   "[&>svg]:w-4 [&>svg]:h-4 text-[15px]",
  lg:   "[&>svg]:w-5 [&>svg]:h-5 text-[16px]",
  icon: "[&>svg]:w-[18px] [&>svg]:h-[18px] text-[18px]",
};

const baseClasses = computed(() => [
  variantMap[props.variant],
  sizeMap[props.size],
  iconSizeMap[props.size],
  props.block ? "w-full" : "",
  props.disabled || props.loading ? "cursor-not-allowed opacity-90" : "cursor-pointer",
]);
const labelClasses = computed(() =>
  props.size === "icon" ? "hidden" : "",
);
</script>
