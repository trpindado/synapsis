/*
 * generators/assembly.js — Unir piezas (ensamblaje).
 *
 * Se genera una figura de casillas y se parte en 2-3 piezas conexas.
 * Se muestran las piezas sueltas (a dificultad alta, además giradas) y
 * el usuario elige qué figura se forma al unirlas.
 *
 * Como las piezas pueden girarse mentalmente, cada distractor se valida
 * con un buscador exacto de encajes (vuelta atrás sobre traslaciones y
 * rotaciones): se descarta cualquier candidato que SÍ pueda formarse
 * con las piezas, para que la respuesta correcta sea única.
 *
 * Escalado con la dificultad d:
 *   - nº de casillas de la figura
 *   - piezas mostradas giradas; 3 piezas en vez de 2
 *   - nº de opciones (Synapsis.dif.numOpciones)
 */
(function () {
  const U = Synapsis.utils;
  const D = Synapsis.dif;
  const P = Synapsis.poly;

  /** Parte la figura en n regiones conexas de al menos `minTam` casillas
      (crecimiento aleatorio desde n semillas). */
  function partir(figura, n, minTam) {
    const setFigura = new Set(figura.map((c) => c.join(',')));
    for (let intento = 0; intento < 150; intento++) {
      const semillas = U.muestra(figura, n);
      const regiones = semillas.map((s) => [s]);
      const asignadas = new Set(semillas.map((s) => s.join(',')));
      let restantes = figura.length - n;
      let atascos = 0;
      while (restantes > 0 && atascos < 600) {
        const region = U.elegir(regiones);
        const [bx, by] = U.elegir(region);
        const [dx, dy] = U.elegir(P.DIRS4);
        const k = (bx + dx) + ',' + (by + dy);
        if (!setFigura.has(k) || asignadas.has(k)) { atascos++; continue; }
        asignadas.add(k);
        region.push([bx + dx, by + dy]);
        restantes--;
      }
      if (restantes === 0 && regiones.every((r) => r.length >= minTam)) return regiones;
    }
    return null;
  }

  /**
   * true si el objetivo puede cubrirse exactamente con las piezas
   * (trasladadas y giradas, sin solaparse ni sobresalir). Búsqueda
   * exhaustiva con vuelta atrás; con ≤ 14 casillas es instantánea.
   */
  function puedeFormarse(objetivo, piezas) {
    if (piezas.reduce((s, p) => s + p.length, 0) !== objetivo.length) return false;
    const objetivoNorm = P.normalizar(objetivo);
    const dentro = new Set(objetivoNorm.map((c) => c.join(',')));
    const orientaciones = piezas.map((p) => P.rotacionesUnicas(p));

    function resolver(cubiertas, usadas) {
      if (cubiertas.size === objetivoNorm.length) return true;
      // La primera casilla sin cubrir debe cubrirla alguna pieza.
      const celda = objetivoNorm.find((c) => !cubiertas.has(c.join(',')));
      for (let i = 0; i < piezas.length; i++) {
        if (usadas[i]) continue;
        usadas[i] = true;
        for (const orientacion of orientaciones[i]) {
          for (const ancla of orientacion) {
            const dx = celda[0] - ancla[0];
            const dy = celda[1] - ancla[1];
            const colocada = orientacion.map(([x, y]) => (x + dx) + ',' + (y + dy));
            if (colocada.every((k) => dentro.has(k) && !cubiertas.has(k))) {
              colocada.forEach((k) => cubiertas.add(k));
              if (resolver(cubiertas, usadas)) return true;
              colocada.forEach((k) => cubiertas.delete(k));
            }
          }
        }
        usadas[i] = false;
      }
      return false;
    }
    return resolver(new Set(), piezas.map(() => false));
  }

  function generar(d) {
    const totalCeldas = Math.min(14, D.creciente(d, 6, 2));
    const numPiezas = Math.min(D.activo(d, 8) ? 3 : 2, Math.floor(totalCeldas / 2));
    const girarPiezas = D.activo(d, 5);
    // Piezas de 3+ casillas siempre que el total lo permita: los dominós
    // son tan flexibles que forman casi cualquier figura y dejan sin
    // candidatos válidos al filtro de distractores.
    const minTamPieza = totalCeldas >= numPiezas * 3 ? 3 : 2;

    // Figura objetivo, preferentemente asimétrica (su espejo será un buen
    // distractor); en los últimos intentos se relaja para no atascarse.
    let figura = null;
    let piezas = null;
    for (let intento = 0; intento < 80 && !piezas; intento++) {
      const candidata = P.generarPoliomino(totalCeldas);
      if (intento < 50 && !P.esAsimetrica(candidata)) continue;
      piezas = partir(candidata, numPiezas, minTamPieza);
      if (piezas) figura = candidata;
    }

    // Piezas tal y como se muestran (giradas o no).
    const piezasVista = piezas.map((p) => {
      let c = P.normalizar(p);
      if (girarPiezas) {
        const vueltas = U.enteroAleatorio(0, 3);
        for (let i = 0; i < vueltas; i++) c = P.rotar90(c);
      }
      return P.normalizar(c);
    });

    // ---- Distractores ----
    // Ningún distractor puede ser un giro de la correcta ni de otro
    // distractor (parecerían duplicados), ni poder formarse con las piezas.
    const usadas = new Set(P.clavesRotaciones(figura));
    const distractores = [];

    function proponer() {
      switch (U.elegir(['espejo', 'movida', 'otra'])) {
        case 'espejo': return P.normalizar(P.espejar(figura));
        case 'movida': return P.moverCasilla(figura);
        case 'otra':   return P.generarPoliomino(totalCeldas);
      }
    }

    const numOpciones = D.numOpciones(d);
    let intentos = 0;
    while (distractores.length < numOpciones - 1 && intentos < 300) {
      intentos++;
      const candidata = proponer();
      if (!candidata) continue;
      const clavesGiros = P.clavesRotaciones(candidata);
      if ([...clavesGiros].some((k) => usadas.has(k))) continue;
      if (puedeFormarse(candidata, piezas)) continue; // ¡también encajaría!
      clavesGiros.forEach((k) => usadas.add(k));
      distractores.push(candidata);
    }

    // Último recurso si las piezas son tan flexibles que casi cualquier
    // candidato puede formarse: figuras con una casilla de más, que por
    // recuento nunca pueden formarse y garantizan un mínimo de opciones.
    while (distractores.length < Math.min(3, numOpciones - 1)) {
      const candidata = P.generarPoliomino(totalCeldas + 1);
      const clavesGiros = P.clavesRotaciones(candidata);
      if ([...clavesGiros].some((k) => usadas.has(k))) continue;
      clavesGiros.forEach((k) => usadas.add(k));
      distractores.push(candidata);
    }

    const opciones = U.mezclar([
      { celdas: P.normalizar(figura), correcta: true },
      ...distractores.map((celdas) => ({ celdas })),
    ]);
    const indiceCorrecto = opciones.findIndex((o) => o.correcta);
    const color = U.elegir(U.PALETA);

    // Mismo tamaño de casilla en todas las opciones.
    const maxDim = Math.max(...opciones.map((o) => {
      const nx = Math.max(...o.celdas.map((c) => c[0])) + 1;
      const ny = Math.max(...o.celdas.map((c) => c[1])) + 1;
      return Math.max(nx, ny);
    }));

    return {
      enunciado: '¿Qué figura se forma al unir estas piezas?',

      dibujarPrincipal(canvas, ancho) {
        const dims = piezasVista.map((p) => ({
          nx: Math.max(...p.map((c) => c[0])) + 1,
          ny: Math.max(...p.map((c) => c[1])) + 1,
        }));
        const sep = 26; // hueco entre piezas, donde va el signo +
        const sumaNx = dims.reduce((s, dim) => s + dim.nx, 0);
        const maxNy = Math.max(...dims.map((dim) => dim.ny));
        const tamCelda = Math.min(
          (ancho * 0.94 - sep * (piezasVista.length - 1)) / sumaNx,
          42,
          (ancho * 0.5) / maxNy
        );
        const alto = Math.round(maxNy * tamCelda + 26);
        const ctx = U.prepararCanvas(canvas, ancho, alto);

        const anchoTotal = sumaNx * tamCelda + sep * (piezasVista.length - 1);
        let x = (ancho - anchoTotal) / 2;
        piezasVista.forEach((p, i) => {
          const w = dims[i].nx * tamCelda;
          P.dibujarCeldas(ctx, p, x + w / 2, alto / 2, tamCelda, color);
          if (i < piezasVista.length - 1) {
            ctx.fillStyle = '#9aa4bd';
            ctx.font = `700 ${Math.round(Math.max(14, tamCelda * 0.6))}px -apple-system, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+', x + w + sep / 2, alto / 2);
          }
          x += w + sep;
        });
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
    id: 'ensamblaje',
    nombre: 'Unir piezas',
    generar,
  });
})();
