<template>
  <Teleport to="body">
    <Transition name="tm-modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[70]"
        @click.self="closeOnBackdrop && close()"
        role="dialog"
        aria-modal="true"
      >
        <div class="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px]" />

        <div class="absolute inset-0 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
          <div
            class="pointer-events-auto w-full
                   bg-surface-elevated rounded-2xl shadow-lg
                   border border-border overflow-hidden animate-pop-in"
            :class="sizeClasses"
            role="document"
            @keydown.esc="closeOnEsc && close()"
          >
            <header
              v-if="$slots.header || title"
              class="flex items-start justify-between gap-4 px-6 py-5 border-b border-border"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div
                  v-if="icon"
                  :class="[
                    'w-10', 'h-10', 'shrink-0', 'rounded-xl', 'flex', 'items-center', 'justify-center',
                    iconToneClass,
                  ]"
                >
                  <component :is="icon" class="w-5 h-5" />
                </div>
                <div class="min-w-0">
                  <h3 class="text-h3 text-neutral-800 leading-tight">{{ title }}</h3>
                  <p v-if="subtitle" class="text-caption text-neutral-500 mt-0.5">{{ subtitle }}</p>
                  <slot v-else-if="$slots.header" name="header" />
                </div>
              </div>
              <button
                v-if="closeable"
                type="button"
                class="shrink-0 w-9 h-9 rounded-lg text-neutral-500
                       hover:bg-neutral-100 hover:text-neutral-800
                       transition-colors inline-flex items-center justify-center"
                @click="close"
                aria-label="Cerrar"
              >
                <component :is="XIcon" class="w-4 h-4" />
              </button>
            </header>

            <div :class="bodyPadding">
              <slot />
            </div>

            <footer
              v-if="$slots.footer"
              class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4
                     bg-surface-muted/60 border-t border-border"
            >
              <slot name="footer" />
            </footer>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from "vue";
import { X as XIcon } from "lucide-vue-next";

const props = defineProps({
  modelValue:     { type: Boolean, default: false },
  title:          { type: String,  default: "" },
  subtitle:       { type: String,  default: "" },
  size:           { type: String,  default: "md", validator: (v) => ["sm","md","lg","xl","full"].includes(v) },
  icon:           { type: [Object, Function, String], default: null },
  iconTone: {
    type: String, default: "primary",
    validator: (v) => ["primary","success","warning","danger"].includes(v),
  },
  closeable:      { type: Boolean, default: true },
  closeOnEsc:     { type: Boolean, default: true },
  closeOnBackdrop:{ type: Boolean, default: true },
});

const emit = defineEmits(["update:modelValue", "close"]);
const close = () => {
  emit("update:modelValue", false);
  emit("close");
};

const sizeMap = {
  sm:   "max-w-md",
  md:   "max-w-lg",
  lg:   "max-w-2xl",
  xl:   "max-w-4xl",
  full: "max-w-6xl max-h-[92vh]",
};
const sizeClasses = computed(() => sizeMap[props.size]);
const bodyPadding = computed(() =>
  props.size === "full" ? "p-0 overflow-y-auto scrollbar-thin" : "px-6 py-5",
);

const iconToneMap = {
  primary: "bg-primary-50   text-primary-600",
  success: "bg-success-50   text-success-600",
  warning: "bg-warning-50   text-warning-600",
  danger:  "bg-danger-50    text-danger-600",
};
const iconToneClass = computed(() => iconToneMap[props.iconTone]);
</script>

<style scoped>
.tm-modal-enter-active,
.tm-modal-leave-active { transition: opacity .2s ease; }
.tm-modal-enter-from,
.tm-modal-leave-to   { opacity: 0; }
.tm-modal-enter-active [role="document"],
.tm-modal-leave-active [role="document"] { transition: all .2s cubic-bezier(.2,.7,.2,1); }
.tm-modal-enter-from [role="document"],
.tm-modal-leave-to   [role="document"] { opacity: 0; transform: translateY(8px) scale(.98); }
</style>
