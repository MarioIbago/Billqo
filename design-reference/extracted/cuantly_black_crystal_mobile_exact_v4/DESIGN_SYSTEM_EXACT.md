# Cuantly — Black Crystal Glass Mobile Design System v4

## 1. Objetivo

Este documento define con precisión el rediseño visual de `finance-tracker.zip` usando el lenguaje **Black Crystal Glass** mostrado en las referencias proporcionadas por el usuario.

La prioridad no es desktop: **la referencia principal del producto es móvil**, especialmente teléfonos entre **390 y 430 CSS px de ancho**. Desktop se deriva después a partir de los mismos tokens y componentes.

El sistema debe sentirse como:

- vidrio negro ahumado real;
- cristal pulido con bordes plateados;
- capas profundas y discretas;
- negro absoluto como canvas;
- blanco/plata/gris como acento predeterminado;
- verde/rojo/azul únicamente cuando exista significado financiero;
- sin morado como identidad predeterminada;
- alta legibilidad;
- pocas superficies, pero cada superficie claramente material.

---

# 2. Fuente de verdad visual

Las imágenes de `images/` son la referencia pantalla por pantalla.

Cada archivo fue generado a **1290 × 2796 px**, equivalente a un viewport de diseño de **430 × 932 CSS px a 3×**.

Pantallas:

1. `01_landing.png`
2. `02_auth.png`
3. `03_onboarding.png`
4. `04_dashboard.png`
5. `05_transactions.png`
6. `06_insights.png`
7. `07_budgets.png`
8. `08_new_transaction.png`
9. `09_categories.png`
10. `10_analysis.png`
11. `11_goals.png`
12. `12_settings.png`
13. `13_export.png`
14. `14_filters.png`
15. `15_menu_drawer.png`

`CONTACT_SHEET_15_MOBILE_SCREENS.jpg` permite comparar todo el sistema de una sola vez.

---

# 3. Investigación aplicada

## Apple: materiales y Liquid Glass

Apple describe los materiales como recursos visuales que crean profundidad, capas y jerarquía entre foreground y background. Su guía actual distingue Liquid Glass como una capa funcional para controles y navegación que flota sobre el contenido.

Para esta web **no se intenta copiar una API nativa**; se replica el principio visual mediante `backdrop-filter`, translucidez, borde especular y jerarquía de materiales.

## Apple: tipografía

Apple identifica San Francisco como su familia sans serif de sistema. Para iOS/iPadOS, su guía de tipografía publica **17 pt como tamaño predeterminado recomendado** y **11 pt como mínimo general**.

## Apple: targets táctiles

Apple recomienda controles con una región táctil de **al menos 44 × 44 pt**.

## Material Design 3: spacing

Material 3 define su sistema de spacing sobre una escala base de **8dp** y recomienda adaptar padding, gaps y márgenes al componente, densidad y form factor.

## WCAG 2.2

WCAG 2.2 SC 2.5.8 fija **24 × 24 CSS px** como tamaño mínimo AA para targets, con excepciones basadas en spacing. Esta aplicación deliberadamente supera ese mínimo y adopta 44–48 px para interacción móvil.

### Fuentes oficiales consultadas

- Apple Human Interface Guidelines — Materials / Liquid Glass
- Apple Human Interface Guidelines — Typography
- Apple Human Interface Guidelines — Buttons
- Apple UI Design Dos and Don’ts
- Apple Designing for iOS
- Material Design 3 — Spacing
- W3C WCAG 2.2 — Target Size (Minimum)

URLs:

- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/design/human-interface-guidelines/typography
- https://developer.apple.com/design/human-interface-guidelines/buttons
- https://developer.apple.com/design/tips/
- https://developer.apple.com/design/human-interface-guidelines/designing-for-ios
- https://m3.material.io/styles/spacing
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum

---

# 4. Color system exacto

