/*
 * poly.js — Geometría compartida de poliominós: figuras formadas por
 * casillas cuadradas [x, y] sobre una retícula entera.
 *
 * La usan los generadores basados en piezas (puzzle.js y assembly.js).
 * rotation.js es anterior y conserva sus propias copias privadas.
 */
window.Synapsis = window.Synapsis || {};

Synapsis.poly = (function () {
  const U = Synapsis.utils;

  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /** Traslada la figura a la esquina (0,0) y la ordena: dos figuras
      congruentes por traslación comparten clave. */
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

  /** Claves de las 4 rotaciones (la "identidad" de la figura salvo giro). */
  function clavesRotaciones(celdas) {
    const claves = new Set();
    let actual = celdas;
    for (let i = 0; i < 4; i++) {
      claves.add(clave(actual));
      actual = rotar90(actual);
    }
    return claves;
  }

  /** Las rotaciones distintas de la figura, ya normalizadas. */
  function rotacionesUnicas(celdas) {
    const vistas = new Set();
    const resultado = [];
    let actual = celdas;
    for (let i = 0; i < 4; i++) {
      const k = clave(actual);
      if (!vistas.has(k)) {
        vistas.add(k);
        resultado.push(normalizar(actual));
      }
      actual = rotar90(actual);
    }
    return resultado;
  }

  /**
   * true si la figura es totalmente asimétrica: sus 4 rotaciones son
   * distintas entre sí Y ninguna coincide con una rotación de su espejo.
   * Garantiza que "girada" y "espejada" son siempre figuras diferentes.
   */
  function esAsimetrica(celdas) {
    const rotaciones = clavesRotaciones(celdas);
    if (rotaciones.size < 4) return false;
    return [...clavesRotaciones(espejar(celdas))].every((k) => !rotaciones.has(k));
  }

  /** true si todas las casillas forman un solo bloque conexo (lado con lado). */
  function esConexa(celdas) {
    if (!celdas.length) return false;
    const pendientes = new Set(celdas.map((c) => c.join(',')));
    const cola = [celdas[0]];
    pendientes.delete(celdas[0].join(','));
    while (cola.length) {
      const [x, y] = cola.pop();
      for (const [dx, dy] of DIRS4) {
        const k = (x + dx) + ',' + (y + dy);
        if (pendientes.has(k)) {
          pendientes.delete(k);
          cola.push([x + dx, y + dy]);
        }
      }
    }
    return pendientes.size === 0;
  }

  /** Poliominó aleatorio de n casillas por crecimiento desde el origen. */
  function generarPoliomino(n) {
    for (;;) {
      const celdas = [[0, 0]];
      const ocupadas = new Set(['0,0']);
      let atascos = 0;
      while (celdas.length < n && atascos < 250) {
        const [bx, by] = U.elegir(celdas);
        const [dx, dy] = U.elegir(DIRS4);
        const k = (bx + dx) + ',' + (by + dy);
        if (ocupadas.has(k)) { atascos++; continue; }
        ocupadas.add(k);
        celdas.push([bx + dx, by + dy]);
      }
      if (celdas.length === n) return normalizar(celdas);
    }
  }

  /**
   * Variante con una casilla movida: quita una casilla "hoja" (un solo
   * vecino, para no romper la conexión) y añade otra en un hueco
   * adyacente distinto. Devuelve null si no lo consigue.
   */
  function moverCasilla(celdas) {
    const ocupadas = new Set(celdas.map((c) => c.join(',')));
    const grados = ([x, y]) =>
      DIRS4.filter(([dx, dy]) => ocupadas.has((x + dx) + ',' + (y + dy))).length;

    for (let intento = 0; intento < 80; intento++) {
      const hojas = celdas.filter((c) => grados(c) === 1);
      if (!hojas.length) return null;
      const quitada = U.elegir(hojas);
      const resto = celdas.filter((c) => c !== quitada);

      const [bx, by] = U.elegir(resto);
      const [dx, dy] = U.elegir(DIRS4);
      const nueva = [bx + dx, by + dy];
      const kNueva = nueva.join(',');
      if (ocupadas.has(kNueva) || kNueva === quitada.join(',')) continue;
      return normalizar([...resto, nueva]);
    }
    return null;
  }

  /** Dibuja las casillas centradas en (cx, cy) con casillas de `tamCelda` px. */
  function dibujarCeldas(ctx, celdas, cx, cy, tamCelda, color) {
    const norm = normalizar(celdas);
    const nx = Math.max(...norm.map((c) => c[0])) + 1;
    const ny = Math.max(...norm.map((c) => c[1])) + 1;
    const ox = cx - (nx * tamCelda) / 2;
    const oy = cy - (ny * tamCelda) / 2;
    for (const [x, y] of norm) {
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * tamCelda, oy + y * tamCelda, tamCelda, tamCelda);
      ctx.strokeStyle = 'rgba(16,20,31,0.55)'; // junta entre casillas
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + x * tamCelda + 0.5, oy + y * tamCelda + 0.5, tamCelda - 1, tamCelda - 1);
    }
  }

  return {
    DIRS4,
    normalizar,
    clave,
    rotar90,
    espejar,
    clavesRotaciones,
    rotacionesUnicas,
    esAsimetrica,
    esConexa,
    generarPoliomino,
    moverCasilla,
    dibujarCeldas,
  };
})();
