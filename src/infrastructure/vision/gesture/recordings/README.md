# Grabaciones de gestos

Cada `*.json` de esta carpeta es una sesión real frente a la cámara que
[`recordings.test.ts`](../recordings.test.ts) reproduce sin cámara: el motor de gestos tiene que
emitir, frame por frame, los mismos movimientos que guarda el archivo.

## Cómo grabar

1. `npm run dev` (o `npm run dev:lan` en el teléfono). El botón «Grabar» solo existe en desarrollo.
2. Activar la cámara en una lección o en la pantalla de cámara, con la calibración hecha.
3. Tocar «Grabar», hacer los gestos y tocar «Detener». Se descarga
   `gestos-<modo>-<fecha>.json`. Al empezar a grabar, el motor se reinicia (suelta lo agarrado).
4. Copiar el archivo acá con un nombre que diga qué se hizo (`push-subir-3-bajar-1.json`) y
   completar `label`.

## Qué guarda

- Por frame: el instante, la mano (confianza y landmarks `[x, y]` ya espejados) o `null`.
- Solo cuando cambian: los dígitos del soroban que recibió el motor y el modo y la calibración
  con que se creó el motor.
- `moves`: los movimientos que emitió el motor al grabar. Son los **esperados**: si al grabar
  hubo un falso positivo o faltó un movimiento, se corrige a mano en el JSON y el test va a fallar
  hasta que el motor lo resuelva.

Los ajustes finos del motor (`GestureTuning`) no se guardan: el replay usa los valores por
defecto. Si se cambian a propósito, hay que revisar los `moves` de las grabaciones.

Pesan unos 25 KB por segundo; conviene grabar tramos cortos (10 a 20 s) con un objetivo claro.
