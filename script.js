/* ============================================================
   CONFIGURACIÓN — ajustar sin tocar el resto del código
   ============================================================ */
const CONFIG = {
  archivoPDF: 'base.pdf',

  /* Valor que indica exclusión del sorteo */
  valorExcluir: 'NO',

  /* Fases de la animación: cada fase define cuántos ms
     dura y cada cuántos ms se actualiza el nombre */
  fases: [
    { intervalo:  55, duracion:  800 },
    { intervalo: 110, duracion:  700 },
    { intervalo: 200, duracion:  600 },
    { intervalo: 360, duracion:  720 },
    { intervalo: 600, duracion:  600 },
    { intervalo: 750, duracion: 2250 },  /* ~3 ticks: 1 random + 2 ganador */
  ],
};


/* ============================================================
   REFERENCIAS AL DOM
   ============================================================ */
const el = {
  estadoCargando:   document.getElementById('estado-cargando'),
  estadoInicial:    document.getElementById('estado-inicial'),
  estadoAnimacion:  document.getElementById('estado-animacion'),
  estadoResultado:  document.getElementById('estado-resultado'),
  estadoError:      document.getElementById('estado-error'),

  btnSorteo:        document.getElementById('btn-sorteo'),
  btnOtroSorteo:    document.getElementById('btn-otro-sorteo'),

  infoParticipantes: document.getElementById('info-participantes'),
  nombreGirando:    document.getElementById('nombre-girando'),
  nombreGanador:    document.getElementById('nombre-ganador'),
  mensajeError:     document.getElementById('mensaje-error'),

  bomboAnimacion:   document.getElementById('bombo-animacion'),
};


/* ============================================================
   ESTADO DE LA APLICACIÓN
   ============================================================ */
let participantes = [];


/* ============================================================
   GESTIÓN DE ESTADOS — muestra uno, oculta el resto
   ============================================================ */
function mostrarEstado(id) {
  const ids = [
    'estado-cargando',
    'estado-inicial',
    'estado-animacion',
    'estado-resultado',
    'estado-error',
  ];
  ids.forEach(estadoId => {
    const elem = document.getElementById(estadoId);
    if (estadoId === id) {
      elem.classList.add('activo');
    } else {
      elem.classList.remove('activo');
    }
  });
}


/* ============================================================
   PARSEO DEL PDF
   ============================================================ */

/**
 * Punto de entrada: carga el PDF y devuelve la lista de
 * participantes válidos (columna SORTEO vacía o ausente).
 */
async function cargarParticipantes() {
  console.log('[Sorteo] Cargando PDF:', CONFIG.archivoPDF);

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';

  const pdf = await pdfjsLib.getDocument(CONFIG.archivoPDF).promise;
  console.log('[Sorteo] Páginas en el PDF:', pdf.numPages);

  /* Extraer todos los items de texto de todas las páginas */
  const todosItems = [];
  for (let numPag = 1; numPag <= pdf.numPages; numPag++) {
    const pag  = await pdf.getPage(numPag);
    const cont = await pag.getTextContent();
    for (const item of cont.items) {
      const texto = item.str.trim();
      if (!texto) continue;
      todosItems.push({
        texto,
        x:      Math.round(item.transform[4]),
        y:      Math.round(item.transform[5]),
        pagina: numPag,
      });
    }
  }
  console.log('[Sorteo] Items de texto extraídos:', todosItems.length);

  /* Agrupar items en filas (misma Y aproximada dentro de cada página) */
  const filas = agruparEnFilas(todosItems);
  console.log('[Sorteo] Filas detectadas:', filas.length);

  /* Intentar parseo estructural (por posición X de columnas) */
  const resultadoPosicional = parsearPorPosicion(filas);
  if (resultadoPosicional !== null) {
    console.log('[Sorteo] Parseo posicional OK. Participantes:', resultadoPosicional.length);
    return resultadoPosicional;
  }

  /* Fallback: parseo por texto plano */
  console.warn('[Sorteo] Parseo posicional sin resultado. Intentando fallback por texto…');
  const resultadoTexto = parsearPorTexto(filas);
  console.log('[Sorteo] Parseo por texto. Participantes:', resultadoTexto.length);
  return resultadoTexto;
}

