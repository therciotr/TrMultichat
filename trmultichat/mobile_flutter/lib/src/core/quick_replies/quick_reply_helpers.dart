import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

class QuickReplySelection {
  final int id;
  final String shortcode;
  final String message;
  final String? category;
  final String? mediaPath;
  final String? mediaName;

  const QuickReplySelection({
    required this.id,
    required this.shortcode,
    required this.message,
    required this.category,
    required this.mediaPath,
    required this.mediaName,
  });
}

String quickReplyAbsoluteMediaUrl(Dio dio, String raw) {
  final value = raw.trim();
  if (value.isEmpty) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  final base = dio.options.baseUrl.replaceAll(RegExp(r'/+$'), '');
  return '$base/${value.replaceAll(RegExp(r'^/+'), '')}';
}

Future<List<QuickReplySelection>> fetchQuickReplies(
  Dio dio, {
  int? companyId,
  int? userId,
}) async {
  final res = await dio.get(
    '/quick-messages/list',
    queryParameters: {
      if (companyId != null && companyId > 0) 'companyId': companyId,
      if (userId != null && userId > 0) 'userId': userId,
    },
  );
  final raw = res.data;
  final list = raw is List ? raw : const [];
  return list
      .whereType<Map>()
      .map((e) => e.cast<String, dynamic>())
      .map(
        (e) => QuickReplySelection(
          id: (e['id'] as num?)?.toInt() ?? 0,
          shortcode: (e['shortcode'] ?? '').toString(),
          message: (e['message'] ?? '').toString(),
          category: (e['category'] ?? '').toString().trim().isEmpty
              ? null
              : (e['category'] ?? '').toString(),
          mediaPath: (e['mediaPath'] ?? '').toString().trim().isEmpty
              ? null
              : (e['mediaPath'] ?? '').toString(),
          mediaName: (e['mediaName'] ?? '').toString().trim().isEmpty
              ? null
              : (e['mediaName'] ?? '').toString(),
        ),
      )
      .toList();
}

Future<QuickReplySelection?> pickQuickReply(
  BuildContext context,
  List<QuickReplySelection> replies,
) async {
  String search = '';
  String category = 'all';
  final categories = <String>{
    'all',
    ...replies
        .map((e) => (e.category ?? '').trim())
        .where((e) => e.isNotEmpty),
  }.toList();

  QuickReplySelection? selected;
  await showDialog<void>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setLocal) {
        final filtered = replies.where((item) {
          final categoryOk = category == 'all' || item.category == category;
          if (!categoryOk) return false;
          final term = search.trim().toLowerCase();
          if (term.isEmpty) return true;
          return item.shortcode.toLowerCase().contains(term) ||
              item.message.toLowerCase().contains(term);
        }).toList();

        return AlertDialog(
          title: const Text('Selecionar resposta rápida'),
          content: SizedBox(
            width: 560,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  decoration: const InputDecoration(labelText: 'Buscar resposta'),
                  onChanged: (v) => setLocal(() => search = v),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: category,
                  decoration: const InputDecoration(labelText: 'Categoria'),
                  items: categories
                      .map(
                        (c) => DropdownMenuItem<String>(
                          value: c,
                          child: Text(c == 'all' ? 'Todas' : c),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setLocal(() => category = v ?? 'all'),
                ),
                const SizedBox(height: 12),
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final item = filtered[i];
                      return InkWell(
                        onTap: () {
                          selected = item;
                          Navigator.of(ctx).pop();
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: Theme.of(context)
                                  .colorScheme
                                  .outlineVariant
                                  .withOpacity(0.45),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      '/${item.shortcode}',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ),
                                  if ((item.category ?? '').trim().isNotEmpty)
                                    Chip(
                                      label: Text(item.category!),
                                      visualDensity: VisualDensity.compact,
                                    ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                item.message,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if ((item.mediaPath ?? '').trim().isNotEmpty) ...[
                                const SizedBox(height: 6),
                                const Text(
                                  'Contém anexo',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Fechar'),
            ),
          ],
        );
      },
    ),
  );
  return selected;
}

Future<({Uint8List bytes, String fileName, String? mimeType})>
    downloadQuickReplyMedia(
  Dio dio,
  QuickReplySelection reply,
) async {
  final url = quickReplyAbsoluteMediaUrl(dio, reply.mediaPath ?? '');
  final res = await dio.get<List<int>>(
    url,
    options: Options(responseType: ResponseType.bytes),
  );
  final data = res.data ?? const <int>[];
  return (
    bytes: Uint8List.fromList(data),
    fileName: (reply.mediaName ?? url.split('/').last).trim().isEmpty
        ? 'arquivo'
        : (reply.mediaName ?? url.split('/').last),
    mimeType: null,
  );
}
