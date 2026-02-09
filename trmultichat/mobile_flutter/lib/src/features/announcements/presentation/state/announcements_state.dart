import '../../domain/entities/announcement.dart';

class AnnouncementsState {
  final bool loading;
  final String search;
  final List<Announcement> items;
  final Set<int> readIds;
  final String? error;

  const AnnouncementsState({
    required this.loading,
    required this.search,
    required this.items,
    required this.readIds,
    required this.error,
  });

  factory AnnouncementsState.initial() => const AnnouncementsState(
        loading: false,
        search: '',
        items: [],
        readIds: {},
        error: null,
      );

  AnnouncementsState copyWith({
    bool? loading,
    String? search,
    List<Announcement>? items,
    Set<int>? readIds,
    String? error,
  }) {
    return AnnouncementsState(
      loading: loading ?? this.loading,
      search: search ?? this.search,
      items: items ?? this.items,
      readIds: readIds ?? this.readIds,
      error: error,
    );
  }
}