/**
 * Agrupa items en filas según su coordenada Y
 * (tolerancia: 4 puntos dentro de la misma página).
 */
function agruparEnFilas(items) {
  const ordenados = [...items].sort((a, b) => {
    if (a.pagina !== b.pagina) return a.pagina - b.pagina;
    const difY = b.y - a.y;              // Y mayor = más arriba en PDF
    if (Math.abs(difY) > 4) return difY;
    return a.x - b.x;
  });

  const filas   = [];
  let filaActual = [];
  let yRef       = null;
  let pagRef     = null;

  for (const item of ordenados) {
    const mismaFila = (
      pagRef === item.pagina &&
      yRef !== null &&
      Math.abs(item.y - yRef) <= 4
    );

    if (mismaFila) {
      filaActual.push(item);
    } else {
      if (filaActual.length) filas.push(filaActual);
      filaActual = [item];
      yRef       = item.y;
      pagRef     = item.pagina;
    }
  }
  if (filaActual.length) filas.push(filaActual);

  return filas;
}

/**
 * Parseo estructural: detecta posiciones X de las columnas
 * SORTEO y APELLIDO/NOMBRE y extrae datos fila por fila.
 * Devuelve un array de nombres o null si no encuentra encabezado.
 */
function parsearPorPosicion(filas) {
  /* Buscar fila de encabezado */
  let indiceEnc   = -1;
  let xSorteo     = null;
  let xNombre     = null;

  for (let i = 0; i < filas.length; i++) {
    const fila    = filas[i];
    const textos  = fila.map(it => it.texto.toUpperCase());
    const lineaOK = textos.some(t => t === 'SORTEO' || t.includes('SORTEO'));
    const nombreOK = textos.some(t => t.includes('APELLIDO') || t.includes('NOMBRE'));

    if (lineaOK && nombreOK) {
      indiceEnc = i;

      /* Posición X de la columna SORTEO */
      const itemSorteo = fila.find(it =>
        it.texto.toUpperCase() === 'SORTEO' ||
        it.texto.toUpperCase().startsWith('SORTEO')
      );
      if (itemSorteo) xSorteo = itemSorteo.x;

      /* Posición X de la columna APELLIDO/NOMBRE
         Preferimos el item que contiene "APELLIDO" */
      const itemNombre =
        fila.find(it => it.texto.toUpperCase().includes('APELLIDO')) ||
        fila.find(it => it.texto.toUpperCase().includes('NOMBRE') && !it.texto.toUpperCase().includes('SORTEO'));
      if (itemNombre) xNombre = itemNombre.x;

      break;
    }
  }

  if (indiceEnc === -1 || xSorteo === null || xNombre === null) return null;

  console.log('[Sorteo] Encabezado en fila', indiceEnc,
    '| xSorteo:', xSorteo, '| xNombre:', xNombre);

  const resultado = [];

  for (let i = indiceEnc + 1; i < filas.length; i++) {
    const fila = filas[i];

    const valorSorteo = textoColumna(fila, xSorteo, 55);
    const valorNombre = textoColumna(fila, xNombre, 120);

    if (!valorNombre) continue;

    const excluido = valorSorteo.toUpperCase().trim() === CONFIG.valorExcluir;
    if (!excluido) {
      resultado.push(valorNombre.trim());
    }
  }

  return resultado;
}

/**
 * Devuelve el texto del item más cercano a la columna xCol,
 * combinando todos los items dentro de la tolerancia (para
 * nombres que el PDF divide en varios fragmentos).
 */
