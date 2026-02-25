import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/providers/auth_providers.dart';

class ShellScaffold extends ConsumerWidget {
  final StatefulNavigationShell navigationShell;
  const ShellScaffold({super.key, required this.navigationShell});

  void _goBranch(int index) {
    navigationShell.goBranch(index,
        initialLocation: index == navigationShell.currentIndex);
  }

  bool _useDesktopLayout(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final platform = Theme.of(context).platform;
    final isDesktop = platform == TargetPlatform.macOS ||
        platform == TargetPlatform.windows ||
        platform == TargetPlatform.linux;
    if (isDesktop) return width >= 760;
    return width >= 1024;
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sair'),
        content: const Text('Deseja sair da sua conta?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sair'),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    await ref.read(authControllerProvider.notifier).logout();
    if (context.mounted) context.go('/login');
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
        NavigationDestination(
          icon: Icon(Icons.apps_outlined),
          selectedIcon: Icon(Icons.apps),
          label: 'Módulos',
        ),
      ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (_useDesktopLayout(context)) {
      final auth = ref.watch(authControllerProvider);
      final user = auth.user;
      final profile = (user?.profile ?? '').toLowerCase();
      final isAdminLike = user?.admin == true || user?.isSuper == true || profile == 'admin' || profile == 'super';
      final cs = Theme.of(context).colorScheme;
      final wide = MediaQuery.sizeOf(context).width >= 1320;
      final currentPath = GoRouterState.of(context).uri.path;
      final modules = isAdminLike
          ? const <({String label, IconData icon, String route})>[
              (label: 'Dashboard', icon: Icons.dashboard_outlined, route: '/workspace/dashboard'),
              (label: 'Financeiro', icon: Icons.payments_outlined, route: '/workspace/finance'),
              (label: 'Tarefa', icon: Icons.checklist_rtl_outlined, route: '/workspace/todo'),
              (label: 'Respostas', icon: Icons.quickreply_outlined, route: '/workspace/quick-messages'),
              (label: 'Usuários', icon: Icons.group_outlined, route: '/workspace/users'),
              (label: 'Filas', icon: Icons.account_tree_outlined, route: '/workspace/queues'),
              (label: 'Conexões', icon: Icons.wifi_tethering_outlined, route: '/workspace/connections'),
              (label: 'Tags', icon: Icons.sell_outlined, route: '/workspace/tags'),
              (label: 'Arquivos', icon: Icons.folder_outlined, route: '/workspace/files'),
              (label: 'Campanhas', icon: Icons.campaign_outlined, route: '/workspace/campaigns'),
              (label: 'Planos', icon: Icons.workspace_premium_outlined, route: '/workspace/plans'),
              (label: 'Ajuda', icon: Icons.help_outline, route: '/workspace/helps'),
              (label: 'Configurações', icon: Icons.settings_outlined, route: '/workspace/settings'),
            ]
          : const <({String label, IconData icon, String route})>[
              (label: 'Dashboard', icon: Icons.dashboard_outlined, route: '/workspace/dashboard'),
              (label: 'Financeiro', icon: Icons.payments_outlined, route: '/workspace/finance'),
              (label: 'Tarefa', icon: Icons.checklist_rtl_outlined, route: '/workspace/todo'),
              (label: 'Respostas', icon: Icons.quickreply_outlined, route: '/workspace/quick-messages'),
              (label: 'Ajuda', icon: Icons.help_outline, route: '/workspace/helps'),
            ];

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
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          color: cs.primary.withOpacity(0.07),
                        ),
                        child: Row(
                          mainAxisAlignment: wide ? MainAxisAlignment.start : MainAxisAlignment.center,
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: Image.asset(
                                'assets/logo_login.png',
                                width: 34,
                                height: 34,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => CircleAvatar(
                                  radius: 16,
                                  backgroundColor: cs.primary.withOpacity(0.12),
                                  child: Icon(Icons.all_inbox_rounded, color: cs.primary),
                                ),
                              ),
                            ),
                            if (wide) ...[
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'TR Multichat',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontWeight: FontWeight.w900),
                                    ),
                                    Text(
                                      isAdminLike ? 'Administrador' : 'Usuário',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: cs.onSurfaceVariant,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      Expanded(
                        child: ListView(
                          padding: EdgeInsets.zero,
                          children: [
                            _SidebarItem(
                              compact: !wide,
                              icon: Icons.confirmation_number_outlined,
                              label: 'Tickets',
                              selected: navigationShell.currentIndex == 0,
                              onTap: () => _goBranch(0),
                            ),
                            _SidebarItem(
                              compact: !wide,
                              icon: Icons.people_outline,
                              label: 'Contatos',
                              selected: navigationShell.currentIndex == 1,
                              onTap: () => _goBranch(1),
                            ),
                            _SidebarItem(
                              compact: !wide,
                              icon: Icons.forum_outlined,
                              label: 'Chat Interno',
                              selected: navigationShell.currentIndex == 2,
                              onTap: () => _goBranch(2),
                            ),
                            _SidebarItem(
                              compact: !wide,
                              icon: Icons.calendar_month_outlined,
                              label: 'Agenda',
                              selected: navigationShell.currentIndex == 3,
                              onTap: () => _goBranch(3),
                            ),
                            const SizedBox(height: 14),
                            if (wide)
                              Padding(
                                padding: const EdgeInsets.only(left: 8, bottom: 6),
                                child: Text(
                                  isAdminLike ? 'Módulos administrativos' : 'Módulos',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    color: cs.onSurfaceVariant,
                                  ),
                                ),
                              ),
                            ...modules.map(
                              (m) => _SidebarItem(
                                compact: !wide,
                                icon: m.icon,
                                label: m.label,
                                selected: currentPath == m.route || currentPath.startsWith('${m.route}/'),
                                onTap: () => context.go(m.route),
                              ),
                            ),
                            const SizedBox(height: 12),
                            _SidebarItem(
                              compact: !wide,
                              icon: Icons.logout,
                              label: 'Sair',
                              selected: false,
                              onTap: () => _confirmLogout(context, ref),
                            ),
                          ],
                        ),
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
                    child: Stack(
                      children: [
                        Positioned.fill(child: navigationShell),
                        if (currentPath.startsWith('/workspace/'))
                          Positioned(
                            right: 16,
                            top: 12,
                            child: FilledButton.icon(
                              onPressed: () => _confirmLogout(context, ref),
                              icon: const Icon(Icons.logout, size: 18),
                              label: const Text('Sair'),
                              style: FilledButton.styleFrom(
                                visualDensity: VisualDensity.compact,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
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

class _SidebarItem extends StatelessWidget {
  final bool compact;
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _SidebarItem({
    required this.compact,
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: selected ? cs.primary.withOpacity(0.12) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: compact ? 8 : 10,
              vertical: compact ? 10 : 9,
            ),
            child: Row(
              mainAxisAlignment: compact ? MainAxisAlignment.center : MainAxisAlignment.start,
              children: [
                Icon(
                  icon,
                  size: 18,
                  color: selected ? cs.primary : cs.onSurfaceVariant,
                ),
                if (!compact) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                        color: selected ? cs.primary : cs.onSurface,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
