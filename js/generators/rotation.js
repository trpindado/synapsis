/*
 * generators/rotation.js — Rotación espacial de figuras 2D.
 *
 * Se genera un poliominó aleatorio (figura formada por casillas
 * cuadradas conectadas) garantizando que sea asimétrico respecto a la
 * reflexión: así su imagen especular NUNCA coincide con ninguna
 * rotación de la figura y puede usarse como distractor legítimo.
 *
 * Opciones:
 *   - Correcta: la misma figura rotada.
 *   - Distractores: la figura reflejada (espejo) rotada, y variantes
 *     con una casilla movida de sitio, también rotadas.
 *
 * Escalado con la dificultad d:
 *   - nº de casillas de la figura: 4 y creciendo (más carga espacial)
 *   - ángulos: múltiplos de 90° al principio, de 45° después
 *   - más opciones y más distractores tipo "espejo" (los más difíciles)
 */
(function () {
  const U = Synapsis.utils;
  const D = Synapsis.dif;

  /* ---------- Geometría de poliominós (listas de celdas [x, y]) ---------- */

  /** Traslada la figura para que su esquina mínima sea (0,0) y la ordena,
      de modo que dos figuras congruentes por traslación tengan la misma clave. */
  function normalizar(celdas) {
    const minX = Math.min(...celdas.map((c) => c[0]));
    const minY = Math.min(...celdas.map((c) => c[1]));
    return celdas
      .map(([x, y]) => [x - minX, y - minY])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }

  const clave = (celdas) => JSON.stringify(normalizar(celdas));
  const rotar90 = (celdas) => celdas.map(([x, y]) => [y, -x]);
  const espejar = (celdas) => celdas.map(([x, y]) => [-x, y]);

  /** Claves de las 4 rotaciones de una figura (su "identidad" salvo giro). */
  function clavesRotaciones(celdas) {
    const claves = new Set();
    let actual = celdas;
    for (let i = 0; i < 4; i++) {
      claves.add(clave(actual));
      actual = rotar90(actual);
    }
    return claves;
  }

  /** true si ninguna rotación del espejo coincide con la figura original. */
  function esAsimetrica(celdas) {
    const original = clavesRotaciones(celdas);
    const reflejo = clavesRotaciones(espejar(celdas));
    return [...reflejo].every((k) => !original.has(k));
  }

  /** Poliominó aleatorio de n casillas, asimétrico respecto al espejo. */
  function generarFigura(n) {
    for (let intento = 0; intento < 300; intento++) {
      const celdas = [[0, 0]];
      const ocupadas = new Set(['0,0']);
      let atascos = 0;
      while (celdas.length < n && atascos < 200) {
        const [bx, by] = U.elegir(celdas);
        const [dx, dy] = U.elegir([[1, 0], [-1, 0], [0, 1], [0, -1]]);
        const k = (bx + dx) + ',' + (by + dy);
        if (ocupadas.has(k)) { atascos++; continue; }
        ocupadas.add(k);
        celdas.push([bx + dx, by + dy]);
      }
      if (celdas.length === n && esAsimetrica(celdas)) return normalizar(celdas);
    }
    // Último recurso (no debería llegar aquí): pentominó en L, asimétrico.
    return normalizar([[0, 0], [0, 1], [0, 2], [0, 3], [1, 0]]);
  }

  /**
   * Variante con una casilla movida: quita una casilla "hoja" (con un solo
   * vecino, para no romper la conexión) y añade otra en un borde distinto.
   * Se garantiza que el resultado no es congruente por rotación ni con la
   * figura original ni con su espejo.
   */
  function moverCasilla(celdas, clavesProhibidas) {
    const ocupadas = new Set(celdas.map(([x, y]) => x + ',' + y));
    const vecinos = ([x, y]) =>
      [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => ocupadas.has((x + dx) + ',' + (y + dy))).length;

    for (let intento = 0; intento < 120; intento++) {
      const hojas = celdas.filter((c) => vecinos(c) === 1);
      if (!hojas.length) return null;
      const quitada = U.elegir(hojas);
      const resto = celdas.filter((c) => c !== quitada);

      // Nueva casilla pegada a una celda restante, en un hueco libre.
      const [bx, by] = U.elegir(resto);
      const [dx, dy] = U.elegir([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const nueva = [bx + dx, by + dy];
      const kNueva = nueva[0] + ',' + nueva[1];
      if (ocupadas.has(kNueva) || (nueva[0] === quitada[0] && nueva[1] === quitada[1])) continue;

      const candidata = normalizar([...resto, nueva]);
      const claves = clavesRotaciones(candidata);
      if ([...claves].every((k) => !clavesProhibidas.has(k))) return candidata;
    }
    return null;
  }

  /* ---------- Dibujo ---------- */

  /** Dibuja la figura centrada en el canvas, rotada `anguloGrados`. */
  function dibujarFigura(ctx, celdas, ancho, alto, anguloGrados, color) {
    const xs = celdas.map((c) => c[0]);
    const ys = celdas.map((c) => c[1]);
    const nx = Math.max(...xs) + 1;
    const ny = Math.max(...ys) + 1;
    // La diagonal del bounding box debe caber en el canvas a cualquier ángulo.
    const diagonal = Math.hypot(nx, ny);
    const tamCelda = Math.min(ancho, alto) * 0.86 / diagonal;

    ctx.save();
    ctx.translate(ancho / 2, alto / 2);
    ctx.rotate((anguloGrados * Math.PI) / 180);
    ctx.translate(-(nx * tamCelda) / 2, -(ny * tamCelda) / 2);
    for (const [x, y] of celdas) {
      ctx.fillStyle = color;
      ctx.fillRect(x * tamCelda, y * tamCelda, tamCelda, tamCelda);
      ctx.strokeStyle = 'rgba(16,20,31,0.55)'; // junta entre casillas
      ctx.lineWidth = 1;
      ctx.strokeRect(x * tamCelda + 0.5, y * tamCelda + 0.5, tamCelda - 1, tamCelda - 1);
    }
    ctx.restore();
  }

  /* ---------- Generación del ejercicio ---------- */

  function generar(d) {
    // Tamaño de la figura: 4 casillas y una más cada ~2.5 niveles (tope 10).
    const numCasillas = Math.min(10, 4 + Math.floor((d - 1) / 2.5));
    const figura = generarFigura(numCasillas);
    const prohibidas = new Set([
      ...clavesRotaciones(figura),
      ...clavesRotaciones(espejar(figura)),
    ]);

    // Ángulos permitidos: giros de 90° al principio, de 45° a dificultad alta.
    const angulos = D.activo(d, 8)
      ? [45, 90, 135, 180, 225, 270, 315]
      : [90, 180, 270];

    const numOpciones = D.numOpciones(d);
    const opcionesDef = [{ celdas: figura, angulo: U.elegir(angulos), correcta: true }];

    // Distractores espejo: 1 siempre; a más dificultad puede haber 2
    // (son los más difíciles de descartar).
    const numEspejos = Math.min(numOpciones - 2, D.activo(d, 6) ? 2 : 1);
    const reflejada = normalizar(espejar(figura));
    for (let i = 0; i < numEspejos; i++) {
      opcionesDef.push({ celdas: reflejada, angulo: U.elegir(angulos) });
    }

    // El resto: variantes con una casilla movida (si no se consigue una
    // variante válida, se recurre a otro espejo con otro ángulo).
    while (opcionesDef.length < numOpciones) {
      const variante = moverCasilla(figura, prohibidas);
      opcionesDef.push({
        celdas: variante || reflejada,
        angulo: U.elegir(angulos),
      });
    }

    // Evitar dos opciones idénticas (misma figura Y mismo ángulo).
    const vistas = new Set();
    for (const op of opcionesDef) {
      let firma = clave(op.celdas) + '@' + op.angulo;
      let vueltas = 0;
      while (vistas.has(firma) && vueltas < 12) {
        op.angulo = U.elegir(angulos);
        firma = clave(op.celdas) + '@' + op.angulo;
        vueltas++;
      }
      vistas.add(firma);
    }

    const opcionesMezcladas = U.mezclar(opcionesDef);
    const indiceCorrecto = opcionesMezcladas.findIndex((o) => o.correcta);
    const color = U.elegir(U.PALETA);

    return {
      enunciado: '¿Cuál es la misma figura, solo que rotada?',

      dibujarPrincipal(canvas, ancho) {
        const alto = Math.round(ancho * 0.62);
        const ctx = U.prepararCanvas(canvas, ancho, alto);
        dibujarFigura(ctx, figura, ancho, alto, 0, color);
      },

      opciones: opcionesMezcladas.map((op) => ({
        dibujar(canvas, tam) {
          const ctx = U.prepararCanvas(canvas, tam, tam);
          dibujarFigura(ctx, op.celdas, tam, tam, op.angulo, color);
        },
      })),

      indiceCorrecto,
    };
  }

  Synapsis.registry.registrar({
    id: 'rotacion',
    nombre: 'Rotación espacial',
    generar,
  });
})();
