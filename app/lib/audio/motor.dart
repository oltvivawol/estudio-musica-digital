import 'dart:ui' show Color;

import 'package:flutter_soloud/flutter_soloud.dart';

/// Una pista del Estudio (un instrumento separado de la canción).
class Pista {
  Pista({
    required this.id,
    required this.nombre,
    required this.color,
    required this.fuente,
    required this.duracion,
  });

  final String id;
  final String nombre;
  final Color color;
  final AudioSource fuente;
  final Duration duracion;

  double volumen = 1;
  bool muteada = false;
  bool soleada = false;

  SoundHandle? handle;
}

/// Motor de audio multipista. Puerto de `web/src/lib/audioEngine.js`.
///
/// Lo que hace que esto sea un estudio y no un reproductor: todas las pistas
/// arrancan en el MISMO instante absoluto del reloj del motor
/// (`playScheduled` a un `t0` común), igual que la web con
/// `source.start(cuando)`. Si cada pista arrancara por su cuenta, se
/// escucharían desfasadas.
///
/// Diferencia importante con la web, y a propósito: acá pausar NO para las
/// voces para después reposicionarlas — las mete en un grupo y las pausa
/// juntas. Al despausar retoman exactamente donde estaban, sin tener que
/// buscar una posición (que es la operación menos confiable, sobre todo con
/// MP3). Es más simple y más seguro.
class MotorAudio {
  final List<Pista> pistas = [];

  double velocidad = 1;
  bool get reproduciendo => _grupo != null && !_pausado;
  bool get pausado => _pausado;
  bool get hayAlgoCargado => pistas.isNotEmpty;

  SoundHandle? _grupo;
  bool _pausado = false;

  Duration get duracionTotal => pistas.fold(
        Duration.zero,
        (max, p) => p.duracion > max ? p.duracion : max,
      );

  /// La regla de mezcla, idéntica a la web: muteada manda; si hay alguna
  /// soleada, las demás se callan.
  double gananciaEfectiva(Pista p) {
    if (p.muteada) return 0;
    if (pistas.any((x) => x.soleada) && !p.soleada) return 0;
    return p.volumen;
  }

  void agregar(Pista p) => pistas.add(p);

  Future<void> limpiar() async {
    await detener();
    for (final p in pistas) {
      try {
        await SoLoud.instance.disposeSource(p.fuente);
      } catch (_) {
        // Si ya estaba liberada, seguimos.
      }
    }
    pistas.clear();
  }

  Future<void> reproducir() async {
    if (pistas.isEmpty) return;

    // Si está pausado, retomamos donde quedó: las voces conservan su posición.
    if (_grupo != null && _pausado) {
      SoLoud.instance.setPause(_grupo!, false);
      _pausado = false;
      return;
    }
    if (_grupo != null) return; // ya está sonando

    // Margen para alcanzar a programar todas las voces antes de que llegue el
    // instante: si t0 quedara en el pasado, arrancarían descoordinadas.
    final t0 = SoLoud.instance.getEngineTime() + const Duration(milliseconds: 150);
    final handles = <SoundHandle>[];

    for (final p in pistas) {
      final h = SoLoud.instance.playScheduled(
        p.fuente,
        t0,
        volume: gananciaEfectiva(p),
      );
      // Sin esto, SoLoud puede "robar" la voz si se pasa del máximo activo y
      // una pista dejaría de sonar sin aviso.
      SoLoud.instance.setProtectVoice(h, true);
      if (velocidad != 1) {
        SoLoud.instance.setRelativePlaySpeed(h, velocidad);
      }
      p.handle = h;
      handles.add(h);
    }

    final grupo = SoLoud.instance.createVoiceGroup();
    SoLoud.instance.addVoicesToGroup(grupo, handles);
    _grupo = grupo;
    _pausado = false;
  }

  void pausar() {
    if (_grupo == null || _pausado) return;
    SoLoud.instance.setPause(_grupo!, true);
    _pausado = true;
  }

  Future<void> detener() async {
    for (final p in pistas) {
      final h = p.handle;
      if (h != null) {
        try {
          await SoLoud.instance.stop(h);
        } catch (_) {
          // Puede haber terminado sola.
        }
        p.handle = null;
      }
    }
    if (_grupo != null) {
      try {
        SoLoud.instance.destroyVoiceGroup(_grupo!);
      } catch (_) {
        // Si el grupo ya no existe, no importa.
      }
    }
    _grupo = null;
    _pausado = false;
  }

  /// Posición actual de la reproducción. La leemos de una voz viva en vez de
  /// calcularla con un cronómetro: así el cabezal muestra dónde está el audio
  /// de verdad, no dónde debería estar.
  Duration get posicion {
    for (final p in pistas) {
      final h = p.handle;
      if (h != null) {
        try {
          return SoLoud.instance.getPosition(h);
        } catch (_) {
          continue;
        }
      }
    }
    return Duration.zero;
  }

  bool get llegoAlFinal =>
      _grupo != null && !_pausado && posicion >= duracionTotal - const Duration(milliseconds: 120);

  void setVolumen(Pista p, double valor) {
    p.volumen = valor.clamp(0, 1.5);
    _aplicarGanancias();
  }

  void toggleMute(Pista p) {
    p.muteada = !p.muteada;
    _aplicarGanancias();
  }

  void toggleSolo(Pista p) {
    p.soleada = !p.soleada;
    _aplicarGanancias();
  }

  void _aplicarGanancias() {
    for (final p in pistas) {
      final h = p.handle;
      if (h != null) SoLoud.instance.setVolume(h, gananciaEfectiva(p));
    }
  }

  /// Velocidad global de toda la mezcla (el equivalente de `playbackRate`).
  /// Cambia el tempo y el tono a la vez, como acelerar un disco — igual que la
  /// web, a propósito.
  void setVelocidad(double valor) {
    velocidad = valor.clamp(0.25, 4);
    for (final p in pistas) {
      final h = p.handle;
      if (h != null) SoLoud.instance.setRelativePlaySpeed(h, velocidad);
    }
  }
}
