import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'providers.dart';
import '../agenda/agenda_screen.dart';
import '../announcements/announcements_screen.dart';
import '../auth/forgot_password_screen.dart';
import '../auth/login_screen.dart';
import '../auth/profile_screen.dart';
import '../auth/splash_screen.dart';
import '../chat/chat_screen.dart';
import '../dashboard/home_screen.dart';
import '../tickets/ticket_details_screen.dart';
import '../tickets/tickets_list_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: GoRouterRefreshStream(ref.watch(_authStreamProvider.stream)),
    routes: [
      GoRoute(path: '/splash', builder: (c, s) => const SplashScreen()),
      GoRoute(path: '/login', builder: (c, s) => const LoginScreen()),
      GoRoute(path: '/forgot', builder: (c, s) => const ForgotPasswordScreen()),
      GoRoute(path: '/', builder: (c, s) => const HomeScreen()),
      GoRoute(path: '/tickets', builder: (c, s) => const TicketsListScreen()),
      GoRoute(
        path: '/tickets/:id',
        builder: (c, s) => TicketDetailsScreen(ticketId: int.parse(s.pathParameters['id']!)),
      ),
      GoRoute(
        path: '/chat/:ticketId',
        builder: (c, s) => ChatScreen(ticketId: int.parse(s.pathParameters['ticketId']!)),
      ),
      GoRoute(path: '/announcements', builder: (c, s) => const AnnouncementsScreen()),
      GoRoute(path: '/agenda', builder: (c, s) => const AgendaScreen()),
      GoRoute(path: '/profile', builder: (c, s) => const ProfileScreen()),
    ],
    redirect: (context, state) {
      final isLogged = auth.session != null;
      final boot = auth.bootstrapped;
      final loc = state.matchedLocation;

      if (!boot) return '/splash';
      final goingAuth = loc == '/login' || loc == '/forgot' || loc == '/splash';
      if (!isLogged && !goingAuth) return '/login';
      if (isLogged && (loc == '/login' || loc == '/splash')) return '/';
      return null;
    },
  );
});

// Convert auth state changes into a stream for GoRouter refresh
final _authStreamProvider = StreamProvider<void>((ref) async* {
  ref.listen<AuthState>(authStateProvider, (_, __) {});
  // Emit any time the provider updates (simplified)
  yield null;
});

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    _sub = stream.asBroadcastStream().listen((_) => notifyListeners());
  }
  late final StreamSubscription<dynamic> _sub;
  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

