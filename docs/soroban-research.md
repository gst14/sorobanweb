# Soroban Trainer: cómo funciona el ábaco japonés, cómo se aprende y cómo construir una web gamificada con rastreo de manos (Vite + TypeScript)

Lo central: el Soroban se aprende con una progresión muy estable. Primero se representan números, después vienen las sumas y restas directas, luego los "amigos del 5" y los "amigos del 10", la multiplicación y la división, y al final el Anzan (el ábaco imaginado). Esa progresión se puede convertir casi uno a uno en niveles de juego. Lo que no conviene es que todo el aprendizaje dependa de la cámara. Mi recomendación es construir el núcleo con un dominio puro en TypeScript y entrada táctil o de ratón como forma principal de jugar, y tratar el rastreo de manos con MediaPipe Hand Landmarker como un "modo técnica" que entrena pulgar e índice. El motivo es que en mobile la cámara frontal, la iluminación y el rendimiento de gama baja hacen que el gesto sea menos fiable que el toque.

## TL;DR

- **Pedagogía:** se progresa por reglas atómicas: directo → complemento de 5 → complemento de 10 → combinado (5+10) → multiplicación y división → Anzan y flash anzan. Las federaciones japonesas certifican en kyu y dan. Programas como UCMAS cubren 8 a 10 niveles en un plazo que depende de la sede: ucmasabacus.in (Odisha) indica "~3.5–5 years · 2 classes per week" y ucmas.us habla de unos 3 años con niveles de 3 meses. El ensayo controlado más sólido (Barner et al., 2016, *Child Development* 87(4):1146–58) incluyó 204 niños inscriptos en la Zenith School de Vadodara, de los cuales 183 entraron al análisis longitudinal, con 3 h por semana durante 3 años. Encontró mejoras en aritmética (d = 0,60), pero ninguna transferencia cognitiva general. Una versión de un solo año en EE. UU. no mostró ventaja significativa. La conclusión práctica es que se necesitan meses de práctica diaria y que el beneficio es sobre todo de cálculo, no "de inteligencia".
- **Tecnología:** usar MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`, licencia Apache-2.0, 21 landmarks; el modelo `hand_landmarker.task` float16 pesa 7,82 MB según la copia en Hugging Face) en lugar de TF.js handpose, que es legado. Hace falta HTTPS, `playsinline` y procesamiento 100 % local. Los landmarks se suavizan con el filtro One Euro, el pinch se detecta con umbrales normalizados al tamaño de la mano, con histéresis y con confirmación durante N frames, y siempre debe existir respaldo táctil. A octubre de 2026 las tareas de visión de MediaPipe usan WebGL, no WebGPU, y el delegado GPU se comporta distinto en iOS y en Android, así que hay que medir en dispositivos reales.
- **Stack y plan:** React + Vite + TypeScript estricto. El Soroban se renderiza en SVG, el esqueleto de la mano en un Canvas 2D superpuesto, el estado vive en Zustand, el progreso y la repetición espaciada en IndexedDB, el audio pasa por Web Audio con desbloqueo por gesto, y la app es una PWA con `vite-plugin-pwa`. La arquitectura es limpia: `domain` (Rod, Soroban, clasificador de reglas, validador) no conoce React, ni la cámara, ni el audio. El roadmap tiene cuatro fases: MVP táctil → gestos → gamificación → Anzan.

---

## 1. Cómo es el Soroban

### 1.1 Estructura física

| Elemento | Descripción | Implicación para el modelo digital |
|---|---|---|
| **Marco** | Rectangular, con un número impar de varillas (13, 17, 21, 23, 27…)\[1\] | Configurable; 13 varillas en mobile vertical y 17 en horizontal o desktop |
| **Varillas (rods)** | Cada varilla es una posición decimal; el valor crece de derecha a izquierda\[2\] | `rods: Rod[]` indexado desde la derecha |
| **Viga o barra de cálculo (beam / reckoning bar)** | Barra horizontal que divide cada varilla en dos | Solo cuentan las cuentas que tocan la viga\[3\] |
| **Cuenta del cielo (heaven bead)** | 1 por varilla, encima de la viga, vale **5**\[3\] | `heaven: boolean` |
| **Cuentas de la tierra (earth beads)** | 4 por varilla, debajo de la viga, valen **1** cada una\[3\] | `earth: 0..4` |
| **Puntos de unidad (unit points)** | Marcas sobre la viga cada 3 varillas, como los separadores de miles\[2\] | Sirven para elegir la varilla de unidades y para alinear decimales |

En cada varilla se representan valores de 0 a 9. Para poner un 7 se baja la cuenta del cielo (5) y se suben dos cuentas de la tierra (2).\[4\]\[5\] El 10 no cabe en una varilla: se escribe como un 1 en la varilla de la izquierda.\[4\] Esta restricción es la que obliga a usar complementos. El soroban no admite representaciones ambiguas: cada dígito tiene una sola configuración, y eso hace trivial validar el estado.\[6\]

**Valor posicional y unidad:** el operador elige una varilla con punto como varilla de unidades. Con la misma configuración de cuentas, 8036 o 80.36 dependen solo de dónde se fije esa unidad.\[7\] En la app conviene fijar la varilla de unidades en un punto (por ejemplo, el tercer punto desde la derecha) y mostrarla resaltada.

### 1.2 Diferencias con el suanpan chino

- **Suanpan:** 2 cuentas en el cielo y 5 en la tierra (2:5). Las "cuentas extra" sostienen técnicas antiguas de multiplicación y división ("extra bead", "suspended bead") y permiten representar 10 o más en una sola varilla, con lo que hay más de una forma de escribir el mismo valor.\[6\]\[8\]
- **Soroban moderno:** 1 cuenta en el cielo y 4 en la tierra (1:4).\[4\]\[8\] Está pensado exclusivamente para base 10, sin cuentas sobrantes y con representación única.\[9\]
- **Historia:** el ábaco llegó a Japón desde China, vía Corea, en torno a los siglos XIV y XV. Hacia 1850 se quitó una cuenta del cielo (configuración 1:5). La reducción a 1:4 aparece en las fuentes con fechas distintas: algunas la atribuyen a Irie Garyū en 1891 y otras la ubican hacia 1935, en la era Shōwa. Todas coinciden en que el 1:4 se generalizó en los años 30.\[1\]\[4\]\[7\]\[10\] No es un dato crítico para el proyecto, pero el conflicto de fechas existe.

**Decisión de diseño:** implementar solo el 1:4. Un modo "suanpan" agregaría ambigüedad y confundiría al principiante.

### 1.3 La técnica real de dedos

La técnica estándar usa solo dos dedos de la mano dominante:

- **Pulgar:** sube las cuentas de la tierra hacia la viga, es decir, suma unidades.\[5\]\[11\]
- **Índice:** hace todo lo demás. Baja las cuentas de la tierra (resta unidades), baja la cuenta del cielo (suma 5) y la sube (resta 5).\[5\]\[11\]\[12\]
- **Pinza (pinch):** pulgar e índice juntos en un mismo movimiento. Por ejemplo, para poner 6 a 9 desde cero, el índice baja el 5 mientras el pulgar sube las unidades.\[5\]\[12\]
- **Movimientos combinados:** por ejemplo, el índice suma 5 y limpia 4 cuentas de la tierra en un solo gesto fluido. Combinar reduce la cantidad de movimientos y es lo que da velocidad.\[3\]\[13\]
- **Limpieza:** se inclina el soroban hacia uno para que caigan las cuentas de la tierra, y después se pasa el índice entre la viga y el cielo para empujar hacia arriba las cuentas del cielo.\[3\]\[14\]
- **Orden:** se opera de izquierda a derecha, al revés que el algoritmo escolar en papel.\[15\]

**Esto le da al proyecto una oportunidad que las apps existentes no aprovechan:** el rastreo de manos puede distinguir qué dedo movió cada cuenta (landmark 4 = punta del pulgar, landmark 8 = punta del índice).\[16\] Así se puede puntuar la técnica y no solo el resultado.

---

## 2. Cómo se aprende

### 2.1 Estructura de certificación tradicional en Japón

En Japón hay dos vías: los **exámenes** (kentei), que certifican un nivel, y las **competencias**, donde se compite por un ranking.\[17\] Los organismos principales son tres:

- **Cámara de Comercio e Industria de Japón (Nissho):** grados 1 a 6.\[17\]
- **Japan Abacus Federation (Nisshuren):** grados 10 a 7, semigrados, y dan del 1 al 10.\[17\]
- **League for Soroban Education of Japan (Zenshuren):** exámenes propios de ábaco y de cálculo mental, y organiza el All-Japan Abacus Championship.\[17\]

La numeración y la dificultad cambian según el organismo.\[17\] Como patrón general:

| Nivel | Contenido típico |
|---|---|
| 15–10 kyu | Sumas y restas básicas\[18\] |
| 9 kyu | Se agrega la multiplicación\[18\] |
| 8 kyu | Se agrega la división\[18\] |
| 7 kyu en adelante | Cálculo mental (anzan) con números cada vez más grandes y decimales\[18\] |
| Dan | Mayor complejidad, velocidad y precisión; raíces cuadradas, denpyo-zan (cálculo de recibos), cálculo aplicado\[18\] |

Muchos niños japoneses empiezan alrededor de la entrada a primaria y apuntan a llegar a 1 kyu al terminar la primaria, hacia los 11 o 12 años.\[18\] Es decir, el camino completo lleva unos 5 o 6 años de práctica regular. Gastón tiene a su favor la ventaja cognitiva del adulto para entender las reglas, pero no hay atajo para automatizarlas.

Dentro de los exámenes conviene conocer tres formatos, porque cada uno puede ser un modo de juego: **mitori-zan** (leer columnas de números y sumarlas), **yomiage-zan** (sumar números dictados en voz alta) y **flash anzan**.

### 2.2 Programas modernos de "abacus mental arithmetic" (UCMAS y similares)

UCMAS es el programa franquiciado más extendido. La estructura cambia según la sede, pero en general se ve así:

- **Módulos:** Foundation → Construction → Advance → Master, con unos 8 niveles: Basic, Elementary A/B, Intermediate A/B, Higher A/B, Advance, más Grand 1/2 opcionales.\[19\]\[20\]
- **Duración:** cada nivel dura de 3 a 6 meses. La duración total del programa depende de la sede. ucmasabacus.in (Odisha) indica "Total programme duration ~3.5–5 years · 2 classes per week", aunque su propia FAQ dice "2–3 years". ucmas.us habla de diez niveles en "approximately 3 years… each level is 3 months".
- **Curriculum típico:** suma y resta de 1 y 2 dígitos → mental → multiplicación de 2×1 y 3×1 dígitos → división → decimales → multiplicación de 2×2 → división de 5 dígitos entre 3 → introducción a raíces cuadradas.\[21\]\[22\]\[23\]
- **Transición al ábaco visual:** empieza en los niveles Elementary, poco después de dominar el ábaco físico.\[20\]

Aloha y otros programas similares siguen el mismo esquema: primero el ábaco físico, después el "ábaco visual" en etapas tempranas, y ambos en paralelo durante años.

### 2.3 La secuencia de habilidades

Esta es la parte que más importa para el diseño. **Toda suma o resta de un dígito sobre una varilla cae exactamente en uno de cuatro casos**:

1. **Directo:** hay cuentas disponibles. Por ejemplo, 2 + 2: el pulgar sube 2.
2. **Amigos pequeños, o complemento de 5** (pares 1↔4 y 2↔3). Si hay 3 y se suma 2, no quedan cuentas de la tierra: se suma 5 y se restan 3 (+5 −3).\[24\]\[25\]
3. **Amigos grandes, o complemento de 10** (pares 1↔9, 2↔8, 3↔7, 4↔6, 5↔5). Si hay 6 y se suma 4: se suma 1 en la varilla de la izquierda y se restan 6 en la actual (+10 −6). Primero se resta el complemento y después se suma la decena.\[24\]\[26\]\[27\]
4. **Combinado:** el complemento de 10 exige a su vez un complemento de 5. Si hay 5 y se suma 7: habría que restar 3, pero solo está la cuenta del cielo. Entonces se suman 2 y se resta 5 en la varilla, y se suma 10 en la izquierda.\[24\]

La resta es simétrica: en lugar de sumar 5 y quitar el complemento, se suma el complemento y se quita el 5. Con préstamo, se resta 10 en la varilla de la izquierda y se suma el complemento.\[26\]

**Secuencia didáctica recomendada, coherente con UCMAS y con los kyu:**

1. Lectura y representación de números de 0 a 9, luego de 0 a 99 y de 0 a 999 (decodificar cuentas → número y número → cuentas).
2. Sumas y restas directas de 1 dígito.
3. Amigos del 5: suma, después resta y después mezcla.
4. Amigos del 10: suma con llevada, después resta con préstamo.
5. Casos combinados y llevadas en cascada (por ejemplo, 99 + 1).
6. Varios dígitos: operar de izquierda a derecha y encadenar 3 a 10 términos (mitori-zan).
7. Multiplicación: tablas → 2×1 → 3×1 → 2×2. En el soroban la multiplicación es una serie de sumas de productos parciales con las mismas reglas.\[28\]
8. División: 2÷1 → 3÷1 → 4÷2…
9. **Anzan:** se hace lo mismo sin el ábaco, primero "moviendo los dedos en el aire" y después solo imaginando.
10. **Flash anzan:** números que aparecen y desaparecen a intervalos cada vez más cortos.

En la práctica, el ensayo de EE. UU. (Barner et al., 2017) mostró lo lento que avanza esto: en un año escolar, los chicos de primer grado llegaron a sumar con complemento de 5, y los de segundo a sumar con complemento de 10.\[29\] Es una referencia realista para calibrar los niveles.

### 2.4 Anzan y flash anzan

- **Qué pasa cognitivamente:** el usuario experto manipula una imagen mental del ábaco. Frank y Barner encontraron que este cálculo depende de la memoria de trabajo visoespacial y de los procedimientos motores. Lo perturba más una interferencia manual que una verbal, al revés que en el cálculo convencional. Además, los usuarios parecen representar **solo 3 o 4 columnas a la vez**, cada una como un "objeto" en la memoria visual.\[29\]\[30\] Para el diseño, esto implica que el Anzan debe empezar con 1 o 2 varillas y llegar como mucho a 3 o 4 por "bloque", y que conviene mantener el gesto de los dedos al principio del Anzan (mover los dedos en el aire ayuda).
- **Flash anzan:** lo inventó Yuji Miyamoto en 1978. La prueba de élite consiste en sumar 15 números de 3 dígitos que se muestran en secuencia. El récord Guinness era de 1,83 s en 2010 y pasó a 1,70 s con Takeo Sasano en 2012. Según Guinness, Takahiro Asano lo bajó a 1,68 s el 8 de agosto de 2017 en los All Japan Soroban Championships (Kyoto International Conference Center). El récord actual es de **1,61 s, de Rikako Miyamoto, logrado el 18 de febrero de 2024 en la 72.ª Nakano Abacus Competition (Tokio)**. Guinness World Records indica que "shortened the previous record of 1.62 seconds by 0.01 second", así que entre ambas marcas hubo una intermedia de 1,62 s. Equivale a unos 0,1 s por número. Es la referencia del techo, no del objetivo.

### 2.5 Evidencia sobre la eficacia

| Estudio | Diseño | Resultado | Lectura práctica |
|---|---|---|---|
| **Barner et al., 2016, *Child Development*** | Ensayo controlado aleatorizado con 204 niños de 5 a 7 años inscriptos en la Zenith School de Vadodara (India); 183 entraron al análisis longitudinal. 3 h por semana (2 sesiones de 90 min) durante 3 años, contra un grupo de control con la misma cantidad de matemática estándar extra | Ventaja en aritmética (**d = 0,60**), en WJ-III Calculation (d = 0,24) y en valor posicional (d = 0,28). **Sin cambios** en memoria de trabajo, rotación mental ni Raven. La memoria de trabajo espacial inicial **moderó** el beneficio: los niños con baja capacidad (unos 1,9 ítems contra 3,7) no se beneficiaron más que el control | Funciona para el cálculo, no "entrena el cerebro" en general. El beneficio depende de la capacidad visoespacial |
| **Barner et al., 2017, *Journal of Numerical Cognition*** | Ensayo aleatorizado por aula, de 1 año, en una escuela pública de EE. UU., N = 180. 3 períodos de 40 min por semana | **Sin ventaja significativa** en cálculo ni en capacidades cognitivas. A primer grado le costó lograr pericia; a segundo le fue mejor | "Cautela" con intervenciones cortas: un año de práctica liviana no alcanza\[29\] |

**Conclusión honesta para Gastón:** casi toda la evidencia es con niños. Para un adulto, el beneficio esperable es concreto: cálculo mental más rápido y preciso, siempre que haya práctica diaria durante meses. No hay que esperar mejoras cognitivas generales. Antes de invertir meses en Anzan, conviene medir su propia capacidad visoespacial con un minijuego de "recordar posiciones de cuentas", y el juego puede incorporar esa medición.

### 2.6 Tiempos realistas y estructura de la práctica diaria

Los programas presenciales rondan **2 a 3 horas semanales**, y el ensayo positivo duró 3 años.\[30\] Para un adulto autodidacta propongo lo siguiente (es una recomendación de diseño, no una prescripción validada):

**Sesión diaria de 20 a 25 minutos:**
1. **Calentamiento, 2–3 min:** lectura relámpago de cuentas (decodificar).
2. **Repaso espaciado, 5 min:** las reglas que "vencen" hoy según el algoritmo de repetición espaciada.
3. **Regla nueva, 5–8 min:** tutorial guiado y después ejercicios aislados de esa regla.
4. **Mezcla, 5 min:** sumas y restas encadenadas con todas las reglas ya aprendidas.
5. **Anzan, 3–5 min:** desde la semana 3 o 4, con 1 o 2 varillas, aunque todavía no se dominen las reglas.

**Hitos orientativos para un adulto con práctica diaria:** reglas directas y del 5 en 1 a 2 semanas; reglas del 10 y combinadas en 3 a 6 semanas; fluidez en encadenados de 2 dígitos en 2 a 3 meses; Anzan estable de 2 dígitos en 4 a 6 meses; multiplicación y división desde el mes 3 o 4. Son estimaciones mías, derivadas de la estructura de UCMAS y de la ventaja adulta en la comprensión de reglas, no datos medidos.

---

## 3. Gamificación aplicada

### 3.1 La unidad de progreso es la regla, no el nivel

El hallazgo de la sección 2.3 tiene una consecuencia directa: **el "ítem" de la repetición espaciada es la pareja (operación, regla, dígito)**. Por ejemplo, "+3 por complemento de 5 (+5 −2)". Hay unas 36 reglas atómicas de suma y resta de un dígito: directas, 4 del 5 × 2 operaciones, 9 del 10 × 2, y combinadas. El sistema registra precisión, latencia y técnica (qué dedo se usó) para cada una.

### 3.2 Mapa de niveles (rango interno inspirado en kyu; no es una certificación oficial)

| Mundo / rango | Habilidad | Desbloquea | Jefe |
|---|---|---|---|
| 0 · "Las cuentas" (15 kyu) | Representar y leer 0–999 | Mundo 1 | Lectura relámpago: 20 números en 60 s |
| 1 · "Directo" (14–13 kyu) | Suma y resta directa | Modo contrarreloj | 10 operaciones encadenadas sin error |
| 2 · "Amigos del 5" (12–11 kyu) | Complemento de 5 | Sonidos y skins de madera | Mezcla de directo + 5 con 3 vidas |
| 3 · "Amigos del 10" (10–9 kyu) | Llevadas y préstamos | Flash anzan de 1 dígito | Cascada de llevadas (99 + 1, 999 + 1) |
| 4 · "Combinados" (8 kyu) | Complemento de 5 dentro del de 10 | Mitori-zan | "Tormenta": 15 términos de 2 dígitos |
| 5 · "Multiplicar" (7–6 kyu) | Tablas, 2×1, 3×1, 2×2 | Yomiage-zan (dictado con audio) | Multiplicaciones contra reloj |
| 6 · "Dividir" (5–4 kyu) | 2÷1 a 4÷2 | Modo "dan" | Mixto de las 4 operaciones |
| 7 · "Anzan" (3–1 kyu) | Ábaco imaginario, 1 → 3 varillas | Flash anzan avanzado | 10 números de 2 dígitos a 1 s cada uno |
| Dan | Velocidad y longitud | Tablas de récords personales | 15 números de 3 dígitos con tiempo libre, bajando hacia los 1,61 s del récord mundial |

### 3.3 Modos de juego

- **Tutorial guiado:** "manos fantasma" animadas muestran el movimiento correcto (pulgar en verde, índice en azul), la regla aparece en texto ("+3 = +5 −2") y el sistema espera a que el usuario la ejecute.
- **Práctica libre:** soroban sin objetivo, con lectura del valor opcional. Una reseña de la app "Soroban: Japanese Abacus Math" pide justamente que se puedan ver los totales.\[31\]
- **Contrarreloj:** 60 s, la mayor cantidad posible de operaciones de una regla o mezcla, con multiplicador por racha.
- **Flash anzan:** se configuran la cantidad de dígitos, de números y el intervalo. Empieza en 1 dígito, 3 números y 1,5 s, y el sistema ajusta el intervalo solo.
- **Lectura relámpago:** se muestra una configuración de cuentas durante X ms y el usuario escribe el número. Entrena la imagen que usa el Anzan.
- **Dictado (yomiage-zan):** los números se escuchan con Web Speech o con audios grabados y el usuario opera en el soroban.
- **Modo jefe y modo técnica:** el jefe cierra cada mundo con todas las reglas mezcladas, 3 vidas y un temporizador; el modo técnica usa la cámara y también puntúa el dedo usado.

### 3.4 Puntos, estrellas, rachas y curva de dificultad

- **Puntos por ejercicio:** `base(regla) × multiplicadorRacha × bonusVelocidad × bonusTécnica`. Un ejemplo concreto: base 10/15/20/25 para directo/5/10/combinado; racha ×1,0 → ×2,0 en pasos de 0,1 cada 5 aciertos; velocidad ×1,5 si se resuelve por debajo de la mediana personal; técnica ×1,25 si todos los movimientos se hicieron con el dedo correcto.
- **Estrellas por lección:** ★ con 80 % de aciertos, ★★ con 90 % y tiempo bajo el objetivo, ★★★ con 100 % y buena técnica.
- **Racha diaria** con un "congelador" ganable (1 por semana) para no castigar un día perdido. La racha premia constancia, no volumen: alcanza con 10 minutos.
- **Dificultad adaptativa:** apuntar a un **85 % de aciertos** como heurística. La idea viene de Wilson, Shenhav, Straccia y Cohen (*Nat Commun* 10:4646, 2019), que encontraron que "the optimal error rate for training is around 15.87%". Ese resultado se derivó para clasificación binaria con descenso de gradiente, así que aplicarlo acá es una extrapolación. Si la precisión supera el 92 %, se suben los términos, los dígitos o la velocidad; si baja del 75 %, se baja un escalón y se reintroducen ejercicios aislados de la regla que falla.
- **Repetición espaciada:** cajas de Leitner por regla (intervalos de 1, 2, 4, 8 y 16 días). Un error devuelve la regla a la caja 1. Es fácil de implementar y de explicar, y no hace falta SM-2 para esto.

### 3.5 Qué hacen bien y mal las apps existentes

| App | Bien | Mal | Lección para el proyecto |
|---|---|---|---|
| **Soroban: Japanese Abacus Math** (SIC) | Videos de profesores; secuencia suma/resta → multiplicación/división; dojos de flash anzan; hojas basadas en guías de examen | Suscripción cara (unos 6 USD por mes según una reseña). El soroban virtual "no se comporta como un soroban": si se suben 3 cuentas de más, no se puede bajar 1 para dejar 2\[31\]\[32\] | Simular cuentas individuales con física real, no "botones de dígito" |
| **Simple Soroban** | Sin anuncios; tutorial, práctica y desafíos; interfaz simple | Algunos usuarios encuentran saltos de dificultad bruscos\[33\] | La curva adaptativa es crítica |
| **Soroban Flash Anzan Challenge** | Sin retrasos de rendering, buena para velocidad | Una reseña dice que con un dígito "el 90 % de las veces" salen pares que suman 5\[34\] | **Generar ejercicios por regla**, no por números al azar |
| **Flash Anzan Soroban Trainer** | Muy configurable (dígitos, cantidad, velocidad) | Anuncios molestos\[35\] | La configurabilidad es esperada; los anuncios destruyen el flujo |
| **SoroTouch** | Evaluación formal: ensayo controlado registrado (jRCTs032210356); el fabricante dice que el 62 % de los niños usuarios adquiere cálculo mental (dato del proveedor)\[36\] | Orientada al mercado japonés | Medir el progreso con métricas objetivas |

**Ninguna de las apps revisadas usa la cámara para entrenar la técnica de dedos.** Ese es el diferencial real del proyecto.

---

## 4. Rastreo de manos en la web

### 4.1 Comparativa de opciones (octubre de 2026)

| Opción | Estado | Modelo | Rendimiento | Licencia | Veredicto |
|---|---|---|---|---|---|
| **MediaPipe Hand Landmarker** (`@mediapipe/tasks-vision`) | Activo: versión 1.1.1 (octubre de 2026); la última 0.10.x fue la 0.10.35 | `hand_landmarker.task`, float16, 7,82 MB según la copia en Hugging Face (Leo-TX/mediapipe-hand); palma + landmarks, entrada de 192/224 px | Benchmark oficial **nativo** en Pixel 6: 17,12 ms en CPU y 12,27 ms en GPU. No hay cifras oficiales para navegadores mobile | Apache-2.0 | **Elegida** |
| TF.js `hand-pose-detection` (runtime `tfjs` o `mediapipe`) | Mantenimiento mínimo; empaqueta el MediaPipe Hands de 2021 | lite / full\[37\]\[38\] | Aceptable con WebGL; más peso (tfjs-core + backend) | Apache-2.0 | Solo si ya usás TF.js |
| TF.js `handpose` (2020) y MediaPipe "Hands" legacy (`@mediapipe/hands`) | Legado, reemplazados por Tasks | — | Con el legacy, en 2022 se reportaron unos 6–7 fps en iPhone 11–13\[39\]\[40\] | Apache-2.0 | Descartar |

**Detalles que importan sobre MediaPipe:**

- **Salida:** 21 landmarks por mano en coordenadas de imagen normalizadas (x, y en [0,1], z relativa a la muñeca), además de landmarks "world" en metros y la lateralidad (izquierda o derecha).\[41\]\[42\] La guía de Google AI Edge dice que el modelo fue "trained on approximately 30K real-world images, as well as several rendered synthetic hand models".
- **Modos `VIDEO` y `LIVE_STREAM`:** después de la primera detección de palma, el modelo rastrea la mano con la caja del frame anterior y solo vuelve a ejecutar el detector de palma (que es caro) cuando pierde la mano.\[43\] Por eso conviene `numHands: 1` y mantener la mano dentro del encuadre.
- **WebGPU:** un mantenedor de Google dijo en el issue #5826 que "Our Vision tasks do use WebGL at the moment, as our WebGPU support is currently focused on our LLM Inference API".\[44\] **No hay que diseñar contando con WebGPU.**
- **Delegado GPU en iOS Safari:** la evidencia es contradictoria. El issue #6142 (noviembre de 2025, iPhone 12 Pro, iOS 18.7.1) muestra que el delegado GPU **sí corre** en iOS Safari, pero que en el Image Segmenter dio categorías "scrambled", mientras que en CPU el resultado era correcto. Un PR de terceros (septiembre de 2026) afirma lo contrario, que iOS siempre cae a WASM, sin haberlo verificado.\[45\]\[46\]
- **Android:** el mismo PR describe manos que no se detectan en Androids recientes con el delegado GPU, en Chrome y en Firefox, y opta por usar CPU en Android. Sus autores lo marcan como "Not verified on an affected device".\[45\]
- **Rendimiento en gama baja:** en Face Landmarker, un usuario reportó que en varios equipos mobile económicos "CPU outperforms WebGL".\[44\]
- **Resolución mínima con CPU:** en `tasks-vision` 0.10.35 se reportó que con el delegado CPU un video de 640×360 no detecta ninguna mano, mientras que con 854×480 o más sí.\[47\]
- **Telemetría en 1.x:** las notas de la 1.1.1 incluyen "Add stats logging to Web Tasks", y un PR de terceros advierte que la 1.x envía métricas de uso a Google por defecto y que el README pide consentimiento.\[48\]\[49\]\[50\] **Hay que leer el README de la versión exacta antes de publicar.** Si no se puede desactivar, conviene fijar la 0.10.35 o informar en la política de privacidad. Los fotogramas se procesan en el dispositivo en ambos casos.

**Decisión:** que el delegado se elija en tiempo de ejecución con un microbenchmark al arrancar. Se intenta con GPU, se miden 30 frames con la mano visible, y si la latencia o la tasa de detección son peores que con CPU, se cambia a CPU. El resultado se guarda por dispositivo. Por defecto: GPU en desktop e iOS, y medir siempre en Android.

### 4.2 Dibujar los 21 landmarks y sus conexiones

- `tasks-vision` incluye `DrawingUtils` (`drawConnectors`, `drawLandmarks`) y la constante `HandLandmarker.HAND_CONNECTIONS`.\[51\] Las puntas 4 y 8 se dibujan más grandes y con colores propios (pulgar verde, índice azul) para reforzar la técnica.
- Índices clave: 0 = muñeca; 1–4 = pulgar (4 = punta); 5–8 = índice (5 = MCP, 8 = punta); 9–12 = medio; 13–16 = anular; 17–20 = meñique.\[42\]
- **Efecto espejo:** con la cámara frontal el video se muestra espejado (`transform: scaleX(-1)`). Para que el canvas coincida hay que espejarlo igual (`ctx.translate(w, 0); ctx.scale(-1, 1)`), o transformar `x → 1 − x` antes de mapear a las varillas. La lógica del dominio siempre trabaja en el espacio "pantalla", no en el de la cámara.

### 4.3 Diseño de la interacción con gestos

El problema físico es que el soroban real está apoyado en una mesa y los dedos empujan en el plano de la mesa, mientras que la cámara frontal ve la mano en un plano vertical. Propongo **dos esquemas de interacción** y medir cuál es más fiable con usuarios reales.

**A. Modo "empuje" (imita la técnica real; es el diferencial):**
- El soroban virtual se dibuja en pantalla y la mano del usuario "flota" frente a la cámara.
- Las puntas del **pulgar (4)** y del **índice (8)** actúan como dos "empujadores" independientes, cada uno con su propio filtro One Euro.
- **Mapeo a varillas:** la x del empujador, dentro de un rectángulo calibrado (ROI), se convierte en el índice de la varilla. Hay histéresis de ±15 % del ancho de la varilla para que no salte entre dos varillas vecinas.
- **Mapeo vertical:** la y relativa a la viga calibrada decide si se está en la zona del cielo o de la tierra.
- **Empuje:** una cuenta se mueve cuando el empujador cruza su borde **en la dirección válida** con una velocidad mínima. En la tierra, hacia arriba suma y hacia abajo resta; en el cielo, hacia abajo suma y hacia arriba resta. Las cuentas que están entre el dedo y la viga se mueven en bloque, como en el ábaco físico.
- **Validación de técnica:** si el pulgar baja una cuenta de la tierra, el movimiento es válido para el valor pero se marca "técnica incorrecta: usá el índice". No se bloquea el movimiento; solo se registra para la puntuación y el feedback.

**B. Modo "puntero + pinch" (más robusto, para accesibilidad y poca luz):**
- El índice es un cursor. La varilla bajo el cursor se resalta tras 150 ms de permanencia ("dwell").
- **Pinch** (distancia entre los landmarks 4 y 8 bajo el umbral) = "agarrar"; mover hacia arriba o hacia abajo arrastra las cuentas; soltar el pinch las libera.\[42\]

**Fiabilidad, que es la clave:**

1. **Normalizar por el tamaño de la mano:** hay que dividir la distancia 4↔8 por la distancia de la muñeca al MCP del medio (0↔9). Un umbral fijo en coordenadas normalizadas (en tutoriales se cita 0,02–0,05 "con los dedos tocándose") cambia con la distancia a la cámara.\[16\]\[52\]
2. **Histéresis:** entrar al pinch con una razón menor a 0,25 y salir con una mayor a 0,40. Así se evita el parpadeo.\[53\]
3. **Confirmación por N frames y cooldown:** el pinch se acepta tras 3 frames consecutivos, y entre dos "empujes" de la misma cuenta debe haber al menos 120 ms.
4. **Filtro One Euro** (Casiez, Roussel y Vogel, CHI 2012): un pasabajos con corte adaptativo. A baja velocidad corta más (menos temblor) y a alta velocidad corta menos (menos retraso). Se ajusta así: primero `beta = 0` y `minCutoff ≈ 1 Hz`, quieto, bajando `minCutoff` hasta que no tiemble; después se mueve rápido y se sube `beta` hasta que no haya retraso.\[54\]\[55\]
5. **Gating por confianza:** si no hay mano durante más de 250 ms, se "sueltan" todos los estados (pinch, varilla activa) para que no queden cuentas agarradas.
6. **Calibración inicial de 10 s:** el usuario apoya el índice en la "viga" y en las varillas extremas izquierda y derecha. Con eso se calculan el ROI, la altura de la viga y el tamaño de la mano. La calibración se guarda por dispositivo y orientación.
7. **Indicador de calidad:** una luz verde, ámbar o roja según la confianza y los FPS. Si cae a rojo durante 3 s, la app sugiere pasar a modo táctil.

### 4.4 Respaldo táctil o de ratón (obligatorio)

- Se usan Pointer Events (`pointerdown`, `pointermove`, `pointerup`) con `touch-action: none` sobre el soroban.
- Con un tap sobre una cuenta, se mueve esa cuenta y todas las que estén entre ella y la viga (física real). Con un swipe vertical sobre una varilla, se mueve el bloque.
- **Mi posición:** en mobile, el modo táctil debería ser el principal para practicar a diario, y la cámara un modo de entrenamiento de técnica con el teléfono apoyado en un soporte. Sostener el teléfono con una mano y "tocar el aire" con la otra frente a la cámara frontal es ergonómicamente malo.

### 4.5 Permisos, HTTPS, privacidad y accesibilidad

- **Contexto seguro:** `getUserMedia` solo funciona en HTTPS o en `localhost`; en HTTP, `navigator.mediaDevices` vale `undefined`.\[56\]\[57\]\[58\] Para probar en el celular por LAN: `vite --host` + `@vitejs/plugin-basic-ssl`, o un túnel HTTPS.
- **iOS:** el `<video>` necesita `playsinline`, `muted` y `autoplay`; sin `playsinline`, Safari muestra negro o pasa a pantalla completa.\[56\]\[59\]\[60\]\[61\]
- **Pedir la cámara solo tras un gesto explícito** ("Activar modo cámara"), con una pantalla previa que explique por qué. Hay que manejar `NotAllowedError`, `NotFoundError` y `NotReadableError` ofreciendo pasar a modo táctil.\[56\]
- **Privacidad:** todo el procesamiento es local y no se envía ni se guarda ningún frame. Conviene decirlo en la interfaz. Lo ideal es servir el modelo y el WASM desde el mismo origen (no desde CDN) para que funcione offline y no haya terceros. Ver más arriba la advertencia sobre la telemetría de la 1.x.
- **Accesibilidad:** navegación completa con teclado (flechas para elegir la varilla, ↑/↓ para mover cuentas, números para responder); `aria-live` que anuncie el valor y el resultado; `prefers-reduced-motion`; pulgar e índice diferenciados también por forma, no solo por color; subtítulos visuales para los sonidos; modo zurdo.

---

## 5. Arquitectura y stack con Vite

### 5.1 Stack propuesto

| Capa | Elección | Por qué |
|---|---|---|
| Build | **Vite** + TypeScript `strict` | Requisito del usuario; HMR rápido |
| UI | **React 19** | Gastón lo está aprendiendo. Con un dominio en TS puro, React queda como "detalle", y se podría portar a Angular sin tocar el núcleo |
| Estado de UI | **Zustand** | Mínimo boilerplate, se puede usar fuera de React (el bucle de visión), selectores finos |
| Soroban | **SVG** + CSS transforms; `motion` (Framer Motion) para springs | Son unas 65–85 cuentas: el SVG escala perfecto en responsive, es accesible (cada cuenta puede tener rol y etiqueta) y fácil de testear. PixiJS o Three.js agregan peso sin beneficio real a esta escala |
| Overlay de mano y partículas | **Canvas 2D** | Redibujado por frame, barato |
| Audio | **Web Audio API** con un wrapper propio (o Howler.js si se quiere sprites y desbloqueo de iOS resueltos)\[62\]\[63\] | Latencia mínima para los "clacs". Tone.js solo si se quiere música generativa |
| Persistencia | **IndexedDB** (`idb` o Dexie) para progreso, Leitner e historial; `localStorage` solo para preferencias | Hay que guardar historial por regla, y localStorage es síncrono y limitado |
| PWA | `vite-plugin-pwa` (Workbox `generateSW`) | Instalable y offline\[64\]\[65\] |

**¿React o Vanilla?** Para un juego con un bucle de 30–60 fps, el riesgo de React es re-renderizar en cada frame. La solución no es dejar React, sino **sacar el bucle de visión de React**. El pipeline de cámara → landmarks → filtro → gesto corre en un servicio TS puro con `requestAnimationFrame` (o `requestVideoFrameCallback`), escribe en el canvas directamente y solo despacha **eventos de dominio** ("mover cuenta", "pinch empezó") hacia el store. React solo re-renderiza cuando cambia el estado del ábaco.

### 5.2 Estructura de carpetas (Clean Architecture)

```
src/
├─ domain/            # TS puro: sin React, sin DOM, sin MediaPipe
│  ├─ soroban/        # Rod.ts, Soroban.ts, Move.ts, rules.ts
│  ├─ exercises/      # Exercise.ts, generators/ (por regla), validator.ts
│  ├─ progression/    # skills.ts, leitner.ts, scoring.ts, difficulty.ts
│  └─ events.ts
├─ application/
│  ├─ ports/          # InputSource, AudioPort, ProgressRepo, Clock
│  └─ usecases/       # StartLesson, ApplyMove, SubmitAnswer, RunFlashAnzan…
├─ infrastructure/
│  ├─ vision/         # MediaPipe, OneEuro, PinchDetector, RodMapper, Calibration
│  ├─ input/          # PointerInput, KeyboardInput
│  ├─ audio/          # WebAudioPort
│  ├─ persistence/    # IndexedDbProgressRepo
│  └─ speech/         # dictado (yomiage-zan)
├─ presentation/
│  ├─ components/     # <SorobanSvg/>, <HandOverlay/>, <FlashDisplay/>, <HUD/>
│  ├─ screens/        # WorldMap, Lesson, Challenge, FlashAnzan, Settings
│  ├─ stores/         # zustand
│  └─ hooks/          # useCamera, useInputSource, useReducedMotion
├─ app/               # composition root
└─ main.tsx
public/
├─ models/hand_landmarker.task
└─ mediapipe/wasm/    # copiado desde node_modules en el build
```

La regla de dependencias es: `presentation → application → domain`, y `infrastructure` implementa los `ports`. **Las tres fuentes de entrada (gestos, táctil y teclado) implementan la misma interfaz `InputSource`, que emite `Move`.** El dominio nunca sabe de dónde vino el movimiento, salvo por el campo `finger`, que existe para puntuar la técnica.

### 5.3 Modelo de dominio (TypeScript)

```ts
// domain/soroban/Rod.ts
export type EarthCount = 0 | 1 | 2 | 3 | 4;
export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export class Rod {
  private constructor(readonly heaven: boolean, readonly earth: EarthCount) {}
  static of(d: Digit): Rod { return new Rod(d >= 5, (d % 5) as EarthCount); }
  get value(): Digit { return ((this.heaven ? 5 : 0) + this.earth) as Digit; }
  /** Subir/bajar n cuentas de tierra (n>0 hacia la viga). Física real: no hay estados imposibles. */
  moveEarth(n: number): Rod {
    const e = this.earth + n;
    if (e < 0 || e > 4) throw new RangeError(`earth fuera de rango: ${e}`);
    return new Rod(this.heaven, e as EarthCount);
  }
  setHeaven(on: boolean): Rod { return new Rod(on, this.earth); }
}
```

```ts
// domain/soroban/Move.ts
export type Deck = 'heaven' | 'earth';
export type Finger = 'thumb' | 'index' | 'unknown';
export interface Move {
  rod: number;        // 0 = varilla de la derecha
  deck: Deck;
  delta: number;      // tierra: ±1..4 ; cielo: +1 (bajar) | -1 (subir)
  finger: Finger;
  at: number;         // timestamp ms
}
/** Dedo correcto según la técnica tradicional. */
export const expectedFinger = (m: Pick<Move, 'deck' | 'delta'>): Finger =>
  m.deck === 'earth' && m.delta > 0 ? 'thumb' : 'index';
