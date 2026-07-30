import 'dart:async';
import 'dart:io';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_soloud/flutter_soloud.dart';

import '../audio/importar.dart';
import '../audio/motor.dart';
import '../tema.dart';
import 'diagnostico.dart';

class PantallaEstudio extends StatefulWidget {
  const PantallaEstudio({super.key});

  @override
  State<PantallaEstudio> createState() => _PantallaEstudioState();
}

class _PantallaEstudioState extends State<PantallaEstudio> {
  final _motor = MotorAudio();
  Timer? _reloj;
  Duration _posicion = Duration.zero;
  bool _cargando = false;
  String _estado = '';
  bool _motorListo = false;

  @override
  void initState() {
    super.initState();
    _arrancarMotor();
  }

  Future<void> _arrancarMotor() async {
    try {
      await SoLoud.instance.init(
        sampleRate: 44100,
        bufferSize: 2048,
        channels: Channels.stereo,
      );
      // El máximo por defecto (16) alcanzaría, pero si algún día se suman
      // plugins sonando encima, SoLoud empezaría a robar voces y una pista
      // dejaría de sonar sin decir nada.
      SoLoud.instance.setMaxActiveVoiceCount(64);
      if (mounted) setState(() => _motorListo = true);
    } catch (e) {
      if (mounted) setState(() => _estado = 'No pude arrancar el audio: $e');
    }
  }

  @override
  void dispose() {
    _reloj?.cancel();
    _motor.limpiar();
    super.dispose();
  }

  void _arrancarReloj() {
    _reloj?.cancel();
    _reloj = Timer.periodic(const Duration(milliseconds: 60), (_) {
      if (!mounted) return;
      setState(() => _posicion = _motor.posicion);
      if (_motor.llegoAlFinal) _detener();
    });
  }

  Future<void> _elegirArchivo() async {
    // Sin filtro de tipos: en Android filtrar por extensión esconde archivos
    // que el usuario sí tiene (los .zip suelen quedar afuera según el gestor
    // de archivos). Validamos el contenido nosotros al abrirlo.
    final elegido = await openFile();
    final ruta = elegido?.path;
    if (ruta == null || ruta.isEmpty) return;

    setState(() {
      _cargando = true;
      _estado = 'Preparando…';
    });

    try {
      await _motor.limpiar();
      final pistas = await cargarDesdeArchivo(
        File(ruta),
        onProgreso: (m) {
          if (mounted) setState(() => _estado = m);
        },
      );
      if (pistas.isEmpty) {
        setState(() {
          _estado = 'No encontré audio ahí adentro. ¿Es el .zip que te dio la '
              'separación con IA?';
          _cargando = false;
        });
        return;
      }
      for (final p in pistas) {
        _motor.agregar(p);
      }
      setState(() {
        _cargando = false;
        _estado = '';
        _posicion = Duration.zero;
      });
    } catch (e) {
      setState(() {
        _cargando = false;
        _estado = 'No pude abrirlo: $e';
      });
    }
  }

  Future<void> _tocarOPausar() async {
    if (_motor.reproduciendo) {
      _motor.pausar();
      _reloj?.cancel();
    } else {
      await _motor.reproducir();
      _arrancarReloj();
    }
    if (mounted) setState(() {});
  }

  Future<void> _detener() async {
    _reloj?.cancel();
    await _motor.detener();
    if (mounted) {
      setState(() => _posicion = Duration.zero);
    }
  }

