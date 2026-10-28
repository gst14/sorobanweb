# Plan de implementación: Soroban Trainer (fases 0 a 4)

## Contexto

`docs/soroban-research.md` es la fuente de verdad. El repo hoy solo tiene `docs/`: no hay git ni código. Este plan convierte el roadmap 5.8 en tareas ejecutables. Las fases 0 (fundaciones) y 1 (MVP táctil) van con detalle fino; de la 2 a la 4 van solo hitos y riesgos. Las decisiones que ya tomaste no se reabren; donde encontré un problema técnico concreto lo marco con **⚠**.

Entorno verificado: Node 24.19.0, npm 11.17.0, Windows 11 (sin pnpm). Las versiones de npm se consultaron el 2026-10-27.

---

## Estado (2026-10-28, sesión 04)

- **Fase 0:** completa.
- **Fase 1:** tareas 1.1 a 1.24 completas. CI en verde y deploy vivo en `https://sorobanweb.vercel.app`. De la **1.25** queda la checklist manual en un iPhone y un Android reales.
- **Fase 2:** desglose fino escrito (más abajo). Bloques A (2.1–2.8) y B (2.9–2.13) completos, y la 2.14 también: `VisionPort` en `application/ports`, `VisionService` y la pantalla de cámara con el botón de "modo compatibilidad". El chunk JS de MediaPipe no se precachea, y en Chromium el modo táctil no pide nada de MediaPipe. Sigue la 2.15.
- **Desvíos respecto del plan:**
  - El template de create-vite 9 trae oxlint; se reemplazó por ESLint.
  - `vite-plugin-static-copy` 4 necesita `rename: { stripBase: true }`.
  - No hay rewrite SPA en `vercel.json`, porque la app no tiene rutas por URL.
  - En mobile horizontal, el soroban ocupa toda la altura con una columna lateral angosta: es la única forma de que 13 varillas tengan celdas de 44 px.
- **Verificado en Chromium:**
  - Capturas en 390×844, 844×390 y 1280×800, sin scroll horizontal.
  - Celdas de toque de 48×44 px en mobile y de 61×56 px en desktop.
  - La lección se juega sin red, sin requests a terceros ni a MediaPipe.

## Hallazgos previos (verificados, no son suposiciones)

1. **`classifyAdd` y `classifySub` del documento son correctos.** Los comparé contra un simulador de cuentas independiente (que intenta directo → amigo del 5 → amigo del 10 → combinado con restricciones físicas de cuentas) en las 180 combinaciones: 0 diferencias. Distribución por operación: 35 directo, 10 five, 35 ten, 10 combined.
2. **⚠ Son 52 ítems (operación, regla, dígito), no "unas 36" (§3.1).** Suma: direct d1–9 (9), five d1–4 (4), ten d1–9 (9), combined d6–9 (4) = 26. Resta: lo mismo = 26. Leitner necesita 52 cajas.
3. **Dualidad útil para tests:** `classifyAdd(v, d) === classifySub(9 − v, d)` para todo v, d (complemento a 9).
4. **Las llevadas y los préstamos nunca disparan "combined":** una llevada es +1 en la varilla izquierda y "combined" solo existe para d = 6..9. Por eso el mundo 3 puede tener cascadas (99+1) sin filtrar casos del mundo 4; pero una llevada sobre una varilla en 4 dispara "five" (4+1 = +5 −4), que sí es válido en el mundo 3 porque las reglas son acumulativas.
5. **⚠ Telemetría de MediaPipe.** En los tarballs de 1.1.1 y 1.2.0 (1.2.0 salió hoy): el README incluye un "Privacy Notice" que dice que las Tasks "send metrics about the performance and utilization of the APIs in your app to Google" y que "You are responsible for obtaining informed consent". El bundle hace POST a `https://odml.pa.googleapis.com/v1/log`. **En los tipos no hay ninguna opción pública para desactivarlo** (`TaskRunnerOptions` solo tiene `baseOptions`). En **0.10.35**, el README no tiene ese aviso y el bundle no contiene ese endpoint ni ninguna URL https. → **Decidido: `@mediapipe/tasks-vision@0.10.35`.**
6. **⚠ El WASM de MediaPipe pesa unos 11 MB por variante** (`vision_wasm_internal.wasm` 11 153 617 B; `nosimd` 10 481 398 B). §5.4 propone `workbox.globPatterns` con `wasm`, lo que **rompería el build** igual que el modelo (supera 2 MiB) y además obligaría a descargar unos 32 MB a quien solo usa el modo táctil. → El WASM recibe el mismo trato que el modelo: `globIgnores` + `CacheFirst` en tiempo de ejecución.
7. **⚠ TypeScript:** `latest` es 7.0.2, pero `typescript-eslint@8.72.1` exige `typescript >=4.8.4 <6.1.0`. → Fijar **TypeScript 6.0.3**.
8. **⚠ `erasableSyntaxOnly`** (activado en el template de create-vite): prohíbe las *parameter properties*, así que `private constructor(readonly heaven, readonly earth)` del §5.3 no compila. Hay que declarar los campos explícitamente.
9. **⚠ `noUncheckedIndexedAccess`** hará que `lm[4]` en `PinchDetector` (§5.5) sea `T | undefined`; en la fase 2 hacen falta guardas.
10. **⚠ La semántica del tap en la tierra que da el §4.4 está incompleta.** "Se mueve esa cuenta y todas las que estén entre ella y la viga" vale para *activar*. Para *desactivar* se mueven esa cuenta y las que están **más lejos** de la viga. Spec precisa (slot 0 = cuenta más cercana a la viga): si `slot < earth`, la tierra queda en `slot`; si no, queda en `slot + 1`.
11. **⚠ Cantidad de varillas contradictoria:** la tabla §1.1 dice 13 en mobile vertical y 17 en horizontal o desktop; el §5.7 dice 7–9 en vertical, 13 en horizontal y 17 en desktop → **Decidido: 7/13/17.**
12. **⚠ `value: number` no es seguro con 17 varillas:** 10¹⁷ − 1 es mayor que `Number.MAX_SAFE_INTEGER` (unos 9·10¹⁵). → La fuente de verdad son los `digits`, y `toNumber()` lanza un error si el resultado no es un safe integer. Los ejercicios nunca llegan a ese rango.
13. **⚠ La PWA instalada y offline no se puede probar con `basic-ssl`:** con un certificado autofirmado, Chrome no registra el service worker y la instalación falla. LAN + basic-ssl sirve para iterar sobre táctil y audio; para el criterio de salida de la fase 1 se usa el deploy en Vercel.
14. **Inconsistencias menores, con su resolución:**
    - §3.2 lista "sonidos" como desbloqueo del mundo 2, pero la fase 1 pide sonidos básicos. → En la fase 1 va el clac básico; el pack de madera y las skins se desbloquean en la fase 3.
    - `motion` (Framer Motion) figura en el stack pero no en tus decisiones. → Fase 1 con transiciones CSS; se reevalúa en la fase 3.
    - §2.3 dice que en el amigo del 10 "primero se resta el complemento y después se suma la decena". → La secuencia canónica sigue ese orden. Si preferís llevar primero, es un cambio de una línea en `technique.ts`.
    - §5.4 dice "copiar a `public/mediapipe/wasm`", pero `vite-plugin-static-copy` copia a `dist/` y lo sirve en dev; no escribe en `public/`. → Destino `mediapipe/wasm`, sin tocar `public/`.

