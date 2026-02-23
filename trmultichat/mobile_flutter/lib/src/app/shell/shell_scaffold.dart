import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/env/app_env.dart';

class ShellScaffold extends StatelessWidget {
  final StatefulNavigationShell navigationShell;
  const ShellScaffold({super.key, required this.navigationShell});

  void _goBranch(int index) {
    navigationShell.goBranch(index,
        initialLocation: index == navigationShell.currentIndex);
  }

  bool _useDesktopLayout(BuildContext context) {
    return MediaQuery.sizeOf(context).width >= 1024;
  }

  Uri _webAppUri() {
    final api = AppEnv.baseUrl();
    final parsed = Uri.tryParse(api);
    if (parsed == null || parsed.host.isEmpty) {
      return Uri.parse('https://app.trmultichat.com.br');
    }
    final host = parsed.host;
    if (host == 'api.trmultichat.com.br') {
      return Uri(
        scheme: parsed.scheme.isEmpty ? 'https' : parsed.scheme,
        host: 'app.trmultichat.com.br',
      );
    }
    if (host.startsWith('api.')) {
      return Uri(
        scheme: parsed.scheme.isEmpty ? 'https' : parsed.scheme,
        host: host.replaceFirst('api.', 'app.'),
      );
    }
    if (host.contains('localhost') ||
        RegExp(r'^\d+\.\d+\.\d+\.\d+$').hasMatch(host)) {
      return Uri(
        scheme: parsed.scheme.isEmpty ? 'http' : parsed.scheme,
        host: host,
        port: 3000,
      );
    }
    return Uri.parse('https://app.trmultichat.com.br');
  }

  Uri _webModuleUri(String path) {
    final base = _webAppUri();
    final normalized = path.trim().isEmpty
        ? '/'
        : (path.trim().startsWith('/') ? path.trim() : '/${path.trim()}');
    return base.replace(path: normalized);
  }

  Future<void> _openWebApp(BuildContext context) async {
    final uri = _webAppUri();
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!context.mounted || ok) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Não foi possível abrir o web app.')),
    );
  }

  Future<void> _openWebModule(BuildContext context, String path) async {
    final uri = _webModuleUri(path);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!context.mounted || ok) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Não foi possível abrir este módulo web.')),
    );
  }

  List<NavigationDestination> get _destinations => const [
        NavigationDestination(
          icon: Icon(Icons.confirmation_number_outlined),
          selectedIcon: Icon(Icons.confirmation_number),
          label: 'Tickets',
        ),
        NavigationDestination(
          icon: Icon(Icons.people_outline),
          selectedIcon: Icon(Icons.people),
          label: 'Contatos',
        ),
        NavigationDestination(
          icon: Icon(Icons.forum_outlined),
          selectedIcon: Icon(Icons.forum),
          label: 'Chat Interno',
        ),
        NavigationDestination(
          icon: Icon(Icons.calendar_month_outlined),
          selectedIcon: Icon(Icons.calendar_month),
          label: 'Agenda',
        ),
      ];

  @override
  Widget build(BuildContext context) {
    if (_useDesktopLayout(context)) {
      final cs = Theme.of(context).colorScheme;
      final wide = MediaQuery.sizeOf(context).width >= 1320;
      return Scaffold(
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                cs.primary.withOpacity(0.08),
                cs.surface,
                cs.surface,
              ],
            ),
          ),
          child: SafeArea(
            child: Row(
              children: [
                Container(
                  width: wide ? 280 : 92,
                  margin: const EdgeInsets.fromLTRB(14, 14, 0, 14),
                  padding:
                      const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    color: Theme.of(context).colorScheme.surface,
                    border: Border.all(
                      color: Theme.of(context)
                          .colorScheme
                          .outlineVariant
                          .withOpacity(0.45),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: wide
                            ? MainAxisAlignment.start
                            : MainAxisAlignment.center,
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: cs.primary.withOpacity(0.12),
                            child: Icon(Icons.all_inbox_rounded,
                                color: cs.primary),
                          ),
                          if (wide) ...[
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'TR Multichat',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w900),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 16),
                      Expanded(
                        child: NavigationRail(
                          selectedIndex: navigationShell.currentIndex,
                          onDestinationSelected: _goBranch,
                          extended: wide,
                          leading: const SizedBox.shrink(),
                          destinations: const [
                            NavigationRailDestination(
                              icon: Icon(Icons.confirmation_number_outlined),
                              selectedIcon: Icon(Icons.confirmation_number),
                              label: Text('Tickets'),
                            ),
                            NavigationRailDestination(
                              icon: Icon(Icons.people_outline),
                              selectedIcon: Icon(Icons.people),
                              label: Text('Contatos'),
                            ),
                            NavigationRailDestination(
                              icon: Icon(Icons.forum_outlined),
                              selectedIcon: Icon(Icons.forum),
                              label: Text('Chat Interno'),
                            ),
                            NavigationRailDestination(
                              icon: Icon(Icons.calendar_month_outlined),
                              selectedIcon: Icon(Icons.calendar_month),
                              label: Text('Agenda'),
                            ),
                          ],
                        ),
                      ),
                      if (wide) ...[
                        const Divider(height: 18),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Padding(
                            padding: const EdgeInsets.only(left: 8, bottom: 8),
                            child: Text(
                              'Módulos web',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                              ),
                            ),
                          ),
                        ),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _DesktopModuleChip(
                              icon: Icons.dashboard_outlined,
                              label: 'Dashboard',
                              onTap: () =>
                                  _openWebModule(context, '/dashboard'),
                            ),
                            _DesktopModuleChip(
                              icon: Icons.payments_outlined,
                              label: 'Financeiro',
                              onTap: () =>
                                  _openWebModule(context, '/financeiro'),
                            ),
                            _DesktopModuleChip(
                              icon: Icons.checklist_rtl_outlined,
                              label: 'To-do',
                              onTap: () => _openWebModule(context, '/todo'),
                            ),
                            _DesktopModuleChip(
                              icon: Icons.quickreply_outlined,
                              label: 'Respostas',
                              onTap: () =>
                                  _openWebModule(context, '/quick-messages'),
                            ),
                            _DesktopModuleChip(
                              icon: Icons.settings_outlined,
                              label: 'Configurações',
                              onTap: () => _openWebModule(context, '/settings'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                      ],
                      if (wide)
                        FilledButton.tonalIcon(
                          onPressed: () => _openWebApp(context),
                          icon: const Icon(Icons.open_in_new),
                          label: const Text('Web completo'),
                        )
                      else
                        IconButton(
                          tooltip: 'Abrir web completo',
                          onPressed: () => _openWebApp(context),
                          icon: const Icon(Icons.open_in_new),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.fromLTRB(0, 14, 14, 14),
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: Theme.of(context)
                            .colorScheme
                            .outlineVariant
                            .withOpacity(0.45),
                      ),
                      color: Theme.of(context).colorScheme.surface,
                    ),
                    child: navigationShell,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: _goBranch,
        destinations: _destinations,
      ),
    );
  }
}

class _DesktopModuleChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _DesktopModuleChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar:
          Icon(icon, size: 16, color: Theme.of(context).colorScheme.primary),
      label: Text(label),
      onPressed: onTap,
      side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      backgroundColor: Theme.of(context).colorScheme.surface,
      labelStyle: const TextStyle(fontWeight: FontWeight.w700),
    );
  }
}
