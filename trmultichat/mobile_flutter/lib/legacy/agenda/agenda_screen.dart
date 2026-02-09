import 'package:flutter/material.dart';

class AgendaScreen extends StatelessWidget {
  const AgendaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agenda')),
      body: const SafeArea(
        child: Center(
          child: Text('Em breve: consumir /agenda/events e exibir calendário.'),
        ),
      ),
    );
  }
}

