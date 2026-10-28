# Soroban Trainer

Web app para aprender cálculo mental con el **soroban** (el ábaco japonés 1:4), gamificada y pensada primero para el celular. Se aprende regla por regla: sumas directas, amigos del 5, amigos del 10, combinados y, más adelante, multiplicación, división y anzan (el ábaco imaginado).

La entrada principal es táctil: se tocan o arrastran las cuentas, con la física de un soroban real. Más adelante se suma un **modo técnica** con la cámara, que usa MediaPipe Hand Landmarker para reconocer si cada cuenta se movió con el pulgar o con el índice.

> **Estado:** las fases 0 y 1 están completas en código. Falta el QA en dispositivos reales. El detalle vivo está en [docs/bitacoras](docs/bitacoras/README.md).

## Qué se puede hacer hoy

- **Mundo 0 · Las cuentas:** leer y poner números del 0 al 999. El jefe pide 20 lecturas en 60 s.
- **Mundo 1 · Directo:** sumas y restas sin complementos, sueltas y encadenadas.
- **Mundo 2 · Amigos del 5:** complementos de 5 (+3 = +5 −2).
- **Mundo 3 · Amigos del 10:** llevadas y préstamos, con un jefe de cascadas (99 + 1, 1000 − 1).

Los ejercicios se **generan por regla**, no con números al azar. Al fallar, la app muestra la regla que correspondía con su fórmula. Cada intento queda guardado en el dispositivo para la repetición espaciada (fase 3). La app se instala como PWA y funciona sin conexión.

## Stack

| Capa            | Tecnología                                                            |
| --------------- | --------------------------------------------------------------------- |
| Build           | Vite 8, TypeScript 6 (`strict`)                                       |
| UI              | React 19 y SVG para el soroban (Canvas 2D para la mano, en la fase 2) |
| Estado          | Zustand                                                               |
| Persistencia    | IndexedDB con Dexie; las preferencias van en `localStorage`           |
| Audio           | Web Audio API con sonidos sintetizados                                |
| PWA             | vite-plugin-pwa (Workbox)                                             |
| Visión (fase 2) | `@mediapipe/tasks-vision` 0.10.35, sin telemetría                     |
| Tests           | Vitest, Testing Library, fast-check y fake-indexeddb                  |

Todas las dependencias están fijadas a versiones exactas (`.npmrc` con `save-exact=true`).

## Arquitectura

Clean Architecture. El dominio es TypeScript puro e inmutable: no conoce React, el DOM ni MediaPipe.

```
src/
├─ domain/          # Soroban, reglas, ejercicios, mundos (sin dependencias)
├─ application/     # Puertos (InputSource, AudioPort, ProgressRepo, Clock) y casos de uso
├─ infrastructure/  # Adaptadores: puntero, teclado, Web Audio, Dexie
├─ presentation/    # Componentes, pantallas, stores y hooks
└─ app/             # Composition root
```

Las tres entradas (táctil, teclado y, más adelante, gestos) implementan el mismo puerto `InputSource` y emiten `Move`. Las fronteras entre capas se controlan en tres lugares:

- **ESLint:** impide imports cruzados entre capas, y en el dominio también `Math.random` y `Date.now`.
- **`tsconfig.domain.json`:** compila el dominio sin `lib: DOM`.
- **Cobertura:** el 100 % en `src/domain` es obligatorio.

Más detalle en [docs/architecture.md](docs/architecture.md).

## Empezar

Requiere **Node 24** o superior.

```bash
npm ci
npm run dev        # http://localhost:5173
```

### Probar en el celular por la LAN

```bash
npm run dev:lan    # HTTPS con un certificado autofirmado
```

Abrí la URL "Network" que imprime Vite y aceptá el certificado. Sirve para probar el modo táctil, el audio y el layout. Para **instalar la PWA y probar sin conexión** hace falta HTTPS de confianza, así que hay que usar el deploy en Vercel: con un certificado autofirmado, el service worker no se registra.

## Scripts

| Comando                           | Qué hace                                                            |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                     | Servidor de desarrollo                                              |
| `npm run dev:lan`                 | Servidor de desarrollo con HTTPS, accesible en la LAN               |
| `npm run build`                   | Typecheck y build de producción, con el service worker              |
| `npm run preview`                 | Sirve el build localmente                                           |
| `npm run test`                    | Corre los tests                                                     |
| `npm run coverage`                | Corre los tests con cobertura (100 % obligatorio en `src/domain`)   |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                   |
| `npm run check`                   | Lint, formato, typecheck y cobertura. Se corre antes de cada commit |

## Deploy

Vercel, desde este repo. La configuración está en [vercel.json](vercel.json): el build de Vite, `sw.js` y el manifest sin caché, y los assets como inmutables. GitHub Actions corre `npm run check` y el build en cada push a `main` y en cada PR.

## Convenciones

- Commits chicos, uno por tarea, con [Conventional Commits](https://www.conventionalcommits.org/) (`feat(domain): …`, `fix(presentation): …`).
- Nada de `any`. El dominio es inmutable.
- Si algo del documento de investigación es ambiguo, se anota en el plan en lugar de asumir.
- Al cerrar cada sesión de trabajo se escribe una bitácora en `docs/bitacoras/`.

## Documentación

| Documento                                            | Contenido                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| [docs/soroban-research.md](docs/soroban-research.md) | Fuente de verdad: pedagogía, gamificación, rastreo de manos y arquitectura |
| [docs/PLAN.md](docs/PLAN.md)                         | Plan de implementación de las fases 0 a 4, con decisiones y riesgos        |
| [docs/architecture.md](docs/architecture.md)         | Capas, reglas de dependencia y convenciones del dominio                    |
| [docs/bitacoras/](docs/bitacoras/README.md)          | Bitácoras por sesión y estado actual (hecho y pendiente)                   |

## Roadmap

| Fase                                                                          | Estado                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------- |
| 0 · Fundaciones                                                               | ✅ Completa                                        |
| 1 · MVP táctil                                                                | 🟡 Completa en código; falta el QA en dispositivos |
| 2 · Gestos (cámara + MediaPipe)                                               | ⏳ Pendiente                                       |
| 3 · Gamificación (puntos, rachas, Leitner, dificultad adaptativa, mundos 4–6) | ⏳ Pendiente                                       |
| 4 · Anzan (flash anzan, lectura relámpago, dictado)                           | ⏳ Pendiente                                       |
