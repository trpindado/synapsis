/*
 * generators/cutout.js — Figura recortada.
 *
 * Una figura geométrica maciza (círculo o polígono regular, con
 * orientación aleatoria) a la que le falta un sector con vértice en el
 * centro. El usuario elige el trozo que completa la figura EXACTAMENTE
 * tal cual se muestra (sin girarlo).
 *
 * Cada pieza se materializa como una lista de puntos (vértice central +
 * frontera de la figura entre los dos ángulos de corte). La clave de
 * comparación es esa lista redondeada y ordenada: dos piezas con la
 * misma clave son visualmente idénticas, así que los distractores
 * (girado, espejado, ángulo distinto) se deduplican con seguridad
 * aunque la figura tenga simetrías (p. ej. el espejo de un sector de
 * círculo con bisectriz vertical es él mismo, y se descarta solo).
 *
 * Escalado con la dificultad d:
 *   - más formas (pentágono, octógono) y más aperturas de sector
 *   - distractores girados solo unos grados (más sutiles)
 *   - nº de opciones (Synapsis.dif.numOpciones)
 */
(function () {
  const U = Synapsis.utils;
  const D = Synapsis.dif;

  const TAU = Math.PI * 2;
  const RAD = TAU / 360;

  /** Radio de la frontera en el ángulo `a` (radio unidad; n = 0 es círculo). */
  function radioEn(n, phi0, a) {
    if (n === 0) return 1;
    const paso = TAU / n;
    const rel = (((a - phi0) % paso) + paso) % paso;
    return Math.cos(Math.PI / n) / Math.cos(rel - Math.PI / n);
  }

  /**
   * Puntos de la frontera desde el ángulo a1 hasta a2 (a2 > a1).
   * Para polígonos basta con los extremos y los vértices intermedios
   * (los lados son rectos); el círculo se muestrea cada 6°.
   */
  function frontera(n, phi0, a1, a2) {
    const angulos = [a1];
    if (n === 0) {
      const paso = 6 * RAD;
      for (let a = Math.ceil(a1 / paso) * paso; a < a2 - 1e-9; a += paso) {
        if (a > a1 + 1e-9) angulos.push(a);
      }
    } else {
      const paso = TAU / n;
      for (let k = Math.ceil((a1 - phi0) / paso - 1e-9); phi0 + k * paso < a2 - 1e-9; k++) {
        const v = phi0 + k * paso;
        if (v > a1 + 1e-9) angulos.push(v);
      }
    }
    angulos.push(a2);
    return angulos.map((a) => {
      const r = radioEn(n, phi0, a);
      return [r * Math.cos(a), r * Math.sin(a)];
    });
  }

  /** Traza el polígono `puntos` (coordenadas de radio unidad) en el canvas. */
  function trazar(ctx, puntos, cx, cy, escala) {
    ctx.beginPath();
    puntos.forEach(([x, y], i) => {
      const px = cx + x * escala;
      const py = cy + y * escala;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }

  /** Clave visual: puntos redondeados y ordenados (semántica de conjunto). */
  function clavePieza(puntos) {
    return JSON.stringify(
      puntos
        .map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])
        .sort((p, q) => p[0] - q[0] || p[1] - q[1])
    );
  }

  function generar(d) {
    // Forma base: círculo, cuadrado y hexágono; luego pentágono y octógono.
    const formas = [0, 4, 6];
    if (D.activo(d, 6)) formas.push(5, 8);
    const n = U.elegir(formas);
    const phi0 = U.enteroAleatorio(0, 71) * 5 * RAD; // orientación de la forma

    // Apertura del sector recortado (en grados, siempre múltiplos de 5).
    const aperturas = [60, 90, 120];
    if (D.activo(d, 7)) aperturas.push(45, 75, 105, 135);
    if (D.activo(d, 11)) aperturas.push(30, 140, 150);
    const grados = U.elegir(aperturas);
    const a1 = U.enteroAleatorio(0, 71) * 5 * RAD; // posición del corte
    const theta = grados * RAD;
    const a2 = a1 + theta;

    /** Pieza como lista de puntos: vértice central + frontera del sector. */
    function pieza(desde, gradosApertura, espejo) {
      let puntos = [[0, 0], ...frontera(n, phi0, desde, desde + gradosApertura * RAD)];
      if (espejo) puntos = puntos.map(([x, y]) => [-x, y]);
      return puntos;
    }

    const correcta = pieza(a1, grados, false);
    const usadas = new Set([clavePieza(correcta)]);
    const distractores = [];

    function proponer() {
      const tipos = ['giro', 'espejo', 'angulo'];
      if (D.activo(d, 12)) tipos.push('giro-fino'); // girado solo unos grados
      switch (U.elegir(tipos)) {
        case 'giro':      // el trozo correcto pero girado
          return pieza(a1 + U.elegir([45, 90, 135, 180, 225, 270]) * RAD, grados, false);
        case 'giro-fino':
          return pieza(a1 + U.elegir([-30, -25, -20, 20, 25, 30]) * RAD, grados, false);
        case 'espejo':    // el trozo reflejado (y quizá girado)
          return pieza(a1 + U.elegir([0, 0, 45, 90, -45]) * RAD, grados, true);
        case 'angulo': {  // demasiado ancho o demasiado estrecho
          const nuevos = grados + U.elegir([-40, -30, -25, -20, 20, 25, 30, 40]);
          if (nuevos < 25 || nuevos > 160) return null;
          return pieza(a1, nuevos, false);
        }
      }
    }

    const numOpciones = D.numOpciones(d);
    let intentos = 0;
    while (distractores.length < numOpciones - 1 && intentos < 250) {
      intentos++;
      const candidata = proponer();
      if (!candidata) continue;
      const k = clavePieza(candidata);
      if (usadas.has(k)) continue;
      usadas.add(k);
      distractores.push(candidata);
    }

    // Relleno determinista por si el azar no reúne suficientes (giros a
    // posiciones nuevas siempre producen piezas distintas).
    for (let g = 15; g < 360 && distractores.length < numOpciones - 1; g += 15) {
      const candidata = pieza(a1 + g * RAD, grados, false);
      const k = clavePieza(candidata);
      if (usadas.has(k)) continue;
      usadas.add(k);
      distractores.push(candidata);
    }

    const opciones = U.mezclar([
      { puntos: correcta, correcta: true },
      ...distractores.map((puntos) => ({ puntos })),
    ]);
    const indiceCorrecto = opciones.findIndex((o) => o.correcta);
    const color = U.elegir(U.PALETA);

    return {
      enunciado: '¿Qué trozo completa la figura? (sin girarlo)',

      dibujarPrincipal(canvas, ancho) {
        const R = Math.min(ancho * 0.36, 150);
        const alto = Math.round(2 * R + 30);
        const ctx = U.prepararCanvas(canvas, ancho, alto);
        const cx = ancho / 2;
        const cy = alto / 2;

        // La figura sin el trozo: frontera desde a2 hasta a1 (dando la vuelta).
        trazar(ctx, [[0, 0], ...frontera(n, phi0, a2, a1 + TAU)], cx, cy, R);
        ctx.fillStyle = color;
        ctx.fill();

        // El hueco: relleno tenue + contorno discontinuo.
        const hueco = [[0, 0], ...frontera(n, phi0, a1, a2)];
        trazar(ctx, hueco, cx, cy, R);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fill();
        ctx.strokeStyle = '#9aa4bd';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // "?" sobre la bisectriz del hueco.
        const b = a1 + theta / 2;
        const rb = radioEn(n, phi0, b) * 0.55 * R;
        U.dibujarInterrogante(ctx, cx + Math.cos(b) * rb, cy + Math.sin(b) * rb, R * 0.3);
      },

      opciones: opciones.map((op) => ({
        dibujar(canvas, tam) {
          const ctx = U.prepararCanvas(canvas, tam, tam);
          // Centrado por el cuadro delimitador, misma escala en todas las
          // opciones para que el tamaño no delate la correcta.
          const xs = op.puntos.map((p) => p[0]);
          const ys = op.puntos.map((p) => p[1]);
          const mx = (Math.min(...xs) + Math.max(...xs)) / 2;
          const my = (Math.min(...ys) + Math.max(...ys)) / 2;
          trazar(ctx, op.puntos.map(([x, y]) => [x - mx, y - my]), tam / 2, tam / 2, tam * 0.34);
          ctx.fillStyle = color;
          ctx.fill();
        },
      })),

      indiceCorrecto,
    };
  }

  Synapsis.registry.registrar({
    id: 'recorte',
    nombre: 'Figura recortada',
    generar,
  });
})();
