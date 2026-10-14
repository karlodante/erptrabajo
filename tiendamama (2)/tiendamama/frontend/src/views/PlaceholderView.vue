<template>
  <div
    class="min-h-[60vh] flex flex-col items-center justify-center text-center p-10"
  >
    <div
      class="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mb-5"
    >
      <component :is="icon" class="w-8 h-8" />
    </div>
    <h2 class="text-h2 mb-2">{{ title }}</h2>
    <p class="text-body-sm text-neutral-500 max-w-lg">
      Módulo en construcción. Volveremos acá cuando te toque pedirme este
      módulo en los próximos prompts. 👷
    </p>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import * as I from "lucide-vue-next";

const route = useRoute();
const title = computed(() => route.meta?.title ?? "Pantalla");
const icon = computed(() => {
  const name = route.meta?.icon ?? "Layers";
  return I[name] ?? I.Layers;
});
</script>