```css
:root {
  --black-1000: #000000;
  --black-950: #020304;
  --black-900: #050607;
  --black-850: #090A0C;

  --glass-fill-1: rgba(255, 255, 255, 0.035);
  --glass-fill-2: rgba(255, 255, 255, 0.055);
  --glass-fill-3: rgba(255, 255, 255, 0.075);
  --glass-fill-elevated: rgba(255, 255, 255, 0.11);

  --glass-border: rgba(255, 255, 255, 0.13);
  --glass-border-strong: rgba(255, 255, 255, 0.20);
  --glass-highlight: rgba(255, 255, 255, 0.34);

  --text-primary: #F6F7F8;
  --text-secondary: #969CA4;
  --text-tertiary: #696F78;

  /* accent por defecto */
  --accent: #F2F3F4;

  /* semánticos: no dependen del accent */
  --income: #42D77D;
  --expense: #FF5A60;
  --balance: #4E9FFF;
  --warning: #F4A43C;
  --info: #55D2D8;
}
```

## Regla absoluta del color

No usar violeta o morado como color de fondo, halo o CTA predeterminado.

El color de acento debe poder configurarse en un futuro, pero el default es:

```text
White / Silver / Neutral Gray
```

Los colores semánticos se mantienen:

```text
Ingreso  -> verde
Gasto    -> rojo
Balance  -> azul
Warning  -> naranja
```

---

# 5. Fondo

```css
.app-background {
  background:
    radial-gradient(
      380px 280px at 16% 4%,
      rgba(255,255,255,.055),
      transparent 62%
    ),
    radial-gradient(
      380px 280px at 94% 102%,
      rgba(255,255,255,.038),
      transparent 66%
    ),
    linear-gradient(180deg, #020304 0%, #000000 66%);
}
```

No usar un gradient visible como protagonista. El fondo debe percibirse negro; los cambios de luminancia son ambientales.

---

# 6. Orbes Black Crystal

Los orbes son decorativos y dan al vidrio algo que refractar.

## Cantidad

Máximo recomendado en móvil visible simultáneamente:

```text
2 orbes grandes/medianos
1 orbe pequeño
```

## Posición típica

```text
Orb A: parcialmente fuera del viewport arriba/izquierda
Orb B: parcialmente fuera del viewport abajo/derecha
Orb C: pequeño, cerca del tercio inferior derecho
```

## Regla

No colocar un orbe brillante directamente detrás de un párrafo importante.

```css
.crystal-orb {
  pointer-events: none;
  border-radius: 999px;
  background:
    radial-gradient(
      circle at 32% 24%,
      rgba(255,255,255,.33),
      rgba(255,255,255,.08) 12%,
      rgba(31,33,38,.68) 35%,
      rgba(4,4,5,.98) 70%
    );
  border: 1px solid rgba(255,255,255,.12);
  box-shadow:
    inset -18px -22px 40px rgba(0,0,0,.75),
    inset 10px 10px 22px rgba(255,255,255,.06),
    0 20px 60px rgba(0,0,0,.70);
}
```

---

# 7. Sistema de vidrio exacto

## Glass L1 — background grouping

```css
.glass-l1 {
  background: rgba(255,255,255,.035);
  border: 1px solid rgba(255,255,255,.09);
  backdrop-filter: blur(16px) saturate(112%);
  -webkit-backdrop-filter: blur(16px) saturate(112%);
}
```

## Glass L2 — card principal

```css
.glass-l2 {
  position: relative;
  background: linear-gradient(
    145deg,
    rgba(255,255,255,.075),
    rgba(255,255,255,.032) 52%,
    rgba(255,255,255,.018)
  );
  border: 1px solid rgba(255,255,255,.13);
  backdrop-filter: blur(22px) saturate(118%);
  -webkit-backdrop-filter: blur(22px) saturate(118%);
  box-shadow:
    0 18px 48px rgba(0,0,0,.38),
    inset 0 1px 0 rgba(255,255,255,.095),
    inset 0 -1px 0 rgba(255,255,255,.018);
}
```

## Glass L3 — modal/drawer/navigation flotante

```css
.glass-l3 {
  position: relative;
  background: rgba(15,16,18,.74);
  border: 1px solid rgba(255,255,255,.20);
  backdrop-filter: blur(28px) saturate(122%);
  -webkit-backdrop-filter: blur(28px) saturate(122%);
  box-shadow:
    0 32px 90px rgba(0,0,0,.64),
    inset 0 1px 0 rgba(255,255,255,.14);
}
```

## Reflejo superior obligatorio

