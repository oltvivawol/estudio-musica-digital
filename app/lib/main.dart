import 'package:flutter/material.dart';

import 'pantallas/estudio.dart';
import 'tema.dart';

void main() => runApp(const AppEstudio());

class AppEstudio extends StatelessWidget {
  const AppEstudio({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Estudio de Música Digital VAWOL',
      debugShowCheckedModeBanner: false,
      theme: Tema.datos,
      home: const PantallaEstudio(),
    );
  }
}
