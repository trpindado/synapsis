/*
 * generators/puzzle.js — Pieza que falta.
 *
 * Se genera una figura de casillas (poliominó grande) y se le recorta
 * una pieza conexa; la figura se muestra con el hueco marcado y el
 * usuario elige la pieza que lo rellena EXACTAMENTE tal cual se
 * muestra (sin girarla).
 *
 * La pieza se recorta verificando que es asimétrica (giro y espejo):
 * así los distractores "pieza girada" y "pieza espejada" nunca encajan.
 * Todos los distractores mantienen el mismo número de casillas para
 * que no se puedan descartar contando.
 *
 * Escalado con la dificultad d:
 *   - tamaño de la figura y de la pieza recortada
 *   - nº de opciones (Synapsis.dif.numOpciones)
 */
(function () {
  const U = Synapsis.utils;
  const D = Synapsis.dif;
  const P = Synapsis.poly;

  /**
   * Recorta de la figura una pieza conexa de `tam` casillas (paseo
   * aleatorio dentro de la figura) dejando el resto conexo. Si
   * `exigirAsimetrica`, la pieza debe ser asimétrica (giro y espejo).
   */
  function extraerPieza(figura, tam, exigirAsimetrica) {
    const setFigura = new Set(figura.map((c) => c.join(',')));
    for (let intento = 0; intento < 120; intento++) {
      const pieza = [U.elegir(figura)];
      const enPieza = new Set([pieza[0].join(',')]);
      let atascos = 0;
      while (pieza.length < tam && atascos < 60) {
        const [bx, by] = U.elegir(pieza);
        const [dx, dy] = U.elegir(P.DIRS4);
        const k = (bx + dx) + ',' + (by + dy);
        if (!setFigura.has(k) || enPieza.has(k)) { atascos++; continue; }
        enPieza.add(k);
        pieza.push([bx + dx, by + dy]);
      }
      if (pieza.length < tam) continue;
      const resto = figura.filter((c) => !enPieza.has(c.join(',')));
      if (!P.esConexa(resto)) continue;
      if (exigirAsimetrica && !P.esAsimetrica(pieza)) continue;
      return { pieza, resto };
    }
    return null;
  }

  function generar(d) {
    // Pieza de 4 casillas como mínimo: no existe ninguna pieza de 3
    // casillas totalmente asimétrica (todas tienen alguna simetría).
    const tamPieza = Math.min(6, D.creciente(d, 4, 4));
    const totalCeldas = Math.min(18, Math.max(tamPieza + 6, D.creciente(d, 10, 2)));

    // Se reintenta con figuras nuevas; en los últimos intentos se relaja
    // la asimetría de la pieza (los distractores giro/espejo repetidos
    // se descartan luego por clave, así que sigue siendo válido).
    let figura = null;
    let corte = null;
    for (let intento = 0; intento < 60 && !corte; intento++) {
      figura = P.generarPoliomino(totalCeldas);
      corte = extraerPieza(figura, tamPieza, intento < 40);
    }
    const { pieza, resto } = corte;
    const hueco = new Set(pieza.map((c) => c.join(',')));

    // ---- Distractores: mismas casillas en número, forma distinta ----
    const claveCorrecta = P.clave(pieza);
    const usadas = new Set([claveCorrecta]);
    const distractores = [];

    function proponer() {
      switch (U.elegir(['giro', 'espejo', 'movida'])) {
        case 'giro': {   // la pieza correcta pero girada
          let c = pieza;
          const vueltas = U.enteroAleatorio(1, 3);
          for (let i = 0; i < vueltas; i++) c = P.rotar90(c);
          return c;
        }
        case 'espejo': { // la pieza reflejada (y quizá girada)
          let c = P.espejar(pieza);
          const vueltas = U.enteroAleatorio(0, 3);
          for (let i = 0; i < vueltas; i++) c = P.rotar90(c);
          return c;
        }
        case 'movida':   // una casilla cambiada de sitio
          return P.moverCasilla(pieza);
      }
    }

    const numOpciones = D.numOpciones(d);
    let intentos = 0;
    while (distractores.length < numOpciones - 1 && intentos < 250) {
      intentos++;
      const candidata = proponer();
      if (!candidata) continue;
      const k = P.clave(candidata);
      if (usadas.has(k)) continue;
      usadas.add(k);
      distractores.push(P.normalizar(candidata));
    }

    const opciones = U.mezclar([
      { celdas: P.normalizar(pieza), correcta: true },
      ...distractores.map((celdas) => ({ celdas })),
    ]);
    const indiceCorrecto = opciones.findIndex((o) => o.correcta);
    const color = U.elegir(U.PALETA);

    // Casilla del hueco más cercana a su centro (para colocar el "?"
    // dentro aunque la pieza sea cóncava y el centroide caiga fuera).
    const mx = pieza.reduce((s, c) => s + c[0], 0) / pieza.length;
    const my = pieza.reduce((s, c) => s + c[1], 0) / pieza.length;
    const celdaInterrogante = pieza.reduce((mejor, c) =>
      (c[0] - mx) ** 2 + (c[1] - my) ** 2 < (mejor[0] - mx) ** 2 + (mejor[1] - my) ** 2 ? c : mejor
    );

    // Mismo tamaño de casilla en todas las opciones, para que el
    // encuadre no delate cuál es la correcta.
    const maxDim = Math.max(...opciones.map((o) => {
      const nx = Math.max(...o.celdas.map((c) => c[0])) + 1;
      const ny = Math.max(...o.celdas.map((c) => c[1])) + 1;
      return Math.max(nx, ny);
    }));

    return {
      enunciado: '¿Qué pieza completa la figura? (sin girarla)',

      dibujarPrincipal(canvas, ancho) {
        const nx = Math.max(...figura.map((c) => c[0])) + 1;
        const ny = Math.max(...figura.map((c) => c[1])) + 1;
        const tamCelda = Math.min((ancho * 0.82) / nx, 44);
        const alto = Math.round(ny * tamCelda + 28);
        const ctx = U.prepararCanvas(canvas, ancho, alto);
        const ox = (ancho - nx * tamCelda) / 2;
        const oy = (alto - ny * tamCelda) / 2;

        // Parte visible de la figura
        for (const [x, y] of resto) {
          ctx.fillStyle = color;
          ctx.fillRect(ox + x * tamCelda, oy + y * tamCelda, tamCelda, tamCelda);
          ctx.strokeStyle = 'rgba(16,20,31,0.55)';
          ctx.lineWidth = 1;
          ctx.strokeRect(ox + x * tamCelda + 0.5, oy + y * tamCelda + 0.5, tamCelda - 1, tamCelda - 1);
        }

        // Hueco: relleno tenue + contorno discontinuo en su perímetro
        for (const [x, y] of pieza) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(ox + x * tamCelda, oy + y * tamCelda, tamCelda, tamCelda);
        }
        ctx.strokeStyle = '#9aa4bd';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        for (const [x, y] of pieza) {
          const x0 = ox + x * tamCelda;
          const y0 = oy + y * tamCelda;
          if (!hueco.has(x + ',' + (y - 1))) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + tamCelda, y0); }
          if (!hueco.has(x + ',' + (y + 1))) { ctx.moveTo(x0, y0 + tamCelda); ctx.lineTo(x0 + tamCelda, y0 + tamCelda); }
          if (!hueco.has((x - 1) + ',' + y)) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + tamCelda); }
          if (!hueco.has((x + 1) + ',' + y)) { ctx.moveTo(x0 + tamCelda, y0); ctx.lineTo(x0 + tamCelda, y0 + tamCelda); }
        }
        ctx.stroke();
        ctx.setLineDash([]);

        U.dibujarInterrogante(
          ctx,
          ox + (celdaInterrogante[0] + 0.5) * tamCelda,
          oy + (celdaInterrogante[1] + 0.5) * tamCelda,
          tamCelda * 0.6
        );
      },

      opciones: opciones.map((op) => ({
        dibujar(canvas, tam) {
          const ctx = U.prepararCanvas(canvas, tam, tam);
          P.dibujarCeldas(ctx, op.celdas, tam / 2, tam / 2, (tam * 0.78) / maxDim, color);
        },
      })),

      indiceCorrecto,
    };
  }

  Synapsis.registry.registrar({
    id: 'piezas',
    nombre: 'Pieza que falta',
    generar,
  });
})();
