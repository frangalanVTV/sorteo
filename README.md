# Sorteo — Banco Provincia

Herramienta visual para realizar sorteos en eventos institucionales.
Diseñada para pantalla completa en computadora de escritorio.

---

## Cómo correr el sitio

El navegador **bloquea la lectura de archivos PDF locales** cuando se abre `index.html` directamente (protocolo `file://`). Es necesario servir el proyecto desde un servidor local.

### Opción 1 — Python (recomendada, sin instalación extra)

Abrí una terminal en la carpeta del proyecto y ejecutá:

**macOS / Linux**
```
python3 -m http.server 8080
```

**Windows**
```
python -m http.server 8080
```

Luego abrí en el navegador:
```
http://localhost:8080
```

### Opción 2 — Node.js (si está instalado)

```
npx serve .
```

### Opción 3 — VS Code Live Server

Abrí la carpeta en VS Code, instalá la extensión **Live Server** y hacé clic en *"Go Live"*.

---

## Estructura del proyecto

```
/
├── index.html           ← Página principal
├── styles.css           ← Estilos y variables de diseño
├── script.js            ← Lógica del sorteo
├── base.pdf             ← Base de participantes (colocá aquí el tuyo)
├── README.md
├── /Fonts               ← Tipografías locales
│   ├── EncodeSans-Bold.ttf
│   ├── EncodeSans-Regular.ttf
│   └── MinionVariableConcept-Roman.otf
├── /IMAGENES_REF        ← Imágenes de referencia (solo diseño)
└── /libs                ← PDF.js (incluido, no requiere internet)
    ├── pdf.min.js
    └── pdf.worker.min.js
```

---

## Dónde colocar el archivo base.pdf

El archivo debe llamarse exactamente **`base.pdf`** y estar en la **raíz del proyecto** (misma carpeta que `index.html`).

El PDF debe tener una tabla con al menos estas columnas:

| SORTEO | APELLIDO, NOMBRE  |
|--------|-------------------|
| (vacío)| GARCIA, JUAN      |
| NO     | PEREZ, ANA        |

- Si la columna **SORTEO** está **vacía**, la persona **participa**.
- Si la columna **SORTEO** dice **NO**, la persona queda **excluida**.

---

## Dónde colocar las fuentes

Las fuentes deben estar en la carpeta `/Fonts` con estos nombres exactos:

- `Fonts/EncodeSans-Bold.ttf`
- `Fonts/EncodeSans-Regular.ttf`
- `Fonts/MinionVariableConcept-Roman.otf`

Si cambiás los nombres, actualizá las reglas `@font-face` en `styles.css`.

---

## Personalización

### Cambiar colores

Editá las variables al inicio de `styles.css`:

```css
:root {
  --color-fondo:        #F2EDE4;   /* fondo general (crema) */
  --color-verde-oscuro: #1E5C3A;   /* verde institucional */
  --color-verde-medio:  #2D7A50;   /* verde hover del botón */
  --color-arena:        #C8A96E;   /* borde exterior del bombo */
  --color-crema:        #FAF7F2;   /* texto sobre verde */
  --color-negro:        #1A1A1A;   /* contornos */
}
```

### Cambiar duración y velocidad de la animación

En `script.js`, modificá el array `CONFIG.fases`. Cada objeto tiene:
- `intervalo`: tiempo en ms entre cada cambio de nombre (más bajo = más rápido)
- `duracion`: cuántos ms dura esa fase

```js
fases: [
  { intervalo:  55, duracion:  900 },   // muy rápido
  { intervalo: 110, duracion:  800 },
  { intervalo: 190, duracion:  700 },
  { intervalo: 320, duracion:  650 },
  { intervalo: 520, duracion:  600 },
  { intervalo: 850, duracion:  700 },   // lento, casi para
],
```

La duración total del sorteo es la suma de todos los `duracion` (~4,5 s por defecto).

### Cambiar el tamaño del bombo (círculo central)

```css
:root {
  --bombo-ext: 400px;   /* diámetro exterior (aro de piedra) */
  --bombo-int: 296px;   /* diámetro interior (agua verde) */
}
```

---

## Navegadores compatibles

Probado y compatible con:
- Google Chrome (recomendado)
- Mozilla Firefox
- Microsoft Edge
- Safari (macOS)

Versiones modernas de escritorio (2020 en adelante).

---

## Resolución de problemas

| Síntoma | Solución |
|---------|----------|
| Pantalla de error "No se pudo leer la base del sorteo" | Verificá que el sitio corre desde un servidor local (no desde `file://`) |
| No se detectan participantes válidos | Abrí la consola del navegador (F12 → Consola) para ver el detalle del parseo |
| Las fuentes no cargan | Verificá que los archivos .ttf/.otf estén en `/Fonts` con los nombres exactos |
| El PDF tiene una estructura muy diferente | El sistema tiene dos estrategias de parseo (posicional y por texto). Consultá los logs en consola para diagnosticar |
