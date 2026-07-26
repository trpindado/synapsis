/*
 * utils.js — Funciones auxiliares compartidas por todos los módulos:
 * aleatoriedad y primitivas de dibujo en canvas.
 *
 * Todo el proyecto vive bajo el espacio de nombres global `Synapsis`
 * (scripts clásicos, sin módulos ES, para que funcione abriendo
 * index.html directamente desde el disco sin servidor).
 */
window.Synapsis = window.Synapsis || {};

Synapsis.utils = (function () {

  /* ---------------- Aleatoriedad ---------------- */

  /** Entero aleatorio en [min, max], ambos incluidos. */
  function enteroAleatorio(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** Elemento aleatorio de una lista. */
  function elegir(lista) {
    return lista[Math.floor(Math.random() * lista.length)];
  }

  /** Copia barajada de una lista (Fisher-Yates). */
  function mezclar(lista) {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** n elementos distintos elegidos al azar de una lista. */
  function muestra(lista, n) {
    return mezclar(lista).slice(0, n);
  }

  /* ---------------- Canvas ---------------- */

  /**
   * Ajusta un canvas a un tamaño CSS dado teniendo en cuenta la densidad
   * de píxeles del dispositivo (para que se vea nítido en móvil) y
   * devuelve su contexto 2D ya escalado y limpio.
   * Todas las coordenadas de dibujo posteriores se expresan en px CSS.
   */
  function prepararCanvas(canvas, anchoCss, altoCss) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(anchoCss * dpr);
    canvas.height = Math.round(altoCss * dpr);
    canvas.style.width = anchoCss + 'px';
    canvas.style.height = altoCss + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, anchoCss, altoCss);
    return ctx;
  }

  /* Paleta de colores bien diferenciables entre sí (también pensada
     para fondo oscuro). Los generadores eligen subconjuntos de aquí. */
  const PALETA = ['#e63946', '#4f8ef7', '#2ecc71', '#f4a261', '#a06df7', '#00c2cb'];

  /* Formas disponibles para dibujarForma(). */
  const FORMAS = ['circulo', 'cuadrado', 'triangulo', 'rombo', 'estrella', 'cruz', 'hexagono'];

  /** Polígono regular de n lados inscrito en un círculo de radio r. */
  function trazarPoligono(ctx, n, r, anguloInicial) {
    for (let i = 0; i < n; i++) {
      const a = anguloInicial + (i * 2 * Math.PI) / n;
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }

  /** Estrella de 5 puntas (alterna radio exterior e interior). */
  function trazarEstrella(ctx, r) {
    for (let i = 0; i < 10; i++) {
      const radio = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = radio * Math.cos(a);
      const y = radio * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }

  /** Cruz (signo +) inscrita en un círculo de radio r. */
  function trazarCruz(ctx, r) {
    const s = r * 0.36; // semiancho del brazo
    const p = [
      [-s, -r], [s, -r], [s, -s], [r, -s], [r, s], [s, s],
      [s, r], [-s, r], [-s, s], [-r, s], [-r, -s], [-s, -s],
    ];
    p.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  }

  /**
   * Dibuja una forma centrada en (x, y) con un radio aproximado `radio`,
   * color de relleno `color` y rotación opcional en radianes.
   */
  function dibujarForma(ctx, forma, x, y, radio, color, rotacion = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotacion);
    ctx.fillStyle = color;
    ctx.beginPath();
    switch (forma) {
      case 'circulo':   ctx.arc(0, 0, radio, 0, Math.PI * 2); break;
      case 'cuadrado': { const l = radio * 1.7; ctx.rect(-l / 2, -l / 2, l, l); break; }
      case 'triangulo': trazarPoligono(ctx, 3, radio, -Math.PI / 2); break;
      case 'rombo':     trazarPoligono(ctx, 4, radio, -Math.PI / 2); break;
      case 'estrella':  trazarEstrella(ctx, radio); break;
      case 'cruz':      trazarCruz(ctx, radio); break;
      case 'hexagono':  trazarPoligono(ctx, 6, radio, 0); break;
      default: ctx.arc(0, 0, radio, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Dibuja un "?" centrado, usado para la casilla/término desconocido. */
  function dibujarInterrogante(ctx, x, y, tam) {
    ctx.save();
    ctx.fillStyle = '#9aa4bd';
    ctx.font = `700 ${tam}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y);
    ctx.restore();
  }

  /**
   * Dibuja texto centrado reduciendo el tamaño de fuente hasta que quepa
   * en `anchoMax`. Útil para las series numéricas con números grandes.
   */
  function dibujarTextoAjustado(ctx, texto, x, y, anchoMax, tamInicial, color) {
    ctx.save();
    let tam = tamInicial;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    do {
      ctx.font = `700 ${tam}px -apple-system, sans-serif`;
      tam -= 1;
    } while (ctx.measureText(texto).width > anchoMax && tam > 8);
    ctx.fillStyle = color;
    ctx.fillText(texto, x, y);
    ctx.restore();
  }

  return {
    enteroAleatorio,
    elegir,
    mezclar,
    muestra,
    prepararCanvas,
    dibujarForma,
    dibujarInterrogante,
    dibujarTextoAjustado,
    PALETA,
    FORMAS,
  };
})();