---

## Setup

### Comandos de scaffolding

`create-vite` en un directorio que no está vacío pide borrar su contenido; para no arriesgar `docs/`, se genera en un directorio temporal y se copia:

```bash
cd /c/Projects/Utils/sorocan
git init -b main
npm create vite@9.3.3 ../sorocan-scaffold -- --template react-ts
cp -r ../sorocan-scaffold/. . && rm -rf ../sorocan-scaffold
rm -f package-lock.json && rm -rf node_modules
echo "save-exact=true" > .npmrc
```

### Dependencias con versiones fijadas (`-E`)

```bash
npm i -E react@19.3.1 react-dom@19.3.1 zustand@5.0.16 dexie@4.4.7 \
  @mediapipe/tasks-vision@0.10.35 workbox-window@7.4.1

npm i -D -E typescript@6.0.3 vite@8.3.5 @vitejs/plugin-react@6.1.2 \
  @vitejs/plugin-basic-ssl@2.3.0 vite-plugin-static-copy@4.1.1 vite-plugin-pwa@2.0.0 \
  @vite-pwa/assets-generator@2.0.0 \
  vitest@5.0.5 @vitest/coverage-v8@5.0.5 jsdom@30.1.3 fast-check@4.10.2 fake-indexeddb@6.2.6 \
  @testing-library/react@16.3.3 @testing-library/dom@10.4.2 \
  @testing-library/user-event@14.6.8 @testing-library/jest-dom@7.0.1 \
  eslint@10.13.0 @eslint/js@10.0.1 typescript-eslint@8.72.1 eslint-plugin-react-hooks@7.1.1 \
  eslint-plugin-react-refresh@0.5.7 eslint-config-prettier@10.1.8 globals@17.13.0 prettier@3.9.10 \
  @types/react@19.3.0 @types/react-dom@19.3.0 @types/node@24.19.2
```

Se revisaron los peers: vite-plugin-pwa 2.0.0, static-copy 4.1.1, basic-ssl 2.3.0 y vitest 5.0.5 aceptan Vite 8; plugin-react 6.1.2 exige Vite 8; react-refresh 0.5.7 acepta ESLint 9 o 10. `package.json` lleva `"engines": { "node": ">=24" }`. Para persistencia se elige Dexie y no idb: tiene versionado de esquema y consultas por índice (`skills.where('nextDue')`), que la fase 3 va a necesitar.

### tsconfig (strict)

- `tsconfig.json`: solo `references` a `app` y `node`, como en el template.
- `tsconfig.app.json` (`src/`): `target ES2022`, `lib [ES2023, DOM, DOM.Iterable]`, `module ESNext`, `moduleResolution bundler`, `jsx react-jsx`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `isolatedModules`, `noEmit`, `types [vite/client, vite-plugin-pwa/client]`, `paths { "@/*": ["./src/*"] }` (sin `baseUrl`, que está deprecado en TS 6).
- **`tsconfig.domain.json`** (nuevo): extiende `app`, `include: ["src/domain"]`, `lib: ["ES2023"]` **sin DOM**, `types: []`. Así, si el dominio usa `window`, `document` o `HTMLElement`, la compilación falla.
- `tsconfig.node.json`: para `vite.config.ts`.
- Script: `"typecheck": "tsc -b && tsc -p tsconfig.domain.json"`.

### ESLint (flat config, `eslint.config.js`)

- `@eslint/js` recommended, `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked` con `parserOptions.projectService: true`, `react-hooks` recommended (la 7.x incluye las reglas del compilador), `react-refresh` y `eslint-config-prettier` al final.
- Reglas globales: `@typescript-eslint/no-explicit-any: error`, `consistent-type-imports`, `switch-exhaustiveness-check`.
- **Fronteras de capas** con `no-restricted-imports` por carpeta, sin plugin extra:
  - `src/domain/**`: prohíbe `react*`, `zustand`, `dexie`, `@mediapipe/*`, `@/application|infrastructure|presentation|app/*` y sus rutas relativas equivalentes. Además, `no-restricted-properties` sobre `Math.random` y `Date.now` (la aleatoriedad y el tiempo se inyectan) y `no-restricted-globals` sobre `window`, `document`, `navigator`, `localStorage` y `performance`.
  - `src/application/**`: prohíbe `infrastructure`, `presentation`, `react`, `dexie` y `@mediapipe`.
  - `src/infrastructure/**`: prohíbe `presentation` y `app`.
  - `src/presentation/**`: prohíbe `infrastructure`. Las implementaciones llegan por el composition root mediante contexto.

