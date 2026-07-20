# Estudio de Música Digital

Un editor de música simple donde la IA separa una canción en instrumentos
individuales (voz, batería, bajo, piano, guitarra) para trabajarlos por
separado — por ejemplo, aislar el piano y reconstruir sobre él.

## Estado actual: Fase 1 — separación de instrumentos (Colab, gratis)

Separar audio con IA (Demucs, de Meta) necesita GPU para ser práctico. Ni el
Codespace ni el teléfono tienen una, así que esta primera fase corre en
**Google Colab** — GPU real, gratis, sin tarjeta de crédito.

### Usar el separador

1. Abrí **[`colab/separar_instrumentos.ipynb`](colab/separar_instrumentos.ipynb)** en Google Colab:
   - Subilo a [colab.research.google.com](https://colab.research.google.com) → "Subir" → elegí el archivo, **o**
   - Una vez que el repo esté en GitHub, usar el link directo `colab.research.google.com/github/<usuario>/estudio-musica-digital/blob/main/colab/separar_instrumentos.ipynb`
2. Activá GPU: `Entorno de ejecución` → `Cambiar tipo de entorno` → **GPU (T4)**.
3. Corré las celdas de arriba a abajo, subí tu canción, descargá el .zip con las pistas separadas.

### Por qué así (la verdad honesta)

- Demucs corriendo por CPU (sin GPU) puede tardar varios minutos por canción y,
  con la poca RAM libre que tenemos en el teléfono/Codespace, corre riesgo real
  de colgarse (sin margen de memoria).
- No existe hoy una API gratis, estable y sin límites para esto — los
  servicios "gratis" que aparecen son en realidad pruebas con minutos/créditos
  limitados.
- Colab con GPU T4 es el único cómputo con GPU real disponible sin costo.

## Próximas fases (a definir)

- Importar las pistas separadas a una interfaz simple (piano roll o tabla de
  acordes) para editar/recomponer.
- Cambio de tonalidad (transposición): mover cada nota/acorde N semitonos —
  es matemática simple de teoría musical, no necesita IA ni GPU.
- Plugins básicos de edición (volumen, EQ simple, loop de secciones).
- Explorar separación 100% en el navegador (WebGPU/WASM) para sacar la
  dependencia de Colab, cuando la tecnología esté más madura.
