/*
 * main.js — Controlador del juego.
 *
 * Orquesta el flujo de una sesión: elegir generador al azar, pedirle un
 * ejercicio a la dificultad actual, pintarlo, procesar la respuesta con
 * feedback inmediato y decidir si continuar o mostrar el resumen.
 *
 * Solo conoce el contrato de `Synapsis.registry` (ver registry.js);
 * no sabe nada de los generadores concretos.
 */
(function () {
  const U = Synapsis.utils;

  /* Duración de una sesión: termina al primer fallo o tras este número
     de ejercicios, lo que ocurra primero. */
  const MAX_EJERCICIOS = 12;

  /* Pausa de feedback antes de pasar al siguiente ejercicio (ms).
     Tras un fallo se da más tiempo para ver cuál era la correcta. */
  const PAUSA_ACIERTO = 900;
  const PAUSA_FALLO = 1600;

  const estado = {
    nivel: 1,          // contador de aciertos consecutivos + 1; es también
                       // la dificultad que reciben los generadores
    record: 1,         // nivel máximo alcanzado (persiste en localStorage)
    recordPrevio: 1,   // récord al empezar la sesión, para detectar si se bate
    aciertos: 0,
    fallos: 0,
    indice: 0,         // nº de ejercicio dentro de la sesión (1..MAX)
    ejercicio: null,   // ejercicio actual (objeto del generador)
    ultimoGenerador: null, // id del último tipo usado, para no repetir
    bloqueado: false,  // true mientras se muestra el feedback
  };

  /* ---------- Referencias al DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const pantallas = {
    inicio: $('pantalla-inicio'),
    juego: $('pantalla-juego'),
    resumen: $('pantalla-resumen'),
  };
  const marcadores = $('marcadores');
  const chipNivel = $('chip-nivel');
  const chipProgreso = $('chip-progreso');
  const enunciado = $('enunciado');
  const canvasPrincipal = $('canvas-principal');
  const zonaOpciones = $('zona-opciones');
  const feedback = $('feedback');
  const inicioProgreso = $('inicio-progreso');
  const btnBorrar = $('btn-borrar');

  function mostrarPantalla(nombre) {
    Object.entries(pantallas).forEach(([n, el]) => (el.hidden = n !== nombre));
    marcadores.hidden = nombre !== 'juego';
  }

  /* ---------- Flujo de la sesión ---------- */

  function iniciarSesion() {
    // El nivel se conserva entre sesiones mientras no se falle: una sesión
    // perfecta continúa donde se quedó (progresión infinita); un fallo
    // reinicia la racha de aciertos consecutivos y el nivel vuelve a 1.
    estado.nivel = estado.fallos === 0 ? estado.nivel : 1;
    estado.recordPrevio = estado.record;
    estado.aciertos = 0;
    estado.fallos = 0;
    estado.indice = 0;
    estado.ultimoGenerador = null;
    mostrarPantalla('juego');
    siguienteEjercicio();
  }

  function siguienteEjercicio() {
    estado.indice++;
    estado.bloqueado = false;

    // Tipo de ejercicio al azar, evitando repetir el anterior.
    const generador = Synapsis.registry.aleatorio(estado.ultimoGenerador);
    estado.ultimoGenerador = generador.id;

    // El nivel actual ES la dificultad que recibe el generador.
    estado.ejercicio = generador.generar(estado.nivel);

    actualizarMarcadores();
    feedback.textContent = ' ';
    feedback.className = 'feedback';
    renderEjercicio();
  }

  function actualizarMarcadores() {
    chipNivel.textContent = 'Nivel ' + estado.nivel;
    chipProgreso.textContent = estado.indice + ' / ' + MAX_EJERCICIOS;
  }

  /* ---------- Render ---------- */

  function renderEjercicio() {
    const ej = estado.ejercicio;
    enunciado.textContent = ej.enunciado;

    // Estímulo principal: ocupa el ancho disponible (con tope).
    ej.dibujarPrincipal(canvasPrincipal, anchoPrincipal());

    // Opciones: un botón con un canvas por cada una.
    zonaOpciones.innerHTML = '';
    zonaOpciones.classList.toggle('tres-columnas', ej.opciones.length > 4);

    ej.opciones.forEach((opcion, i) => {
      const boton = document.createElement('button');
      boton.className = 'opcion';
      boton.setAttribute('aria-label', 'Opción ' + (i + 1));
      const canvas = document.createElement('canvas');
      boton.appendChild(canvas);
      boton.addEventListener('click', () => responder(i));
      zonaOpciones.appendChild(boton);
      opcion.dibujar(canvas, tamOpcion(ej.opciones.length));
    });
  }

  /** Redibuja los canvas del ejercicio actual (p. ej. al girar el móvil). */
  function redibujar() {
    const ej = estado.ejercicio;
    if (!ej || pantallas.juego.hidden) return;
    ej.dibujarPrincipal(canvasPrincipal, anchoPrincipal());
    const canvases = zonaOpciones.querySelectorAll('canvas');
    ej.opciones.forEach((opcion, i) => {
      if (canvases[i]) opcion.dibujar(canvases[i], tamOpcion(ej.opciones.length));
    });
  }

  function anchoPrincipal() {
    const zona = $('zona-principal');
    return Math.min(zona.clientWidth, 420);
  }

  function tamOpcion(numOpciones) {
    const columnas = numOpciones > 4 ? 3 : 2;
    const gap = 12, paddingBoton = 20;
    const disponible = (zonaOpciones.clientWidth - gap * (columnas - 1)) / columnas - paddingBoton;
    return Math.max(56, Math.min(140, Math.floor(disponible)));
  }

  /* ---------- Respuesta y feedback ---------- */

  function responder(indiceElegido) {
    if (estado.bloqueado) return; // ignora toques durante el feedback
    estado.bloqueado = true;

    const ej = estado.ejercicio;
    const acierto = indiceElegido === ej.indiceCorrecto;
    const botones = zonaOpciones.querySelectorAll('.opcion');
    botones.forEach((b) => (b.disabled = true));

    // Feedback visual inmediato: siempre se resalta la correcta en verde;
    // si se falló, la elegida se marca en rojo.
    botones[ej.indiceCorrecto].classList.add('correcta');
    if (!acierto) botones[indiceElegido].classList.add('incorrecta');

    if (acierto) {
      estado.aciertos++;
      estado.nivel++; // el nivel sube con cada acierto consecutivo
      if (estado.nivel > estado.record) estado.record = estado.nivel;
      // Se guarda tras cada acierto: si se cierra la app a media sesión,
      // la próxima empieza donde tocaba.
      Synapsis.almacen.guardar(estado.nivel, estado.record);
      feedback.textContent = '✔ ¡Correcto!';
      feedback.className = 'feedback ok';
    } else {
      estado.fallos++;
      // Un fallo devuelve el nivel inicial a 1 (misma regla de siempre).
      Synapsis.almacen.guardar(1, estado.record);
      feedback.textContent = '✘ Incorrecto';
      feedback.className = 'feedback mal';
    }
    actualizarMarcadores();

    // La sesión sigue solo si se acertó y quedan ejercicios.
    const continuar = acierto && estado.indice < MAX_EJERCICIOS;
    setTimeout(
      () => (continuar ? siguienteEjercicio() : mostrarResumen()),
      acierto ? PAUSA_ACIERTO : PAUSA_FALLO
    );
  }

  /* ---------- Resumen ---------- */

  function mostrarResumen() {
    $('res-nivel').textContent = estado.nivel;
    $('res-record').textContent = estado.record;
    $('res-aciertos').textContent = estado.aciertos;
    $('res-fallos').textContent = estado.fallos;

    let mensaje = estado.fallos === 0
      ? '¡Sesión perfecta! La siguiente sesión continúa en el nivel ' + estado.nivel + '.'
      : 'Has encadenado ' + estado.aciertos + (estado.aciertos === 1 ? ' acierto' : ' aciertos') +
        ' antes de fallar. La siguiente sesión empieza en el nivel 1.';
    if (estado.record > estado.recordPrevio) {
      mensaje = '🏆 ¡Nuevo récord: nivel ' + estado.record + '! ' + mensaje;
    }
    $('res-mensaje').textContent = mensaje;
    $('btn-reiniciar').textContent = estado.fallos === 0
      ? 'Continuar — nivel ' + estado.nivel
      : 'Jugar otra sesión';

    mostrarPantalla('resumen');
  }

  /* ---------- Pantalla de inicio y progreso guardado ---------- */

  function actualizarInicio() {
    const hayProgreso = estado.nivel > 1 || estado.record > 1;
    inicioProgreso.hidden = !hayProgreso;
    btnBorrar.hidden = !hayProgreso;
    if (hayProgreso) {
      inicioProgreso.textContent = (estado.nivel > 1
        ? 'Continúas en el nivel ' + estado.nivel
        : 'Empiezas en el nivel 1') + ' · Récord: ' + estado.record;
    }
    $('btn-comenzar').textContent = estado.nivel > 1
      ? 'Continuar — nivel ' + estado.nivel
      : 'Comenzar';
  }

  // Borrado en dos toques para evitar sustos con el dedo en el móvil.
  let confirmarBorrado = false;
  btnBorrar.addEventListener('click', () => {
    if (!confirmarBorrado) {
      confirmarBorrado = true;
      btnBorrar.textContent = '¿Seguro? Toca otra vez para borrar';
      return;
    }
    Synapsis.almacen.borrar();
    estado.nivel = 1;
    estado.record = 1;
    confirmarBorrado = false;
    btnBorrar.textContent = 'Borrar progreso guardado';
    actualizarInicio();
  });

  /* ---------- Arranque ---------- */

  $('btn-comenzar').addEventListener('click', iniciarSesion);
  $('btn-reiniciar').addEventListener('click', iniciarSesion);

  // Redibujar al cambiar el tamaño/orientación (con un pequeño debounce).
  let timerResize = null;
  window.addEventListener('resize', () => {
    clearTimeout(timerResize);
    timerResize = setTimeout(redibujar, 150);
  });

  // Restaurar el progreso guardado (si lo hay) antes de mostrar el inicio.
  const guardado = Synapsis.almacen.cargar();
  estado.nivel = guardado.nivel;
  estado.record = guardado.record;
  actualizarInicio();
  mostrarPantalla('inicio');

  // PWA: el service worker cachea la app para poder jugar sin conexión.
  // Solo en https o localhost (abriendo desde file:// no está permitido,
  // pero el juego funciona igual, simplemente sin caché).
  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js');
  }
})();
