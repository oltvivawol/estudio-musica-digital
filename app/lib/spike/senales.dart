import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import '../audio/wav.dart';

/// Un par de señales para la prueba nula: la misma señal y su inversión exacta.
/// Si suenan perfectamente alineadas, se cancelan y la salida es silencio.
class ParNulo {
  const ParNulo({required this.original, required this.invertida});
  final File original;
  final File invertida;
}

/// Genera un par (señal, señal invertida) en WAV sobre disco.
///
/// Usamos ruido blanco porque es la señal más exigente para esta prueba: al
/// tener energía en todas las frecuencias, un desfasaje de UNA sola muestra ya
/// deja de cancelar y reaparece fuerte (la suma se comporta como un
/// derivador). Una senoidal, en cambio, podría cancelar "de casualidad".
///
/// La semilla fija hace que cada corrida genere exactamente la misma señal,
/// así los resultados son comparables entre ejecuciones y entre dispositivos.
Future<ParNulo> generarParNulo({
  required Directory carpeta,
  required int indice,
  required int sampleRate,
  required Duration duracion,
}) async {
  final n = (duracion.inMilliseconds * sampleRate / 1000).round();
  final rnd = Random(1000 + indice);

  final izq = Float32List(n);
  final der = Float32List(n);
  final izqInv = Float32List(n);
  final derInv = Float32List(n);

  for (var i = 0; i < n; i++) {
    // 0.5 de amplitud deja margen: la suma de 6 pistas no satura.
    final l = (rnd.nextDouble() * 2 - 1) * 0.5;
    final r = (rnd.nextDouble() * 2 - 1) * 0.5;
    izq[i] = l;
    der[i] = r;
    izqInv[i] = -l;
    derInv[i] = -r;
  }

  final original = File('${carpeta.path}/senal_$indice.wav');
  final invertida = File('${carpeta.path}/senal_${indice}_inv.wav');

  await original.writeAsBytes(
    codificarWav(canales: [izq, der], sampleRate: sampleRate),
    flush: true,
  );
  await invertida.writeAsBytes(
    codificarWav(canales: [izqInv, derInv], sampleRate: sampleRate),
    flush: true,
  );

  return ParNulo(original: original, invertida: invertida);
}
