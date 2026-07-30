import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter_soloud/flutter_soloud.dart';
import 'package:path_provider/path_provider.dart';

import 'senales.dart';

/// Umbral de aprobación en dBFS. Un desfasaje de UNA muestra con ruido blanco
/// deja un residuo del orden de -10 dBFS; la cancelación perfecta queda cerca
/// de -90 dBFS (el piso lo pone la cuantización a 16 bits del WAV, que no es
/// perfectamente simétrica). Poner el corte en -60 deja ~50 dB de margen para
/// cada lado: ningún resultado real cae ambiguo en el medio.
const double kUmbralAprobadoDb = -60;

/// Cuánto dura cada señal de prueba en disco.
const Duration kDuracionSenal = Duration(seconds: 30);

/// Cuántos pares (señal + inversa) se generan. 6 = la cantidad de stems que
/// devuelve htdemucs_6s, o sea 12 voces sonando a la vez en la prueba grande.
const int kCantidadPares = 6;

class ResultadoPrueba {
  const ResultadoPrueba({
    required this.nombre,
    required this.descripcion,
    this.residualDb,
    this.referenciaDb,
    this.paso,
    this.error,
    this.nota,
  });

  final String nombre;
  final String descripcion;

  /// Pico de la mezcla con la señal y su inversa sonando juntas.
  final double? residualDb;

  /// Pico de la señal sola, como referencia de cuánto "debería" sonar.
  final double? referenciaDb;

  final bool? paso;
  final String? error;
  final String? nota;

  /// Cuánto cancela: diferencia entre lo que sonaría sin cancelar y el residuo.
  double? get cancelacionDb =>
      (residualDb != null && referenciaDb != null) ? referenciaDb! - residualDb! : null;
}

/// Batería de pruebas que decide si se puede construir el Estudio nativo sobre
/// flutter_soloud, o si hay que pivotear.
///
/// El método es la "prueba nula" que se usa en audio profesional: se reproduce
/// una señal junto con su copia invertida. Si arrancan exactamente en la misma
/// muestra, se anulan y el resultado es silencio. Cualquier desfasaje reaparece
/// como ruido. Es una medición objetiva — no depende del oído de nadie.
class PruebaSincro {
  PruebaSincro({this.onProgreso});

  final void Function(String)? onProgreso;

  final List<ParNulo> _pares = [];
  Directory? _carpeta;
  bool _iniciado = false;

  void _avisar(String mensaje) => onProgreso?.call(mensaje);

  Future<void> preparar() async {
    if (_iniciado) return;

    _avisar('Arrancando el motor de audio…');
    await SoLoud.instance.init(
      sampleRate: 44100,
      bufferSize: 2048,
      channels: Channels.stereo,
    );
    // SoLoud roba voces pasado su máximo (16 por defecto). Con 12 voces de
    // prueba más lo que sea, se activaría el robo y el resultado sería
    // desconcertante en vez de concluyente.
    SoLoud.instance.setMaxActiveVoiceCount(64);
    _iniciado = true;

    final base = await getApplicationDocumentsDirectory();
    final carpeta = Directory('${base.path}/spike_sincro');
    if (!carpeta.existsSync()) carpeta.createSync(recursive: true);
    _carpeta = carpeta;

    for (var i = 0; i < kCantidadPares; i++) {
      _avisar('Generando señal de prueba ${i + 1}/$kCantidadPares…');
      _pares.add(await generarParNulo(
        carpeta: carpeta,
        indice: i,
        sampleRate: 44100,
        duracion: kDuracionSenal,
      ));
    }
  }

