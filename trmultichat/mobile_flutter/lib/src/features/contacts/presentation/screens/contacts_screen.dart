import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/utils/phone_format.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../domain/entities/contact.dart';
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
  final Set<int> _selectedIds = <int>{};

  bool _isAdminLike({
    required bool admin,
    required bool isSuper,
    required String? profile,
  }) {
    final p = (profile ?? '').trim().toLowerCase();
    return admin || isSuper || p == 'admin' || p == 'super';
  }

  Future<bool> _confirmDeleteOne(Contact c) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir contato?'),
        content: Text(
          'Deseja excluir "${c.name.trim().isEmpty ? 'Contato' : c.name.trim()}"?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    return ok == true;
  }

  Future<bool> _deleteOne(Contact c) async {
    final ok = await _confirmDeleteOne(c);
    if (!ok) return false;
    final deleted =
        await ref.read(contactsControllerProvider.notifier).deleteOne(c.id);
    if (!mounted) return false;
    if (deleted) {
      setState(() => _selectedIds.remove(c.id));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Contato excluido com sucesso.')),
      );
      return true;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Falha ao excluir contato.')),
    );
    return false;
  }

  Future<void> _deleteSelected() async {
    if (_selectedIds.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Excluir ${_selectedIds.length} contato(s)?'),
        content: const Text(
          'Esta ação é irreversível e removerá os contatos selecionados.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final deleted = await ref
        .read(contactsControllerProvider.notifier)
        .deleteMany(_selectedIds.toList());
    if (!mounted) return;
    if (deleted > 0) {
      setState(() => _selectedIds.clear());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Contatos excluidos: $deleted')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao excluir contatos.')),
      );
    }
  }

  Future<void> _deleteAll() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir TODOS os contatos?'),
        content: const Text(
          'Esta ação é irreversível e removerá todos os contatos visíveis da empresa.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Excluir todos'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final deleted = await ref.read(contactsControllerProvider.notifier).deleteAll();
    if (!mounted) return;
    if (deleted >= 0) {
      setState(() => _selectedIds.clear());
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Contatos excluidos: $deleted')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Falha ao excluir todos os contatos.')),
      );
    }
  }

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
    final auth = ref.watch(authControllerProvider);
    final theme = Theme.of(context);
    final cs = Theme.of(context).colorScheme;
    final platform = Theme.of(context).platform;
    final isDesktop = platform == TargetPlatform.macOS ||
        platform == TargetPlatform.windows ||
        platform == TargetPlatform.linux;
    final canDelete = _isAdminLike(
      admin: auth.user?.admin ?? false,
      isSuper: auth.user?.isSuper ?? false,
      profile: auth.user?.profile,
    );
    final allVisibleSelected =
        st.items.isNotEmpty && _selectedIds.length == st.items.length;
    final someSelected =
        _selectedIds.isNotEmpty && _selectedIds.length < st.items.length;

    Widget contactTile(dynamic c) {
      final id = int.tryParse('${c.id}') ?? 0;
      final hovered = isDesktop && _hoveredContactId == id;
      final pressed = isDesktop && _pressedContactId == id;
      final name = c.name.trim().isEmpty ? 'Contato' : c.name.trim();
      final initials = _initialsFromName(name);
      final phone = formatPhoneBr(c.number);
      final selected = _selectedIds.contains(id);
      Widget card = AnimatedScale(
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
              color: selected
                  ? cs.primary.withValues(alpha: 0.08)
                  : hovered
                      ? cs.surfaceContainerHighest.withValues(alpha: 0.24)
                      : cs.surface,
              border: Border.all(
                color: selected
                    ? cs.primary.withValues(alpha: 0.55)
                    : hovered
                        ? cs.primary.withValues(alpha: 0.45)
                        : cs.outlineVariant.withValues(alpha: 0.45),
                width: hovered || selected ? 1.1 : 1,
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
                  if (canDelete) ...[
                    Checkbox(
                      value: selected,
                      tristate: false,
                      onChanged: (_) {
                        setState(() {
                          if (selected) {
                            _selectedIds.remove(id);
                          } else {
                            _selectedIds.add(id);
                          }
                        });
                      },
                    ),
                    const SizedBox(width: 4),
                  ],
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
                            if (c.isGroup == true)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: cs.secondaryContainer
                                      .withValues(alpha: 0.75),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  'Grupo',
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              )
                            else
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
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
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
                                      style:
                                          theme.textTheme.bodySmall?.copyWith(
                                        color: cs.onSurfaceVariant,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if ((c.email ?? '').trim().isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 9, vertical: 4),
                                decoration: BoxDecoration(
                                  color: cs.surfaceContainerHighest
                                      .withValues(alpha: 0.6),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.alternate_email,
                                        size: 12, color: cs.onSurfaceVariant),
                                    const SizedBox(width: 5),
                                    ConstrainedBox(
                                      constraints:
                                          const BoxConstraints(maxWidth: 180),
                                      child: Text(
                                        c.email!,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style:
                                            theme.textTheme.bodySmall?.copyWith(
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
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  if (canDelete)
                    IconButton(
                      tooltip: 'Excluir contato',
                      onPressed: () => _deleteOne(c),
                      icon: const Icon(Icons.delete_outline),
                    ),
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

      if (canDelete) {
        card = Dismissible(
          key: ValueKey('contact-$id'),
          direction: DismissDirection.endToStart,
          confirmDismiss: (_) => _confirmDeleteOne(c),
          onDismissed: (_) async {
            final deleted =
                await ref.read(contactsControllerProvider.notifier).deleteOne(id);
            if (!mounted) return;
            if (deleted) {
              setState(() => _selectedIds.remove(id));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    'Contato "${name.trim().isEmpty ? 'Contato' : name}" excluido.',
                  ),
                ),
              );
            } else {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Falha ao excluir contato.')),
              );
            }
          },
          background: Container(
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              color: cs.errorContainer,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Icon(Icons.delete_outline, color: cs.error),
          ),
          child: card,
        );
      }
      return card;
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
                      if (canDelete) ...[
                        const SizedBox(width: 8),
                        Tooltip(
                          message: 'Selecionar todos os contatos visíveis',
                          child: Checkbox(
                            value: allVisibleSelected
                                ? true
                                : (someSelected ? null : false),
                            tristate: true,
                            onChanged: (_) {
                              setState(() {
                                if (allVisibleSelected) {
                                  _selectedIds.clear();
                                } else {
                                  _selectedIds
                                    ..clear()
                                    ..addAll(st.items.map((e) => e.id));
                                }
                              });
                            },
                          ),
                        ),
                      ],
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
                  if (canDelete) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        OutlinedButton.icon(
                          onPressed: st.items.isEmpty
                              ? null
                              : () {
                                  setState(() {
                                    if (allVisibleSelected) {
                                      _selectedIds.clear();
                                    } else {
                                      _selectedIds
                                        ..clear()
                                        ..addAll(st.items.map((e) => e.id));
                                    }
                                  });
                                },
                          icon: const Icon(Icons.done_all),
                          label: Text(
                            allVisibleSelected
                                ? 'Limpar seleção'
                                : 'Selecionar todos',
                          ),
                        ),
                        FilledButton.tonalIcon(
                          onPressed: _selectedIds.isEmpty ? null : _deleteSelected,
                          icon: const Icon(Icons.delete_sweep_outlined),
                          label: Text('Excluir (${_selectedIds.length})'),
                        ),
                        OutlinedButton.icon(
                          onPressed: st.items.isEmpty ? null : _deleteAll,
                          icon: const Icon(Icons.warning_amber_rounded),
                          label: const Text('Excluir todos'),
                        ),
                      ],
                    ),
                  ],
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