### Prettier

`.prettierrc.json`: `{ "singleQuote": true, "trailingComma": "all", "printWidth": 100, "semi": true }` y `.prettierignore` (`dist`, `coverage`, `docs`).

### Vitest (dentro de `vite.config.ts`, con `/// <reference types="vitest/config" />`)

```ts
test: {
  projects: [
    { extends: true, test: { name: 'domain', environment: 'node', include: ['src/domain/**/*.test.ts', 'src/application/**/*.test.ts'] } },
    { extends: true, test: { name: 'ui', environment: 'jsdom', setupFiles: ['src/test/setup.ts'],
      include: ['src/{presentation,infrastructure,app}/**/*.test.{ts,tsx}'] } },
  ],
  coverage: {
    provider: 'v8', include: ['src/**'], exclude: ['src/**/*.test.*', 'src/test/**', 'src/main.tsx'],
    thresholds: { 'src/domain/**': { lines: 100, branches: 100, functions: 100, statements: 100 } },
  },
}
```

### `vite.config.ts`

```ts
/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { VitePWA } from 'vite-plugin-pwa';

const MP_VERSION = '0.10.35';

export default defineConfig(({ mode }) => ({
  base: '/',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    mode === 'lan' && basicSsl(),                       // `vite --mode lan --host`
    viteStaticCopy({
      targets: [{ src: 'node_modules/@mediapipe/tasks-vision/wasm/*', dest: 'mediapipe/wasm' }],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Soroban Trainer', short_name: 'Soroban', lang: 'es',
        display: 'standalone', orientation: 'any', start_url: '.', scope: '.',
        theme_color: '#…', background_color: '#…', icons: [/* generados con assets-generator */],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,ogg,mp3}'],   // sin wasm ni task
        globIgnores: ['mediapipe/**', 'models/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [{
          urlPattern: ({ url }) => /\/(mediapipe|models)\//.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: `mediapipe-${MP_VERSION}`, cacheableResponse: { statuses: [200] },
                     expiration: { maxEntries: 10 } },
        }],
      },
    }),
  ],
  optimizeDeps: { exclude: ['@mediapipe/tasks-vision'] },
  server: { host: true },
  test: { /* ver arriba */ },
}));
```

Scripts: `dev`, `dev:lan` (`vite --mode lan --host`), `build` (`npm run typecheck && vite build`), `preview` y `preview:lan`, `lint`, `format`, `format:check`, `test`, `test:watch`, `coverage`, y `check` (lint + typecheck + coverage), que se corre antes de cada commit.

---

## Fase 0 · Fundaciones (unos 4–5 días)

Un commit por tarea, con conventional commits (`chore:`, `build:`, `test:`, `feat(domain):`).

| # | Tarea | Archivos | Aceptación |
|---|---|---|---|
| 0.1 | git init, scaffold, versiones fijadas, `.npmrc`, `.gitignore` (`dist`, `coverage`, `public/models/*.task`) | raíz | `npm ci` funciona; `npm run dev` muestra la página del template |
| 0.2 | Los tres tsconfig más `tsconfig.domain.json` | `tsconfig*.json` | `npm run typecheck` pasa; un `document` puesto a propósito en el dominio falla |
| 0.3 | ESLint, Prettier y fronteras de capas | `eslint.config.js`, `.prettierrc.json` | `npm run lint` pasa; un `import 'react'` puesto a propósito en el dominio falla |
| 0.4 | Vitest con proyectos `domain`/`ui`, coverage y `src/test/setup.ts` (jest-dom) | `vite.config.ts`, `src/test/setup.ts` | Un test smoke en cada proyecto; `npm run coverage` aplica el umbral |
| 0.5 | `vite.config.ts` completo (react, basic-ssl, static-copy, PWA mínima) y esqueleto de carpetas de §5.2 con `.gitkeep` | `vite.config.ts`, `src/**` | `vite build` genera `dist/mediapipe/wasm/*.wasm` **sin** precachearlos (se revisa en `sw.js`); `dev:lan` abre por HTTPS desde el teléfono |
| 0.6 | `Digit.ts` y `Rod.ts` | `src/domain/soroban/Digit.ts`, `Rod.ts`, `Rod.test.ts` | Ver detalle; 100 % de cobertura |
| 0.7 | `Move.ts` y `expectedFinger` | `Move.ts`, `Move.test.ts` | 100 % de cobertura |
| 0.8 | Agregado `Soroban` | `Soroban.ts`, `errors.ts`, `Soroban.test.ts` | Ver detalle; propiedades con fast-check |
| 0.9 | `rules.ts` con `classifyAdd` y `classifySub` | `rules.ts`, `rules.test.ts`, `rules.fixtures.ts` | Las 180 combinaciones contra la tabla escrita a mano y contra el oráculo; 100 % de cobertura |
| 0.10 | Barrel `src/domain/soroban/index.ts` y README corto de arquitectura | `index.ts`, `docs/architecture.md` | `npm run check` en verde |

### Detalle del dominio

