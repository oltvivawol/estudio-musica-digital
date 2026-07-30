# Estudio de Música Digital — app nativa Android

App Flutter nativa del Estudio (la versión web vive en [`../web`](../web) y se
publica en arte.vawol.com).

## En qué estado está

**Fase 0: spike de riesgo.** Todavía no es el Estudio — es una app que responde
una sola pregunta, la que decide si el proyecto entero es viable.

### La pregunta

Un estudio multipista necesita que todas las pistas arranquen **exactamente
juntas, al sample**. En la web eso sale gratis: la Web Audio API deja programar
varias fuentes al mismo instante absoluto del reloj de audio
(`source.start(cuando)` en [`web/src/lib/audioEngine.js`](../web/src/lib/audioEngine.js)).

En Flutter no hay nada equivalente de fábrica. Los reproductores comunes
(`just_audio`, `audioplayers`) manejan cada pista por separado, sin un reloj
común: dos pistas arrancan con decenas de milisegundos de diferencia y eso ya
se escucha como un eco horrible.

El candidato es **`flutter_soloud`**, que expone un reloj de mezclador
(`getEngineTime`) y arranque programado a un instante absoluto
(`playScheduled`). Sobre el papel es el equivalente exacto. Falta comprobar que
funcione de verdad en un teléfono real.

### Cómo se mide

Con una **prueba nula**, el método estándar en audio: se reproduce una señal
junto con su copia invertida. Si arrancan alineadas se anulan y sale silencio;
cualquier desfasaje reaparece como ruido.

Es una medición objetiva, no depende del oído de nadie:

- Cancelación perfecta → alrededor de **-90 dBFS** (el piso lo pone la
  cuantización a 16 bits).
- Desfasaje de **una sola muestra** → alrededor de **-10 dBFS**.

Son 80 dB de diferencia, así que ningún resultado queda ambiguo. El corte está
puesto en -60 dBFS.

La señal es ruido blanco a propósito: al tener energía en todas las
frecuencias, es la más exigente. Una senoidal podría cancelar de casualidad.

### Qué prueba

| Prueba | Qué responde |
|---|---|
| 2 voces | ¿Funciona el mecanismo básico? |
| 12 voces | ¿Aguanta 6 stems (lo que devuelve htdemucs_6s) sonando juntos? |
| Reanudar desde 12,5 s | ¿Se puede volver de una pausa sin perder el sincronismo? **La más riesgosa.** |
| Velocidad 0,5× y 2× | ¿Siguen alineadas al cambiar el tempo? |
| Grupo de voces | Plan alternativo, por si el mecanismo principal falla |
| Deriva | ¿Se van desfasando de a poco con el tiempo? |

### Qué se hace con el resultado

- **Todo pasa** → se construye el Estudio nativo sobre este motor.
- **Falla solo "reanudar"** → se reanuda con el mecanismo alternativo.
- **Falla el mecanismo principal pero anda el grupo de voces** → se construye
  con ese.
- **No pasa nada** → hay que escribir un motor propio en C++ (Oboe). Bastante
  más trabajo, pero mejor saberlo ahora que a las tres semanas.

## Probarlo

El APK sale del workflow [`app-android.yml`](../.github/workflows/app-android.yml):
cada push a `app/` deja un artifact descargable, y un tag `app-v*` publica un
Release.

Hay que correrlo en un **teléfono real**. Un emulador no sirve: su capa de
audio no representa el timing del hardware.

## Por qué nativa y no la web envuelta

Aclaración honesta sobre lo que una app cambia y lo que no:

- **Sí cambia**: se siente como una app de verdad, ícono propio, y el motor de
  audio corre nativo en vez de dentro del navegador (menos latencia, mejor
  manejo de memoria con canciones largas).
- **No cambia**: separar instrumentos (Demucs) necesita GPU real. Un teléfono
  no puede correrlo en un tiempo razonable, con app o sin app. Esa parte sigue
  yendo al servidor.

## Estructura

```
lib/
  audio/wav.dart           Codificador WAV — mismo algoritmo que la web,
                           así un export suena igual venga de donde venga.
                           Cubierto por tests (test/wav_test.dart).
  spike/senales.dart       Genera las señales de prueba y sus inversas.
  spike/prueba_sincro.dart La batería de pruebas.
  main.dart                Pantalla de resultados.
```

## Lo que viene después (si el spike pasa)

1. **Importar + reproducir + mezclar** — abrir el zip de stems, reproducirlos
   sincronizados, volumen/mute/solo/velocidad. Es el 80% del valor.
2. **Exportar** la mezcla a WAV.
3. **Guardar proyectos** — algo que la web no tiene: hoy al recargar se pierde
   todo menos la librería del sampler.
4. **Recortar pistas** y tocar la forma de onda para saltar a un punto.
5. **Grabar** con el micrófono, con compensación de latencia (en Android el
   retardo es de 50-300 ms y hay que calibrarlo, si no la toma queda corrida).
6. **Plugins** — batería, metrónomo, sampler.

Decisión de arquitectura ya tomada para cuando toque el punto 1: los stems
llegan en MP3 desde Colab, y se decodifican **una sola vez** a WAV PCM en
disco. Eso resuelve tres problemas juntos: la memoria (6 stems decodificados en
RAM son ~550 MB, imposible en un teléfono), la precisión al saltar de posición
(en MP3 el salto cae en el frame más cercano, no en la muestra exacta) y el
export (que pasa a ser leer y sumar archivos).