```css
.glass::before {
  content: "";
  position: absolute;
  pointer-events: none;
  top: 0;
  left: 12%;
  right: 12%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255,255,255,.34),
    transparent
  );
}
```

Si se elimina este reflejo, la interfaz pierde gran parte del efecto de “cristal”.

---

# 8. Typography system

## Fuente deseada

Visualmente, la referencia se aproxima a:

```text
SF Pro Display / SF Pro Text
```

En producción web usar la system stack:

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "SF Pro Text",
  "SF Pro Display",
  system-ui,
  "Inter",
  "Helvetica Neue",
  Arial,
  sans-serif;
```

Esto permite que Safari/iPhone utilice la tipografía del sistema sin redistribuir archivos de fuente Apple.

Los mockups de este paquete usan Inter Display como sustituto visual.

## Escala exacta móvil

| Rol | Size | Weight | Line height | Letter spacing |
|---|---:|---:|---:|---:|
| Hero | 31px | 700 | 1.08 | -1.2px |
| Page title | 25px | 700 | 1.08 | -0.75px |
| Greeting | 25px | 700 | 1.08 | -0.75px |
| Modal title | 17px | 600 | 1.20 | -0.20px |
| Section title | 16px | 600 | 1.20 | -0.25px |
| KPI large | 21–33px | 600 | 1.05 | -0.45 a -1px |
| Body | 13–15px | 400 | 1.45–1.55 | 0 |
| Input | 14px | 400–500 | 1.20 | 0 |
| Label | 11px | 400–500 | 1.20 | 0 |
| Micro/meta | 9.5–10px | 400–500 | 1.30 | 0 |

No usar microcopy de 9.5–10 px para instrucciones críticas.

---

# 9. Teoría de padding aplicada

No existe un “padding perfecto” universal. El sistema correcto es repetible, jerárquico y adaptativo.

Este diseño usa:

```text
8px grid como base
4px como medio paso óptico
```

## Tokens

```css
--space-0-5: 2px;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

## Padding prioritario: teléfonos 390–430 px

```text
Page horizontal padding: 20px
Top padding after safe area: 14–16px
Card standard: 16px
Card dense: 14px
Card large: 18px
Card gap: 12px
Input gap: 12–13px
Title -> first component: 14–16px
Section gap: 24px
Major section gap: 32px
Bottom reserve above fixed nav: 96px + safe-area
```

### Por qué 20 px

16 px es eficiente; 24 px genera una composición más editorial. Para una pantalla de 390–430 px, **20 px** ofrece el punto medio que replica la referencia: premium y respirado, sin perder demasiado espacio útil.

---

# 10. Responsive spacing matrix

```text
320–359px
page: 12px
card: 14px
card gap: 10px
section: 20px

360–389px
page: 16px
card: 16px
card gap: 12px
section: 24px

390–479px   <-- referencia principal
page: 20px
card: 16px
card gap: 12px
section: 24px

480–767px
page: 24px
card: 18–20px
card gap: 16px
section: 28–32px

768–1023px
page: 24px
card: 20–24px
gap: 16px
section: 32px

1024–1439px
page: 24–28px
card: 20px
gap: 16px
section: 32px

1440px+
page: 32px
card: 24px
gap: 20px
section: 40px
```

---

# 11. Touch sizing

## Regla del producto

```text
Absolute minimum hit area: 44 × 44 CSS px
Preferred hit area: 48 × 48 CSS px
Primary button: 52px height
Input: 50px height
Icon button: 44–48px hit area
Visible icon: 20–22px
Central +: 56 × 56px
Gap between adjacent actions: >= 8px
```

No confundir el tamaño visible del icono con el tamaño táctil del botón.

---

# 12. Safe areas iPhone

HTML:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
```

CSS:

```css
.mobile-shell {
  padding-top: max(14px, env(safe-area-inset-top));
  padding-left: max(20px, env(safe-area-inset-left));
  padding-right: max(20px, env(safe-area-inset-right));
}

.mobile-main {
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
}