- **`Digit.ts`**: `type Digit = 0|…|9`, `type EarthCount = 0|…|4`, `isDigit(n): n is Digit` y `toDigit(n): Digit` (lanza `RangeError`). Sin casts sueltos: los `as` se concentran en esos helpers, detrás de una verificación.
- **`Rod.ts`**: campos `readonly heaven` y `readonly earth` declarados explícitamente (por `erasableSyntaxOnly`), `private constructor`, `Rod.of(d)`, `Rod.ZERO`, `value`, `moveEarth(n)` (lanza `RangeError` fuera de 0..4), `setHeaven(on)`, `canMoveEarth(n)` y `equals`. Las instancias se congelan con `Object.freeze(this)`.
- **`Move.ts`**: como en el §5.3, con `readonly` en todos los campos. Se agrega el tipo `HeavenDelta = 1 | -1`. Como unión discriminada por `deck`, `delta` se tipa según el deck: `EarthMove { deck: 'earth'; delta: -4|…|-1|1|…|4 }` y `HeavenMove { deck: 'heaven'; delta: 1 | -1 }`. Así, un "cielo +3" no se puede ni escribir.
- **`Soroban.ts`**: `static create(rodCount, unitRod = 0)` valida que la cantidad sea impar y ≥ 3 y que `unitRod` esté en rango. También `fromNumber(n, rodCount, unitRod)`, `fromDigits`, `rods: readonly Rod[]` (congelado), `digits(): readonly Digit[]`, `toNumber()` (lanza si no es un safe integer), `canApply(move)` y `apply(move): Soroban`, que lanza `InvalidMoveError` (por ejemplo, bajar el cielo si ya está abajo, o una varilla fuera de rango). Se agregan `rodValue(i)` y `clear()`.
- **`rules.ts`**: `Rule`, `Operation = 'add' | 'sub'`, `classifyAdd`, `classifySub` y `classify(op, v, d)`. Las firmas usan `Digit` para v y `d: Exclude<Digit, 0>`, de modo que las 180 combinaciones son exactamente el dominio del tipo. Se agrega `RULE_ITEMS`: la lista constante de los 52 ítems (op, rule, d), que va a usar Leitner.

### Tests de `rules` (exhaustivos, con tres fuentes independientes)

1. **Tabla escrita a mano** (`rules.fixtures.ts`), *no derivada* de la fórmula. Las 180 celdas.
2. **Oráculo por simulación de cuentas** en el propio test: intenta directo → amigo del 5 → amigo del 10 → combinado aplicando solo `Rod.moveEarth` y `setHeaven`.
3. **Invariantes:** conteo 35/10/35/10 por operación; dualidad `classifyAdd(v, d) === classifySub(9 − v, d)`; si `v + d ≤ 9`, la regla está en {direct, five}; "combined" solo aparece con d ∈ 6..9; `RULE_ITEMS.length === 52`.

**Tabla esperada.** D = direct, 5 = five, 10 = ten, C = combined. Filas: valor actual v. Columnas: d = 1..9.

| v | **Suma** d=1 2 3 4 5 6 7 8 9 | **Resta** d=1 2 3 4 5 6 7 8 9 |
|---|---|---|
| 0 | D D D D D D D D D | 10 10 10 10 10 10 10 10 10 |
| 1 | D D D 5 D D D D 10 | D 10 10 10 10 C 10 10 10 |
| 2 | D D 5 5 D D D 10 10 | D D 10 10 10 C C 10 10 |
| 3 | D 5 5 5 D D 10 10 10 | D D D 10 10 C C C 10 |
| 4 | 5 5 5 5 D 10 10 10 10 | D D D D 10 C C C C |
| 5 | D D D D 10 C C C C | 5 5 5 5 D 10 10 10 10 |
| 6 | D D D 10 10 C C C 10 | D 5 5 5 D D 10 10 10 |
| 7 | D D 10 10 10 C C 10 10 | D D 5 5 D D D 10 10 |
| 8 | D 10 10 10 10 C 10 10 10 | D D D 5 D D D D 10 |
| 9 | 10 10 10 10 10 10 10 10 10 | D D D D D D D D D |

**Casos testigo con explicación** (van como `it` con nombre propio):

| Caso | Regla | Movimientos |
|---|---|---|
| 2+2 | direct | +2 tierra |
| 3+2 | five | +5 −3 |
| 4+1 | five | +5 −4 |
| 6+4 | ten | −6 (subir el cielo y bajar 1 de tierra) y +10 |
| 5+5 | ten | −5 y +10 |
| 5+7 | combined | +2 −5 y +10 |
| 9+1 | ten | −9 y +10 |
| 6−3 | five | +2 −5 |
| 5−1 | five | +4 −5 |
| 0−1 | ten | −10 y +9 |
| 5−6 | ten | −10 y +4 |
| 3−6 | combined | −10, +5 −1 |
---

## Fase 1 · MVP táctil (unas 2,5–3 semanas, 22 tareas de ≤ ½ día)

Orden por bloques: **A dominio → B aplicación → C infraestructura → D presentación → E PWA y dispositivos**. Dentro de cada bloque, el orden de la tabla respeta las dependencias.

### A · Dominio (100 % de cobertura)

| # | Tarea | Archivos | Depende de | Aceptación |
|---|---|---|---|---|
| 1.1 | Interacción pura con cuentas: `earthTap(rod, slot)`, `heavenTap(rod)` y `dragMove(rod, deck, dir)` → `Move \| null` | `domain/soroban/interaction.ts` (+test) | 0.8 | Spec del hallazgo 10 para los 5 estados × 4 slots; un drag en la dirección inválida devuelve `null` |
| 1.2 | Secuencia canónica por varilla: `canonicalSteps(op, v, d): Step[]`, con `Step = { rodOffset: 0 \| 1; deck; delta }` y el orden "−c y luego +10" | `domain/soroban/technique.ts` (+test) | 0.9 | En las 180 combinaciones, aplicar los pasos a `Rod` da el valor esperado y cada paso es físicamente válido; la cantidad de pasos por regla es fija y conocida |
| 1.3 | Planificador multi-varilla: `planOperation(soroban, op, operand)` → `{ steps, ruleUses: {op, rule, d, rod}[] }`, de izquierda a derecha y con llevadas o préstamos en cascada | `domain/soroban/operation.ts` (+test) | 1.2 | 99+1, 999+1, 100−1 y 1000−1; con fast-check, `apply(steps)` vale a±b; `ruleUses` coincide con `classify` en cada varilla |
| 1.4 | `Rng` puro con semilla (mulberry32) y modelo `Exercise` (`reading-decode`, `reading-encode`, `operation`, `chain`) | `domain/exercises/Rng.ts`, `Exercise.ts` (+test) | 0.8 | Misma semilla, misma secuencia |
| 1.5 | Generadores por regla: se elige el ítem (op, rule, d) y luego v uniforme entre los candidatos donde `classify` da esa regla; también versión multi-dígito y encadenados de N términos con la restricción `ruleUses ⊆ allowed` | `domain/exercises/generators/{reading,singleRule,chain}.ts` (+tests) | 1.3, 1.4 | Con 10⁴ muestras: todos los candidatos aparecen (chi² laxo), nunca hay reglas fuera de lo permitido y nunca sale un resultado negativo |
| 1.6 | Validador: `validate(exercise, finalSoroban, moves)` → `{ correct, techniqueScore, extraMoves, failedRule? }` | `domain/exercises/validator.ts` (+test) | 1.2, 1.3 | Hacer la secuencia canónica da `extraMoves = 0`; un error se etiqueta con el primer `ruleUse` cuya varilla quedó mal |
| 1.7 | Catálogo de mundos 0–3: lecciones con `allowedRules`, operaciones, dígitos, cantidad de ejercicios y umbral (80 %), más los jefes del §3.2 en versión simple | `domain/progression/worlds.ts`, `lessonProgress.ts` (+test) | 1.5 | Cada lección genera solo sus reglas; desbloqueo lineal puro `isUnlocked(lessonId, results)` |
| 1.8 | Textos de reglas para feedback: `describeStep` y `describeRule` ("+3 = +5 −2") | `domain/exercises/hints.ts` (+test) | 1.2 | Las 52 descripciones son únicas y correctas |

