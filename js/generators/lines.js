/*
 * generators/lines.js — Completamiento de figuras de líneas.
 *
 * Serie horizontal de figuras formadas por segmentos sobre una retícula
 * de 3x3 puntos (generados con un paseo aleatorio, para que la figura
 * sea un trazo conexo). Cada paso aplica una regla y el usuario elige
 * la figura que continúa:
 *   - acumular: la figura se va completando, ganando líneas trazo a trazo
 *   - quitar:   la figura pierde líneas paso a paso
 *   - rotar:    la misma figura gira un ángulo fijo en cada paso
 *   - rotar-acumular: ambas cosas a la vez (dificultad alta)
 *
 * Escalado con la dificultad d:
 *   - nº de segmentos y figuras mostradas
 *   - reglas más complejas (quitar → rotar 45° → combinada)
 *   - más opciones y distractores más sutiles (espejo, ángulo erróneo,
 *     un segmento de más/menos, repetir la figura anterior)
 */
(function () {
  const U = Synapsis.utils;
  const D = Synapsis.dif;

  /* ---------- Figuras: listas de segmentos [[x1,y1],[x2,y2]] con
     coordenadas en {-1, 0, 1} (retícula de 3x3 puntos) ---------- */

  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  /** Segmento con extremos en orden canónico (para poder comparar). */
  function normSeg(a, b) {
    const [p, q] = [a, b].sort((u, v) => u[0] - v[0] || u[1] - v[1]);
    return [[...p], [...q]];
  }

  /** Clave visual de una figura: segmentos canónicos + ángulo de render. */
  function claveFigura(segs, angulo) {
    const canon = segs
      .map(([a, b]) => normSeg(a, b))
      .sort((s, t) => (JSON.stringify(s) < JSON.stringify(t) ? -1 : 1));
    return JSON.stringify(canon) + '@' + ((angulo % 360) + 360) % 360;
  }

  const rotar90 = (segs) => segs.map(([a, b]) => normSeg([a[1], -a[0]], [b[1], -b[0]]));
  const espejar = (segs) => segs.map(([a, b]) => normSeg([-a[0], a[1]], [-b[0], b[1]]));

  /**
   * true si la figura no coincide consigo misma girada 90/180/270 ni con
   * ninguna rotación de su espejo. Así los distractores "espejo" y
   * "ángulo erróneo" nunca pueden ser respuestas válidas.
   */
  function esAsimetrica(segs) {
    const claves = new Set();
    let f = segs;
    for (let i = 0; i < 4; i++) { claves.add(claveFigura(f, 0)); f = rotar90(f); }
    if (claves.size < 4) return false; // simetría rotacional
    let m = espejar(segs);
    for (let i = 0; i < 4; i++) {
      if (claves.has(claveFigura(m, 0))) return false; // simetría especular
      m = rotar90(m);
    }
    return true;
  }

  /**
   * Paseo aleatorio por la retícula: k segmentos conexos y sin repetir,
   * en orden de trazado (el orden natural para "ir completando" la figura).
   * Se reintenta hasta lograr una figura asimétrica.
   */
  function generarTrazo(k) {
    let mejor = null;
    for (let intento = 0; intento < 60; intento++) {
      let actual = [U.enteroAleatorio(-1, 1), U.enteroAleatorio(-1, 1)];
      const segs = [];
      const usados = new Set();
      let atascos = 0;
      while (segs.length < k && atascos < 300) {
        const [dx, dy] = U.elegir(DIRS);
        const destino = [actual[0] + dx, actual[1] + dy];
        if (Math.abs(destino[0]) > 1 || Math.abs(destino[1]) > 1) { atascos++; continue; }
        const seg = normSeg(actual, destino);
        const clave = JSON.stringify(seg);
        actual = destino;
        if (usados.has(clave)) { atascos++; continue; }
        usados.add(clave);
        segs.push(seg);
      }
      if (segs.length < k) continue;
      if (esAsimetrica(segs)) return segs;
      mejor = mejor || segs; // por si ninguna sale asimétrica
    }
    return mejor; // último recurso (poco probable con k >= 3)
  }

  /** Todas las aristas de la retícula que la figura no usa (para añadir). */
  function aristasLibres(segs) {
    const usadas = new Set(segs.map(([a, b]) => JSON.stringify(normSeg(a, b))));
    const libres = [];
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          const q = [x + dx, y + dy];
          if (Math.abs(q[0]) > 1 || Math.abs(q[1]) > 1) continue;
          const seg = normSeg([x, y], q);
          if (!usadas.has(JSON.stringify(seg))) libres.push(seg);
        }
      }
    }
    return libres;
  }

  /* ---------- Dibujo ---------- */

  /** Dibuja la figura centrada en (cx, cy), rotada `anguloGrados`. */
  function dibujarFigura(ctx, segs, cx, cy, radio, anguloGrados, color) {
    const esc = radio / 1.5; // el punto (±1,±1) queda dentro incluso girado
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((anguloGrados * Math.PI) / 180);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, radio * 0.11);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const [[x1, y1], [x2, y2]] of segs) {
      ctx.moveTo(x1 * esc, y1 * esc);
      ctx.lineTo(x2 * esc, y2 * esc);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- Generación del ejercicio ---------- */

  function generar(d) {
    const numMostrados = D.activo(d, 7) ? 4 : 3;

    // Reglas disponibles según dificultad (entrada gradual, no por corte).
    const reglas = ['acumular', 'rotar'];
    if (D.activo(d, 5)) reglas.push('quitar');
    if (D.activo(d, 10)) reglas.push('rotar-acumular');
    const regla = U.elegir(reglas);

    const girando = regla.includes('rotar');
    const acumulando = regla !== 'rotar';
    // Ángulo de giro por paso: 90° al principio, también 45°/135° después.
    const anguloPaso = girando ? (D.activo(d, 9) ? U.elegir([45, 90, 135]) : 90) : 0;
    // Segmentos que se añaden/quitan por paso.
    const paso = acumulando && D.activo(d, 6) ? 2 : 1;
    // Tamaño base de la figura (crece sin tope suave, con techo físico de la retícula).
    const base = Math.min(6, D.creciente(d, 2, 4));

    // Total de segmentos que necesita la serie completa.
    const total = regla === 'rotar'
      ? Math.min(9, base + 2)
      : Math.min(11, base + paso * numMostrados);
    const trazo = generarTrazo(total);

    /* Figura i-ésima de la serie (i = numMostrados es la respuesta). */
    function figura(i) {
      let segs = trazo;
      if (regla === 'acumular' || regla === 'rotar-acumular') {
        segs = trazo.slice(0, Math.min(trazo.length, base + i * paso));
      } else if (regla === 'quitar') {
        segs = trazo.slice(0, Math.max(2, trazo.length - i * paso));
      }
      return { segs, angulo: i * anguloPaso };
    }

    const correcta = figura(numMostrados);
    const claveCorrecta = claveFigura(correcta.segs, correcta.angulo);

    // ---- Distractores: variaciones plausibles de la respuesta ----
    const numOpciones = D.numOpciones(d);
    const usadas = new Set([claveCorrecta]);
    const distractores = [];

    function proponer() {
      const tipo = U.elegir(['espejo', 'angulo', 'menos', 'mas', 'anterior']);
      switch (tipo) {
        case 'espejo':   // la figura reflejada (el más difícil de descartar)
          return { segs: espejar(correcta.segs), angulo: correcta.angulo };
        case 'angulo':   // la figura correcta pero girada de más/de menos
          return { segs: correcta.segs, angulo: correcta.angulo + U.elegir([90, 180, 270, anguloPaso || 90]) };
        case 'menos': {  // le falta un trazo
          if (correcta.segs.length <= 2) return null;
          const quitar = U.enteroAleatorio(0, correcta.segs.length - 1);
          return { segs: correcta.segs.filter((_, i) => i !== quitar), angulo: correcta.angulo };
        }
        case 'mas': {    // tiene un trazo de sobra
          const libres = aristasLibres(correcta.segs);
          if (!libres.length) return null;
          return { segs: [...correcta.segs, U.elegir(libres)], angulo: correcta.angulo };
        }
        case 'anterior': // repite la última figura mostrada
          return figura(numMostrados - 1);
      }
    }

    let intentos = 0;
    while (distractores.length < numOpciones - 1 && intentos < 250) {
      intentos++;
      const candidato = proponer();
      if (!candidato) continue;
      const clave = claveFigura(candidato.segs, candidato.angulo);
      if (usadas.has(clave)) continue;
      usadas.add(clave);
      distractores.push(candidato);
    }

    const opciones = U.mezclar([correcta, ...distractores]);
    const indiceCorrecto = opciones.findIndex(
      (o) => claveFigura(o.segs, o.angulo) === claveCorrecta
    );
    const color = U.elegir(U.PALETA);

    return {
      enunciado: '¿Qué figura continúa la serie?',

      dibujarPrincipal(canvas, ancho) {
        const alto = Math.round(ancho * 0.34);
        const ctx = U.prepararCanvas(canvas, ancho, alto);
        const nCasillas = numMostrados + 1; // + la casilla del "?"
        const anchoCasilla = ancho / nCasillas;
        const radio = Math.min(anchoCasilla * 0.4, alto * 0.38);
        for (let i = 0; i < numMostrados; i++) {
          const f = figura(i);
          dibujarFigura(ctx, f.segs, anchoCasilla * (i + 0.5), alto / 2, radio, f.angulo, color);
        }
        // Separador suave antes de la incógnita
        ctx.strokeStyle = '#2a3248';
        ctx.beginPath();
        ctx.moveTo(anchoCasilla * numMostrados, alto * 0.18);
        ctx.lineTo(anchoCasilla * numMostrados, alto * 0.82);
        ctx.stroke();
        U.dibujarInterrogante(ctx, anchoCasilla * (nCasillas - 0.5), alto / 2, radio * 1.6);
      },

      opciones: opciones.map((f) => ({
        dibujar(canvas, tam) {
          const ctx = U.prepararCanvas(canvas, tam, tam);
          dibujarFigura(ctx, f.segs, tam / 2, tam / 2, tam * 0.38, f.angulo, color);
        },
      })),

      indiceCorrecto,
    };
  }

  Synapsis.registry.registrar({
    id: 'lineas',
    nombre: 'Completar figuras',
    generar,
  });
})();