.mobile-bottom-nav {
  bottom: max(12px, env(safe-area-inset-bottom));
}
```

No usar `user-scalable=no`.

---

# 13. Radius system

```css
--radius-xs: 10px;
--radius-sm: 14px;
--radius-md: 18px;
--radius-lg: 20px;
--radius-xl: 24px;
--radius-sheet: 28px;
```

Uso:

```text
Input -> 14px
Segment -> 12–14px
Button -> 15px
Compact card -> 15–18px
Main card -> 20px
Bottom nav -> 24px
Drawer / modal -> 28px
```

---

# 14. Bottom navigation

La navegación móvil es fija y tiene cinco posiciones:

```text
Inicio
Movimientos
+
Insights
Más
```

Dimensiones:

```text
Left/right: 14px
Bottom: 12px + safe area
Visual height: 76px
Radius: 24px
Central plus: 56px
Central plus radius: 18px
```

El `+` se eleva aproximadamente 12 px respecto de la barra.

---

# 15. Pantalla por pantalla

## 01 — Landing

Archivo: `images/01_landing.png`

- header de marca arriba;
- mucho negative space;
- hero aproximadamente entre 250–400 px del viewport;
- headline 31 px / bold;
- texto máximo ~315 px;
- CTAs en zona inferior;
- primario silver full-width;
- secundario glass full-width;
- tres atributos al fondo;
- orbe superior izquierdo parcialmente fuera del viewport.

## 02 — Authentication

Archivo: `images/02_auth.png`

- título centrado;
- Google primero;
- separator fino;
- input 50 px;
- label 11 px;
- primary 52 px;
- el formulario no necesita una gran card externa: los inputs son el material interno.

## 03 — Google Sheets onboarding

Archivo: `images/03_onboarding.png`

- title centrado;
- objeto circular glass central;
- icono Google Sheets es una excepción semántica verde;
- tres beneficios;
- CTA principal plata.

## 04 — Dashboard

Archivo: `images/04_dashboard.png`

- greeting 25 px;
- selector 50 px;
- chips 36 px;
- KPIs 2×2 en 390–430;
- charts debajo, nunca al lado en móvil;
- bottom nav fija;
- charts simplificados, legibles.

## 05 — Movimientos

Archivo: `images/05_transactions.png`

- title + search/filter;
- 2 filtros iniciales;
- tabla desktop convertida en lista;
- row mínima 66 px;
- monto alineado derecha;
- metadatos secundarios 10 px;
- no aplicar blur completo a cada row en implementación: usar fill translúcido simple para performance.

## 06 — Insights

Archivo: `images/06_insights.png`

- selector periodo;
- savings rate hero;
- donut;
- insight textual;
- colores solo cuando explican información.

## 07 — Presupuestos

Archivo: `images/07_budgets.png`

- stack vertical;
- category + spent/limit + percentage;
- progress neutral silver;
- CTA nuevo presupuesto.

## 08 — Nuevo movimiento

Archivo: `images/08_new_transaction.png`

Orden de captura:

```text
Tipo
Monto
Categoría
Fecha
Descripción
Influencia
Guardar
```

- sin bottom nav;
- segmented control 44 px;
- inputs 50 px;
- CTA 52 px;
- influencia en 1–5;
- mantener flujo corto.

## 09 — Categorías

Archivo: `images/09_categories.png`

- lista vertical;
- nombre/subtipo izquierda;
- porcentaje/monto derecha;
- row completa interactiva.

## 10 — Análisis

Archivo: `images/10_analysis.png`

- gráficos en una columna;
- evolución balance arriba;
- barras por día abajo;
- no comprimir dos gráficos horizontalmente.

## 11 — Metas

Archivo: `images/11_goals.png`

- una card por meta;
- monto actual/objetivo;
- porcentaje;
- barra progreso;
- CTA nueva meta.

## 12 — Configuración

Archivo: `images/12_settings.png`

- list rows ~53–55 px;
- cuenta, notificaciones, tema, acento, privacidad;
- cerrar sesión rojo semántico.

## 13 — Exportar datos

Archivo: `images/13_export.png`

- rango;
- formato;
- exportar;
- privacidad.

## 14 — Filtros

Archivo: `images/14_filters.png`

En producción se recomienda bottom sheet:

```text
Tipo
Categoría
Fecha
Inicio/fin si personalizada
Aplicar
Limpiar
```

## 15 — Drawer

Archivo: `images/15_menu_drawer.png`

- drawer ~80% del viewport;
- Glass L3;
- backdrop posterior atenuado;
- navegación secundaria completa;
- perfil al fondo;
- item row ~42–46 px visual, con hit area al menos 44 px.

---

# 16. Mobile-first real

No hacer esto:

```text
Desktop dashboard -> transform: scale(.42)
```

Hacer esto:

```text
Desktop table -> mobile cards
Desktop sidebar -> bottom nav + drawer
Desktop 6 KPI row -> mobile 2×2 / stacked
Desktop side-by-side charts -> stacked charts
Desktop visible filters -> filter sheet
Desktop modal -> mobile full-height/bottom sheet
```

Breakpoints base:

```css
/* default: 0–479 mobile */
@media (min-width: 480px) {}
@media (min-width: 768px) {}
@media (min-width: 1024px) {}
@media (min-width: 1280px) {}
@media (min-width: 1440px) {}
```

---

# 17. Safari / iPhone performance

`backdrop-filter` puede ser costoso si se multiplica sin control.

Reglas:

- blur 16–22 px en cards;
- blur 28 px solo drawer/sheet/modal;
- máximo unas pocas superficies grandes solapadas;
- listas largas: glass en wrapper y rows simples;
- no animar blur continuamente;
- animar `opacity` y `transform`;
- orbes `pointer-events:none`;
- fallback sólido cuando no exista backdrop filter.

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass {
    background: rgba(18,19,21,.96);
  }
}
```

