import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:vawol_estudio/audio/wav.dart';

/// El codificador WAV es el mismo algoritmo que usa la web para exportar
/// (`web/src/lib/wavEncoder.js`). Es la pieza de la que depende que una mezcla
/// exportada suene bien, así que conviene tenerla cubierta: son pruebas que
/// corren en CI sin necesidad de un teléfono.
void main() {
  String texto(Uint8List b, int desde, int largo) =>
      String.fromCharCodes(b.sublist(desde, desde + largo));

  test('escribe un header RIFF/WAVE válido', () {
    final wav = codificarWav(
      canales: [Float32List(4), Float32List(4)],
      sampleRate: 44100,
    );

    expect(texto(wav, 0, 4), 'RIFF');
    expect(texto(wav, 8, 4), 'WAVE');
    expect(texto(wav, 12, 4), 'fmt ');
    expect(texto(wav, 36, 4), 'data');

    final v = ByteData.view(wav.buffer);
    expect(v.getUint16(20, Endian.little), 1, reason: 'formato PCM');
    expect(v.getUint16(22, Endian.little), 2, reason: 'estéreo');
    expect(v.getUint32(24, Endian.little), 44100);
    expect(v.getUint32(28, Endian.little), 44100 * 4, reason: 'byte rate');
    expect(v.getUint16(32, Endian.little), 4, reason: 'block align');
    expect(v.getUint16(34, Endian.little), 16, reason: 'bits por muestra');
  });

  test('el tamaño total es 44 bytes de header + los datos', () {
    final wav = codificarWav(
      canales: [Float32List(100), Float32List(100)],
      sampleRate: 44100,
    );
    // 100 muestras × 2 canales × 2 bytes
    expect(wav.length, 44 + 400);
    expect(
      ByteData.view(wav.buffer).getUint32(40, Endian.little),
      400,
      reason: 'el chunk data declara su tamaño real',
    );
  });

  test('intercala los canales muestra por muestra', () {
    final izq = Float32List.fromList([1.0, 0.0]);
    final der = Float32List.fromList([0.0, -1.0]);
    final wav = codificarWav(canales: [izq, der], sampleRate: 44100);
    final v = ByteData.view(wav.buffer);

    // Orden esperado: L0, R0, L1, R1
    expect(v.getInt16(44, Endian.little), 0x7fff, reason: 'L0 = +1');
    expect(v.getInt16(46, Endian.little), 0, reason: 'R0 = 0');
    expect(v.getInt16(48, Endian.little), 0, reason: 'L1 = 0');
    expect(v.getInt16(50, Endian.little), -0x8000, reason: 'R1 = -1');
  });

  test('recorta los valores que se pasan de rango en vez de dar la vuelta', () {
    // Un desborde silencioso sonaría como un chasquido horrible, así que esto
    // importa de verdad.
    final wav = codificarWav(
      canales: [Float32List.fromList([5.0, -5.0])],
      sampleRate: 44100,
    );
    final v = ByteData.view(wav.buffer);
    expect(v.getInt16(44, Endian.little), 0x7fff);
    expect(v.getInt16(46, Endian.little), -0x8000);
  });

  test('acepta mono', () {
    final wav = codificarWav(
      canales: [Float32List(10)],
      sampleRate: 48000,
    );
    final v = ByteData.view(wav.buffer);
    expect(v.getUint16(22, Endian.little), 1, reason: 'un solo canal');
    expect(v.getUint32(24, Endian.little), 48000);
    expect(wav.length, 44 + 20);
  });
}