### B · Aplicación

| # | Tarea | Archivos | Depende de | Aceptación |
|---|---|---|---|---|
| 1.9 | Puertos: `InputSource` (`start(onMove)`, `stop()`), `AudioPort` (`unlock`, `play(cue)`, `setMuted`), `ProgressRepo`, `Clock` y `RngFactory` | `application/ports/*.ts` | 0.7 | Solo tipos; compilan |
| 1.10 | Casos de uso: `ApplyMove` (valida con `canApply` y descarta sin lanzar; registra el move con `clock.now()`), `StartLesson`, `SubmitAnswer` (valida, reproduce el sonido y persiste el intento) y `LessonSession` como máquina de estados pura | `application/usecases/*.ts` (+test con fakes) | 1.6, 1.7, 1.9 | Flujo completo de una lección con fakes; un move inválido no rompe la sesión |

### C · Infraestructura

| # | Tarea | Archivos | Depende de | Aceptación |
|---|---|---|---|---|
| 1.11 | `PointerInput`: se registra sobre el `<svg>`, lee `data-rod`, `data-deck` y `data-slot` del target, sigue cada `pointerId` (multi-touch, para "pinza" con dos dedos), usa `setPointerCapture`, tap si se movió menos de 8 px y drag cuando se supera el 35 % de la altura de una cuenta; emite `Move` con `finger: 'unknown'` vía 1.1 | `infrastructure/input/PointerInput.ts` (+test jsdom) | 1.1, 1.9 | Tests con `pointerdown/move/up` sintéticos; dos punteros simultáneos sobre varillas distintas |
| 1.12 | `KeyboardInput`: ←/→ elige la varilla, ↑/↓ mueve la tierra, Shift+↑/↓ el cielo y Esc limpia | `infrastructure/input/KeyboardInput.ts` (+test) | 1.1, 1.9 | Se puede resolver un ejercicio solo con teclado |
| 1.13 | `WebAudioPort`: un solo `AudioContext({ latencyHint: 'interactive' })` creado en `unlock()` dentro del gesto, `resume()` más un buffer silencioso de 1 muestra, `resume()` antes de cada disparo, manejo de `interrupted` y `visibilitychange`. Sonidos **sintetizados** (ráfaga de ruido con filtro pasabanda para el clac; tonos de acierto y error) con `playbackRate` ±5 %. Así no hay assets ni licencias | `infrastructure/audio/WebAudioPort.ts`, `synth.ts` (+test con un AudioContext falso) | 1.9 | Los tests verifican el orden unlock → resume → silent buffer; en el iPhone suena después de "Empezar" |
| 1.14 | `DexieProgressRepo`: tablas `attempts` y `lessonResults`, con un esquema que ya prevé `skills` y `profile` para la fase 3 | `infrastructure/persistence/*.ts` (+test con fake-indexeddb) | 1.9 | Guarda y lee; `navigator.storage.persist()` se pide una vez |

### D · Presentación

