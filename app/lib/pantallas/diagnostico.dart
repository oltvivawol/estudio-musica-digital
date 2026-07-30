import 'package:flutter/material.dart';

import '../spike/prueba_sincro.dart';
import '../tema.dart';

/// Pantalla de diagnóstico: mide si las pistas arrancan realmente juntas.
/// No es parte del Estudio en sí — es la herramienta que decide si el motor de
/// audio es confiable. Se llega desde el ícono del velocímetro.
class PantallaDiagnostico extends StatefulWidget {
  const PantallaDiagnostico({super.key});

  @override
  State<PantallaDiagnostico> createState() => _EstadoDiagnostico();
}

class _EstadoDiagnostico extends State<PantallaDiagnostico> {
  List<ResultadoPrueba> _resultados = [];
  String _estado = '';
  bool _corriendo = false;
  bool _termino = false;

  Future<void> _correr() async {
    setState(() {
      _corriendo = true;
      _termino = false;
      _resultados = [];
      _estado = 'Preparando…';
    });

    final prueba = PruebaSincro(
      onProgreso: (m) {
        if (mounted) setState(() => _estado = m);
      },
    );

    try {
      final r = await prueba.correrTodo();
      if (mounted) {
        setState(() {
          _resultados = r;
          _corriendo = false;
          _termino = true;
          _estado = '';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _corriendo = false;
          _estado = 'Se cortó: $e';
        });
      }
    } finally {
      await prueba.limpiar();
    }
  }

  bool get _todoOk =>
      _resultados.isNotEmpty && _resultados.every((r) => r.paso == true);

  bool get _mecanismoAOk => _resultados
      .where((r) => r.nombre.startsWith('Mecanismo A'))
      .every((r) => r.paso == true);

  bool get _mecanismoBOk => _resultados
      .where((r) => r.nombre.startsWith('Mecanismo B'))
      .every((r) => r.paso == true);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
          children: [
            const Text(
              'Estudio de Música Digital',
              style: TextStyle(
                color: Tema.texto,
                fontSize: 26,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'VAWOL · prueba de sincronización',
              style: TextStyle(color: Tema.accion, fontSize: 14, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Tema.panel,
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Text(
                'Antes de construir el Estudio nativo hay que probar una cosa: '
                'que varias pistas puedan arrancar exactamente juntas, al sample. '
                'Sin eso no hay estudio multipista posible.\n\n'
                'La prueba reproduce una señal junto con su copia invertida. Si '
                'arrancan alineadas se anulan y sale silencio; cualquier desfasaje '
                'reaparece como ruido. Es una medición objetiva, no depende del oído.',
                style: TextStyle(color: Tema.textoSuave, fontSize: 13, height: 1.5),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              height: 52,
              child: FilledButton(
                onPressed: _corriendo ? null : _correr,
                style: FilledButton.styleFrom(
                  backgroundColor: Tema.accion,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(26),
                  ),
                ),
                child: Text(
                  _corriendo
                      ? 'Midiendo…'
                      : (_termino ? 'Correr de nuevo' : 'Correr la prueba'),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
            ),
            if (_corriendo) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Tema.accion),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _estado,
                      style: const TextStyle(color: Tema.textoSuave, fontSize: 13),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Subí el volumen para escuchar: si la sincronización es buena, '
                'casi no vas a oír nada aunque esté sonando.',
                style: TextStyle(color: Tema.textoSuave, fontSize: 11, height: 1.4),
              ),
            ],
            if (!_corriendo && _estado.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(_estado, style: const TextStyle(color: Tema.mal, fontSize: 13)),
            ],
            if (_termino) ...[
              const SizedBox(height: 24),
              _Veredicto(
                todoOk: _todoOk,
                mecanismoAOk: _mecanismoAOk,
                mecanismoBOk: _mecanismoBOk,
              ),
            ],
            const SizedBox(height: 20),
            ..._resultados.map((r) => _Fila(resultado: r)),
          ],
        ),
      ),
    );
  }
}

class _Veredicto extends StatelessWidget {
  const _Veredicto({
    required this.todoOk,
    required this.mecanismoAOk,
    required this.mecanismoBOk,
  });

  final bool todoOk;
  final bool mecanismoAOk;
  final bool mecanismoBOk;

  @override
  Widget build(BuildContext context) {
    late final String titulo;
    late final String detalle;
    late final Color color;

    if (todoOk) {
      titulo = '✓ Se puede avanzar';
      detalle = 'La sincronización al sample funciona. El Estudio nativo se '
          'puede construir sobre este motor.';
      color = Tema.ok;
    } else if (mecanismoAOk) {
      titulo = '✓ Se puede avanzar (con reservas)';
      detalle = 'El mecanismo principal funciona. Mirá abajo qué prueba puntual '
          'falló para saber qué evitar.';
      color = Tema.ok;
    } else if (mecanismoBOk) {
      titulo = '~ Se puede avanzar por el plan alternativo';
      detalle = 'El arranque programado no da, pero el grupo de voces sí. Se '
          'construye con ese mecanismo.';
      color = Tema.accion;
    } else {
      titulo = '✗ Hay que pivotear';
      detalle = 'Ningún mecanismo sincroniza. Este motor no sirve para el '
          'Estudio: hay que ir a un motor propio (Oboe/C++), que es bastante '
          'más trabajo. Mejor saberlo ahora que en tres semanas.';
      color = Tema.mal;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            titulo,
            style: TextStyle(color: color, fontSize: 17, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          Text(
            detalle,
            style: const TextStyle(color: Tema.texto, fontSize: 13, height: 1.45),
          ),
        ],
      ),
    );
  }
}

class _Fila extends StatelessWidget {
  const _Fila({required this.resultado});

  final ResultadoPrueba resultado;

  @override
  Widget build(BuildContext context) {
    final paso = resultado.paso == true;
    final color = paso ? Tema.ok : Tema.mal;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Tema.panel,
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: color, width: 3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(paso ? Icons.check_circle : Icons.cancel, color: color, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  resultado.nombre,
                  style: const TextStyle(
                    color: Tema.texto,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            resultado.descripcion,
            style: const TextStyle(color: Tema.textoSuave, fontSize: 12, height: 1.4),
          ),
          if (resultado.residualDb != null) ...[
            const SizedBox(height: 8),
            Text(
              'Residuo: ${resultado.residualDb!.toStringAsFixed(1)} dBFS'
              '${resultado.cancelacionDb != null ? '  ·  cancela '
                  '${resultado.cancelacionDb!.toStringAsFixed(1)} dB' : ''}',
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
          if (resultado.error != null) ...[
            const SizedBox(height: 8),
            Text(
              resultado.error!,
              style: const TextStyle(color: Tema.mal, fontSize: 11, height: 1.4),
            ),
          ],
          if (resultado.nota != null) ...[
            const SizedBox(height: 8),
            Text(
              resultado.nota!,
              style: const TextStyle(color: Tema.accion, fontSize: 11, height: 1.4),
            ),
          ],
        ],
      ),
    );
  }
}
