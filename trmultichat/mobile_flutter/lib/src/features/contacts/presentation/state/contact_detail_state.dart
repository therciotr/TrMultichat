import '../../domain/entities/contact.dart';

class ContactDetailState {
  final bool loading;
  final Contact? contact;
  final String? error;

  const ContactDetailState({required this.loading, required this.contact, required this.error});

  factory ContactDetailState.initial() => const ContactDetailState(loading: true, contact: null, error: null);

  ContactDetailState copyWith({bool? loading, Contact? contact, String? error}) {
    return ContactDetailState(
      loading: loading ?? this.loading,
      contact: contact ?? this.contact,
      error: error,
    );
  }
}

