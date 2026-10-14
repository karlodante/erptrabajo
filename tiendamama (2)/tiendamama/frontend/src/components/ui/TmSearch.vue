<template>
  <div class="relative flex items-center">
    <component
      :is="SearchIcon"
      class="w-4 h-4 absolute left-3.5 text-neutral-400 pointer-events-none z-10"
      aria-hidden="true"
    />
    <input
      ref="inputRef"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      @focus="$emit('focus', $event)"
      @blur="$emit('blur', $event)"
      type="text"
      :placeholder="placeholder"
      :disabled="disabled"
      class="!pl-10 w-full !pr-10"
    />
    <button
      v-if="clearable && modelValue"
      type="button"
      @click="clear"
      class="absolute right-3 w-6 h-6 rounded-full text-neutral-400
             hover:text-neutral-700 hover:bg-neutral-200
             inline-flex items-center justify-center"
      aria-label="Limpiar"
    >
      <component :is="XIcon" class="w-3.5 h-3.5" />
    </button>
    <kbd
      v-else-if="shortcutKey && !modelValue"
      class="absolute right-3 h-6 px-1.5 items-center gap-0.5 text-caption-xs
             font-mono text-neutral-400 bg-neutral-100 border border-border rounded"
      aria-hidden="true"
    >
      {{ shortcutKey }}
    </kbd>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { Search as SearchIcon, X as XIcon } from "lucide-vue-next";

/**
 * TmSearch — Input de búsqueda con ícono y atajo de teclado visible.
 *
 * @prop {string}  modelValue       - v-model
 * @prop {string}  placeholder
 * @prop {boolean} clearable       - botón limpiar cuando hay texto
 * @prop {string}  shortcutKey    - ej: "/", "⌘K"
 * @prop {boolean} disabled
 */
const props = defineProps({
  modelValue:    { type: String,  default: "" },
  placeholder: { type: String,  default: "Buscar…" },
  clearable:   { type: Boolean, default: true },
  shortcutKey:{ type: String,  default: "" },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue", "clear", "focus", "blur"]);
const clear = () => { emit("update:modelValue", ""); emit("clear"); };

const inputRef = ref(null);
function focus() { inputRef.value?.focus(); }
defineExpose({ focus });
</script>