---

# 18. Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Default interactions:

```text
button press: 120–160ms
sheet open: 220–280ms
drawer: 240–300ms
card hover desktop: 160–200ms
```

No animar por decorar; usar movimiento para estados y jerarquía.

---

# 19. Mapeo al proyecto actual

El proyecto inspeccionado usa:

```text
React 19
TypeScript
Vite
React Router
Firebase Auth
Express backend
Google OAuth
Google Sheets
Lucide React
Recharts
Motion
```

Rutas actuales:

```text
/       -> LandingPage
/auth   -> AuthScreen
/app/*  -> Dashboard
```

Archivos principales a transformar:

```text
src/components/LandingPage.tsx
src/components/AuthScreen.tsx
src/components/GoogleStorageOnboarding.tsx
src/Dashboard.tsx
src/components/Header.tsx
src/components/PowerBIDashboard.tsx
src/components/TransactionRegistry.tsx
src/components/BudgetManager.tsx
src/components/AiInsightsPanel.tsx
src/components/AddTransactionModal.tsx
src/index.css
```

`Dashboard.tsx` ya contiene el modelo de navegación para:

```text
dashboard
transactions
income
expense
categories
analysis
insights
reports
budgets
goals
settings
```

No reemplazar esta arquitectura sin una razón concreta.

---

# 20. Primitives que debe crear el agente

```text
BlackCrystalBackground
CrystalOrb
GlassCard
GlassPanel
GlassInput
GlassButton
GlassIconButton
GlassChip
GlassSegmentedControl
MobileTopbar
MobileBottomNav
MobileDrawer
MobileSheet
MetricCard
TransactionRow
BudgetCard
GoalCard
```

Estos primitives deben concentrar los tokens del sistema y evitar estilos duplicados.

---

# 21. QA visual obligatorio

Probar capturas en:

```text
320 × 568
360 × 800
390 × 844
393 × 852
402 × 874
430 × 932  <-- reference viewport
768 × 1024
1024 × 768
1440 × 900
```

En cada viewport comprobar:

- no horizontal scrolling;
- no contenido detrás de bottom nav;
- safe area correcta;
- mínimo 44 px táctil;
- textos no cortados;
- charts legibles;
- drawers/sheets no salen del viewport;
- no aparecen backgrounds morados;
- glass no destruye contraste;
- keyboard mobile no tapa CTA principal cuando hay formulario.

---

# 22. Resultado esperado

La implementación correcta debe verse como los PNG del paquete, no como una interpretación genérica de “glassmorphism”.

La firma visual es:

```text
#000 canvas
+
smoked neutral glass
+
silver edge highlights
+
black reflective orbs
+
SF-like typography
+
20px mobile outer padding
+
16px card padding
+
12px card gap
+
24px section rhythm
+
44–48px touch targets
+
mobile-first IA
```
