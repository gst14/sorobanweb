# Bitácoras

Registro de cada sesión de trabajo: qué se hizo, qué quedó pendiente y qué se decidió. Sirve para retomar el proyecto sin tener que reconstruir el contexto.

- **Este archivo** guarda el estado vivo del proyecto: lo hecho y lo pendiente, por fase. Se actualiza al cerrar cada sesión.
- **Una bitácora por sesión** (`AAAA-MM-DD-sesion-NN.md`) cuenta el detalle de esa sesión. Cada una se arma a partir de [PLANTILLA.md](PLANTILLA.md).
- El plan completo está en [../PLAN.md](../PLAN.md); la fuente de verdad del producto, en [../soroban-research.md](../soroban-research.md).

## Sesiones

| Sesión | Fecha | Resumen |
|---|---|---|
| [01](2026-10-27-sesion-01.md) | 2026-10-27 | Plan aprobado; fase 0 completa; fase 1 completa en código (falta el QA en dispositivos) |
| [02](2026-10-27-sesion-02.md) | 2026-10-27 | CI y deploy confirmados; desglose de la fase 2; bloque A de gestos completo y script del modelo |

## Estado actual

Última actualización: 2026-10-27, sesión 02.

### Hecho

**Fase 0 · Fundaciones**
- [x] Scaffold de Vite 8 + React 19 + TypeScript 6 strict, con todas las versiones fijadas.
- [x] ESLint con fronteras de capas, Prettier y Vitest con el 100 % de cobertura obligatorio en `src/domain`.
- [x] `vite.config.ts` con basic-ssl para la LAN, el WASM de MediaPipe copiado sin precache y la PWA.
- [x] Dominio del soroban: `Rod`, `Move`, `Soroban` y `classifyAdd`/`classifySub`, verificados en las 180 combinaciones.

**Fase 1 · MVP táctil**
- [x] Dominio: interacción con las cuentas, técnica canónica, planificador multi-varilla con cascadas, generadores por regla, validador, mundos 0 a 3 y pistas.
- [x] Aplicación: puertos y sesión de lección con vidas y tiempo de jefe.
- [x] Infraestructura: `PointerInput`, `KeyboardInput`, `WebAudioPort` con sonidos sintetizados y `DexieProgressRepo`.
- [x] Presentación: `SorobanSvg`, layout responsive de 7, 13 o 17 varillas, pantallas de inicio, mundos, lección y resultado, y botón de mute.
- [x] PWA: íconos, service worker y modo offline verificado en Chromium.
- [x] `vercel.json` y CI en GitHub Actions; CI en verde y deploy vivo en `https://sorobanweb.vercel.app`.
- [x] Pista de las reglas directas con los pasos (`describeStep`).

**Fase 2 · Gestos**
- [x] Desglose fino en [PLAN.md](../PLAN.md#fase-2--gestos-detalle).
- [x] Bloque A (2.1–2.8): landmarks, One Euro, pinch, calibración, `RodMapper`, `Pusher`, `PinchPointer` y `GestureEngine`, con 100 % de cobertura.
- [x] 2.9: `scripts/fetch-model.mjs` con SHA-256, en `predev` y `prebuild`.

### Pendiente

**Sin pushear:** los commits de la sesión 02 están solo en local.

**Fase 1 · cierre (tarea 1.25)**
- [ ] Checklist manual en un iPhone y un Android reales (ver [PLAN.md](../PLAN.md#estrategia-de-pruebas)). Lo prioritario: instalar, jugar en modo avión, oír el audio en iOS después de "Empezar" y rotar en medio de una lección.
- [ ] Corregir lo que aparezca en esa prueba.

**Mejoras chicas detectadas (opcionales)**
- [ ] `npm audit` reporta 4 vulnerabilidades *low* en `deepmerge`, que llega vía `workbox-build` y solo se usa al compilar. Revisar cuando salga una versión nueva de vite-plugin-pwa.

**Fase 2 · Gestos**: bloques B a D, desde la 2.10 (cámara, tracker, bucle, delegado, pantallas, calibración y medición).

**Fase 3 · Gamificación**: no iniciada.

**Fase 4 · Anzan**: no iniciada.