  /// Mide el pico de la salida del mezclador durante [ventana].
  ///
  /// Escucha la mezcla final real (lo que iría al parlante), no lo que el motor
  /// "dice" que está haciendo — por eso sirve como evidencia.
  ///
  /// OJO: `startMixerOutputStream` está marcado como experimental en
  /// flutter_soloud 4.1.3, así que puede cambiar o desaparecer en una versión
  /// futura. Acá es aceptable porque es el instrumento de medición del spike,
  /// no algo de lo que dependa el Estudio en producción. Si más adelante hace
  /// falta capturar la mezcla en la app final (por ejemplo para grabar la
  /// salida), hay que volver a evaluarlo.
  // ignore: experimental_member_use
  Future<double> _medirPicoDb(Duration ventana) async {
    var pico = 0.0;
    // ignore: experimental_member_use
    final stream = SoLoud.instance.startMixerOutputStream(
      format: MixerOutputFormat.pcmF32le,
    );
    final sub = stream.listen((bytes) {
      // Los bytes vienen como float32 little-endian. Copiamos para no depender
      // de que el offset del buffer esté alineado a 4, y recortamos a un
      // múltiplo de 4: si llegara un chunk cortado a la mitad de una muestra,
      // asFloat32List tira excepción y se caería toda la medición.
      final completos = (bytes.lengthInBytes ~/ 4) * 4;
      if (completos == 0) return;
      final copia = Uint8List.fromList(bytes.sublist(0, completos));
      final muestras = copia.buffer.asFloat32List();
      for (final v in muestras) {
        final a = v.abs();
        // Un NaN o infinito daría un pico sin sentido en vez de un error claro.
        if (a.isFinite && a > pico) pico = a;
      }
    });
    await Future<void>.delayed(ventana);
    await sub.cancel();
    // ignore: experimental_member_use
    SoLoud.instance.stopMixerOutputStream();
    return 20 * (log(pico + 1e-12) / ln10);
  }

  Future<void> _silenciarTodo() async {
    try {
      await SoLoud.instance.disposeAllSources();
    } catch (_) {
      // Si no había nada cargado, no importa.
    }
    await Future<void>.delayed(const Duration(milliseconds: 250));
  }

  /// Prueba 1 y 2 — Mecanismo A: `playScheduled` a un instante absoluto común.
  /// Es el equivalente directo de lo que hace la web con
  /// `source.start(cuando)` sobre `ctx.currentTime`.
  Future<ResultadoPrueba> mecanismoProgramado({required int pares}) async {
    final nombre = 'Mecanismo A · $pares ${pares == 1 ? "par" : "pares"} '
        '(${pares * 2} voces)';
    try {
      await _silenciarTodo();

      final fuentes = <AudioSource>[];
      for (var i = 0; i < pares; i++) {
        fuentes.add(await SoLoud.instance
            .loadFile(_pares[i].original.path, mode: LoadMode.disk));
        fuentes.add(await SoLoud.instance
            .loadFile(_pares[i].invertida.path, mode: LoadMode.disk));
      }

      // Referencia: una sola señal, para saber cuánto sonaría sin cancelación.
      final hRef = SoLoud.instance.playScheduled(
        fuentes.first,
        SoLoud.instance.getEngineTime() + const Duration(milliseconds: 120),
      );
      final referencia = await _medirPicoDb(const Duration(seconds: 2));
      SoLoud.instance.stop(hRef);
      await Future<void>.delayed(const Duration(milliseconds: 200));

      // La prueba: todas las voces al MISMO instante absoluto del motor.
      final t0 = SoLoud.instance.getEngineTime() + const Duration(milliseconds: 120);
      for (final f in fuentes) {
        SoLoud.instance.playScheduled(f, t0);
      }
      final residual = await _medirPicoDb(const Duration(seconds: 3));

      await _silenciarTodo();
      return ResultadoPrueba(
        nombre: nombre,
        descripcion: 'Todas las voces arrancan en el mismo instante del reloj '
            'del motor (playScheduled).',
        residualDb: residual,
        referenciaDb: referencia,
        paso: residual < kUmbralAprobadoDb,
      );
    } catch (e) {
      return ResultadoPrueba(
        nombre: nombre,
        descripcion: 'Arranque programado a instante absoluto.',
        error: '$e',
        paso: false,
      );
    }
  }