| # | Tarea | Archivos | Depende de | Aceptación |
|---|---|---|---|---|
| 1.15 | Composition root y stores Zustand: `sorobanStore`, `sessionStore` y `settingsStore` (con `persist` en localStorage: mute, mano, mostrar valor); contexto `PortsProvider` | `app/composition.ts`, `app/App.tsx`, `presentation/stores/*.ts` | 1.10–1.14 | La app arranca con implementaciones reales; los tests usan fakes |
| 1.16 | Geometría pura del soroban: `computeLayout(rodCount, width, height)` → posiciones de varillas, viga, cuentas y puntos de unidad (cada 3 desde `unitRod`) | `presentation/components/soroban/geometry.ts` (+test) | 0.8 | Las áreas táctiles miden ≥ 44 px CSS con 7 varillas a 360 px de ancho |
| 1.17 | `<SorobanSvg/>` estático: render a partir del `Soroban`, `role="group"` y `aria-label` por varilla ("varilla 3: 7"), resaltado de la varilla de unidades, `aria-live` con el valor (opcional) | `presentation/components/soroban/SorobanSvg.tsx` (+test RTL) | 1.16 | Snapshot semántico; muestra 0–999 correctamente |
| 1.18 | Interacción en `<SorobanSvg/>`: hook `useInputSource` que conecta PointerInput y KeyboardInput, `touch-action: none`, rects de hit invisibles ampliados, transiciones CSS de `transform` y respeto de `prefers-reduced-motion` | `SorobanSvg.tsx`, `presentation/hooks/useInputSource.ts`, `useReducedMotion.ts` (+test) | 1.11, 1.12, 1.15, 1.17 | El caso de la reseña (subir 3 y bajar 1 para dejar 2) funciona; tap y swipe |
| 1.19 | Layout responsive: `useRodLayout` (cantidad de varillas según orientación y ancho, 7 en vertical, 13 en horizontal, 17 en desktop), `dvh/svh`, `safe-area-inset-*`, sugerencia de rotar | `presentation/hooks/useRodLayout.ts`, `styles/*.css` | 1.18 | Sin scroll horizontal entre 320 px y desktop; el soroban ocupa todo el ancho en vertical |
| 1.20 | Pantallas: `Start` (botón "Empezar" que desbloquea el audio), `WorldList` (mundos 0–3 con lecciones y candados lineales), `Lesson` (enunciado, soroban, botón "Listo", feedback con `describeRule` cuando hay error, barra de progreso) y `LessonResult` (aciertos y reglas falladas) | `presentation/screens/*.tsx`, `components/HUD.tsx` (+test de flujo con fakes) | 1.15, 1.18 | Se completa una lección del mundo 1 en el test de integración |
| 1.21 | Ejercicios del mundo 0: decodificar (soroban de solo lectura y teclado numérico en pantalla con `inputmode="numeric"`) y codificar (se muestra un número y el usuario pone las cuentas), más el jefe "20 números en 60 s" | `presentation/screens/Lesson*.tsx`, `components/NumericKeypad.tsx` (+test) | 1.20 | Los dos tipos de ejercicio se juegan con táctil y con teclado |
| 1.22 | Audio en la UI: clac en cada `Move` aplicado, sonidos de acierto y error, botón de mute, subtítulo visual del sonido ("✓ correcto") | `presentation/**`, `app/composition.ts` | 1.13, 1.20 | Con mute no suena nada; sin audio, la UI no cambia |

### E · PWA y dispositivos

| # | Tarea | Archivos | Depende de | Aceptación |
|---|---|---|---|---|
| 1.23 | PWA completa: íconos generados con `@vite-pwa/assets-generator` a partir de `public/logo.svg`, manifest final, `registerSW` con `autoUpdate` y aviso discreto de "versión nueva" | `pwa-assets.config.ts`, `public/*`, `app/registerSW.ts` | 1.20 | Lighthouse PWA instalable; con `vite preview` y DevTools en offline, la app recarga y se juega |
| 1.24 | Deploy en Vercel: `vercel.json` (rewrite SPA y headers de `sw.js`) y workflow de CI con `npm ci && npm run check && npm run build` | `vercel.json`, `.github/workflows/ci.yml` | 1.23 | La URL HTTPS de Vercel abre, se instala y funciona sin red |
| 1.25 | QA en dispositivos reales (checklist más abajo), con margen para arreglos | — | 1.24 | Criterio de salida de la fase 1 |

Mundos en el MVP: **0** (lectura 0–9 → 0–99 → 0–999), **1** (directo: suma, resta y mezcla), **2** (amigos del 5: suma, resta y mezcla, acumulativo con directo) y **3** (amigos del 10 con llevada y préstamo, más el jefe de cascadas). Los puntos, las estrellas, las rachas y Leitner quedan para la fase 3. Desde la fase 1 sí se persisten los intentos con su `ruleUses`, así Leitner arranca con historial.

---

## Fase 2 · Gestos (detalle)

Se ejecuta en cuatro bloques. El A es TS puro y se testea sin cámara, así que puede avanzar mientras se hace la QA de la fase 1; del B en adelante hace falta probar con una mano real frente a la cámara.

**Dónde vive la lógica de gestos:** en `src/infrastructure/vision/gesture/`, sin importar MediaPipe (usa su propio tipo `Landmark`, estructuralmente compatible con `NormalizedLandmark`). No va en `src/domain` porque los filtros y detectores tienen estado mutable, y el dominio es inmutable. Igual se le exige el 100 % de cobertura y corre en el entorno node de Vitest.

**Convenciones:** las coordenadas que entran al bloque A ya están en espacio pantalla (x espejada: `x → 1 − x`) y normalizadas a [0, 1] sobre el frame. El tiempo es el `performance.now()` del frame, en ms, inyectado.

### A · Lógica de gestos (TS puro, 100 % de cobertura)

| # | Tarea | Aceptación |
|---|---|---|
| 2.1 | `Landmark`, `HandFrame` y accesores con guardas: `fingertip(frame, 'thumb' \| 'index')`, `handScale` (muñeca → MCP del medio). Devuelven `null` si faltan landmarks | Un frame con menos de 21 landmarks no lanza |
| 2.2 | `OneEuro` y `OneEuro2D` (§5.5) con `reset()` | La señal constante sale igual; el ruido blanco baja su varianza; un escalón se sigue con más retraso a `beta = 0` que a `beta > 0` |
| 2.3 | `PinchDetector`: razón 4↔8 / 0↔9, entrada < 0,25, salida > 0,40, 3 frames de confirmación | Sin parpadeo con una razón que oscila entre 0,26 y 0,39; `start` y `end` exactamente una vez por pinch |
| 2.4 | `Calibration` (`left`, `right`, `beamY`, `beadHeight`, `rodCount`) y `deckLayout`: posición de cada cuenta en unidades de cuenta según el estado de la varilla (cielo: 1 cuenta + 1 hueco; tierra: 4 cuentas + 1 hueco). `hitBead(rod, y)` devuelve la cuenta más cercana | Para los 10 valores de una varilla, cada cuenta se encuentra en su centro |
| 2.5 | `RodMapper`: x → varilla (0 = derecha) con histéresis del 15 % del ancho; `null` fuera del ROI | Un temblor de ±10 % sobre el borde no cambia de varilla; un cruce del 20 % sí |
| 2.6 | `Pusher` (modo empuje), uno por dedo: si en una ventana de 250 ms el dedo se desplaza al menos 0,35 cuentas, la cuenta donde empezó el trazo se arrastra con `dragMove`, como en `PointerInput`. Cooldown de 120 ms por varilla. Emite `Move` con `finger` | "Subir 3 y bajar 1" con trazos sintéticos deja 2; un movimiento lento (deriva) no emite; dos trazos en menos de 120 ms emiten uno |
| 2.7 | `PinchPointer` (modo puntero + pinch): el índice es el cursor, dwell de 150 ms para fijar la varilla, el pinch agarra la cuenta bajo el cursor y el desplazamiento vertical la arrastra; soltar libera | Sin dwell no agarra; soltar el pinch a mitad del trazo no emite |
| 2.8 | `GestureEngine`: `HandFrame \| null` → `Move[]`; tolera huecos de hasta 250 ms sin soltar el estado y después resetea todo; fixtures sintéticas de trazos | Una mano que desaparece 300 ms en medio de un pinch no deja la cuenta agarrada |

