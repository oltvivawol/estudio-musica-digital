import 'dart:typed_data';

/// Codificador WAV PCM 16-bit. Puerto directo de `web/src/lib/wavEncoder.js`
/// (mismo header RIFF, mismo escalado asimétrico al clampear) para que un WAV
/// exportado desde la app y uno exportado desde la web salgan byte a byte
/// iguales — así el export no "suena distinto" según de dónde venga.
Uint8List codificarWav({
  required List<Float32List> canales,
  required int sampleRate,
}) {
  final numCanales = canales.length;
  final numMuestras = canales.isEmpty ? 0 : canales.first.length;
  final blockAlign = numCanales * 2;
  final tamanoDatos = numMuestras * blockAlign;

  final bytes = Uint8List(44 + tamanoDatos);
  final vista = ByteData.view(bytes.buffer);

  void escribirTexto(int offset, String texto) {
    for (var i = 0; i < texto.length; i++) {
      bytes[offset + i] = texto.codeUnitAt(i);
    }
  }

  escribirTexto(0, 'RIFF');
  vista.setUint32(4, 36 + tamanoDatos, Endian.little);
  escribirTexto(8, 'WAVE');
  escribirTexto(12, 'fmt ');
  vista.setUint32(16, 16, Endian.little); // tamaño del chunk fmt
  vista.setUint16(20, 1, Endian.little); // 1 = PCM sin comprimir
  vista.setUint16(22, numCanales, Endian.little);
  vista.setUint32(24, sampleRate, Endian.little);
  vista.setUint32(28, sampleRate * blockAlign, Endian.little); // byte rate
  vista.setUint16(32, blockAlign, Endian.little);
  vista.setUint16(34, 16, Endian.little); // bits por muestra
  escribirTexto(36, 'data');
  vista.setUint32(40, tamanoDatos, Endian.little);

  // Intercalado canal por canal, con el mismo clamp/escalado que la web:
  // los negativos usan 0x8000 y los positivos 0x7fff (el rango de int16 no
  // es simétrico).
  var offset = 44;
  for (var i = 0; i < numMuestras; i++) {
    for (var ch = 0; ch < numCanales; ch++) {
      final muestra = canales[ch][i].clamp(-1.0, 1.0);
      final valor = muestra < 0 ? muestra * 0x8000 : muestra * 0x7fff;
      vista.setInt16(offset, valor.round(), Endian.little);
      offset += 2;
    }
  }

  return bytes;
}
