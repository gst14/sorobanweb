# Bitácoras

Registro de cada sesión de trabajo: qué se hizo, qué quedó pendiente y qué se decidió. Sirve para retomar el proyecto sin tener que reconstruir el contexto.

- **Este archivo** guarda el estado vivo del proyecto: lo hecho y lo pendiente, por fase. Se actualiza al cerrar cada sesión.
- **Una bitácora por sesión** (`AAAA-MM-DD-sesion-NN.md`) cuenta el detalle de esa sesión. Cada una se arma a partir de [PLANTILLA.md](PLANTILLA.md).
- El plan completo está en [../PLAN.md](../PLAN.md); la fuente de verdad del producto, en [../soroban-research.md](../soroban-research.md).

## Sesiones

| Sesión | Fecha | Resumen |
|---|---|---|
| [01](2026-10-27-sesion-01.md) | 2026-10-27 | Plan aprobado; fase 0 completa; fase 1 completa en código (falta el QA en dispositivos) |

## Estado actual

Última actualización: 2026-10-27, sesión 01.

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
- [x] `vercel.json` y CI en GitHub Actions.

### Pendiente

**Fase 1 · cierre (tarea 1.25)**
- [ ] Revisar que el primer run de CI en GitHub Actions haya pasado.
- [ ] Deploy en Vercel desde `gst14/sorobanweb`.
- [ ] Checklist manual en un iPhone y un Android reales (ver [PLAN.md](../PLAN.md#estrategia-de-pruebas)). Lo prioritario: instalar, jugar en modo avión, oír el audio en iOS después de "Empezar" y rotar en medio de una lección.
- [ ] Corregir lo que aparezca en esa prueba.

**Mejoras chicas detectadas (opcionales)**
- [ ] En las reglas directas, el feedback de error dice solo "Directo: +4"; podría describir los pasos (`describeStep`).
- [ ] El bundle pesa 360 kB (114 kB gzip); evaluar dividir Dexie o las pantallas.
- [ ] `npm audit` reporta 4 vulnerabilidades *low* en `deepmerge`, que llega vía `workbox-build` y solo se usa al compilar. Revisar cuando salga una versión nueva de vite-plugin-pwa.

**Fase 2 · Gestos**: no iniciada. Hitos en [PLAN.md](../PLAN.md#fases-2-a-4-hitos-y-riesgos).

**Fase 3 · Gamificación**: no iniciada.

**Fase 4 · Anzan**: no iniciada.
