/*
 * storage.js — Persistencia del progreso con localStorage.
 *
 * Guarda dos datos: el nivel con el que empezará la próxima sesión y el
 * récord (nivel máximo alcanzado). Todo va envuelto en try/catch: si
 * localStorage no está disponible (modo privado, restricciones de
 * file://...), el juego funciona igual pero sin recordar el progreso.
 */
window.Synapsis = window.Synapsis || {};

Synapsis.almacen = (function () {
  const CLAVE = 'synapsis.progreso';

  /** Progreso guardado, o valores iniciales si no hay nada (o no es válido). */
  function cargar() {
    try {
      const crudo = localStorage.getItem(CLAVE);
      const datos = crudo ? JSON.parse(crudo) : null;
      const valido = (n) => Number.isInteger(n) && n >= 1;
      return {
        nivel: datos && valido(datos.nivel) ? datos.nivel : 1,
        record: datos && valido(datos.record) ? datos.record : 1,
      };
    } catch (e) {
      return { nivel: 1, record: 1 };
    }
  }

  function guardar(nivel, record) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ nivel, record }));
    } catch (e) { /* sin persistencia: el juego sigue funcionando */ }
  }

  function borrar() {
    try {
      localStorage.removeItem(CLAVE);
    } catch (e) { /* nada que borrar */ }
  }

  return { cargar, guardar, borrar };
})();
