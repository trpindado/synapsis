/*
 * generators/series.js — Series numéricas y de símbolos.
 *
 * Dos modos:
 *   - Numérico: se elige una familia de series (aritmética, geométrica,
 *     paso creciente, alternante, Fibonacci, cuadrados, intercalada...).
 *     Las familias más complejas se desbloquean gradualmente con la
 *     dificultad, y dentro de cada familia los parámetros (paso, razón,
 *     valores iniciales) también crecen con d.
 *   - Simbólico: secuencia de formas/colores que se repiten en ciclos;
 *     con la dificultad crecen las longitudes de ciclo y se superponen
 *     ciclos de forma y de color de distinta longitud (interferencia).
 *
 * Todo se dibuja en canvas (los números como texto ajustado) para
 * mantener una presentación uniforme con el resto de ejercicios.
 */
(function () {
  const U = Synapsis.utils;
  const D = Synapsis.dif;

  /* ============ Series numéricas ============ */

  /* Cada familia devuelve { terminos: [...], siguiente }.
     `desde` indica la dificultad a partir de la cual entra en el sorteo
     (vía probabilidad logística, sin corte brusco). */
  const FAMILIAS = [
    {
      desde: 0, // siempre disponible
      crear(d) { // aritmética: +k
        const paso = U.enteroAleatorio(2, 3 + Math.floor(d));
        const inicio = U.enteroAleatorio(1, 12);
        return serieDesde(inicio, (x) => x + paso, 4);
      },
    },
    {
      desde: 3,
      crear(d) { // aritmética descendente: -k
        const paso = U.enteroAleatorio(3, 4 + Math.floor(d));
        const inicio = U.enteroAleatorio(40 + paso * 5, 90 + paso * 5);
        return serieDesde(inicio, (x) => x - paso, 4);
      },
    },
    {
      desde: 4,
      crear(d) { // geométrica: ×2 (o ×3 a dificultad alta)
        const razon = D.activo(d, 9) ? 3 : 2;
        const inicio = U.enteroAleatorio(1, 5);
        return serieDesde(inicio, (x) => x * razon, 4);
      },
    },
    {
      desde: 5,
      crear(d) { // paso creciente: +k, +(k+inc), +(k+2·inc)...
        const inc = U.enteroAleatorio(1, 2);
        let paso = U.enteroAleatorio(1, 4);
        let x = U.enteroAleatorio(1, 10);
        const terminos = [x];
        for (let i = 0; i < 4; i++) { x += paso; paso += inc; terminos.push(x); }
        return { terminos: terminos.slice(0, 4), siguiente: terminos[4] };
      },
    },
    {
      desde: 6,
      crear(d) { // alternante: +a, -b, +a, -b... (con a > b para que crezca)
        const a = U.enteroAleatorio(5, 7 + Math.floor(d));
        const b = U.enteroAleatorio(1, a - 2);
        let x = U.enteroAleatorio(3, 15);
        const terminos = [x];
        for (let i = 0; i < 5; i++) { x += i % 2 === 0 ? a : -b; terminos.push(x); }
        return { terminos: terminos.slice(0, 5), siguiente: terminos[5] };
      },
    },
    {
      desde: 7,
      crear() { // tipo Fibonacci: cada término es la suma de los dos previos
        let a = U.enteroAleatorio(1, 4);
        let b = U.enteroAleatorio(a, a + 4);
        const terminos = [a, b];
        while (terminos.length < 5) terminos.push(terminos.at(-1) + terminos.at(-2));
        return { terminos: terminos.slice(0, 4), siguiente: terminos[4] };
      },
    },
    {
      desde: 9,
      crear() { // cuadrados con desplazamiento: n² + c
        const c = U.enteroAleatorio(-2, 3);
        const n0 = U.enteroAleatorio(1, 4);
        const terminos = [];
        for (let i = 0; i < 5; i++) terminos.push((n0 + i) ** 2 + c);
        return { terminos: terminos.slice(0, 4), siguiente: terminos[4] };
      },
    },
    {
      desde: 11,
      crear() { // recurrencia mixta: x -> 2x - k
        const k = U.enteroAleatorio(1, 5);
        const inicio = U.enteroAleatorio(k + 2, k + 8);
        return serieDesde(inicio, (x) => 2 * x - k, 4);
      },
    },
    {
      desde: 13,
      crear(d) { // dos series aritméticas intercaladas
        const pasoA = U.enteroAleatorio(2, 3 + Math.floor(d / 3));
        const pasoB = U.enteroAleatorio(2, 3 + Math.floor(d / 3));
        let a = U.enteroAleatorio(1, 10);
        let b = U.enteroAleatorio(20, 40);
        const terminos = [];
        for (let i = 0; i < 3; i++) {
          terminos.push(a, b);
          a += pasoA; b += pasoB;
        }
        return { terminos, siguiente: a }; // el 7º término pertenece a la serie A
      },
    },
  ];

  /** Serie por iteración de una función: [x, f(x), f(f(x)), ...] */
  function serieDesde(inicio, fn, n) {
    const terminos = [inicio];
    while (terminos.length <= n) terminos.push(fn(terminos.at(-1)));
    return { terminos: terminos.slice(0, n), siguiente: terminos[n] };
  }

  function generarNumerica(d) {
    // Sorteo entre familias desbloqueadas, sesgado hacia las más nuevas
    // (la última desbloqueada pesa más para que se note la progresión).
    const desbloqueadas = FAMILIAS.filter((f) => d >= f.desde || D.activo(d, f.desde + 1, 1));
    const familia = Math.random() < 0.45 ? desbloqueadas.at(-1) : U.elegir(desbloqueadas);
    const { terminos, siguiente } = familia.crear(d);

    // ---- Distractores numéricos plausibles (cercanos a la solución) ----
    const ultimo = terminos.at(-1);
    const salto = Math.max(1, Math.abs(siguiente - ultimo));
    const candidatos = U.mezclar([
      siguiente + salto, siguiente - salto,
      siguiente + 1, siguiente - 1,
      siguiente + 2, siguiente - 2,
      ultimo, siguiente + Math.round(salto / 2),
    ]);
    const numOpciones = D.numOpciones(d);
    const valores = new Set([siguiente]);
    for (const c of candidatos) {
      if (valores.size >= numOpciones) break;
      if (!valores.has(c)) valores.add(c);
    }
    // Relleno de seguridad por si hubiera colisiones
    let extra = 3;
    while (valores.size < numOpciones) valores.add(siguiente + salto + extra++);

    const opcionesValores = U.mezclar([...valores]);

    return {
      enunciado: '¿Qué número continúa la serie?',

      dibujarPrincipal(canvas, ancho) {
        const alto = Math.round(ancho * 0.32);
        const ctx = U.prepararCanvas(canvas, ancho, alto);
        const texto = terminos.join(',  ') + ',  ?';
        U.dibujarTextoAjustado(ctx, texto, ancho / 2, alto / 2, ancho * 0.92, alto * 0.42, '#e8ecf5');
      },

      opciones: opcionesValores.map((valor) => ({
        dibujar(canvas, tam) {
          const alto = Math.round(tam * 0.6);
          const ctx = U.prepararCanvas(canvas, tam, alto);
          U.dibujarTextoAjustado(ctx, String(valor), tam / 2, alto / 2, tam * 0.85, alto * 0.55, '#e8ecf5');
        },
      })),

      indiceCorrecto: opcionesValores.indexOf(siguiente),
    };
  }

  /* ============ Series de símbolos ============ */

  function generarSimbolica(d) {
    // Longitudes de los ciclos de forma y color. A dificultad baja el
    // color es constante; después forma y color ciclan con longitudes
    // distintas, lo que obliga a seguir dos patrones a la vez.
    const cicloForma = Math.min(4, D.creciente(d, 2, 4));
    const cicloColor = D.activo(d, 5) ? (cicloForma === 2 ? 3 : 2) : 1;

    const formas = U.muestra(U.FORMAS, cicloForma);
    const colores = U.muestra(U.PALETA, Math.max(cicloColor, 1));

    const item = (i) => ({
      forma: formas[i % cicloForma],
      color: colores[i % cicloColor] || colores[0],
    });

    // Mostrar suficientes elementos para que el patrón sea deducible.
    const numMostrados = Math.min(7, Math.max(cicloForma, cicloColor) + 3);
    const correcta = item(numMostrados);

    // ---- Distractores: combinaciones forma/color usadas pero incorrectas ----
    const clave = (it) => it.forma + '|' + it.color;
    const usadas = new Set([clave(correcta)]);
    const distractores = [];
    let intentos = 0;
    const numOpciones = D.numOpciones(d);
    while (distractores.length < numOpciones - 1 && intentos < 200) {
      intentos++;
      const candidato = {
        // Mezcla de valores del propio ejercicio y del pool completo,
        // para que los distractores resulten plausibles.
        forma: Math.random() < 0.75 ? U.elegir(formas) : U.elegir(U.FORMAS),
        color: Math.random() < 0.75 ? U.elegir(colores) : U.elegir(U.PALETA),
      };
      if (!usadas.has(clave(candidato))) {
        usadas.add(clave(candidato));
        distractores.push(candidato);
      }
    }

    const opcionesItems = U.mezclar([correcta, ...distractores]);

    return {
      enunciado: '¿Qué figura continúa la serie?',

      dibujarPrincipal(canvas, ancho) {
        const alto = Math.round(ancho * 0.3);
        const ctx = U.prepararCanvas(canvas, ancho, alto);
        const nCasillas = numMostrados + 1; // + la casilla del "?"
        const paso = ancho / nCasillas;
        const radio = Math.min(paso * 0.34, alto * 0.3);
        for (let i = 0; i < numMostrados; i++) {
          const it = item(i);
          U.dibujarForma(ctx, it.forma, paso * (i + 0.5), alto / 2, radio, it.color);
        }
        U.dibujarInterrogante(ctx, paso * (nCasillas - 0.5), alto / 2, radio * 2);
      },

      opciones: opcionesItems.map((it) => ({
        dibujar(canvas, tam) {
          const ctx = U.prepararCanvas(canvas, tam, tam);
          U.dibujarForma(ctx, it.forma, tam / 2, tam / 2, tam * 0.3, it.color);
        },
      })),

      indiceCorrecto: opcionesItems.findIndex((o) => clave(o) === clave(correcta)),
    };
  }

  Synapsis.registry.registrar({
    id: 'series',
    nombre: 'Series lógicas',
    generar(d) {
      // ~1/3 simbólicas, 2/3 numéricas (las numéricas escalan más lejos).
      return Math.random() < 0.35 ? generarSimbolica(d) : generarNumerica(d);
    },
  });
})();