  /// Prueba 3 — la más riesgosa: ¿un `seek` sobre una voz programada pero que
  /// todavía no empezó a sonar se aplica en la muestra correcta?
  ///
  /// De esto depende poder reanudar desde una pausa, que es exactamente lo que
  /// hace la web al despausar (`_offsetPausa`). Si falla, hay que reanudar por
  /// otro camino.
  Future<ResultadoPrueba> reanudarDesdePosicion() async {
    const nombre = 'Mecanismo A · reanudar desde 12,5 s';
    try {
      await _silenciarTodo();
      final a = await SoLoud.instance
          .loadFile(_pares[0].original.path, mode: LoadMode.disk);
      final b = await SoLoud.instance
          .loadFile(_pares[0].invertida.path, mode: LoadMode.disk);

      const desde = Duration(milliseconds: 12500);
      final t0 = SoLoud.instance.getEngineTime() + const Duration(milliseconds: 150);
      final h1 = SoLoud.instance.playScheduled(a, t0);
      final h2 = SoLoud.instance.playScheduled(b, t0);
      SoLoud.instance.seek(h1, desde);
      SoLoud.instance.seek(h2, desde);

      final residual = await _medirPicoDb(const Duration(seconds: 3));
      await _silenciarTodo();

      return ResultadoPrueba(
        nombre: nombre,
        descripcion: 'seek() sobre voces ya programadas pero aún no sonando. '
            'Es lo que hace falta para reanudar después de pausar.',
        residualDb: residual,
        paso: residual < kUmbralAprobadoDb,
        nota: residual >= kUmbralAprobadoDb
            ? 'Si esto falla pero el resto pasa, se reanuda con el Mecanismo B '
                '(pausa + grupo de voces) en vez de con seek programado.'
            : null,
      );
    } catch (e) {
      return ResultadoPrueba(
        nombre: nombre,
        descripcion: 'seek sobre voz programada.',
        error: '$e',
        paso: false,
      );
    }
  }

  /// Prueba 4 — velocidad global (el equivalente de `playbackRate` en la web).
  /// Verifica que al cambiar el tempo las pistas sigan alineadas entre sí.
  Future<ResultadoPrueba> aVelocidad(double velocidad) async {
    final nombre = 'Mecanismo A · velocidad ${velocidad}x';
    try {
      await _silenciarTodo();
      final a = await SoLoud.instance
          .loadFile(_pares[0].original.path, mode: LoadMode.disk);
      final b = await SoLoud.instance
          .loadFile(_pares[0].invertida.path, mode: LoadMode.disk);

      final t0 = SoLoud.instance.getEngineTime() + const Duration(milliseconds: 150);
      final h1 = SoLoud.instance.playScheduled(a, t0);
      final h2 = SoLoud.instance.playScheduled(b, t0);
      SoLoud.instance.setRelativePlaySpeed(h1, velocidad);
      SoLoud.instance.setRelativePlaySpeed(h2, velocidad);

      final residual = await _medirPicoDb(const Duration(seconds: 3));
      await _silenciarTodo();

      return ResultadoPrueba(
        nombre: nombre,
        descripcion: 'Las dos voces a $velocidad× deben seguir alineadas.',
        residualDb: residual,
        paso: residual < kUmbralAprobadoDb,
      );
    } catch (e) {
      return ResultadoPrueba(
        nombre: nombre,
        descripcion: 'Velocidad global.',
        error: '$e',
        paso: false,
      );
    }
  }

  /// Prueba 5 — Mecanismo B (plan alternativo): cargar las voces en pausa,
  /// agruparlas y despausar el grupo de una.
  ///
  /// Acá el arranque absoluto puede caer hasta un buffer tarde, pero eso no
  /// importa: lo que importa es que las pistas no se desfasen ENTRE SÍ, y al
  /// despausarse bajo el mismo tick del mezclador arrancan todas juntas.
  Future<ResultadoPrueba> mecanismoGrupo({required int pares}) async {
    final nombre = 'Mecanismo B · grupo de voces (${pares * 2} voces)';
    try {
      await _silenciarTodo();

      final handles = <SoundHandle>[];
      for (var i = 0; i < pares; i++) {
        final a = await SoLoud.instance
            .loadFile(_pares[i].original.path, mode: LoadMode.disk);
        final b = await SoLoud.instance
            .loadFile(_pares[i].invertida.path, mode: LoadMode.disk);
        handles.add(SoLoud.instance.play(a, paused: true));
        handles.add(SoLoud.instance.play(b, paused: true));
      }

      final grupo = SoLoud.instance.createVoiceGroup();
      SoLoud.instance.addVoicesToGroup(grupo, handles);
      SoLoud.instance.setPause(grupo, false);

      final residual = await _medirPicoDb(const Duration(seconds: 3));
      await _silenciarTodo();

      return ResultadoPrueba(
        nombre: nombre,
        descripcion: 'Voces cargadas en pausa, agrupadas y despausadas juntas. '
            'Es el plan alternativo si el Mecanismo A falla.',
        residualDb: residual,
        paso: residual < kUmbralAprobadoDb,
      );
    } catch (e) {
      return ResultadoPrueba(
        nombre: nombre,
        descripcion: 'Grupo de voces despausado en bloque.',
        error: '$e',
        paso: false,
      );
    }
  }

