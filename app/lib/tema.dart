import 'package:flutter/material.dart';

/// Paleta del Estudio, la misma que arte.vawol.com (`web/src/index.css`), para
/// que la app y la web se sientan el mismo producto.
abstract final class Tema {
  static const fondo = Color(0xFF16232F);
  static const panel = Color(0xFF1E2E3D);
  static const borde = Color(0xFF2C4054);
  static const accion = Color(0xFFE67E22);
  static const texto = Color(0xFFE8EDF2);
  static const textoSuave = Color(0xFF8FA3B5);
  static const ok = Color(0xFF27AE60);
  static const mal = Color(0xFFE74C3C);

  static ThemeData get datos => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: fondo,
        colorScheme: ColorScheme.fromSeed(
          seedColor: accion,
          brightness: Brightness.dark,
        ).copyWith(surface: fondo),
        appBarTheme: const AppBarTheme(
          backgroundColor: panel,
          foregroundColor: texto,
          elevation: 0,
          centerTitle: false,
        ),
      );
}
