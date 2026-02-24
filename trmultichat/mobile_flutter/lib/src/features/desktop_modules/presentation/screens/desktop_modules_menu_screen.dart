import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class DesktopModulesMenuScreen extends StatelessWidget {
  const DesktopModulesMenuScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final modules = <_ModuleItem>[
      const _ModuleItem('Dashboard', Icons.dashboard_outlined, '/desktop/dashboard'),
      const _ModuleItem('Financeiro', Icons.payments_outlined, '/desktop/finance'),
      const _ModuleItem('Tarefa', Icons.checklist_rtl_outlined, '/desktop/todo'),
      const _ModuleItem('Respostas rápidas', Icons.quickreply_outlined, '/desktop/quick-messages'),
      const _ModuleItem('Configurações', Icons.settings_outlined, '/desktop/settings'),
      const _ModuleItem('Usuários', Icons.group_outlined, '/desktop/module/usuarios'),
      const _ModuleItem('Filas', Icons.account_tree_outlined, '/desktop/module/filas'),
      const _ModuleItem('Conexões', Icons.wifi_tethering_outlined, '/desktop/module/conexoes'),
      const _ModuleItem('Tags', Icons.sell_outlined, '/desktop/module/tags'),
      const _ModuleItem('Arquivos', Icons.folder_outlined, '/desktop/module/arquivos'),
      const _ModuleItem('Campanhas', Icons.campaign_outlined, '/desktop/module/campanhas'),
      const _ModuleItem('Planos', Icons.workspace_premium_outlined, '/desktop/module/planos'),
      const _ModuleItem('Ajuda', Icons.help_outline, '/desktop/module/ajuda'),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('Módulos')),
      body: GridView.builder(
        padding: const EdgeInsets.all(14),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 4,
          childAspectRatio: 1.35,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
        ),
        itemCount: modules.length,
        itemBuilder: (context, i) {
          final m = modules[i];
          return Card(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => context.push(m.route),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(m.icon, size: 28),
                    const SizedBox(height: 8),
                    Text(
                      m.label,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ModuleItem {
  final String label;
  final IconData icon;
  final String route;
  const _ModuleItem(this.label, this.icon, this.route);
}
