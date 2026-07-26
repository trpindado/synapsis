# Synapsis

Juego educativo de razonamiento visual y lógico (estilo tests WAIS/Mensa) como
web app en HTML/CSS/JS vanilla, con los ejercicios dibujados mediante Canvas.
Pensado mobile-first y preparado para convertirse más adelante en PWA.

## Cómo funciona una sesión

- Cada ronda toca un tipo de ejercicio al azar (sin repetir el anterior):
  **matriz visual 3x3**, **serie numérica/simbólica**, **rotación espacial**
  o **completamiento de figuras de líneas**.
- El **nivel** empieza en 1 y sube con cada acierto consecutivo, sin tope.
  El nivel es a la vez la puntuación de progreso y la dificultad que reciben
  los generadores (más elementos, patrones más sutiles, más opciones,
  distractores más parecidos...).
- El nivel **se conserva entre sesiones mientras no falles**: si completas
  una sesión perfecta, la siguiente continúa donde te quedaste. Un fallo
  reinicia la racha y el nivel vuelve a 1 (mientras la pestaña siga abierta;
  la persistencia con `localStorage` llegará en una fase futura).
- Tras cada respuesta hay feedback inmediato (se resalta la opción correcta).
- La sesión termina **al primer fallo** o tras **12 ejercicios**, lo que
  ocurra primero, y se muestra un resumen con aciertos, fallos y nivel máximo.

## Probar en local

No hay dependencias ni build. Dos opciones:

**Opción A — abrir directamente:** haz doble clic en `index.html`
(o arrástralo al navegador). Funciona porque no se usan módulos ES.

**Opción B — servidor local** (necesaria para probar desde el móvil):

```bash
# Con Python (ya instalado en macOS):
cd Synapsis
python3 -m http.server 8000
# → abre http://localhost:8000

# O con live-server (recarga automática al editar):
npx live-server
```

## Probar desde el móvil (misma red wifi)

1. Arranca un servidor local en el ordenador (Opción B de arriba).
2. Averigua la IP local del ordenador:
   - **macOS:** `ipconfig getifaddr en0` (o Ajustes → Wi-Fi → Detalles)
   - **Windows:** `ipconfig` (campo "IPv4 Address")
   - **Linux:** `hostname -I`
3. En el móvil (conectado a la misma wifi), abre en el navegador:
   `http://LA_IP_DEL_ORDENADOR:8000` — por ejemplo `http://192.168.1.34:8000`.

Si no carga, revisa que el firewall del ordenador permita conexiones
entrantes al puerto 8000.

## Estructura del código

```
index.html              Estructura de pantallas y orden de carga de scripts
css/styles.css          Estilos mobile-first (tema oscuro)
js/
  utils.js              Aleatoriedad + primitivas de dibujo en canvas
  difficulty.js         Fórmulas de dificultad continua (sat, prob, creciente...)
  registry.js           Registro central de generadores (define el contrato)
  main.js               Controlador: flujo de sesión, render, feedback, resumen
  js/generators/
    matrix.js           Matrices visuales 3x3
    series.js           Series numéricas y de símbolos
    rotation.js         Rotación espacial (poliominós)
    lines.js            Completamiento de figuras de líneas (series de trazos)
```

Todo vive bajo el espacio de nombres global `Synapsis` (scripts clásicos, sin
módulos ES, para que `index.html` funcione también abierto desde el disco).

## Cómo añadir un nuevo tipo de ejercicio

1. Crea `js/generators/mi-ejercicio.js` con esta plantilla:

```js
(function () {
  const U = Synapsis.utils;   // aleatoriedad y dibujo
  const D = Synapsis.dif;     // curvas de dificultad

  Synapsis.registry.registrar({
    id: 'mi-ejercicio',
    nombre: 'Mi ejercicio',

    // d = nivel actual (1, 2, 3... sin tope). Tradúcelo a tus parámetros
    // con las curvas de Synapsis.dif para que la progresión sea continua.
    generar(d) {
      const numOpciones = D.numOpciones(d);        // 4 → 6 gradualmente
      // ... genera aquí el problema, la solución y los distractores ...

      return {
        enunciado: '¿Pregunta que ve el usuario?',

        // Dibuja el estímulo principal. `ancho` es el ancho disponible
        // en px CSS; tú decides la altura al llamar a prepararCanvas.
        dibujarPrincipal(canvas, ancho) {
          const ctx = U.prepararCanvas(canvas, ancho, ancho * 0.6);
          // ... dibuja con la Canvas API ...
        },

        // Una entrada por opción; cada una se dibuja en un canvas
        // cuadrado de lado `tam` (px CSS).
        opciones: [/* ... */].map((datos) => ({
          dibujar(canvas, tam) {
            const ctx = U.prepararCanvas(canvas, tam, tam);
            // ... dibuja la opción ...
          },
        })),

        indiceCorrecto: 0,  // índice de la opción correcta
      };
    },
  });
})();
```

2. Añade el script en `index.html`, junto a los demás generadores y
   **antes** de `main.js`:

```html
<script src="js/generators/mi-ejercicio.js"></script>
```

Nada más: `main.js` lo incluirá automáticamente en el sorteo de cada ronda.

Reglas del contrato:
- `generar(d)` debe devolver siempre un ejercicio resoluble con **una única**
  opción correcta (comprueba que ningún distractor coincida con ella).
- Las funciones de dibujo pueden llamarse varias veces (p. ej. al girar el
  móvil), así que deben ser puras: solo pintar, sin mutar el estado del
  ejercicio.
- Usa `Synapsis.dif` (`sat`, `prob`, `activo`, `creciente`, `numOpciones`)
  en vez de umbrales de nivel fijos, para mantener la progresión continua.

## Pendiente para fases futuras

- Estadísticas persistentes entre sesiones (`localStorage`).
- Modo cronometrado.
- Más tipos de ejercicio (analogías visuales, conteo, plegado de papel...).
- Empaquetado como PWA (manifest + service worker) o Capacitor.
