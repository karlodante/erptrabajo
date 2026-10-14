<template>
  <div
    class="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-neutral-100/70 border border-border w-full max-w-full"
    :class="`tm-tabs tm-tabs--${size || 'lg'}`"
  >
    <button
      v-for="t in tabs"
      :key="t.value"
      type="button"
      @click="$emit('update:modelValue', t.value)"
      class="relative inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
             text-caption font-bold transition-all whitespace-nowrap select-none
             border border-transparent"
      :class="[
        modelValue === t.value
          ? 'bg-white text-neutral-900 shadow-sm border-border'
          : 'text-neutral-500 hover:text-neutral-800 hover:bg-white/60',
      ]"
    >
      <component
        v-if="t.icon"
        :is="t.icon"
        class="w-[18px] h-[18px]"
        :class="[
          modelValue === t.value
            ? toneIcon[t.tone] ?? 'text-primary-600'
            : 'text-neutral-400',
        ]"
      />
      <span>{{ t.label }}</span>
      <span
        v-if="typeof t.badge === 'function' ? t.badge() : t.badge"
        class="ml-0.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5
               rounded-full text-[11px] font-extrabold tabular bg-danger-500 text-white
               border border-danger-400 shadow-[0_0_0_2px_rgba(255,255,255,1)]"
      >
        {{ typeof t.badge === 'function' ? t.badge() : t.badge }}
      </span>
    </button>
  </div>
</template>

<script setup>
const toneIcon = {
  primary: "text-primary-600",
  secondary: "text-secondary-600",
  success: "text-success-600",
  warning: "text-warning-600",
  danger: "text-danger-600",
  info: "text-primary-600",
};

defineProps({
  modelValue: { type: [String, Number, Symbol], default: "" },
  tabs: { type: Array, required: true },
  size: { type: String, default: "lg" },
});
defineEmits(["update:modelValue"]);
</script>
