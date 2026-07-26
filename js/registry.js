/*
 * registry.js — Registro central de generadores de ejercicios.
 *
 * Cada tipo de ejercicio es un módulo independiente (js/generators/*.js)
 * que se auto-registra aquí al cargarse. El controlador (main.js) solo
 * conoce este registro, nunca los generadores concretos: para añadir un
 * tipo nuevo basta con crear el archivo del generador y añadir su
 * <script> en index.html.
 *
 * Contrato de un generador:
 *   {
 *     id: 'identificador-unico',
 *     nombre: 'Nombre legible',
 *     generar(dificultad) -> ejercicio
 *   }
 *
 * Contrato de un ejercicio (lo que devuelve generar):
 *   {
 *     enunciado: 'Pregunta que se muestra al usuario',
 *     dibujarPrincipal(canvas, ancho),  // dibuja el estímulo principal;
 *                                       // decide su propia altura
 *     opciones: [ { dibujar(canvas, tam) }, ... ],  // cada opción se
 *                                       // dibuja en un canvas cuadrado
 *     indiceCorrecto: 0                 // índice de la opción correcta
 *   }
 */
window.Synapsis = window.Synapsis || {};

Synapsis.registry = {
  generadores: [],

  /** Registra un generador validando el contrato mínimo. */
  registrar(gen) {
    if (!gen || !gen.id || typeof gen.generar !== 'function') {
      throw new Error('Generador inválido: se espera { id, nombre, generar() }');
    }
    this.generadores.push(gen);
  },

  /**
   * Devuelve un generador al azar. Si se pasa `excluirId` (y hay más de
   * uno registrado), evita repetir el mismo tipo dos rondas seguidas
   * para que la mezcla sea variada.
   */
  aleatorio(excluirId) {
    let candidatos = this.generadores;
    if (excluirId && candidatos.length > 1) {
      candidatos = candidatos.filter((g) => g.id !== excluirId);
    }
    return candidatos[Math.floor(Math.random() * candidatos.length)];
  },
};
