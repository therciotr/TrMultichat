class ApiEndpoints {
  static const authLogin = '/auth/login';
  static const authMe = '/auth/me';
  static const authForgotPassword = '/auth/forgot-password';
  static const authResetPassword = '/auth/reset-password';

  static const branding = '/branding';
  static const dashboard = '/dashboard';

  static const tickets = '/tickets';
  static String ticketById(int id) => '/tickets/$id';

  static String messagesByTicket(int ticketId) => '/messages/$ticketId';

  static const tags = '/tags';
  static const tagsSync = '/tags/sync';

  static const ticketNotesList = '/ticket-notes/list';
  static const ticketNotes = '/ticket-notes';

  static const announcements = '/announcements';
  static String announcementReplies(String id) => '/announcements/$id/replies';

  static const agendaEvents = '/agenda/events';
}