  /// Prueba 6 — deriva: ¿siguen alineadas después de varios minutos?
  /// Un desfasaje que crece lentamente no se nota en 3 segundos pero arruina
  /// una sesión de trabajo real.
  Future<ResultadoPrueba> deriva({
    Duration total = const Duration(seconds: 25),
  }) async {
    const nombre = 'Mecanismo A · deriva en el tiempo';
    try {
      await _silenciarTodo();
      final a = await SoLoud.instance
          .loadFile(_pares[0].original.path, mode: LoadMode.disk);
      final b = await SoLoud.instance
          .loadFile(_pares[0].invertida.path, mode: LoadMode.disk);

      final t0 = SoLoud.instance.getEngineTime() + const Duration(milliseconds: 150);
      SoLoud.instance.playScheduled(a, t0);
      SoLoud.instance.playScheduled(b, t0);

      // Medimos al principio y al final: si hay deriva, el residuo sube.
      final alPrincipio = await _medirPicoDb(const Duration(seconds: 2));
      await Future<void>.delayed(total);
      final alFinal = await _medirPicoDb(const Duration(seconds: 2));

      await _silenciarTodo();
      final empeoro = alFinal - alPrincipio;
      return ResultadoPrueba(
        nombre: nombre,
        descripcion: 'Residuo al inicio vs. después de '
            '${total.inSeconds}s: ${alPrincipio.toStringAsFixed(1)} → '
            '${alFinal.toStringAsFixed(1)} dBFS.',
        residualDb: alFinal,
        paso: alFinal < kUmbralAprobadoDb,
        nota: empeoro > 6
            ? 'El residuo creció ${empeoro.toStringAsFixed(1)} dB: hay deriva.'
            : null,
      );
    } catch (e) {
      return ResultadoPrueba(
        nombre: nombre,
        descripcion: 'Deriva en el tiempo.',
        error: '$e',
        paso: false,
      );
    }
  }

  Future<List<ResultadoPrueba>> correrTodo() async {
    final resultados = <ResultadoPrueba>[];
    await preparar();

    _avisar('1/7 · Dos voces…');
    resultados.add(await mecanismoProgramado(pares: 1));

    _avisar('2/7 · ${kCantidadPares * 2} voces (como 6 stems)…');
    resultados.add(await mecanismoProgramado(pares: kCantidadPares));

    _avisar('3/7 · Reanudar desde una posición…');
    resultados.add(await reanudarDesdePosicion());

    _avisar('4/7 · Velocidad 0.5×…');
    resultados.add(await aVelocidad(0.5));

    _avisar('5/7 · Velocidad 2×…');
    resultados.add(await aVelocidad(2));

    _avisar('6/7 · Plan alternativo (grupo de voces)…');
    resultados.add(await mecanismoGrupo(pares: kCantidadPares));

    _avisar('7/7 · Deriva en el tiempo (tarda ~30s)…');
    resultados.add(await deriva());

    _avisar('Listo.');
    return resultados;
  }

  Future<void> limpiar() async {
    await _silenciarTodo();
    try {
      if (_carpeta != null && _carpeta!.existsSync()) {
        _carpeta!.deleteSync(recursive: true);
      }
    } catch (_) {
      // Si no se puede borrar el cache de prueba, no es crítico.
    }
  }
}