function textoColumna(fila, xCol, tolerancia) {
  const candidatos = fila
    .filter(it => Math.abs(it.x - xCol) < tolerancia)
    .sort((a, b) => a.x - b.x);

  return candidatos.map(it => it.texto).join(' ').trim();
}

/**
 * Fallback: análisis línea a línea del texto plano.
 * Excluye filas donde aparece "NO" como token aislado.
 */
function parsearPorTexto(filas) {
  /* Reconstruir líneas como texto */
  const lineas = filas.map(fila =>
    fila.map(it => it.texto).join('  ')
  );

  /* Buscar encabezado */
  let indiceEnc = -1;
  for (let i = 0; i < lineas.length; i++) {
    const u = lineas[i].toUpperCase();
    if (u.includes('SORTEO') && (u.includes('APELLIDO') || u.includes('NOMBRE'))) {
      indiceEnc = i;
      break;
    }
  }

  if (indiceEnc === -1) {
    console.error('[Sorteo] Fallback: no se detectó encabezado.');
    return [];
  }

  const resultado = [];

  for (let i = indiceEnc + 1; i < lineas.length; i++) {
    const linea  = lineas[i];
    /* Separar por dos o más espacios */
    const partes = linea.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);

    if (partes.length < 2) continue;

    /* Si alguna parte es exactamente "NO", excluir */
    const excluida = partes.some(p => p.toUpperCase() === CONFIG.valorExcluir);
    if (excluida) continue;

    /* Tomar la parte más larga que parezca un nombre
       (letras, sin ser puramente numérica) */
    const nombre = partes
      .filter(p => /[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]/.test(p) && !/^\d+$/.test(p))
      .sort((a, b) => b.length - a.length)[0];

    if (nombre && nombre.length > 3) resultado.push(nombre);
  }

  return resultado;
}


/* ============================================================
   ANIMACIÓN DEL SORTEO
   ============================================================ */

/**
 * Convierte "APELLIDO, NOMBRE" → "NOMBRE APELLIDO" para mostrar de forma natural.
 * Si no hay coma, devuelve el texto sin cambios.
 */
function formatearNombre(nombre) {
  if (!nombre) return '';
  const coma = nombre.indexOf(',');
  if (coma === -1) return nombre;
  const apellido = nombre.slice(0, coma).trim();
  const nombres  = nombre.slice(coma + 1).trim();
  return nombres ? `${nombres} ${apellido}` : apellido;
}

/**
 * Muestra un nombre en la ruleta con micro-parpadeo.
 */
function mostrarEnRuleta(nombre) {
  el.nombreGirando.classList.add('oculto');
  setTimeout(() => {
    el.nombreGirando.textContent = formatearNombre(nombre);
    el.nombreGirando.classList.remove('oculto');
  }, 28);
}

/**
 * Inicia la animación de nombres.
 * El ganador se elige al inicio. En la última fase, los últimos dos slots
 * muestran al ganador para que el resultado se sienta coherente.
 */
function iniciarSorteo() {
  if (!participantes.length) return;

  const ganador = participantes[Math.floor(Math.random() * participantes.length)];
  console.log('[Sorteo] Ganador elegido:', ganador);

  mostrarEstado('estado-animacion');
  el.bomboAnimacion.classList.add('animando');

  let faseActual  = 0;
  let intervalRef = null;

  function ejecutarFase() {
    if (faseActual >= CONFIG.fases.length) {
      /* La ruleta ya quedó mostrando al ganador — ahora revelar */
      el.bomboAnimacion.classList.remove('animando');
      setTimeout(() => mostrarGanador(ganador), 750);
      return;
    }

    const fase          = CONFIG.fases[faseActual];
    const esUltimaFase  = faseActual === CONFIG.fases.length - 1;
    /* Umbral a partir del cual solo aparece el ganador en la última fase */
    const umbralGanador = Math.max(0, fase.duracion - fase.intervalo * 2);
    let tiempoFase      = 0;

    intervalRef = setInterval(() => {
      tiempoFase += fase.intervalo;

      const nombre = (esUltimaFase && tiempoFase >= umbralGanador)
        ? ganador
        : participantes[Math.floor(Math.random() * participantes.length)];

      mostrarEnRuleta(nombre);

      if (tiempoFase >= fase.duracion) {
        clearInterval(intervalRef);
        faseActual++;
        ejecutarFase();
      }
    }, fase.intervalo);
  }

  mostrarEnRuleta(participantes[0] || '');
  ejecutarFase();
}

