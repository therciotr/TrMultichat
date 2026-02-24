import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../app/shell/shell_scaffold.dart';
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/splash_screen.dart';
import '../features/chat/presentation/screens/chat_screen.dart';
import '../features/tickets/presentation/screens/tickets_screen.dart';
import '../features/tickets/presentation/screens/tickets_home_screen.dart';

// Placeholder tabs (will be implemented fully next)
import '../features/contacts/presentation/screens/contacts_screen.dart';
import '../features/contacts/presentation/screens/contact_detail_screen.dart';
import '../features/announcements/presentation/screens/announcements_screen.dart';
import '../features/announcements/presentation/screens/announcement_detail_screen.dart';
import '../features/agenda/presentation/screens/agenda_screen.dart';
import '../features/agenda/presentation/screens/agenda_detail_screen.dart';
import '../features/agenda/domain/entities/agenda_event.dart';
import '../features/desktop_modules/presentation/screens/desktop_admin_modules_screens.dart';
import '../features/desktop_modules/presentation/screens/desktop_dashboard_screen.dart';
import '../features/desktop_modules/presentation/screens/desktop_finance_screen.dart';
import '../features/desktop_modules/presentation/screens/desktop_module_placeholder_screen.dart';
import '../features/desktop_modules/presentation/screens/desktop_todo_screen.dart';
import '../features/desktop_modules/presentation/screens/desktop_quick_messages_screen.dart';
import '../features/desktop_modules/presentation/screens/desktop_settings_screen.dart';

final _rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

final appRouterProvider = Provider<
    GoRouter Function(
        {required bool isAuthed, required bool isBootstrapping})>((ref) {
  return ({required bool isAuthed, required bool isBootstrapping}) {
    return GoRouter(
      navigatorKey: _rootKey,
      initialLocation: '/splash',
      routes: [
        GoRoute(path: '/splash', builder: (ctx, st) => const SplashScreen()),
        GoRoute(path: '/login', builder: (ctx, st) => const LoginScreen()),
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) =>
              ShellScaffold(navigationShell: navigationShell),
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/tickets',
                  builder: (ctx, st) => const TicketsHomeScreen(),
                  routes: [
                    GoRoute(
                      path: 'all',
                      builder: (ctx, st) => TicketsScreen(
                        initialSearch: st.uri.queryParameters['search'],
                        initialStatus: st.uri.queryParameters['status'],
                      ),
                    ),
                  ],
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/contacts',
                  builder: (ctx, st) => const ContactsScreen(),
                  routes: [
                    GoRoute(
                      path: ':id',
                      builder: (ctx, st) => ContactDetailScreen(
                          id: int.tryParse(st.pathParameters['id'] ?? '') ?? 0),
                    ),
                  ],
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/announcements',
                  builder: (ctx, st) => const AnnouncementsScreen(),
                  routes: [
                    GoRoute(
                      path: ':id',
                      builder: (ctx, st) => AnnouncementDetailScreen(
                          id: int.tryParse(st.pathParameters['id'] ?? '') ?? 0),
                    ),
                  ],
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/agenda',
                  builder: (ctx, st) => const AgendaScreen(),
                  routes: [
                    GoRoute(
                      path: 'event',
                      builder: (ctx, st) =>
                          AgendaDetailScreen(event: st.extra as AgendaEvent),
                    ),
                  ],
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/workspace/dashboard',
                  builder: (ctx, st) => const DesktopDashboardScreen(),
                ),
                GoRoute(
                  path: '/workspace/finance',
                  builder: (ctx, st) => const DesktopFinanceScreen(),
                ),
                GoRoute(
                  path: '/workspace/todo',
                  builder: (ctx, st) => const DesktopTodoScreen(),
                ),
                GoRoute(
                  path: '/workspace/quick-messages',
                  builder: (ctx, st) => const DesktopQuickMessagesScreen(),
                ),
                GoRoute(
                  path: '/workspace/settings',
                  builder: (ctx, st) => const DesktopSettingsScreen(),
                ),
                GoRoute(
                  path: '/workspace/users',
                  builder: (ctx, st) => const DesktopUsersScreen(),
                ),
                GoRoute(
                  path: '/workspace/queues',
                  builder: (ctx, st) => const DesktopQueuesScreen(),
                ),
                GoRoute(
                  path: '/workspace/connections',
                  builder: (ctx, st) => const DesktopConnectionsScreen(),
                ),
                GoRoute(
                  path: '/workspace/tags',
                  builder: (ctx, st) => const DesktopTagsScreen(),
                ),
                GoRoute(
                  path: '/workspace/files',
                  builder: (ctx, st) => const DesktopFilesScreen(),
                ),
                GoRoute(
                  path: '/workspace/campaigns',
                  builder: (ctx, st) => const DesktopCampaignsScreen(),
                ),
                GoRoute(
                  path: '/workspace/plans',
                  builder: (ctx, st) => const DesktopPlansScreen(),
                ),
                GoRoute(
                  path: '/workspace/helps',
                  builder: (ctx, st) => const DesktopHelpsScreen(),
                ),
                GoRoute(
                  path: '/workspace/module/:name',
                  builder: (ctx, st) {
                    final raw = (st.pathParameters['name'] ?? 'modulo').replaceAll('-', ' ');
                    final title = raw.isEmpty ? 'Módulo' : '${raw[0].toUpperCase()}${raw.substring(1)}';
                    return DesktopModulePlaceholderScreen(title: title);
                  },
                ),
              ],
            ),
          ],
        ),
        GoRoute(
          parentNavigatorKey: _rootKey,
          path: '/tickets/:ticketId',
          builder: (ctx, st) {
            final id = int.tryParse(st.pathParameters['ticketId'] ?? '') ?? 0;
            return ChatScreen(ticketId: id, ticketExtra: st.extra);
          },
        ),
      ],
      redirect: (context, state) {
        final loc = state.matchedLocation;
        final inSplash = loc == '/splash';
        final loggingIn = loc == '/login';

        // While bootstrapping session, always keep splash.
        if (isBootstrapping) {
          return inSplash ? null : '/splash';
        }

        if (!isAuthed) {
          if (loggingIn) return null;
          return '/login';
        }

        // authed
        if (loggingIn || inSplash) return '/tickets';
        if (loc == '/') return '/tickets';
        return null;
      },
    );
  };
});
