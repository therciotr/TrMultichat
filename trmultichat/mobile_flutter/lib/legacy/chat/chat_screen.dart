import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/providers.dart';
import '../core/config/env.dart';
import '../core/socket/socket_service.dart';
import 'chat_service.dart';
import 'message_models.dart';

final _socketProvider = Provider<SocketService>((ref) {
  final base = Env.baseUrl(isDebug: kDebugMode);
  return SocketService(baseUrl: base);
});

final chatMessagesProvider = StateNotifierProvider.family<ChatMessagesNotifier, AsyncValue<List<ChatMessage>>, int>(
  (ref, ticketId) => ChatMessagesNotifier(ref, ticketId),
);

class ChatMessagesNotifier extends StateNotifier<AsyncValue<List<ChatMessage>>> {
  final Ref ref;
  final int ticketId;
  ChatMessagesNotifier(this.ref, this.ticketId) : super(const AsyncValue.loading()) {
    _init();
  }

  Future<void> _init() async {
    final dio = ref.read(dioProvider);
    final svc = ChatService(dio);
    try {
      final page = await svc.getMessages(ticketId: ticketId, pageNumber: 1);
      state = AsyncValue.data(page.messages);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }

    final session = ref.read(authStateProvider).session;
    final companyId = session?.user.companyId ?? 0;
    if (companyId > 0) {
      final socket = ref.read(_socketProvider);
      await socket.connect();
      socket.joinChatBox(companyId);
      socket.joinNotification(companyId);
      socket.joinTicket(ticketId);

      final eventName = 'company-$companyId-appMessage';
      socket.on(eventName, (data) => data).listen((payload) {
        try {
          final map = (payload as Map).cast<String, dynamic>();
          if (map['action']?.toString() != 'create') return;
          final msg = (map['message'] as Map).cast<String, dynamic>();
          final next = ChatMessage.fromJson(msg);
          if (next.ticketId != ticketId) return;
          final cur = state.valueOrNull ?? const <ChatMessage>[];
          state = AsyncValue.data([...cur, next]);
        } catch (_) {}
      });
    }
  }

  Future<void> sendText(String body) async {
    final trimmed = body.trim();
    if (trimmed.isEmpty) return;
    final dio = ref.read(dioProvider);
    final svc = ChatService(dio);
    await svc.sendText(ticketId: ticketId, body: trimmed);
  }
}

class ChatScreen extends ConsumerStatefulWidget {
  final int ticketId;
  const ChatScreen({super.key, required this.ticketId});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _ctrl = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(chatMessagesProvider(widget.ticketId).notifier).sendText(_ctrl.text);
      _ctrl.clear();
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(chatMessagesProvider(widget.ticketId));
    return Scaffold(
      appBar: AppBar(title: Text('Atendimento #${widget.ticketId}')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: messages.when(
                data: (list) => ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: list.length,
                  itemBuilder: (_, i) {
                    final m = list[i];
                    final isMe = m.fromMe;
                    return Align(
                      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.all(10),
                        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                        decoration: BoxDecoration(
                          color: isMe ? Theme.of(context).colorScheme.primary : Theme.of(context).colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          m.body,
                          style: TextStyle(color: isMe ? Colors.white : Theme.of(context).colorScheme.onSurface),
                        ),
                      ),
                    );
                  },
                ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Erro: $e')),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      minLines: 1,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        hintText: 'Digite uma mensagem',
                        prefixIcon: Icon(Icons.message_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  FilledButton(
                    onPressed: _sending ? null : _send,
                    child: Text(_sending ? '...' : 'Enviar'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

