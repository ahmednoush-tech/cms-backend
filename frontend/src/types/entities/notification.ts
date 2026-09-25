/** Matches backend NotificationPayload (modules/notifications/notification-bus.service.ts) exactly. */
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
}
