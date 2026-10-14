<template>
  <Teleport to="body">
    <ul
      class="fixed top-4 right-4 z-[100] w-full max-w-sm flex flex-col gap-3
             pointer-events-none select-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <li
        v-for="t in state.toasts"
        :key="t.id"
        class="pointer-events-auto animate-toast-in"
      >
        <div
          :class="[
            'pointer-events-auto', 'flex', 'items-start', 'gap-3', 'p-4', 'pr-3', 'rounded-xl',
            'bg-surface-elevated', 'border', 'shadow-lg', 'ring-1', 'backdrop-blur',
            toneClasses(t.tone),
          ]"
        >
          <div
            :class="[
              'w-9', 'h-9', 'shrink-0', 'rounded-lg', 'flex', 'items-center', 'justify-center',
              iconBgClasses(t.tone),
            ]"
          >
            <component
              :is="t.icon ?? icons[t.tone] ?? InfoIcon"
              class="w-[18px] h-[18px]"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p v-if="t.title" class="text-body-sm font-semibold text-neutral-800 leading-5">
              {{ t.title }}
            </p>
            <p v-if="t.description" class="text-caption text-neutral-500 mt-0.5 break-words">
              {{ t.description }}
            </p>
          </div>
          <button
            type="button"
            class="w-8 h-8 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800
                   inline-flex items-center justify-center shrink-0 transition-colors"
            @click="dismiss(t.id)"
            aria-label="Cerrar notificación"
          >
            <component :is="XIcon" class="w-4 h-4" />
          </button>
        </div>
      </li>
    </ul>
  </Teleport>
</template>

<script setup>
import { Info as InfoIcon, X as XIcon, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-vue-next";
import { toastState, dismiss } from "./ToastBus.js";

const state = toastState;

const icons = {
  success: CheckCircle,
  danger:  XCircle,
  warning: AlertTriangle,
  info:    Info,
};
const toneClasses = tone => ({
  success: "border-success-500/20  text-success-700",
  warning: "border-warning-500/20  text-warning-700",
  danger:  "border-danger-500/20   text-danger-700",
  info:    "border-primary-500/20 text-primary-700",
}[tone] ?? "border-neutral-300 text-neutral-700");
const iconBgClasses = tone => ({
  success: "bg-success-50  text-success-600",
  warning: "bg-warning-50  text-warning-600",
  danger:  "bg-danger-50   text-danger-600",
  info:    "bg-primary-50 text-primary-600",
}[tone] ?? "bg-neutral-100 text-neutral-600");
</script>