### B · Cámara y tracker (infraestructura)

| # | Tarea | Aceptación |
|---|---|---|
| 2.9 | `scripts/fetch-model.mjs`: descarga `hand_landmarker.task` (float16) a `public/models/` con verificación de SHA-256; corre en `prebuild` y el archivo queda en `.gitignore` | El build de Vercel incluye `models/hand_landmarker.task`; un hash distinto rompe el build |
| 2.10 | `CameraPort` + `BrowserCamera`: `isSecureContext`, `getUserMedia` a 960×540 y 30 fps, `<video playsinline muted autoplay>`, errores tipados (`not-allowed`, `not-found`, `not-readable`, `insecure`) | Test con un `mediaDevices` falso para cada error |
| 2.11 | `MediaPipeHandTracker`: `import()` dinámico de `@mediapipe/tasks-vision` (chunk aparte), WASM y modelo del mismo origen, `numHands: 1`, espejado `x → 1 − x` | En modo táctil el bundle inicial no crece y no hay requests a `mediapipe/` ni `models/` |
| 2.12 | Bucle fuera de React: rAF y `detectForVideo` solo si cambió `video.currentTime`; `VisionInput implements InputSource` (kind `vision`) que conecta tracker → `GestureEngine` → `onMove` | `stop()` cancela el rAF y libera la cámara |
| 2.13 | Benchmark de delegado: 30 frames con mano en GPU y en CPU, se elige por latencia y tasa de detección, guardado por dispositivo; botón "modo compatibilidad (CPU)" | El resultado persiste y se puede forzar CPU |

### C · Presentación

| # | Tarea | Aceptación |
|---|---|---|
| 2.14 | Pantalla "Activar modo cámara": explica por qué y que ningún frame sale del dispositivo; pide la cámara solo tras el tap; ante cualquier error ofrece volver a táctil | Los cuatro errores muestran su mensaje y la salida a táctil |
| 2.15 | `<HandOverlay/>` en Canvas 2D espejado sobre el video: conexiones, punta del pulgar (verde, círculo) y del índice (azul, rombo), varilla y zona activas | Se ve alineado con la mano en 390×844 y 1280×800 |
| 2.16 | Calibración de 10 s: índice en la viga y en las varillas extremas → `Calibration`; guardada por dispositivo y orientación | Rotar pide recalibrar solo si no hay calibración para esa orientación |
| 2.17 | Selector de modo (táctil, empuje, puntero) e indicador de calidad (verde, ámbar, rojo según FPS y confianza); con rojo durante 3 s sugiere táctil | El modo elegido persiste; la sugerencia aparece con FPS simulados bajos |

### D · Medición y QA

| # | Tarea | Aceptación |
|---|---|---|
| 2.18 | Grabador de sesiones (solo en dev): exporta los `HandFrame` y los `Move` esperados a JSON; esas grabaciones entran como fixtures de regresión del bloque A | Una grabación real reproduce los mismos `Move` en el test |
| 2.19 | Medición y QA en dispositivos: 95 % de movimientos reconocidos y menos de 1 falso positivo por minuto, en desktop, un iPhone y un Android, con el teléfono en un soporte | Criterio de salida de la fase 2 |

**Plan B de rendimiento** (si en 2.19 los FPS no alcanzan): inferir cada 2 frames y extrapolar con el filtro; después, Web Worker con OffscreenCanvas.

---

## Fases 2 a 4 (hitos y riesgos)

**Fase 2 · Gestos (3–4 semanas).**
- Hitos:
  1. Pantalla de permisos y `useCamera` (secure context, `playsinline`, 960×540, manejo de `NotAllowed`, `NotFound` y `NotReadable`).
  2. `HandTracker` con el WASM y el modelo del mismo origen (script `scripts/fetch-model.mjs` que descarga `hand_landmarker.task` float16 versionado a `public/models/`, más CacheFirst).
  3. Bucle fuera de React (rAF y `currentTime`) y `<HandOverlay/>` en Canvas 2D espejado.
  4. OneEuro, PinchDetector, RodMapper y Pusher como TS puro y testeable con secuencias de landmarks grabadas.
  5. Calibración de 10 s guardada por dispositivo y orientación.
  6. Modos "empuje" y "puntero + pinch" como `InputSource`.
  7. Benchmark de delegado (30 frames) e indicador de calidad, con caída automática a táctil.
  8. Medición: 95 % de movimientos reconocidos y menos de 1 falso positivo por minuto.
- Riesgos: rendimiento en gama baja (plan B: Web Worker con OffscreenCanvas e inferencia cada 2 frames); delegado GPU erróneo en iOS y Android; ergonomía del plano vertical; aviso de privacidad si se terminara usando 1.x.

