# Arquitectura

Clean Architecture según el §5.2 de [soroban-research.md](soroban-research.md). El plan de ejecución está en [PLAN.md](PLAN.md).

```
presentation ──▶ application ──▶ domain
      ▲                ▲
      └──── app ───────┤  (composition root: arma todo)
                       │
infrastructure ────────┘  (implementa los ports de application)
```

| Capa | Contenido | Puede importar |
|---|---|---|
| `src/domain` | TS puro e inmutable: `Rod`, `Soroban`, `Move`, `rules`, ejercicios, progresión | solo `domain` |
| `src/application` | `ports/` (InputSource, AudioPort, ProgressRepo, Clock) y `usecases/` | `domain` |
| `src/infrastructure` | Adaptadores: input (pointer, teclado, visión), audio, persistencia | `domain`, `application` |
| `src/presentation` | Componentes React, pantallas, stores Zustand, hooks | `domain`, `application` |
| `src/app` | Composition root: instancia las implementaciones y las inyecta | todo |

## Cómo se hace cumplir

- **ESLint** (`no-restricted-imports` por carpeta): rompe el lint si una capa importa algo prohibido. En el dominio también se prohíben los globals del navegador, `Math.random` y `Date.now`; la aleatoriedad y el tiempo se inyectan.
- **`tsconfig.domain.json`**: compila `src/domain` sin `lib: DOM`, así que `window` o `document` no compilan.
- **Cobertura**: Vitest exige el 100 % en `src/domain/**`.

## Convenciones del dominio

- Las varillas se indexan desde la derecha: `rods[0]` es la de la derecha. La varilla de unidades (`unitRod`) es 0 en el MVP.
- `Move` es una unión discriminada por `deck`: en la tierra, `delta` va de ±1 a ±4 (positivo = hacia la viga); en el cielo, `+1` baja la cuenta (suma 5) y `−1` la sube.
- `Soroban.apply` lanza `InvalidMoveError` ante un movimiento imposible; `canApply` permite descartarlo sin lanzar.
- Las 180 combinaciones (v, d) se clasifican en `direct`, `five`, `ten` o `combined`. Existen 52 ítems (operación, regla, dígito): `RULE_ITEMS`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run dev:lan` | HTTPS autofirmado en la LAN, para probar en el celular |
| `npm run check` | Lint, formato, typecheck (incluye el del dominio sin DOM) y tests con cobertura. Se corre antes de cada commit |
| `npm run build` | Typecheck y build de producción con service worker |