  String _tiempo(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final hayPistas = _motor.pistas.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Tema.panel,
        title: const Text(
          'Estudio de Música',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
        ),
        actions: [
          IconButton(
            tooltip: 'Diagnóstico de sincronización',
            icon: const Icon(Icons.speed, size: 20),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const PantallaDiagnostico(),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: !_motorListo
            ? Center(
                child: _estado.isEmpty
                    ? const CircularProgressIndicator(color: Tema.accion)
                    : Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(
                          _estado,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Tema.mal),
                        ),
                      ),
              )
            : Column(
                children: [
                  Expanded(
                    child: _cargando
                        ? _Cargando(estado: _estado)
                        : (hayPistas ? _listaDePistas() : _vacio()),
                  ),
                  if (hayPistas) _transporte(),
                ],
              ),
      ),
    );
  }

  Widget _vacio() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.graphic_eq, size: 56, color: Tema.textoSuave),
            const SizedBox(height: 18),
            const Text(
              'Abrí tus instrumentos',
              style: TextStyle(
                color: Tema.texto,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'Elegí el .zip que te dio la separación con IA en '
              'arte.vawol.com, y suenan todos juntos acá.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Tema.textoSuave, fontSize: 14, height: 1.5),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _elegirArchivo,
              icon: const Icon(Icons.folder_open, size: 18),
              style: FilledButton.styleFrom(
                backgroundColor: Tema.accion,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(26),
                ),
              ),
              label: const Text('Elegir archivo'),
            ),
            if (_estado.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(
                _estado,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Tema.mal, fontSize: 13),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _listaDePistas() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
      children: [
        for (final p in _motor.pistas)
          _FilaPista(
            pista: p,
            motor: _motor,
            onCambio: () => setState(() {}),
          ),
        const SizedBox(height: 10),
        Center(
          child: TextButton.icon(
            onPressed: _elegirArchivo,
            icon: const Icon(Icons.folder_open, size: 16),
            label: const Text('Abrir otra canción'),
            style: TextButton.styleFrom(foregroundColor: Tema.textoSuave),
          ),
        ),
      ],
    );
  }

  Widget _transporte() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: const BoxDecoration(
        color: Tema.panel,
        border: Border(top: BorderSide(color: Tema.borde)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                onPressed: _detener,
                icon: const Icon(Icons.stop, size: 22),
                color: Tema.textoSuave,
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _tocarOPausar,
                child: Container(
                  width: 58,
                  height: 58,
                  decoration: const BoxDecoration(
                    color: Tema.accion,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _motor.reproduciendo ? Icons.pause : Icons.play_arrow,
                    color: Colors.white,
                    size: 30,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Text(
                '${_tiempo(_posicion)} / ${_tiempo(_motor.duracionTotal)}',
                style: const TextStyle(
                  color: Tema.textoSuave,
                  fontSize: 13,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.speed, size: 16, color: Tema.textoSuave),
              Expanded(
                child: Slider(
                  value: _motor.velocidad.clamp(0.5, 2),
                  min: 0.5,
                  max: 2,
                  divisions: 30,
                  activeColor: Tema.accion,
                  inactiveColor: Tema.borde,
                  onChanged: (v) => setState(() => _motor.setVelocidad(v)),
                ),
              ),
              SizedBox(
                width: 42,
                child: Text(
                  '${_motor.velocidad.toStringAsFixed(2)}×',
                  style: const TextStyle(
                    color: Tema.textoSuave,
                    fontSize: 12,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Cargando extends StatelessWidget {
  const _Cargando({required this.estado});
  final String estado;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: Tema.accion),
          const SizedBox(height: 18),
          Text(estado, style: const TextStyle(color: Tema.textoSuave, fontSize: 13)),
        ],
      ),
    );
  }
}

class _FilaPista extends StatelessWidget {
  const _FilaPista({
    required this.pista,
    required this.motor,
    required this.onCambio,
  });

  final Pista pista;
  final MotorAudio motor;
  final VoidCallback onCambio;

  @override
  Widget build(BuildContext context) {
    final apagada = motor.gananciaEfectiva(pista) == 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      decoration: BoxDecoration(
        color: Tema.panel,
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: pista.color, width: 4)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  pista.nombre,
                  style: TextStyle(
                    color: apagada ? Tema.textoSuave : Tema.texto,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              _Boton(
                texto: 'M',
                activo: pista.muteada,
                colorActivo: Tema.mal,
                onTap: () {
                  motor.toggleMute(pista);
                  onCambio();
                },
              ),
              const SizedBox(width: 6),
              _Boton(
                texto: 'S',
                activo: pista.soleada,
                colorActivo: Tema.accion,
                onTap: () {
                  motor.toggleSolo(pista);
                  onCambio();
                },
              ),
            ],
          ),
          Row(
            children: [
              const Icon(Icons.volume_up, size: 15, color: Tema.textoSuave),
              Expanded(
                child: Slider(
                  value: pista.volumen,
                  max: 1.5,
                  activeColor: pista.color,
                  inactiveColor: Tema.borde,
                  onChanged: (v) {
                    motor.setVolumen(pista, v);
                    onCambio();
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Boton extends StatelessWidget {
  const _Boton({
    required this.texto,
    required this.activo,
    required this.colorActivo,
    required this.onTap,
  });

  final String texto;
  final bool activo;
  final Color colorActivo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 34,
        height: 30,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: activo ? colorActivo : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: activo ? colorActivo : Tema.borde),
        ),
        child: Text(
          texto,
          style: TextStyle(
            color: activo ? Colors.white : Tema.textoSuave,
            fontSize: 13,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
