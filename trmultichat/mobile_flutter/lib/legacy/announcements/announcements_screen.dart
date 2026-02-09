import 'package:flutter/material.dart';

class AnnouncementsScreen extends StatelessWidget {
  const AnnouncementsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Comunicados internos')),
      body: const SafeArea(
        child: Center(
          child: Text('Em breve: listar /announcements e replies.'),
        ),
      ),
    );
  }
}

