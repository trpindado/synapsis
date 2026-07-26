/*
 * difficulty.js — Fórmulas de dificultad continua.
 *
 * La "dificultad" que reciben los generadores es simplemente el nivel
 * actual del jugador (1, 2, 3, ... sin tope). Cada generador la traduce
 * a sus propios parámetros (nº de elementos, sutileza del patrón, nº de
 * opciones, etc.) usando estas curvas suaves, de modo que la progresión
 * es continua y no hay niveles predefinidos.
 */
window.Synapsis = window.Synapsis || {};

Synapsis.dif = (function () {

  /**
   * Curva de saturación: crece suavemente desde `min` (en d = 1) hacia
   * `max` (asíntota) a un ritmo controlado por `ritmo` (cuanto mayor,
   * más lenta la subida). Ideal para parámetros acotados, p. ej. el
   * número de opciones de respuesta.
   */
  function sat(d, min, max, ritmo) {
    return min + (max - min) * (1 - Math.exp(-(d - 1) / ritmo));
  }

  /** Versión entera de sat(), para cantidades discretas. */
  function satEntera(d, min, max, ritmo) {
    return Math.round(sat(d, min, max, ritmo));
  }

  /**
   * Probabilidad logística: ~0 muy por debajo de `umbral`, ~0.5 en el
   * umbral y ~1 muy por encima. Sirve para introducir gradualmente
   * mecánicas nuevas (patrones más sutiles, distractores más parecidos...)
   * sin un corte brusco de nivel.
   */
  function prob(d, umbral, suavidad = 2) {
    return 1 / (1 + Math.exp(-(d - umbral) / suavidad));
  }

  /** Lanza una moneda con la probabilidad logística anterior. */
  function activo(d, umbral, suavidad = 2) {
    return Math.random() < prob(d, umbral, suavidad);
  }

  /**
   * Crecimiento sin tope: parte de `base` y suma un elemento cada
   * `cada` niveles (con redondeo hacia abajo). Para parámetros que
   * deben seguir creciendo indefinidamente.
   */
  function creciente(d, base, cada) {
    return base + Math.floor((d - 1) / cada);
  }

  /**
   * Número de opciones de respuesta estándar: 4 al principio y sube
   * suavemente hasta 6. Compartido para que todos los ejercicios
   * escalen igual.
   */
  function numOpciones(d) {
    return Math.min(6, satEntera(d, 4, 6.4, 7));
  }

  return { sat, satEntera, prob, activo, creciente, numOpciones };
})();
