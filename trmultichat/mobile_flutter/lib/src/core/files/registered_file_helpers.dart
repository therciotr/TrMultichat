import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

class RegisteredFileSelection {
  final int fileListId;
  final String fileListName;
  final String fileListMessage;
  final int optionId;
  final String optionName;
  final String path;
  final String? mediaType;

  const RegisteredFileSelection({
    required this.fileListId,
    required this.fileListName,
    required this.fileListMessage,
    required this.optionId,
    required this.optionName,
    required this.path,
    required this.mediaType,
  });
}

String registeredFileAbsoluteUrl(Dio dio, String rawPath) {
  final value = rawPath.trim();
  if (value.isEmpty) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  final base = dio.options.baseUrl.replaceAll(RegExp(r'/+$'), '');
  final path = value.startsWith('/') ? value.substring(1) : value;
  return '$base/uploads/files/$path';
}

String registeredFileNameFromPath(String path) {
  final clean = path.trim();
  if (clean.isEmpty) return 'arquivo';
  final parts = clean.split('/');
  return parts.isEmpty ? clean : parts.last;
}

Future<List<Map<String, dynamic>>> fetchRegisteredFileLists(Dio dio) async {
  final res = await dio.get('/files', queryParameters: {'pageNumber': 1});
  final data = (res.data as Map?)?.cast<String, dynamic>() ?? const {};
  final list = (data['files'] as List? ?? const <dynamic>[]);
  return list
      .whereType<Map>()
      .map((e) => e.cast<String, dynamic>())
      .toList();
}

Future<Map<String, dynamic>> fetchRegisteredFileListDetail(Dio dio, int id) async {
  final res = await dio.get('/files/$id');
  return (res.data as Map?)?.cast<String, dynamic>() ?? const {};
}

Future<RegisteredFileSelection?> pickRegisteredFileSelection(
  BuildContext context,
  Dio dio, {
  String title = 'Selecionar arquivo cadastrado',
}) async {
  final lists = await fetchRegisteredFileLists(dio);
  if (lists.isEmpty) return null;

  int? selectedListId =
      (lists.first['id'] as num?)?.toInt();
  bool loadingOptions = false;
  List<Map<String, dynamic>> options = const [];
  String listMessage = '';
  String listName = (lists.first['name'] ?? 'Lista').toString();
  int? selectedOptionId;

  Future<void> loadOptions(StateSetter setLocal, int listId) async {
    setLocal(() => loadingOptions = true);
    try {
      final detail = await fetchRegisteredFileListDetail(dio, listId);
      final optList = (detail['options'] as List? ?? const <dynamic>[])
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .where((e) => (e['path'] ?? '').toString().trim().isNotEmpty)
          .toList();
      setLocal(() {
        options = optList;
        listMessage = (detail['message'] ?? '').toString();
        listName = (detail['name'] ?? listName).toString();
        selectedOptionId = optList.isNotEmpty
            ? (optList.first['id'] as num?)?.toInt()
            : null;
      });
    } finally {
      setLocal(() => loadingOptions = false);
    }
  }

  RegisteredFileSelection? selection;
  await showDialog<void>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setLocal) {
        if (!loadingOptions && options.isEmpty && selectedListId != null) {
          loadingOptions = true;
          Future.microtask(() => loadOptions(setLocal, selectedListId!));
        }
        return AlertDialog(
          title: Text(title),
          content: SizedBox(
            width: 560,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DropdownButtonFormField<int?>(
                  value: selectedListId,
                  decoration: const InputDecoration(
                    labelText: 'Lista de arquivos',
                  ),
                  items: lists.map((item) {
                    final id = (item['id'] as num?)?.toInt();
                    final name = (item['name'] ?? 'Lista').toString();
                    return DropdownMenuItem<int?>(
                      value: id,
                      child: Text(name),
                    );
                  }).toList(),
                  onChanged: (v) async {
                    if (v == null) return;
                    setLocal(() {
                      selectedListId = v;
                      options = const [];
                      selectedOptionId = null;
                      listMessage = '';
                    });
                    await loadOptions(setLocal, v);
                  },
                ),
                const SizedBox(height: 12),
                if (listMessage.trim().isNotEmpty)
                  Text(
                    listMessage,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                if (listMessage.trim().isNotEmpty) const SizedBox(height: 12),
                if (loadingOptions)
                  const LinearProgressIndicator(minHeight: 2)
                else if (options.isEmpty)
                  const Text('Nenhum item com arquivo disponível nesta lista.')
                else
                  DropdownButtonFormField<int?>(
                    value: selectedOptionId,
                    decoration: const InputDecoration(
                      labelText: 'Arquivo cadastrado',
                    ),
                    items: options.map((item) {
                      final id = (item['id'] as num?)?.toInt();
                      final name = (item['name'] ?? 'Arquivo').toString();
                      final path = registeredFileNameFromPath(
                        (item['path'] ?? '').toString(),
                      );
                      return DropdownMenuItem<int?>(
                        value: id,
                        child: Text('$name • $path'),
                      );
                    }).toList(),
                    onChanged: (v) => setLocal(() => selectedOptionId = v),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: selectedListId == null || selectedOptionId == null
                  ? null
                  : () {
                      final opt = options.firstWhere(
                        (e) => (e['id'] as num?)?.toInt() == selectedOptionId,
                        orElse: () => const <String, dynamic>{},
                      );
                      final path = (opt['path'] ?? '').toString().trim();
                      if (path.isEmpty) return;
                      selection = RegisteredFileSelection(
                        fileListId: selectedListId!,
                        fileListName: listName,
                        fileListMessage: listMessage,
                        optionId: selectedOptionId!,
                        optionName: (opt['name'] ?? '').toString(),
                        path: path,
                        mediaType: (opt['mediaType'] ?? '').toString().trim().isEmpty
                            ? null
                            : (opt['mediaType'] ?? '').toString(),
                      );
                      Navigator.of(ctx).pop();
                    },
              child: const Text('Usar arquivo'),
            ),
          ],
        );
      },
    ),
  );
  return selection;
}

Future<({Uint8List bytes, String fileName, String? mimeType})>
    downloadRegisteredFile(
  Dio dio,
  RegisteredFileSelection selection,
) async {
  final url = registeredFileAbsoluteUrl(dio, selection.path);
  final res = await dio.get<List<int>>(
    url,
    options: Options(responseType: ResponseType.bytes),
  );
  final data = res.data ?? const <int>[];
  return (
    bytes: Uint8List.fromList(data),
    fileName: registeredFileNameFromPath(selection.path),
    mimeType: selection.mediaType,
  );
}