```

`Soroban` es un agregado inmutable: guarda `rods: readonly Rod[]` y `unitRod`, y expone `apply(move): Soroban`, `value` y `fromNumber(n)`. En el constructor se valida que la cantidad de varillas sea impar.

```ts
// domain/soroban/rules.ts — el corazón pedagógico
export type Rule = 'direct' | 'five' | 'ten' | 'combined';

/** Clasifica "sumar d a una varilla con valor v" según la técnica del soroban. */
export function classifyAdd(v: number, d: number): Rule {
  const vh = v >= 5, ve = v % 5, dh = d >= 5, de = d % 5;
  if (v + d <= 9) {
    const direct = !(dh && vh) && ve + de <= 4;
    return direct ? 'direct' : 'five';          // +5 −(5−d)
  }
  const c = 10 - d;                              // complemento a 10 a restar
  const ch = c >= 5, ce = c % 5;
  const canRemoveDirect = (!ch || vh) && ve >= ce;
  return canRemoveDirect ? 'ten' : 'combined';   // combined: −c = +(5−c) −5
}
```

`classifySub` es simétrico: si `v − d ≥ 0`, es directo cuando `(!dh || vh) && ve >= de` y si no, "five" (+(5−d) −5). Si hay préstamo, se toma `c = 10 − d` y es "ten" cuando `!(c >= 5 && vh) && ve + c % 5 <= 4`; si no, "combined".

Con `classifyAdd` y `classifySub` se puede: (1) **generar ejercicios por regla**, evitando el defecto de la app que repetía siempre los pares que suman 5; (2) etiquetar cada error con la regla que falló, que es lo que alimenta Leitner; y (3) producir la **secuencia canónica de movimientos** que el tutorial muestra con las manos fantasma. Conviene un test exhaustivo de las 90 combinaciones v×d para cada operación. El validador compara el valor final con el esperado, calcula un `techniqueScore` (proporción de movimientos hechos con `expectedFinger`) y cuenta los movimientos de más respecto de la secuencia canónica.

### 5.4 MediaPipe en Vite

```ts
// infrastructure/vision/HandTracker.ts
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export async function createHandLandmarker(delegate: 'GPU' | 'CPU'): Promise<HandLandmarker> {
  // WASM y modelo servidos desde el mismo origen (offline + privacidad)
  const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}mediapipe/wasm`);
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`, delegate },
    runningMode: 'VIDEO',
    numHands: 1,                     // una mano: menos coste, menos ambigüedad
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });
}
```

**Cámara:** `getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30 } } })`. La resolución queda por encima de 854×480 por el problema de 640×360 con CPU. Antes de pedirla se comprueba `window.isSecureContext`, y en el `<video>` se usan `setAttribute('playsinline', '')` y `muted`. El bucle usa `requestAnimationFrame` y solo llama a `detectForVideo(video, performance.now())` cuando cambió `video.currentTime`. Ese es el patrón de la guía oficial para web.\[66\]

**`vite.config.ts`:** `@vitejs/plugin-react`, `@vitejs/plugin-basic-ssl` (HTTPS en dev para probar en el celular con `vite --host`), `vite-plugin-static-copy` para copiar `node_modules/@mediapipe/tasks-vision/wasm/*` a `public/mediapipe/wasm`, y `VitePWA` con `registerType: 'autoUpdate'`, un manifest con `display: 'standalone'` y `orientation: 'any'`, y `workbox.globPatterns` que incluya `wasm`.\[67\]\[68\] También `optimizeDeps.exclude: ['@mediapipe/tasks-vision']`. Ojo con un detalle: el modelo (7,82 MB) supera el límite por defecto de precache de Workbox. `maximumFileSizeToCacheInBytes` vale 2097152 (2 MiB) por defecto, y según progressivewebapps.com, en vite-plugin-pwa superarlo "fails the build instead of being silently dropped". Recomiendo no precachearlo y cachearlo en tiempo de ejecución con `CacheFirst` la primera vez que se activa la cámara. Así quien solo usa el modo táctil nunca lo descarga.

### 5.5 Filtro One Euro y pinch con histéresis

```ts
// infrastructure/vision/OneEuro.ts  (Casiez, Roussel & Vogel, CHI 2012)
class LowPass { private y?: number; filter(x: number, a: number) {
  this.y = this.y === undefined ? x : a * x + (1 - a) * this.y; return this.y; } last() { return this.y; } }

export class OneEuro {
  private x = new LowPass(); private dx = new LowPass(); private tPrev?: number;
  constructor(private minCutoff = 1.0, private beta = 0.02, private dCutoff = 1.0) {}
  private alpha(cutoff: number, dt: number) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(value: number, tMs: number): number {
    const dt = this.tPrev === undefined ? 1 / 30 : Math.max(1e-3, (tMs - this.tPrev) / 1000);
    this.tPrev = tMs;
    const prev = this.x.last() ?? value;
    const edx = this.dx.filter((value - prev) / dt, this.alpha(this.dCutoff, dt));
    return this.x.filter(value, this.alpha(this.minCutoff + this.beta * Math.abs(edx), dt));
  }
}
```

```ts
// infrastructure/vision/PinchDetector.ts
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
const dist = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y);

export class PinchDetector {
  private pinched = false; private streak = 0;
  constructor(private enter = 0.25, private exit = 0.40, private confirmFrames = 3) {}
  /** Devuelve 'start' | 'end' | null. Normaliza por tamaño de mano (muñeca→MCP medio). */
  update(lm: NormalizedLandmark[]): 'start' | 'end' | null {
    const ratio = dist(lm[4], lm[8]) / Math.max(1e-6, dist(lm[0], lm[9]));
    const want = this.pinched ? ratio < this.exit : ratio < this.enter; // histéresis
    if (want === this.pinched) { this.streak = 0; return null; }
    if (++this.streak < this.confirmFrames) return null;                // debounce
    this.streak = 0; this.pinched = want;
    return want ? 'start' : 'end';
  }
  reset() { this.pinched = false; this.streak = 0; }
}
```

Para el modo "empuje" se agregan dos piezas más. Un `RodMapper` convierte la x (en espacio pantalla, ya espejada) en un índice de varilla según la calibración (bordes izquierdo y derecho del ROI), con una histéresis del 15 %. Un `Pusher` por dedo (pulgar = landmark 4, índice = landmark 8), cada uno con su par de `OneEuro`, compara la y del frame anterior con la actual. Cuando el dedo cruza el borde de una cuenta con velocidad mínima y fuera del cooldown de 120 ms, emite un `Move { rod, deck, delta, finger }`. Como en pantalla la y crece hacia abajo, en la tierra subir suma y en el cielo bajar suma. Esos `Move` pasan por el caso de uso `ApplyMove`, el mismo que usa la entrada táctil.

### 5.6 Audio

- **Desbloqueo:** Chrome 66 o posterior y Safari 11 o posterior arrancan el `AudioContext` suspendido hasta que hay un gesto del usuario. iOS además tiene el estado `interrupted` (llamadas) y vuelve a suspender el contexto en segundo plano. El `WebAudioPort` crea un solo `AudioContext({ latencyHint: 'interactive' })` dentro del botón "Empezar", llama a `resume()` y reproduce un buffer silencioso de 1 muestra (el truco clásico para iOS). Después vuelve a llamar a `resume()` antes de cada sonido.\[69\]\[70\]\[71\]\[72\]
- **Reproducción:** buffers decodificados con `decodeAudioData` y un `AudioBufferSourceNode` más un `GainNode` por disparo. El `playbackRate` varía ±5 % al azar para que el "clac" suene a madera y no a sample repetido.

### 5.7 Estado, persistencia y responsive

- **Zustand:** `sorobanStore`, que guarda el `Soroban` inmutable y expone `apply(move)`; `sessionStore`, con el ejercicio actual, el temporizador, la racha y los puntos; y `settingsStore`, con el modo de entrada, la mano dominante, el volumen y la calibración.
- **IndexedDB:** las tablas `skills` (regla → caja Leitner, próxima fecha, precisión y latencia móviles), `attempts` (historial para estadísticas), `profile` (XP, rango, racha, congeladores) y `calibrations` (por dispositivo y orientación). Conviene pedir `navigator.storage.persist()` para que el navegador no borre el progreso.
- **Responsive y orientación:** en mobile vertical, 7 a 9 varillas a todo el ancho y la cámara en un recuadro pequeño. En mobile horizontal, que es el layout preferido para la cámara, video a la izquierda y 13 varillas a la derecha. En desktop, 17 varillas. Usar `dvh`/`svh` en lugar de `vh`, `safe-area-inset-*`, áreas táctiles de al menos 44×44 px. Como bloquear la orientación no es fiable en iOS, conviene sugerir rotar.

### 5.8 Roadmap por fases

| Fase | Duración orientativa | Entregables | Criterio de salida |
|---|---|---|---|
| **0 · Fundaciones** | 1 semana | Vite + React + TS strict, ESLint, Vitest; `domain/soroban` con `Rod`, `Soroban`, `classifyAdd/Sub` y tests exhaustivos | 100 % de cobertura del dominio; las 180 combinaciones v×d clasificadas |
| **1 · MVP táctil** | 2–3 semanas | `<SorobanSvg/>` con física de cuentas por Pointer Events; mundos 0–3 (lectura, directo, 5, 10); generador por regla; validador; sonidos básicos; PWA offline | Se juega en un iPhone y un Android reales, instalado, sin conexión |
| **2 · Gestos** | 3–4 semanas | Cámara + HandLandmarker; overlay con 21 landmarks; One Euro; calibración; modos "empuje" y "puntero + pinch"; benchmark de delegado; indicador de calidad; caída automática a táctil | Al menos 95 % de movimientos intencionales reconocidos y menos de 1 falso positivo por minuto con buena luz, en un Android medio y un iPhone |
| **3 · Gamificación** | 2–3 semanas | Puntos, estrellas, rachas con congelador; mapa de mundos y desbloqueos; jefes; Leitner; dificultad adaptativa con objetivo del 85 %; animaciones (springs, partículas); mundos 4–6 | Retención propia: 14 días seguidos de uso real de Gastón |
| **4 · Anzan** | 2–3 semanas | Lectura relámpago; flash anzan configurable y adaptativo; ábaco "que se desvanece" (opacidad decreciente); yomiage-zan con voz; minijuego de memoria visoespacial; mundo 7 y dan | Flash de 5 números de 1 dígito a 1 s con 90 % de aciertos |

Un consejo de orden: **la fase 1 sin cámara ya es un producto útil**. Si la fase 2 se complica en mobile, el aprendizaje no se frena.

---

## 6. Riesgos y limitaciones técnicas reales

| Riesgo | Por qué ocurre | Mitigación |
|---|---|---|
| **Rendimiento en mobile de gama baja** | La inferencia, la cámara y el render compiten por la CPU y la GPU; hay calentamiento y throttling; el benchmark oficial (12–17 ms) es nativo, no de navegador\[43\] | `numHands: 1`; resolución de ~960×540; inferir cada 2 frames y extrapolar con el filtro; mover la inferencia a un Web Worker; benchmark de delegado; modo táctil como principal |
| **Delegado GPU inconsistente** | Drivers GL ES en Android; resultados erróneos reportados con GPU en iOS (Segmenter)\[45\]\[46\] | Elegir el delegado por medición y guardarlo; botón "modo compatibilidad (CPU)" |
| **Oclusión de dedos** | En la pinza el pulgar queda detrás del índice; de perfil, los dedos se superponen | Guiar la postura (palma hacia la cámara y ligeramente girada); permitir el modo puntero; tolerar 2–3 frames perdidos sin soltar el estado |
| **Iluminación y contraluz** | El modelo pierde confianza; aparece motion blur con poca luz | Indicador de calidad; consejo "luz de frente"; caída automática a táctil |
| **Desajuste de planos y ergonomía** | El soroban real es horizontal y la mano frente a la cámara está en un plano vertical; hacen falta las dos manos libres | Calibración; asumir que el gesto es una *metáfora* de la técnica; recomendar un soporte y el modo horizontal |
| **Expectativas pedagógicas** | La evidencia es casi toda con niños; un año de práctica liviana no mostró efecto en EE. UU. | Metas de cálculo concretas, sin promesas cognitivas; práctica diaria |

---

## Recomendaciones finales

1. **Empezá por el dominio.** `classifyAdd` y `classifySub`, con tests exhaustivos, son el activo más valioso: de ahí salen el generador de ejercicios, el feedback, la repetición espaciada y el tutorial. Con tu experiencia en Clean Architecture, esta es la parte donde más vas a aportar.
2. **Lanzá el MVP táctil en mobile antes de tocar la cámara.** Usalo vos mismo 10–20 minutos por día. Te va a servir como aprendiz y como QA.
3. **Tratá la cámara como el diferencial, no como la base.** El modo "empuje" con pulgar e índice puntuados es algo que ninguna app revisada ofrece. Medí su fiabilidad con criterios numéricos (aciertos y falsos positivos por minuto) antes de hacerlo obligatorio en algún nivel.
4. **Fijá versiones y medí en dispositivos reales.** Fijá `@mediapipe/tasks-vision` a una versión exacta, revisá la telemetría y probá en al menos un iPhone y un Android de gama media desde la fase 2.

## Caveats

- Los benchmarks oficiales de MediaPipe son nativos (Pixel 6). **No encontré mediciones fiables y recientes de FPS o latencia de Hand Landmarker en iOS Safari ni en Android Chrome**, y las afirmaciones de terceros sobre el delegado GPU se contradicen.
- Las cifras de UCMAS cambian por franquicia y país. Las cifras de SoroTouch (62 %) son del proveedor.
- Los tiempos de aprendizaje para un adulto, la estructura de la sesión diaria, la fórmula de puntos y los umbrales de gestos (0,25/0,40, 3 frames, 120 ms) son **propuestas de diseño** a validar con pruebas, no datos medidos.

## Fuentes

1. [Soroban](https://manga.fandom.com/wiki/Soroban)
2. [Abacus](https://helpingwithmath.com/abacus/)
3. [算盤 Abacus Tutorial - How to use an Abacus. Japanese, Chinese abacus techniques.](http://totton.idirect.com/abacus/pages.htm)
4. [Abacus](https://www.encyclopedia.com/science-and-technology/mathematics/mathematics/abacus)
5. [Setting Numbers on a Soroban](https://sonuprince.wordpress.com/2009/12/18/setting-numbers-on-a-soroban/)
6. [How to Use a Chinese Abacus — Suanpan Tutorial](https://www.kani-math.com/suanpan/how-to-use)
7. [Soroban](https://en.wikipedia.org/wiki/Soroban)
8. [Suanpan](https://en.wikipedia.org/wiki/Suanpan)
9. [Mini Museum: Abacus](https://www.paleotechnologist.net/?p=5264)
10. [Abacus, Suan Pan, Tschu Pan, Schoty, Soroban (Counting ...](https://www.sliderulemuseum.com/Abaci.htm)
11. [What Are Small Friends and Big Friends in Mental Arithmetic — and Why Do They Matter?](https://amavit.com/blog/small-friends-big-friends-mental-arithmetic)
12. [Fingering with Soroban - Teaching Your Child Math - Little Learner Forum](https://forum.littlelearner.kids/t/fingering-with-soroban/228021)
13. [Japanese Soroban: Mastering Mental Math Techniques - Studocu](https://www.studocu.com/row/document/abu-dhabi-university/discrete-mathematics/soroban-mind-math/46049844)
14. [Soroban handbook](https://www.slideshare.net/MindGymSchool/soroban-handbook)
15. [Abacus Division](https://www.cuemath.com/learn/abacus-division/)
16. [Using AI to Measure Parkinson's Disease Severity at Home](https://arxiv.org/pdf/2303.17573)
17. [How to start soroban exams & competitions (grades, dan & flash anzan)](https://soroban.tournavi.jp/en/guide/)
18. [Abacus Levels in Japan](https://finemotormath.com/abacus-levels/)
19. [Abacus Classes for Kids](https://www.ucmasabacus.in/program-structure)
20. [Program Overview](https://ucmas.com/program-overview/)
21. [UCMAS Program Structure - GEMS LEARNING INSTITUTE](https://gemslearninginstitute.com/ucmas-program-structure/)
22. [Abacus Mental Math Class](https://ucmas-usa.com/abacus-math-program/)
23. [Today’s children are experiencing math phobia more than ever. Mathematics has a reputation for being a difficult subject, however, the fear of math stems from many reasons, including Ineffective teaching methods, topped up with Parental pressure. When concepts are not explained clearly and there is a huge dependency on memorizing formulae children struggle to grasp https://ucmasmp.com/what-is-ucmas-a-complete-guide-for-parents-students/ What is UCMAS? A complete guide for parents & students](https://ucmasmp.com/what-is-ucmas-a-complete-guide-for-parents-students/)
24. [Basics - Soroban Exam](https://www.sorobanexam.org/basics/add.html)
25. [Lesson 7: Abacus Addition With 5-Complement](https://finemotormath.com/abacus-lesson7/)
26. [Soroban Piazza -Japanese Abacus a-Kazu-@](http://soroban-movie.com/Soroban-addition.html)
27. [How to Work an Abacus: Add, Subtract, and Divide - ScienceInsights](https://scienceinsights.org/how-to-work-an-abacus-add-subtract-and-divide/)
28. [Free Soroban Abacus Simulator - Beads, or a Full Arithmetic Problem](https://miniwebtool.com/soroban-abacus-simulator/)
29. [Barner, Athanasopoulou, Chu, Lewis, Marchand, Schneider, and Frank: A One-Year Classroom-Randomized Trial of Mental Abacus Instruction for First- and Second-Grade Students](https://jnc.psychopen.eu/index.php/jnc/article/download/5761/5761.html?inline=1)
30. <https://langcog.stanford.edu/papers_new/barner-2015-childdev.pdf>
31. [Soroban: Japanese Abacus Math - Apps on Google Play](https://play.google.com/store/apps/details?id=jp.sicorp.abacusga&hl=en_US)
32. [Soroban: Japanese Abacus Math](https://play.google.com/store/apps/details?id=jp.sicorp.abacusga&hl=en_IE)
33. [Simple Soroban for Android - Free App Download](https://www.appbrain.com/app/simple-soroban/br.net.btco.soroban)
34. [Soroban Flash Anzan Challenge](https://play.google.com/store/apps/details?id=com.tissurachip.sfac&hl=en_IN)
35. [Flash Anzan Soroban Trainer - Apps on Google Play](https://play.google.com/store/apps/details?id=com.KaderSoftDev.FlashAnzan&hl=en_US)
36. [Effects of the abacus-based mental calculation training application “SoroTouch” on cognitive functions: A randomized controlled trial](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10931506/)
37. [@tensorflow-models/hand-pose-detection - npm](https://www.npmjs.com/package/@tensorflow-models/hand-pose-detection)
38. [3D Hand Pose with MediaPipe and TensorFlow.js — The TensorFlow Blog](https://blog.tensorflow.org/2021/11/3D-handpose.html)
39. [HandIntegrating @mediapipe/tasks-vision for Hand Landmark Detection in React](https://medium.com/@kiyo07/integrating-mediapipe-tasks-vision-for-hand-landmark-detection-in-react-a2cfb9d543c7)
40. [Slow perfomance of Hands in iOS Safari · Issue #3303 · google-ai-edge/mediapipe · GitHub](https://github.com/google/mediapipe/issues/3303)
41. [Effortlessly Develop and Deploy ML Models with Google MediaPipe: A Comprehensive Guide](https://encord.com/blog/google-mediapipe/)
42. [Real-Time Hand Tracking in Python with OpenCV and MediaPipe](https://pierre-schwartz.medium.com/real-time-hand-tracking-in-python-with-opencv-and-mediapipe-5e132dbba7fa)
43. [Hand landmarks detection guide | Google AI Edge | Google for Developers](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
44. [WebGPU support for Vision Tasks](https://github.com/google-ai-edge/mediapipe/issues/5826)
45. [Default the hand landmarker to the CPU delegate on Android by utkarsh17gupta · Pull Request #20 · andyjaramillo/mobile-ml-ts](https://github.com/andyjaramillo/mobile-ml-ts/pull/20)
46. [\[Web\] Image Segmenter GPU delegate produces incorrect categories on iOS Safari](https://github.com/google-ai-edge/mediapipe/issues/6142)
47. [Hand model on the CPU delegate finds no hands at 640x360 (found measuring #240) · Issue #324 · thorwhalen/thoremin · GitHub](https://github.com/thorwhalen/thoremin/issues/324)
48. [MediaPipe Tasks Vision Package](https://www.npmjs.com/package/@mediapipe/tasks-vision)
49. [Releases · google-ai-edge/mediapipe · GitHub](https://github.com/google-ai-edge/mediapipe/releases)
50. [Update MediaPipe Tasks Vision to 0.10.35, not 1.x by johnnyrobot · Pull Request #4 · johnnyrobot/discuss-it-recorder · GitHub](https://github.com/johnnyrobot/discuss-it-recorder/pull/4)
51. [Interactive Web Demo ✨](https://blog.neilblaze.live/interactive-web-demo/)
52. [Mediapipe Finger Pinch Dial Controller - TouchDesigner](https://derivative.ca/community-post/tutorial/mediapipe-finger-pinch-dial-controller/74152)
53. [GitHub - Shreshth-1006/mediapipe-gesture-controller: Real-time AI-powered hand gesture control system built with OpenCV and MediaPipe. Control cursor navigation, clicks, scrolling, volume, and system shortcuts hands-free via webcam. · GitHub](https://github.com/Shreshth-1006/mediapipe-gesture-controller)
54. [(PDF) 1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Interactive Systems](https://www.researchgate.net/publication/254005010_1_Filter_A_Simple_Speed-based_Low-pass_Filter_for_Noisy_Input_in_Interactive_Systems)
55. [1€ Filter - Géry Casiez](https://gery.casiez.net/1euro/)
56. [Does getUserMedia works on iOS?](https://developer.apple.com/forums/thread/92713)
57. [\- From: youennf via GitHub \<sysbot+gh@w3.org\>](https://lists.w3.org/Archives/Public/public-webrtc-logs/2025Mar/0075.html)
58. [MediaDevices: getUserMedia() method](https://developer.mozilla.org/en-US/docs/Web/API/navigator/mediaDevices.getUserMedia)
59. [developer.apple.com](https://developer.apple.com/forums/thread/79501?page=2)
60. [JavaScript Camera API: Access the camera and microphone using getUserMedia - Desarrollolibre](https://www.desarrollolibre.net/blog/javascript/accessing-a-devices-camera-and-microphone-with-javascript)
61. [iOS Safari can't access device camera - Mobile - Unity Discussions](https://discussions.unity.com/t/ios-safari-cant-access-device-camera/811671)
62. [github.com](https://github.com/hectorbastida/howler.js)
63. [github.com](https://github.com/crazykay/howler.js)
64. [Ready-to-use Presentations](https://microsoft.github.io/workshop-library/full/mood-journal-progressive-web-app/5-register-service-worker.html)
65. [Getting Started](https://vite-pwa-org.netlify.app/workbox/)
66. [Hand landmarks detection guide for Web | Google AI Edge | Google for Developers](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
67. [vite-plugin-pwa: The Complete Vite PWA Plugin Guide - Progressive Web Apps](https://progressivewebapps.com/tooling/vite-pwa/)
68. [Workbox Integration](https://deepwiki.com/vite-pwa/vite-plugin-pwa/2.3-workbox-integration)
69. [Unlock Web Audio on first user gesture for iOS/Android by Copilot · Pull Request #161 · duongvantoan190224/game\_sudoku · GitHub](https://github.com/duongvantoan190224/game_sudoku/pull/161)
70. [IOS 15 block play background web audio api · Issue #1525 · goldfire/howler.js · GitHub](https://github.com/goldfire/howler.js/issues/1525)
71. [Web Audio API: Browser Support, Features, Known Issues](https://www.testmuai.com/learning-hub/web-audio-api-browser-support/)
72. [iOS Safari audio sessions: fifteen commits to a working voice mode — Sam Eddy](https://samueleddy.com/writing/ios-safari-audio-sessions/)