/**
 * Muestra la pantalla de resultado con el nombre del ganador.
 */
function mostrarGanador(nombre) {
  el.nombreGanador.textContent = formatearNombre(nombre);

  /* Reiniciar animaciones CSS de los elementos del resultado */
  const selectores = ['.resultado-caja', '.resultado-etiqueta', '.btn-secundario',
                      '.festivo-brillo', '.festivo-anillo'];
  selectores.forEach(sel => {
    document.querySelectorAll(sel).forEach(elem => {
      elem.style.animation = 'none';
      void elem.offsetHeight; /* reflow */
      elem.style.animation = '';
    });
  });

  mostrarEstado('estado-resultado');
  lanzarParticulasGanador();
}

/**
 * Crea partículas flotantes efímeras sobre la pantalla de resultado.
 */
function lanzarParticulasGanador() {
  const contenedor = document.getElementById('estado-resultado');
  const colores = [
    'rgba(255,255,255,0.70)',
    'rgba(98,210,88,0.65)',
    'rgba(102,184,196,0.60)',
    'rgba(255,255,255,0.45)',
  ];

  /* Limpiar partículas de una corrida anterior */
  contenedor.querySelectorAll('.particula-festiva').forEach(p => p.remove());

  for (let i = 0; i < 22; i++) {
    const p = document.createElement('span');
    p.className = 'particula-festiva';
    const size    = Math.random() * 5 + 3;          /* 3–8 px */
    const dur     = (Math.random() * 2 + 2).toFixed(2); /* 2–4 s */
    const delay   = (Math.random() * 1.8).toFixed(2);
    const color   = colores[Math.floor(Math.random() * colores.length)];
    p.style.cssText = [
      `left: ${(Math.random() * 90 + 5).toFixed(1)}%`,
      `top:  ${(Math.random() * 75 + 10).toFixed(1)}%`,
      `width: ${size}px`,
      `height: ${size}px`,
      `background: ${color}`,
      `--dur: ${dur}s`,
      `animation-delay: ${delay}s`,
    ].join(';');
    contenedor.appendChild(p);
    setTimeout(() => p.remove(), (parseFloat(dur) + parseFloat(delay) + 0.5) * 1000);
  }
}


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
async function init() {
  mostrarEstado('estado-cargando');

  try {
    participantes = await cargarParticipantes();

    if (!participantes || participantes.length === 0) {
      mostrarError('No se encontraron participantes válidos.');
      return;
    }

    el.infoParticipantes.textContent =
      `${participantes.length} participante${participantes.length !== 1 ? 's' : ''} en el sorteo`;

    mostrarEstado('estado-inicial');
    console.log('[Sorteo] Listo. Participantes cargados:', participantes.length);

  } catch (err) {
    console.error('[Sorteo] Error al inicializar:', err);
    mostrarError('No se pudo leer la base del sorteo.');
  }
}

function mostrarError(msg) {
  el.mensajeError.textContent = msg;
  mostrarEstado('estado-error');
}


/* ============================================================
   EVENTOS
   ============================================================ */
el.btnSorteo.addEventListener('click', iniciarSorteo);

el.btnOtroSorteo.addEventListener('click', () => {
  mostrarEstado('estado-inicial');
});


/* Arrancar */
init();
