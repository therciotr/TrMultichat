import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/utils/phone_format.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../providers/contacts_providers.dart';

class ContactsScreen extends ConsumerStatefulWidget {
  const ContactsScreen({super.key});

  @override
  ConsumerState<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends ConsumerState<ContactsScreen> {
  final _search = TextEditingController();
  final _listCtrl = ScrollController();
  int? _hoveredContactId;
  int? _pressedContactId;

  String _initialsFromName(String name) {
    final clean = name.trim();
    if (clean.isEmpty) return 'C';
    final parts =
        clean.split(RegExp(r'\s+')).where((e) => e.isNotEmpty).toList();
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first.substring(0, 1)}${parts.last.substring(0, 1)}'
        .toUpperCase();
  }

  @override
  void initState() {
    super.initState();
    _listCtrl.addListener(() {
      if (!_listCtrl.hasClients) return;
      final pos = _listCtrl.position;
      if (pos.pixels >= pos.maxScrollExtent - 220) {
        ref.read(contactsControllerProvider.notifier).loadMore();
      }
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _listCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final st = ref.watch(contactsControllerProvider);
    final ctrl = ref.read(contactsControllerProvider.notifier);
    final theme = Theme.of(context);
    final cs = Theme.of(context).colorScheme;
    final platform = Theme.of(context).platform;
    final isDesktop = platform == TargetPlatform.macOS ||
        platform == TargetPlatform.windows ||
        platform == TargetPlatform.linux;

    Widget contactTile(dynamic c) {
      final id = int.tryParse('${c.id}') ?? 0;
      final hovered = isDesktop && _hoveredContactId == id;
      final pressed = isDesktop && _pressedContactId == id;
      final name = c.name.trim().isEmpty ? 'Contato' : c.name.trim();
      final initials = _initialsFromName(name);
      final phone = formatPhoneBr(c.number);
      return AnimatedScale(
        duration: const Duration(milliseconds: 160),
        scale: hovered ? 1.006 : 1,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => context.push('/contacts/${c.id}'),
          onHover: isDesktop
              ? (v) {
                  final next = v ? id : null;
                  if (_hoveredContactId == next) return;
                  setState(() => _hoveredContactId = next);
                }
              : null,
          onHighlightChanged: isDesktop
              ? (v) {
                  setState(() => _pressedContactId = v ? id : null);
                }
              : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOutCubic,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              color: hovered
                  ? cs.surfaceContainerHighest.withValues(alpha: 0.24)
                  : cs.surface,
              border: Border.all(
                color: hovered
                    ? cs.primary.withValues(alpha: 0.45)
                    : cs.outlineVariant.withValues(alpha: 0.45),
                width: hovered ? 1.1 : 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: cs.shadow.withValues(alpha: hovered ? 0.09 : 0.04),
                  blurRadius: hovered ? 26 : 18,
                  offset: Offset(0, hovered ? 12 : 8),
                ),
              ],
            ),
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 140),
              opacity: pressed ? 0.92 : 1,
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      gradient: LinearGradient(
                        colors: [
                          cs.primary.withValues(alpha: hovered ? 0.3 : 0.22),
                          cs.tertiary.withValues(alpha: hovered ? 0.24 : 0.18),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      initials,
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: cs.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: cs.primary.withValues(alpha: 0.78),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 9, vertical: 4),
                          decoration: BoxDecoration(
                            color: cs.surfaceContainerHighest
                                .withValues(alpha: hovered ? 0.95 : 0.7),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.phone_outlined,
                                  size: 12, color: cs.onSurfaceVariant),
                              const SizedBox(width: 5),
                              Flexible(
                                child: Text(
                                  phone.isEmpty ? 'Sem número' : phone,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: cs.onSurfaceVariant,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: hovered
                          ? cs.primary.withValues(alpha: 0.18)
                          : cs.surfaceContainerHighest.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.chevron_right,
                      color: hovered ? cs.primary : cs.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: isDesktop
          ? null
          : AppBar(
              title: const Text('Contatos'),
              actions: [
                IconButton(
                  tooltip: 'Sair',
                  icon: const Icon(Icons.logout),
                  onPressed: () async {
                    final router = GoRouter.of(context);
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
                    if (ok != true) return;
                    await ref.read(authControllerProvider.notifier).logout();
                    if (!mounted) return;
                    router.go('/login');
                  },
                ),
              ],
            ),
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(isDesktop ? 18 : 12,
                isDesktop ? 18 : 12, isDesktop ? 18 : 12, 0),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                color: cs.surface,
                border:
                    Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
                boxShadow: [
                  BoxShadow(
                    color: cs.shadow.withValues(alpha: 0.05),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          color: cs.primary.withValues(alpha: 0.14),
                        ),
                        child: Icon(Icons.people_outline, color: cs.primary),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Contatos',
                          style: theme.textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          color: cs.surfaceContainerHighest
                              .withValues(alpha: 0.75),
                        ),
                        child: Text(
                          '${st.items.length}',
                          style: theme.textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: cs.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _search,
                    onChanged: (v) {
                      ctrl.setSearch(v);
                      setState(() {});
                    },
                    onSubmitted: (_) => ctrl.refresh(),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search),
                      hintText: 'Buscar por nome ou número',
                      suffixIcon: _search.text.isEmpty
                          ? null
                          : IconButton(
                              tooltip: 'Limpar',
                              onPressed: () {
                                _search.clear();
                                ctrl.setSearch('');
                                ctrl.refresh();
                                setState(() {});
                              },
                              icon: const Icon(Icons.close),
                            ),
                      filled: true,
                      fillColor:
                          cs.surfaceContainerHighest.withValues(alpha: 0.55),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(
                          color: cs.outlineVariant.withValues(alpha: 0.35),
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(color: cs.primary, width: 1.2),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (st.loading) const LinearProgressIndicator(minHeight: 2),
          if (st.error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(st.error!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: st.items.isEmpty && !st.loading
                ? Center(
                    child: Container(
                      width: isDesktop ? 460 : null,
                      margin: const EdgeInsets.fromLTRB(12, 14, 12, 16),
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: cs.surface,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                            color: cs.outlineVariant.withValues(alpha: 0.45)),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 56,
                            height: 56,
                            decoration: BoxDecoration(
                              color: cs.primary.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Icon(Icons.search_off, color: cs.primary),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Nenhum contato encontrado',
                            style: theme.textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Ajuste a busca ou atualize para carregar novos contatos.',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodyMedium
                                ?.copyWith(color: cs.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: () => ctrl.refresh(),
                    child: ListView.separated(
                      controller: _listCtrl,
                      padding: EdgeInsets.fromLTRB(
                        isDesktop ? 18 : 12,
                        12,
                        isDesktop ? 18 : 12,
                        90,
                      ),
                      itemCount: st.items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, i) {
                        final c = st.items[i];
                        return contactTile(c);
                      },
                    ),
                  ),
          ),
          if (st.loading && st.items.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text('Carregando mais...',
                  style: TextStyle(color: cs.onSurfaceVariant)),
            ),
        ],
      ),
    );
  }
}