**Fase 3 · Gamificación (2–3 semanas).**
- Hitos: `scoring.ts`, estrellas, racha con congelador; Leitner sobre los 52 ítems (1/2/4/8/16 días, error → caja 1); `difficulty.ts` con objetivo del 85 % (sube si supera el 92 %, baja si cae del 75 %); sesión diaria de 20–25 min (§2.6); mapa de mundos con desbloqueos y jefes con vidas y temporizador; mundos 4–6 (combinados, multiplicación y división, que exigen extender `planOperation` a productos parciales); tutorial con "manos fantasma" a partir de `canonicalSteps`; springs y partículas (reevaluar `motion`); skins y sonidos de madera.
- Riesgos: alcance de multiplicación y división; calibración de la curva sin datos; métrica de salida de 14 días seguidos de uso, que depende solo de un usuario.

**Fase 4 · Anzan (2–3 semanas).**
- Hitos: lectura relámpago (X ms); flash anzan configurable con intervalo adaptativo; ábaco "que se desvanece"; yomiage-zan con Web Speech (falta verificar voces `es-*` en iOS); minijuego visoespacial; mundo 7 y dan.
- Riesgos: precisión de temporizado bajo 300 ms (rAF y frames perdidos, hay que medir con `performance.now`); voces TTS dispares entre dispositivos; pantallas de 120 Hz contra 60 Hz.

---

## Estrategia de pruebas

- **Unit (dominio y aplicación):** Vitest en el proyecto `domain` con entorno node. Umbral del 100 % en `src/domain/**` que rompe el build. Tests exhaustivos donde el espacio es finito (180 combinaciones, 5×4 taps) y fast-check donde no lo es (`fromNumber/digits`, `planOperation`, generadores). Los casos de uso se testean con fakes de los puertos.
- **Componentes:** RTL con jsdom: `SorobanSvg` (render semántico, eventos de puntero sintéticos, teclado), `NumericKeypad`, y un flujo de lección completo con fakes (`InputSource`, `AudioPort` y `ProgressRepo` en memoria). Infraestructura: `PointerInput` en jsdom, `WebAudioPort` con un contexto falso y `DexieProgressRepo` con fake-indexeddb.
- **Gate antes de cada commit:** `npm run check` (lint, typecheck incluido el del dominio sin DOM, y coverage).
- **Checklist manual en un iPhone y un Android reales:**
  - Por LAN con `npm run dev:lan` (aceptando el certificado): táctil, audio y layout.
  - Por la URL HTTPS de confianza: PWA, instalación y modo offline.

  1. Abre por HTTPS; sin scroll horizontal en vertical ni en horizontal; el notch y el home indicator respetan el safe area.
  2. Tap en cada slot de tierra, activando y desactivando, y en el cielo; swipe hacia arriba y hacia abajo; el caso "subir 3 y bajar 1 deja 2".
  3. Dos dedos sobre dos varillas a la vez; durante el gesto no hay scroll, zoom ni menú contextual (long-press en iOS).
  4. Áreas táctiles cómodas con el pulgar; sin taps fantasma en las varillas vecinas.
  5. El audio suena después de "Empezar" en iOS con el interruptor de silencio en las dos posiciones (anotar el comportamiento); vuelve a sonar después de minimizar o de una llamada; el mute funciona.
  6. VoiceOver y TalkBack anuncian el valor de cada varilla; con `prefers-reduced-motion` no hay animaciones.
  7. Se completa una lección de cada mundo 0–3; el progreso sobrevive a cerrar la app.
  8. Se instala ("Agregar a inicio" en iOS y el prompt en Android) y abre en standalone.
  9. Con modo avión, la app instalada abre, se juega y guarda.
  10. Al publicar una versión nueva, se actualiza sola al reabrir.
  11. Rotación en medio de una lección: no pierde estado y cambia la cantidad de varillas sin alterar el valor.
  12. En DevTools Network: **ningún** request a terceros y ningún archivo de `mediapipe/` ni de `models/` descargado en modo táctil.

---

## Riesgos de la fase 0 y la fase 1

- **Física táctil "real":** es la parte más delicada de UX. Se mitiga dejando la lógica en el dominio (1.1), separada del hit-testing (1.11), y con QA temprano en el dispositivo (correr `dev:lan` en cuanto exista 1.18, sin esperar a 1.25).
- **Audio en iOS:** comportamiento con el interruptor de silencio y estado `interrupted`. Se mitiga con el orden de desbloqueo testeado y con subtítulos visuales.
- **Versiones muy recientes** (Vite 8, Vitest 5, ESLint 10, vite-plugin-pwa 2.0): si alguna combinación falla en 0.4 o 0.5, se baja un minor y se documenta. No se cambian herramientas.

## Decisiones tomadas (2026-10-27)

1. **MediaPipe:** se fija `@mediapipe/tasks-vision@0.10.35` (sin telemetría).
2. **Varillas:** 7 en mobile vertical, 13 en mobile horizontal y 17 en desktop. La unidad va en la varilla de la derecha (`unitRod = 0`) y los puntos se dibujan cada 3 varillas a partir de ella. Sin decimales hasta los mundos 5–6.
3. **Desbloqueo en la fase 1:** lineal (≥ 80 % abre la siguiente lección), más un interruptor oculto de "desbloquear todo".
4. **Persistencia:** Dexie desde la fase 1 (`attempts` con `ruleUses`, latencia y moves; `lessonResults`).
5. **Deploy:** Vercel, desde el repo remoto `https://github.com/gst14/sorobanweb.git`. La app se sirve en la raíz (`base: '/'`, sin `BASE_PATH`), con HTTPS de confianza para probar la PWA instalada y offline. `vercel.json` lleva el rewrite SPA a `index.html` y `Cache-Control: no-cache` para `sw.js`. GitHub Actions solo corre `npm run check` y el build en cada push y PR.

## Verificación de punta a punta

- Fase 0: `npm run check` en verde; el reporte de coverage muestra 100/100/100/100 en `src/domain`; `vite build` genera `dist/mediapipe/wasm/` y su `sw.js` no los incluye en el precache.
- Fase 1: el test de flujo de lección pasa; Lighthouse marca la PWA como instalable; la checklist manual completa en un iPhone y un Android reales: instalada, en modo avión, con un mundo 0–3 jugable de punta a punta.
