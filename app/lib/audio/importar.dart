import 'dart:io';
import 'dart:ui' show Color;

import 'package:archive/archive.dart';
import 'package:flutter_soloud/flutter_soloud.dart';
import 'package:path_provider/path_provider.dart';

import 'motor.dart';

/// Cómo se llama y de qué color se ve cada instrumento que devuelve Demucs.
/// Mismos nombres y colores que la web (`web/src/lib/importarStems.js` y
/// `web/src/index.css`) para que el Estudio se vea igual en los dos lados.
class _Reconocido {
  const _Reconocido(this.patron, this.nombre, this.color);
  final RegExp patron;
  final String nombre;
  final Color color;
}

final _reconocidos = <_Reconocido>[
  _Reconocido(RegExp(r'vocals?', caseSensitive: false), 'Voz', const Color(0xFFE67E22)),
  _Reconocido(RegExp(r'drums?', caseSensitive: false), 'Batería', const Color(0xFFF1C40F)),
  _Reconocido(RegExp(r'bass', caseSensitive: false), 'Bajo', const Color(0xFF9B59B6)),
  _Reconocido(RegExp(r'piano', caseSensitive: false), 'Piano', const Color(0xFF27AE60)),
  _Reconocido(RegExp(r'guitar', caseSensitive: false), 'Guitarra', const Color(0xFF3498DB)),
  _Reconocido(RegExp(r'other', caseSensitive: false), 'Otros', const Color(0xFF95A5A6)),
];

const _colorPorDefecto = Color(0xFF95A5A6);

final _esAudio = RegExp(r'\.(wav|mp3|m4a|ogg|flac|aac)$', caseSensitive: false);

({String nombre, Color color}) _identificar(String archivo) {
  for (final r in _reconocidos) {
    if (r.patron.hasMatch(archivo)) return (nombre: r.nombre, color: r.color);
  }
  final limpio = archivo.split('/').last.replaceAll(RegExp(r'\.[^.]+$'), '');
  return (nombre: limpio, color: _colorPorDefecto);
}

/// Carpeta donde quedan los stems de la sesión actual.
Future<Directory> _carpetaDeStems() async {
  final base = await getApplicationDocumentsDirectory();
  final carpeta = Directory('${base.path}/stems');
  if (carpeta.existsSync()) carpeta.deleteSync(recursive: true);
  carpeta.createSync(recursive: true);
  return carpeta;
}

/// Carga las pistas de un archivo: acepta el .zip que devuelve la separación
/// con IA, o archivos de audio sueltos.
///
/// Los stems se dejan en disco y se reproducen en modo streaming
/// ([LoadMode.disk]) en vez de cargarlos enteros en memoria: seis pistas de
/// una canción de 4 minutos descomprimidas serían cientos de megas, que en un
/// teléfono no entran.
Future<List<Pista>> cargarDesdeArchivo(
  File archivo, {
  void Function(String)? onProgreso,
}) async {
  final carpeta = await _carpetaDeStems();
  final rutas = <String>[];

  if (archivo.path.toLowerCase().endsWith('.zip')) {
    onProgreso?.call('Abriendo el archivo…');
    final zip = ZipDecoder().decodeBytes(await archivo.readAsBytes());
    for (final entrada in zip.files) {
      if (!entrada.isFile || !_esAudio.hasMatch(entrada.name)) continue;
      final destino = File('${carpeta.path}/${entrada.name.split('/').last}');
      await destino.writeAsBytes(entrada.content as List<int>, flush: true);
      rutas.add(destino.path);
    }
  } else if (_esAudio.hasMatch(archivo.path)) {
    final destino = File('${carpeta.path}/${archivo.path.split('/').last}');
    await archivo.copy(destino.path);
    rutas.add(destino.path);
  }

  rutas.sort();

  final pistas = <Pista>[];
  for (final ruta in rutas) {
    final nombreArchivo = ruta.split('/').last;
    onProgreso?.call('Cargando $nombreArchivo…');
    final fuente = await SoLoud.instance.loadFile(ruta, mode: LoadMode.disk);
    final info = _identificar(nombreArchivo);
    pistas.add(Pista(
      id: ruta,
      nombre: info.nombre,
      color: info.color,
      fuente: fuente,
      duracion: SoLoud.instance.getLength(fuente),
    ));
  }

  return pistas;
}
