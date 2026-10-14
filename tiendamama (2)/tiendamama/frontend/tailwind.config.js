/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ============================================================
      // 1. PALETA DE COLORES  — Tienda de lácteos: frescura + confianza
      // ============================================================
      // Paleta evita "azul lechero" obvio. En su lugar usamos
      // "Deep Teal" (verde-azulado oscuro → frescura + profesionalismo)
      // acompañado de un color acento Coral cálido para CTAs.
      colors: {
        // --- PRIMARIO: Deep Teal 600-700 (frescura + premium) ---
        primary: {
          50:  "#EFFCF9",
          100: "#CFF8EE",
          200: "#9FF0DC",
          300: "#5FE2C2",
          400: "#2CC9A4",
          500: "#15AE8B",   // base hover
          600: "#0D8A72",   // ← BASE PRIMARY (botones, nav activa)
          700: "#0A6D5C",
          800: "#085247",
          900: "#063A33",
          950: "#022622",
        },

        // --- SECUNDARIO: Coral 500-600 (cálido, energético, toque humano) ---
        secondary: {
          50:  "#FFF4F0",
          100: "#FFE3D6",
          200: "#FFC2AB",
          300: "#FF9973",
          400: "#FF6F3D",   // badges destacados
          500: "#F04E1C",   // ← BASE SECONDARY (acento CTA)
          600: "#D23D11",
          700: "#AC2E0D",
          800: "#872510",
          900: "#671E10",
        },

        // --- SEMÁNTICOS ---
        success: {
          50:  "#ECFDF4",
          100: "#D3FAE1",
          200: "#A9F2C4",
          300: "#72E59F",
          400: "#38CE73",
          500: "#10B359",   // ← BASE SUCCESS
          600: "#069046",
          700: "#08713B",
          800: "#0A5A33",
          900: "#094A2C",
        },
        warning: {
          50:  "#FFFBEB",
          100: "#FEF2C8",
          200: "#FDE38A",
          300: "#FACD4E",
          400: "#F8B020",
          500: "#E89412",   // ← BASE WARNING (stock bajo / vto prox)
          600: "#C87109",
          700: "#A4500C",
          800: "#863F11",
          900: "#703412",
        },
        danger: {
          50:  "#FFF1F2",
          100: "#FFE0E2",
          200: "#FFC7CB",
          300: "#FFA0A7",
          400: "#FF6974",
          500: "#F53D4D",   // ← BASE DANGER (vencido / sin stock)
          600: "#D51E32",
          700: "#B21629",
          800: "#941528",
          900: "#7C1728",
        },

        // --- NEUTROS: Modo claro, cálido (no blanco frío) ---
        neutral: {
          0:   "#FFFFFF",
          50:  "#FAFAF9",   // fondo general
          100: "#F3F2EF",   // fondo tarjeta suave
          200: "#E6E4DE",   // bordes ligeros
          300: "#D3D0C8",   // bordes default
          400: "#A7A49D",   // iconos / placeholders
          500: "#78746D",   // texto secundario
          600: "#5A5650",   // texto body
          700: "#403D39",   // texto títulos
          800: "#2B2926",   // texto muy oscuro
          900: "#1A1918",   // texto hero
          950: "#0E0D0C",
        },

        // --- BACKGROUND GLOBAL (fondo principal app) ---
        surface: {
          DEFAULT: "#FAFAF9",   // neutral-50
          elevated: "#FFFFFF",  // tarjetas elevadas
          muted: "#F3F2EF",     // neutral-100 (input disabled, hover fila)
        },

        // --- BORDER GLOBAL ---
        border: {
          DEFAULT: "#E6E4DE",  // neutral-200
          strong:  "#D3D0C8",  // neutral-300
        },
      },

      // ============================================================
      // 2. TIPOGRAFÍA — Manrope (geometrica moderna, legibilidad total)
      // ============================================================
      fontFamily: {
        sans: [
          "Manrope",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      fontSize: {
        // ── Jerarquía ──
        // display: titulares hero
        "display-1": ["3rem",   { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "800" }],
        "display-2": ["2.25rem",{ lineHeight: "1.15",letterSpacing: "-0.02em", fontWeight: "700" }],
        // heading: títulos de sección / tarjeta
        "h1":        ["1.875rem",{ lineHeight: "1.2", fontWeight: "700" }],  // 30px
        "h2":        ["1.5rem",  { lineHeight: "1.25",fontWeight: "700" }],  // 24px
        "h3":        ["1.25rem", { lineHeight: "1.3", fontWeight: "700" }],  // 20px
        "h4":        ["1.125rem",{ lineHeight: "1.4", fontWeight: "600" }],  // 18px
        // body
        "body-lg":   ["1.0625rem",{ lineHeight: "1.55",fontWeight: "500" }], // 17px
        "base":      ["1rem",    { lineHeight: "1.6", fontWeight: "500" }],  // 16px
        "body-sm":   ["0.9375rem",{lineHeight: "1.5", fontWeight: "500" }],  // 15px
        // small
        "caption":   ["0.8125rem",{lineHeight: "1.5", fontWeight: "500" }],  // 13px
        "caption-xs":["0.75rem",  { lineHeight: "1.45",fontWeight: "500" }], // 12px
        "micro":     ["0.6875rem",{lineHeight: "1.4", fontWeight: "600",letterSpacing: "0.04em"}],
      },
      letterSpacing: {
        tightest:  "-0.03em",
        tighter:   "-0.02em",
      },

      // ============================================================
      // 3. BORDES, SOMBRAS Y RADIUS — Sutil, limpio y premium
      // ============================================================
      borderRadius: {
        "sm":   "6px",
        DEFAULT:"10px",
        "md":   "12px",
        "lg":   "16px",
        "xl":   "20px",
        "2xl":  "28px",
        "full": "9999px",
      },
      boxShadow: {
        // Sombras muy suaves (tipo SaaS premium / Linear/Framer)
        "sm":   "0 1px 2px 0 rgba(16,24,40,0.04), 0 1px 3px 0 rgba(16,24,40,0.04)",
        DEFAULT:"0 4px 6px -2px rgba(16,24,40,0.05), 0 12px 24px -8px rgba(16,24,40,0.08)",
        "md":   "0 8px 16px -4px rgba(16,24,40,0.08), 0 24px 48px -16px rgba(16,24,40,0.10)",
        "lg":   "0 16px 32px -8px rgba(16,24,40,0.10), 0 40px 80px -24px rgba(16,24,40,0.14)",
        "inner-sm": "inset 0 1px 2px rgba(16,24,40,0.06)",
        // Sombras específicas
        "ring-primary": "0 0 0 3px rgba(13,138,114,0.18)",
        "ring-danger":  "0 0 0 3px rgba(245,61,77,0.18)",
        // Tarjeta flotante
        "card": "0 1px 0 rgba(16,24,40,0.04), 0 12px 24px -12px rgba(16,24,40,0.08)",
      },
      ring: {
        "offsetWidth": "2px",
      },

      // ============================================================
      // 4. SPACING & GRID — Escala 4px (estándar) + sidebar 260px
      // ============================================================
      spacing: {
        "sidebar":        "260px",
        "sidebar-collapsed":"72px",
        "header-h":       "64px",
        "gap-card":       "20px",
        "18": "4.5rem",   // 72px
        "22": "5.5rem",   // 88px
        "30": "7.5rem",   // 120px
      },
      maxWidth: {
        "content":  "1400px",
        "prose-md": "860px",
      },
      screens: {
        // Breakpoints personalizados (desktop-first en caja de mostrador)
        "xs": "360px",
        "2xl":"1536px",
        "3xl":"1800px",
      },

      // ============================================================
      // 5. ANIMACIONES — Transiciones cortas y discretas
      // ============================================================
      transitionTimingFunction: {
        "soft": "cubic-bezier(0.2, 0.7, 0.2, 1)",
      },
      keyframes: {
        "fade-in-up": {
          "0%":   { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%":   { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "pop-in": {
          "0%":   { opacity: "0", transform: "scale(0.97)" },
          "60%":  { opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-480px 0" },
          "100%": { backgroundPosition: "480px 0" },
        },
        "toast-in": {
          "0%":   { opacity: "0", transform: "translateY(-8px) scale(.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-in-up":     "fade-in-up .3s ease-out both",
        "slide-in-right": "slide-in-right .25s cubic-bezier(0.2,0.7,0.2,1) both",
        "pop-in":         "pop-in .22s cubic-bezier(0.2,0.7,0.2,1) both",
        "toast-in":       "toast-in .25s cubic-bezier(0.2,0.7,0.2,1) both",
        "shimmer":        "shimmer 1.4s linear infinite",
      },

      // ============================================================
      // 6. BACKGROUND PATTERNS (sutiles, para headers)
      // ============================================================
      backgroundImage: {
        "grid-soft":
          "radial-gradient(rgba(13,138,114,0.06) 1px, transparent 1px)",
        "hero-glow":
          "radial-gradient(60% 120% at 0% 0%, rgba(13,138,114,0.08), transparent 60%), radial-gradient(40% 100% at 100% 0%, rgba(240,78,28,0.06), transparent 60%)",
      },
    },
  },
  plugins: [
    // Plugin de utilidades personalizadas (si se quiere variante)
    function ({ addUtilities, theme }) {
      addUtilities({
        ".scrollbar-thin": {
          "scrollbar-width": "thin",
          "scrollbar-color": theme("colors.neutral.300") + " transparent",
        },
        ".scrollbar-thin::-webkit-scrollbar":    { width: "6px", height: "6px" },
        ".scrollbar-thin::-webkit-scrollbar-thumb": {
          "background-color": theme("colors.neutral.300"),
          "border-radius": "999px",
        },
        ".scrollbar-thin::-webkit-scrollbar-thumb:hover": {
          "background-color": theme("colors.neutral.400"),
        },
      });
    },
  ],
};
