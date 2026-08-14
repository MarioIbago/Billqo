# Super Prompt — Transformar la aplicación al diseño Black Crystal Glass

Actúa como **Senior Frontend Engineer, Product Designer, UX Engineer y especialista en React/TypeScript, accesibilidad, responsive mobile-first y rendering web de glassmorphism**.

Tu misión es transformar el proyecto existente al sistema visual definido en:

- `DESIGN_SYSTEM_EXACT.md`
- `images/*.png`
- `CONTACT_SHEET_15_MOBILE_SCREENS.jpg`

## Regla 0: no reconstruyas la app desde cero

Primero inspecciona la aplicación existente.

Preserva completamente:

- Firebase Auth;
- Google OAuth;
- Google Sheets;
- APIs existentes;
- analytics;
- cálculos financieros;
- persistencia;
- validaciones;
- routing;
- estados funcionales;
- acciones CRUD;
- conexión a backend;
- manejo de errores.

Este trabajo es principalmente una **transformación de UI/UX y arquitectura responsive**, no una reescritura de la lógica de negocio.

---

# Prioridad

1. Móvil 390–430 CSS px.
2. Funcionalidad existente.
3. Fidelidad visual a los PNG.
4. Accesibilidad y touch ergonomics.
5. Safari/iPhone performance.
6. Tablet.
7. Desktop.

---

# Reglas visuales absolutas

```text
Canvas default: #000000
Default accent: white / silver / neutral gray
Purple default: FORBIDDEN
Primary text: #F6F7F8
Secondary text: #969CA4
Income: #42D77D
Expense: #FF5A60
Balance: #4E9FFF
Warning: #F4A43C
```

No conviertas el producto en un dashboard gamer, crypto o neon-purple.

---

# Fuente

Usa:

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "SF Pro Text",
  "SF Pro Display",
  system-ui,
  Inter,
  "Helvetica Neue",
  Arial,
  sans-serif;
```

No agregues archivos de fuente Apple al repositorio.

---

# Spacing obligatorio móvil 390–479

```text
page horizontal: 20px
card padding: 16px
card gap: 12px
section gap: 24px
major section gap: 32px
input height: 50px
button height: 52px
icon hit target: >=44px
preferred hit target: 48px
central +: 56px
```

Usa 8px como unidad base y 4px como ajuste óptico.

---

# Material

Crea tokens reutilizables para:

```text
Glass L1
Glass L2
Glass L3
```

Incluye siempre:

```css
backdrop-filter
-webkit-backdrop-filter
border translucent
inner top highlight
outer shadow
solid fallback
```

No apliques backdrop-filter individual a cada row de listas largas.

---

# Safe areas

Debe existir:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
```

Y usar:

```css
env(safe-area-inset-top)
env(safe-area-inset-right)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
```

---

# Arquitectura mobile-first

En móvil:

```text
sidebar desktop -> bottom nav + drawer
full transaction table -> transaction cards
many horizontal KPIs -> 2×2 or stacked
side-by-side charts -> vertical charts
visible desktop filters -> mobile sheet
desktop modal -> mobile sheet/full-height modal
```

No uses `transform: scale()` para encoger desktop.

---

# Archivos del proyecto a inspeccionar primero

```text
src/App.tsx
src/Dashboard.tsx
src/index.css
src/components/LandingPage.tsx
src/components/AuthScreen.tsx
src/components/GoogleStorageOnboarding.tsx
src/components/Header.tsx
src/components/PowerBIDashboard.tsx
src/components/TransactionRegistry.tsx
src/components/BudgetManager.tsx
src/components/AiInsightsPanel.tsx
src/components/AddTransactionModal.tsx
src/types.ts
src/analytics.ts
src/lib/api.ts
```

No cambies contratos de API para resolver un problema puramente visual.

---

# Primitives a crear

Preferentemente:

```text
src/components/design/BlackCrystalBackground.tsx
src/components/design/CrystalOrb.tsx
src/components/design/GlassCard.tsx
src/components/design/GlassButton.tsx
src/components/design/GlassInput.tsx
src/components/design/GlassChip.tsx
src/components/design/GlassSegmentedControl.tsx
src/components/design/MobileTopbar.tsx
src/components/design/MobileBottomNav.tsx
src/components/design/MobileDrawer.tsx
src/components/design/MobileSheet.tsx
```

Los tokens deben centralizarse. No copies 40 veces el mismo `rgba()`.

---

# Orden de implementación

## Fase 1 — auditoría

- ejecutar proyecto;
- mapear rutas;
- mapear componentes;
- mapear estado;
- mapear OAuth/Google Sheets;
- identificar CSS global;
- identificar media queries actuales;
- identificar cualquier funcionalidad incompleta.

## Fase 2 — design system

- crear tokens;
- crear background;
- crear glass primitives;
- crear spacing/radius/type tokens;
- crear responsive utilities;
- crear safe-area utilities.

## Fase 3 — flujo público

Implementar fielmente:

```text
01_landing.png
02_auth.png
03_onboarding.png
```

## Fase 4 — app principal móvil

Implementar:

```text
04_dashboard.png
05_transactions.png
06_insights.png
07_budgets.png
08_new_transaction.png
```

## Fase 5 — vistas secundarias

Implementar/migrar:

```text
09_categories.png
10_analysis.png
11_goals.png
12_settings.png
13_export.png
14_filters.png
15_menu_drawer.png
```

Reutiliza la lógica que ya exista. Si una vista es actualmente placeholder, conserva el alcance funcional existente; no inventes backend nuevo sin necesidad.

## Fase 6 — responsive

Validar:

```text
320
360
390
393
402
430
768
1024
1440
```

## Fase 7 — accessibility/performance

- focus visible;
- reduced motion;
- labels reales;
- 44–48px targets;
- keyboard behavior;
- no blur masivo en listas;
- Safari fallback;
- safe area.

## Fase 8 — regresión funcional

Probar:

- login;
- logout;
- Google authorization;
- onboarding;
- cargar snapshot;
- crear movimiento;
- editar movimiento;
- borrar movimiento;
- presupuestos;
- insights;
- preferencias;
- sincronización;
- refresh;
- navegación.

---

# Validación final

El `package.json` actual tiene scripts:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Antes de terminar ejecuta:

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Si falla algo, corrígelo antes de declarar terminado.

---

# Criterio de aceptación visual

En viewport **430 × 932 CSS px**, cada vista debe reproducir la correspondiente imagen `images/*.png` en:

- jerarquía;
- spacing;
- tamaño relativo;
- typography;
- radii;
- glass intensity;
- navegación;
- densidad;
- contraste;
- posición de CTAs;
- comportamiento mobile-first.

No es suficiente con “usar glassmorphism”. Debe parecer el mismo sistema.

---

# Criterio de aceptación funcional

El rediseño no puede hacer que una funcionalidad que antes funcionaba deje de hacerlo.

No finalices con “debería funcionar”. Ejecuta las pruebas y build disponibles.
