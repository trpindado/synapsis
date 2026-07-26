/*
 * tests/smoke.js — Pruebas de humo (Node, sin dependencias).
 *
 * Carga los scripts del juego en un entorno simulado (window global y
 * canvas falso) y genera ejercicios en masa con todos los generadores
 * a varias dificultades, comprobando el contrato del registro:
 * enunciado, opciones suficientes, índice correcto en rango y que las
 * funciones de dibujo se ejecutan sin lanzar errores.
 *
 * Uso:  node tests/smoke.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Los scripts del juego son clásicos y cuelgan todo de `window`.
global.window = globalThis;

const RAIZ = path.join(__dirname, '..');
const ARCHIVOS = [
  'js/utils.js',
  'js/difficulty.js',
  'js/storage.js',
  'js/registry.js',
  'js/poly.js',
  'js/generators/matrix.js',
  'js/generators/series.js',
  'js/generators/rotation.js',
  'js/generators/lines.js',
  'js/generators/puzzle.js',
  'js/generators/assembly.js',
  'js/generators/cutout.js',
];
for (const relativo of ARCHIVOS) {
  const codigo = fs.readFileSync(path.join(RAIZ, relativo), 'utf8');
  vm.runInThisContext(codigo, { filename: relativo });
}

/* Canvas simulado: todo método del contexto 2D es un no-op y las
   propiedades (fillStyle, font...) se aceptan sin más. */
function canvasFalso() {
  const ctx = new Proxy({}, {
    get(obj, prop) {
      if (prop === 'measureText') return () => ({ width: 20 });
      if (prop in obj) return obj[prop];
      return () => {};
    },
    set(obj, prop, valor) {
      obj[prop] = valor;
      return true;
    },
  });
  return { style: {}, getContext: () => ctx };
}

/* ---------------- Almacén (localStorage) ---------------- */

function esperar(condicion, mensaje) {
  if (!condicion) {
    console.error('FALLO (almacén): ' + mensaje);
    process.exit(1);
  }
}

// Sin localStorage disponible: valores por defecto, sin lanzar errores.
let progreso = Synapsis.almacen.cargar();
esperar(progreso.nivel === 1 && progreso.record === 1, 'sin localStorage debe devolver 1/1');
Synapsis.almacen.guardar(5, 9); // no debe lanzar aunque no haya localStorage
Synapsis.almacen.borrar();

// Con un localStorage simulado: guardar/cargar/borrar y datos corruptos.
global.localStorage = {
  datos: {},
  getItem(k) { return k in this.datos ? this.datos[k] : null; },
  setItem(k, v) { this.datos[k] = String(v); },
  removeItem(k) { delete this.datos[k]; },
};
Synapsis.almacen.guardar(7, 15);
progreso = Synapsis.almacen.cargar();
esperar(progreso.nivel === 7 && progreso.record === 15, 'guardar/cargar debe devolver 7/15');
localStorage.setItem('synapsis.progreso', '{corrupto');
progreso = Synapsis.almacen.cargar();
esperar(progreso.nivel === 1 && progreso.record === 1, 'JSON corrupto debe devolver 1/1');
localStorage.setItem('synapsis.progreso', JSON.stringify({ nivel: -3, record: 'x' }));
progreso = Synapsis.almacen.cargar();
esperar(progreso.nivel === 1 && progreso.record === 1, 'valores inválidos deben devolver 1/1');
Synapsis.almacen.guardar(4, 4);
Synapsis.almacen.borrar();
progreso = Synapsis.almacen.cargar();
esperar(progreso.nivel === 1 && progreso.record === 1, 'tras borrar debe devolver 1/1');

/* ---------------- Comprobaciones ---------------- */

const DIFICULTADES = [1, 2, 4, 7, 10, 15, 25, 40];
const REPETICIONES = 60;

function validar(generador, d) {
  const ej = generador.generar(d);
  const donde = `${generador.id} (d=${d})`;

  if (typeof ej.enunciado !== 'string' || !ej.enunciado.trim()) {
    throw new Error(`${donde}: enunciado vacío`);
  }
  if (typeof ej.dibujarPrincipal !== 'function') {
    throw new Error(`${donde}: falta dibujarPrincipal()`);
  }
  if (!Array.isArray(ej.opciones) || ej.opciones.length < 3) {
    throw new Error(`${donde}: menos de 3 opciones (${ej.opciones && ej.opciones.length})`);
  }
  if (
    !Number.isInteger(ej.indiceCorrecto) ||
    ej.indiceCorrecto < 0 ||
    ej.indiceCorrecto >= ej.opciones.length
  ) {
    throw new Error(`${donde}: indiceCorrecto fuera de rango (${ej.indiceCorrecto})`);
  }

  // Las funciones de dibujo deben ejecutarse sin errores.
  ej.dibujarPrincipal(canvasFalso(), 360);
  for (const opcion of ej.opciones) opcion.dibujar(canvasFalso(), 120);
}

const ESPERADOS = ['matriz', 'series', 'rotacion', 'lineas', 'piezas', 'ensamblaje', 'recorte'];
const registrados = Synapsis.registry.generadores.map((g) => g.id);
for (const id of ESPERADOS) {
  if (!registrados.includes(id)) {
    console.error(`FALLO: el generador '${id}' no está registrado (hay: ${registrados.join(', ')})`);
    process.exit(1);
  }
}

let generados = 0;
const fallos = [];
for (const generador of Synapsis.registry.generadores) {
  for (const d of DIFICULTADES) {
    for (let i = 0; i < REPETICIONES; i++) {
      try {
        validar(generador, d);
        generados++;
      } catch (e) {
        fallos.push(e.message);
        if (fallos.length >= 10) break;
      }
    }
  }
}

if (fallos.length) {
  console.error(`FALLO: ${fallos.length} errores tras ${generados} ejercicios generados:`);
  for (const f of fallos) console.error('  - ' + f);
  process.exit(1);
}
console.log(
  `OK: almacén verificado y ${generados} ejercicios generados y dibujados sin errores ` +
  `(${Synapsis.registry.generadores.length} generadores × ${DIFICULTADES.length} dificultades × ${REPETICIONES} repeticiones).`
);
