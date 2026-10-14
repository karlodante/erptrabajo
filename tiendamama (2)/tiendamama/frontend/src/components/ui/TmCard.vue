<template>
  <section
    :class="[
      'tm-surface', 'flex', 'flex-col', 'overflow-hidden', 'transition-shadow', 'duration-200', 'ease-soft',
      hoverable
        ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
        : '',
      padding,
    ]"
  >
    <header v-if="$slots.header || title"
            class="flex items-start justify-between pb-4 mb-4 border-b border-border">
      <div class="flex flex-col gap-1 min-w-0">
        <h3 v-if="title" class="text-h4 text-neutral-800 truncate">{{ title }}</h3>
        <p v-if="subtitle" class="text-caption text-neutral-500">{{ subtitle }}</p>
        <slot v-else-if="$slots.header" name="header" />
      </div>
      <div v-if="$slots.actions" class="shrink-0 ml-4">
        <slot name="actions" />
      </div>
    </header>

    <div class="flex-1 min-w-0">
      <slot />
    </div>

    <footer v-if="$slots.footer"
            class="mt-5 pt-4 border-t border-border flex items-center justify-between gap-3">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup>
/**
 * TmCard — Tarjeta reutilizable.
 *
 * @prop {string}  title     - título (opcional)
 * @prop {string}  subtitle  - subtítulo/descripción corta
 * @prop {'none'|'sm'|'md'|'lg'} padding - espaciado interior
 * @prop {boolean} hoverable - sombra + elevación al pasar el mouse
 */
const props = defineProps({
  title:     { type: String, default: "" },
  subtitle:  { type: String, default: "" },
  padding: {
    type: String,
    default: "md",
    validator: (v) => ["none", "sm", "md", "lg"].includes(v),
  },
  hoverable: { type: Boolean, default: false },
});

const paddingMap = {
  none: "",
  sm:   "p-4",
  md:   "p-5",
  lg:   "p-7",
};
</script>
