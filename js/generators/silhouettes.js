/*
 * generators/silhouettes.js — Completar la silueta.
 *
 * Una silueta reconocible (animales y objetos, dibujados a mano como
 * polígonos) a la que se le recorta un trozo con una línea recta. El
 * usuario elige la pieza que completa la silueta EXACTAMENTE tal cual
 * se muestra (sin girarla).
 *
 * El corte se valida: la línea debe cruzar el contorno exactamente dos
 * veces (así ni la pieza ni el resto quedan partidos en dos) y la pieza
 * debe ser una fracción razonable de la figura. Los distractores son la
 * pieza girada, espejada u OTRO trozo de la misma silueta con área
 * parecida, y se deduplican por su geometría real de puntos (como en
 * el generador de figura recortada).
 *
 * Escalado con la dificultad d:
 *   - piezas más pequeñas (menos contexto en el trozo)
 *   - giros más sutiles en los distractores
 *   - nº de opciones (Synapsis.dif.numOpciones)
 */
(function () {
  const U = Synapsis.utils;
  const D = Synapsis.dif;

  const RAD = Math.PI / 180;

  /* Siluetas dibujadas a mano sobre un lienzo 0-100 con la Y hacia
     abajo (revisadas visualmente una a una). Para añadir una nueva
     basta con sumar aquí su polígono. */
  const SILUETAS = {
    pez: [[78,50],[70,38],[58,31],[50,19],[39,22],[43,31],[31,37],[25,46],[13,33],[17,50],[13,67],[25,54],[31,62],[43,69],[58,69],[70,62]],
    pato: [[8,24],[22,20],[28,12],[36,14],[38,24],[38,40],[50,42],[64,40],[80,32],[74,50],[60,60],[42,62],[28,56],[20,46],[24,34],[8,30]],
    pajaro: [[12,30],[20,22],[30,18],[38,22],[40,32],[52,40],[66,50],[88,74],[74,72],[80,84],[62,78],[48,74],[34,68],[26,58],[24,44],[14,36]],
    tortuga: [[16,62],[22,44],[36,32],[54,30],[68,36],[78,48],[80,58],[88,52],[95,56],[95,64],[86,68],[78,66],[74,74],[64,74],[62,66],[50,66],[46,74],[36,74],[34,66],[24,66],[14,70],[12,64]],
    corazon: [[50,88],[20,54],[12,38],[18,24],[32,19],[45,26],[50,36],[55,26],[68,19],[82,24],[88,38],[80,54]],
    arbol: [[50,6],[67,30],[59,30],[75,52],[65,52],[83,76],[57,76],[57,92],[43,92],[43,76],[17,76],[35,52],[25,52],[41,30],[33,30]],
    cohete: [[50,4],[62,18],[66,38],[66,62],[79,82],[62,74],[58,74],[60,88],[40,88],[42,74],[38,74],[21,82],[34,62],[34,38],[38,18]],
    casa: [[15,92],[15,55],[7,55],[50,14],[93,55],[85,55],[85,92],[61,92],[61,68],[39,68],[39,92]],
  };

  /* ---------- Geometría de polígonos ---------- */

  /** Centra la silueta en (0,0) y la escala a dimensión máxima 1. */
  function normalizada(poly) {
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const esc = 1 / Math.max(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys)
    );
    return poly.map(([x, y]) => [(x - cx) * esc, (y - cy) * esc]);
  }

  /** Área (fórmula del cordón, en valor absoluto). */
  function area(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a) / 2;
  }

  /** Centroide del polígono (para girar la pieza y colocar el "?"). */
  function centroide(poly) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const f = x1 * y2 - x2 * y1;
      a += f;
      cx += (x1 + x2) * f;
      cy += (y1 + y2) * f;
    }
    a *= 3;
    return a ? [cx / a, cy / a] : poly[0];
  }

  /**
   * Recorte de Sutherland-Hodgman contra un semiplano: conserva la
   * parte del polígono con lado * (p·n - c) >= 0.
   */
  function recortar(poly, n, c, lado) {
    const res = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const da = (a[0] * n[0] + a[1] * n[1] - c) * lado;
      const db = (b[0] * n[0] + b[1] * n[1] - c) * lado;
      if (da >= 0) res.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        res.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    return res;
  }

  const rotada = (poly, cx, cy, grados) => {
    const cos = Math.cos(grados * RAD);
    const sen = Math.sin(grados * RAD);
    return poly.map(([x, y]) => [
      cx + (x - cx) * cos - (y - cy) * sen,
      cy + (x - cx) * sen + (y - cy) * cos,
    ]);
  };

  const espejada = (poly, cx) => poly.map(([x, y]) => [2 * cx - x, y]);

  /** Clave visual: puntos redondeados y ordenados relativos al centroide. */
  function clavePieza(poly) {
    const [cx, cy] = centroide(poly);
    return JSON.stringify(
      poly
        .map(([x, y]) => [Math.round((x - cx) * 1000) / 1000, Math.round((y - cy) * 1000) / 1000])
        .sort((p, q) => p[0] - q[0] || p[1] - q[1])
    );
  }

  /**
   * Busca un corte recto válido: la línea cruza el contorno exactamente
   * dos veces (pieza y resto de una sola pieza cada uno) y la pieza
   * ocupa una fracción del área en [frMin, frMax].
   */
  function buscarCorte(silueta, frMin, frMax) {
    const total = area(silueta);

    function probar(anguloGrados, f, min, max) {
      const n = [Math.cos(anguloGrados * RAD), Math.sin(anguloGrados * RAD)];
      const proys = silueta.map(([x, y]) => x * n[0] + y * n[1]);
      const mn = Math.min(...proys);
      const mx = Math.max(...proys);
      const c = mn + f * (mx - mn);
      // Ni rozando un vértice (cortes degenerados)...
      if (proys.some((p) => Math.abs(p - c) < 0.015 * (mx - mn))) return null;
      // ...ni cruzando el contorno más de dos veces (partiría la pieza).
      let cruces = 0;
      for (let i = 0; i < proys.length; i++) {
        if ((proys[i] > c) !== (proys[(i + 1) % proys.length] > c)) cruces++;
      }
      if (cruces !== 2) return null;
      let pieza = recortar(silueta, n, c, 1);
      let resto = recortar(silueta, n, c, -1);
      if (area(pieza) > area(resto)) [pieza, resto] = [resto, pieza];
      const frac = area(pieza) / total;
      if (frac < min || frac > max || pieza.length < 3) return null;
      // La pieza debe ser un trozo compacto, no una tira fina de lado
      // a lado (ilegible en las opciones pequeñas).
      const pxs = pieza.map((p) => p[0]);
      const pys = pieza.map((p) => p[1]);
      const pbw = Math.max(...pxs) - Math.min(...pxs);
      const pbh = Math.max(...pys) - Math.min(...pys);
      if (Math.min(pbw, pbh) < 0.32 * Math.max(pbw, pbh)) return null;
      if (Math.max(pbw, pbh) > 0.8) return null;
      return { pieza, resto };
    }

    for (let intento = 0; intento < 120; intento++) {
      const corte = probar(U.enteroAleatorio(0, 11) * 15, U.enteroAleatorio(20, 80) / 100, frMin, frMax);
      if (corte) return corte;
    }
    // Barrido sistemático como red de seguridad (criterio algo más laxo).
    for (let ang = 0; ang < 180; ang += 15) {
      for (let f = 20; f <= 80; f += 5) {
        const corte = probar(ang, f / 100, Math.max(0.1, frMin - 0.06), Math.min(0.5, frMax + 0.06));
        if (corte) return corte;
      }
    }
    return null;
  }

  /* ---------- Dibujo ---------- */

  function trazar(ctx, puntos, cx, cy, escala) {
    ctx.beginPath();
    puntos.forEach(([x, y], i) => {
      const px = cx + x * escala;
      const py = cy + y * escala;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }

  /* ---------- Generación del ejercicio ---------- */

  function generar(d) {
    // Piezas más pequeñas (menos contexto) a dificultad alta.
    const frMin = D.activo(d, 9) ? 0.14 : 0.22;
    const frMax = frMin + 0.2;

    const nombres = Object.keys(SILUETAS);
    let silueta = null;
    let corte = null;
    for (let intento = 0; intento < 25 && !corte; intento++) {
      let puntos = normalizada(SILUETAS[U.elegir(nombres)]);
      if (Math.random() < 0.5) puntos = espejada(puntos, 0); // mirando al otro lado
      corte = buscarCorte(puntos, frMin, frMax);
      if (corte) silueta = puntos;
    }
    const { pieza, resto } = corte;
    const cen = centroide(pieza);
    const areaPieza = area(pieza);
    const fracPieza = areaPieza / area(silueta);

    // ---- Distractores ----
    const claveCorrecta = clavePieza(pieza);
    const usadas = new Set([claveCorrecta]);
    const distractores = [];

    function proponer() {
      switch (U.elegir(['giro', 'giro', 'espejo', 'otro-corte'])) {
        case 'giro': {   // la pieza correcta pero girada
          const sutiles = D.activo(d, 10);
          const angulo = U.elegir(sutiles
            ? [15, 20, 25, -15, -20, -25, 45, 90]
            : [45, 90, 135, 180, -45, -90]);
          return rotada(pieza, cen[0], cen[1], angulo);
        }
        case 'espejo':   // la pieza reflejada
          return espejada(pieza, cen[0]);
        case 'otro-corte': { // otro trozo de la misma silueta, de área parecida
          const otro = buscarCorte(silueta, Math.max(0.1, fracPieza * 0.8), Math.min(0.5, fracPieza * 1.25));
          return otro && otro.pieza;
        }
      }
    }

    const numOpciones = D.numOpciones(d);
    let intentos = 0;
    while (distractores.length < numOpciones - 1 && intentos < 150) {
      intentos++;
      const candidata = proponer();
      if (!candidata) continue;
      const k = clavePieza(candidata);
      if (usadas.has(k)) continue;
      usadas.add(k);
      distractores.push(candidata);
    }
    // Relleno determinista: giros a ángulos nuevos nunca se agotan.
    for (let g = 30; g < 360 && distractores.length < numOpciones - 1; g += 30) {
      const candidata = rotada(pieza, cen[0], cen[1], g);
      const k = clavePieza(candidata);
      if (usadas.has(k)) continue;
      usadas.add(k);
      distractores.push(candidata);
    }

    const opciones = U.mezclar([
      { puntos: pieza, correcta: true },
      ...distractores.map((puntos) => ({ puntos })),
    ]);
    const indiceCorrecto = opciones.findIndex((o) => o.correcta);
    const color = U.elegir(U.PALETA);

    // Misma escala en todas las opciones (que el encuadre no delate nada).
    const maxDim = Math.max(...opciones.map((o) => {
      const xs = o.puntos.map((p) => p[0]);
      const ys = o.puntos.map((p) => p[1]);
      return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    }));

    return {
      enunciado: '¿Qué pieza completa la silueta? (sin girarla)',

      dibujarPrincipal(canvas, ancho) {
        const xs = silueta.map((p) => p[0]);
        const ys = silueta.map((p) => p[1]);
        const bw = Math.max(...xs) - Math.min(...xs);
        const bh = Math.max(...ys) - Math.min(...ys);
        const escala = Math.min((ancho * 0.8) / bw, (ancho * 0.72) / bh);
        const alto = Math.round(bh * escala + 30);
        const ctx = U.prepararCanvas(canvas, ancho, alto);
        const cx = ancho / 2;
        const cy = alto / 2;

        // Silueta sin la pieza.
        trazar(ctx, resto, cx, cy, escala);
        ctx.fillStyle = color;
        ctx.fill();

        // El hueco: relleno tenue + contorno discontinuo + "?".
        trazar(ctx, pieza, cx, cy, escala);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fill();
        ctx.strokeStyle = '#9aa4bd';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        U.dibujarInterrogante(ctx, cx + cen[0] * escala, cy + cen[1] * escala,
          Math.min(26, escala * 0.16));
      },

      opciones: opciones.map((op) => ({
        dibujar(canvas, tam) {
          const ctx = U.prepararCanvas(canvas, tam, tam);
          const xs = op.puntos.map((p) => p[0]);
          const ys = op.puntos.map((p) => p[1]);
          const mx = (Math.min(...xs) + Math.max(...xs)) / 2;
          const my = (Math.min(...ys) + Math.max(...ys)) / 2;
          const escala = (tam * 0.72) / maxDim;
          trazar(ctx, op.puntos.map(([x, y]) => [x - mx, y - my]), tam / 2, tam / 2, escala);
          ctx.fillStyle = color;
          ctx.fill();
        },
      })),

      indiceCorrecto,
    };
  }

  Synapsis.registry.registrar({
    id: 'silueta',
    nombre: 'Completar la silueta',
    generar,
  });
})();
