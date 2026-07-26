/*
 * generators/matrix.js — Matrices visuales 3x3 (estilo matrices progresivas).
 *
 * Se construye una rejilla 3x3 donde cada celda tiene 4 atributos
 * (forma, color, tamaño, cantidad). Algunos atributos "varían" según una
 * regla que depende de la fila/columna de la celda; el resto quedan
 * fijos. Falta una celda y el usuario elige la pieza que la completa.
 *
 * Escalado con la dificultad d:
 *   - nº de atributos que varían a la vez: 1 → 4
 *   - reglas más sutiles (fila/columna → diagonales tipo cuadrado latino)
 *   - la celda que falta deja de ser siempre la última
 *   - más opciones y distractores que difieren en detalles más pequeños
 */
(function () {
  const U = Synapsis.utils;
  const D = Synapsis.dif;

  /* Valores posibles de cada atributo. Para cada ejercicio se eligen 3
     (uno por índice de la regla); el pool completo también se usa para
     construir distractores. */
  const POOLS = {
    forma: U.FORMAS,
    color: U.PALETA,
    tamano: [0.5, 0.72, 0.95],   // factor sobre el tamaño base de la celda
    cantidad: [1, 2, 3],          // copias de la forma dentro de la celda
  };
  const ATRIBUTOS = Object.keys(POOLS);

  /* Valor por defecto cuando un atributo NO varía en el ejercicio. */
  function valorFijo(atributo) {
    if (atributo === 'tamano') return 0.72;
    if (atributo === 'cantidad') return 1;
    return U.elegir(POOLS[atributo]); // forma/color fijos pero aleatorios
  }

  /* Reglas: dada la celda (fila, col) devuelven el índice 0..2 del valor.
     Las diagonales (cuadrado latino) son más difíciles de detectar y se
     desbloquean progresivamente. */
  function reglasDisponibles(d) {
    const reglas = [
      (f, c) => f,             // varía por fila
      (f, c) => c,             // varía por columna
    ];
    if (D.activo(d, 4)) reglas.push((f, c) => (f + c) % 3);      // diagonal
    if (D.activo(d, 8)) reglas.push((f, c) => (f + 2 * c) % 3);  // anti-diagonal
    return reglas;
  }

  /** Genera el ejercicio completo para una dificultad dada. */
  function generar(d) {
    // Cuántos atributos varían: crece sin salto brusco de 1 hasta 4.
    const numVariables = Math.min(ATRIBUTOS.length, D.creciente(d, 1, 4));

    // Siempre varía al menos forma o color (lo más visible); el resto
    // se toma al azar de los atributos restantes.
    const primera = U.elegir(['forma', 'color']);
    const variables = [primera, ...U.muestra(ATRIBUTOS.filter((a) => a !== primera), numVariables - 1)];

    const reglas = reglasDisponibles(d);
    const config = {}; // atributo -> { valores: [v0,v1,v2], regla } o { fijo: v }
    for (const atributo of ATRIBUTOS) {
      if (variables.includes(atributo)) {
        config[atributo] = {
          valores: U.muestra(POOLS[atributo], 3),
          regla: U.elegir(reglas),
        };
      } else {
        config[atributo] = { fijo: valorFijo(atributo) };
      }
    }

    /* Atributos de la celda (fila, col) aplicando la configuración. */
    function celda(fila, col) {
      const atributos = {};
      for (const a of ATRIBUTOS) {
        const cfg = config[a];
        atributos[a] = cfg.fijo !== undefined ? cfg.fijo : cfg.valores[cfg.regla(fila, col)];
      }
      return atributos;
    }

    // A dificultad baja falta siempre la esquina inferior derecha (más
    // fácil de razonar); después la casilla que falta es aleatoria.
    const faltante = D.activo(d, 6)
      ? [U.enteroAleatorio(0, 2), U.enteroAleatorio(0, 2)]
      : [2, 2];

    const correcta = celda(faltante[0], faltante[1]);

    // ---- Distractores: copias de la correcta con 1-2 atributos cambiados ----
    const numOpciones = D.numOpciones(d);
    const clave = (attrs) => ATRIBUTOS.map((a) => attrs[a]).join('|');
    const usadas = new Set([clave(correcta)]);
    const distractores = [];
    let intentos = 0;

    while (distractores.length < numOpciones - 1 && intentos < 300) {
      intentos++;
      const candidato = { ...correcta };
      // A más dificultad, más probable que solo cambie 1 atributo sutil.
      const nCambios = D.activo(d, 7) ? 1 : U.enteroAleatorio(1, 2);
      for (const atributo of U.muestra(ATRIBUTOS, nCambios)) {
        const alternativas = POOLS[atributo].filter((v) => v !== candidato[atributo]);
        candidato[atributo] = U.elegir(alternativas);
      }
      if (!usadas.has(clave(candidato))) {
        usadas.add(clave(candidato));
        distractores.push(candidato);
      }
    }

    const opcionesAttrs = U.mezclar([correcta, ...distractores]);
    const indiceCorrecto = opcionesAttrs.findIndex((o) => clave(o) === clave(correcta));

    /* ---------------- Dibujo ---------------- */

    /** Dibuja el contenido de una celda centrado en (cx, cy). */
    function dibujarCelda(ctx, attrs, cx, cy, tamCelda) {
      const base = tamCelda * 0.3 * attrs.tamano;
      // Disposición de las copias según la cantidad (posiciones relativas).
      const disposiciones = {
        1: [[0, 0, 1]],
        2: [[-0.22, 0, 0.6], [0.22, 0, 0.6]],
        3: [[0, -0.2, 0.52], [-0.22, 0.16, 0.52], [0.22, 0.16, 0.52]],
      };
      for (const [dx, dy, escala] of disposiciones[attrs.cantidad]) {
        U.dibujarForma(ctx, attrs.forma, cx + dx * tamCelda, cy + dy * tamCelda, base * escala, attrs.color);
      }
    }

    return {
      enunciado: '¿Qué pieza completa la matriz?',

      dibujarPrincipal(canvas, ancho) {
        const ctx = U.prepararCanvas(canvas, ancho, ancho);
        const margen = ancho * 0.04;
        const tamCelda = (ancho - margen * 2) / 3;

        for (let f = 0; f < 3; f++) {
          for (let c = 0; c < 3; c++) {
            const x = margen + c * tamCelda;
            const y = margen + f * tamCelda;
            // Borde suave de cada celda
            ctx.strokeStyle = '#2a3248';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, tamCelda, tamCelda);

            if (f === faltante[0] && c === faltante[1]) {
              // Casilla que falta: fondo diferenciado + "?"
              ctx.fillStyle = 'rgba(154,164,189,0.12)';
              ctx.fillRect(x + 2, y + 2, tamCelda - 4, tamCelda - 4);
              U.dibujarInterrogante(ctx, x + tamCelda / 2, y + tamCelda / 2, tamCelda * 0.45);
            } else {
              dibujarCelda(ctx, celda(f, c), x + tamCelda / 2, y + tamCelda / 2, tamCelda);
            }
          }
        }
      },

      opciones: opcionesAttrs.map((attrs) => ({
        dibujar(canvas, tam) {
          const ctx = U.prepararCanvas(canvas, tam, tam);
          dibujarCelda(ctx, attrs, tam / 2, tam / 2, tam);
        },
      })),

      indiceCorrecto,
    };
  }

  Synapsis.registry.registrar({
    id: 'matriz',
    nombre: 'Matriz visual',
    generar,
  });
})();
