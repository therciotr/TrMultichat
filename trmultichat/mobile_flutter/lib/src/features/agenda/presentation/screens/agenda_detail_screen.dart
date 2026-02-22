import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/ui/attachment_preview.dart';
import '../../domain/entities/agenda_event.dart';
import '../providers/agenda_providers.dart';
import '../controllers/agenda_detail_controller.dart';
import '../state/agenda_detail_state.dart';

final agendaDetailProvider = StateNotifierProvider.family<AgendaDetailController, AgendaDetailState, AgendaEvent>((ref, ev) {
  final remote = ref.watch(agendaRemoteDataSourceProvider);
  return AgendaDetailController(remote, ev);
});

class AgendaDetailScreen extends ConsumerWidget {
  final AgendaEvent event;
  const AgendaDetailScreen({super.key, required this.event});

  Future<void> _confirmAndDelete(
    BuildContext context,
    AgendaDetailController ctrl,
  ) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir evento'),
        content: const Text('Deseja excluir este evento?'),
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

    final deleted = await ctrl.deleteEvent();
    if (!context.mounted) return;
    if (deleted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Evento excluído com sucesso.')),
      );
      Navigator.of(context).pop(true);
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Não foi possível excluir o evento.')),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final st = ref.watch(agendaDetailProvider(event));
    final ctrl = ref.read(agendaDetailProvider(event).notifier);

    final start = st.event.startAt;
    final end = st.event.endAt;
    final time = st.event.allDay
        ? 'Dia inteiro'
        : '${start.day.toString().padLeft(2, '0')}/${start.month.toString().padLeft(2, '0')} ${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}  •  '
            '${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Evento'),
        actions: [
          IconButton(
            tooltip: 'Excluir evento',
            onPressed: (st.loading || st.uploading)
                ? null
                : () => _confirmAndDelete(context, ctrl),
            icon: const Icon(Icons.delete_outline),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (st.loading || st.uploading) const LinearProgressIndicator(minHeight: 2),
            if (st.uploading && st.uploadProgress != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 6, 12, 0),
                child: Row(
                  children: [
                    const Spacer(),
                    Flexible(
                      child: Text(
                        [
                          'Enviando',
                          if ((st.uploadFileName ?? '').trim().isNotEmpty) '• ${st.uploadFileName}',
                          '— ${((st.uploadProgress ?? 0) * 100).toStringAsFixed(0)}%',
                        ].join(' '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12, fontWeight: FontWeight.w700),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Cancelar envio',
                      onPressed: () => ctrl.cancelUpload(),
                      icon: const Icon(Icons.close, size: 18),
                      visualDensity: VisualDensity.compact,
                    ),
                  ],
                ),
              ),
            if (st.error != null)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Text(st.error!, style: const TextStyle(color: Colors.red)),
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  Text(st.event.title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 6),
                  Text(time, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  if ((st.event.location ?? '').trim().isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(st.event.location!.trim(), style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  ],
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Text('Anexos', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                      const Spacer(),
                      FilledButton.icon(
                        onPressed: st.uploading
                            ? null
                            : () async {
                                final picked = await FilePicker.platform.pickFiles(withData: false);
                                final f = picked?.files.firstOrNull;
                                if (f == null || f.path == null) return;
                                await ctrl.upload(filePath: f.path!, fileName: f.name, mimeType: null);
                              },
                        icon: const Icon(Icons.upload_file),
                        label: const Text('Enviar'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  if (st.attachments.isEmpty && !st.loading)
                    Text('Nenhum anexo.', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  ...st.attachments.map((a) {
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant.withOpacity(0.55)),
                        color: Theme.of(context).colorScheme.surface,
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.attach_file, color: Theme.of(context).colorScheme.primary),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              a.fileName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w800),
                            ),
                          ),
                          TextButton(
                            onPressed: () async => openAttachment(context, ref, urlOrPath: a.filePath, mimeType: a.fileType),
                            child: const Text('Abrir'),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

extension<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

