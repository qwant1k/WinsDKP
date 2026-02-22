import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';

type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  isRead?: boolean;
};

export function useNotificationsSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const prependUnique = (items: NotificationItem[] | undefined, incoming: NotificationItem, limit?: number) => {
      const base = Array.isArray(items) ? items.filter((item) => item.id !== incoming.id) : [];
      const next = [incoming, ...base];
      return typeof limit === 'number' ? next.slice(0, limit) : next;
    };

    const handleNew = (notification: NotificationItem) => {
      queryClient.setQueryData(['notifications', 'unread-count'], (old: any) => ({
        count: Math.max(0, (old?.count ?? 0) + 1),
      }));

      queryClient.setQueryData(['notifications', 1], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: prependUnique(old.data, notification, 30),
          unreadCount: Math.max(0, (old.unreadCount ?? 0) + 1),
        };
      });

      queryClient.setQueryData(['notifications', 'dropdown'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: prependUnique(old.data, notification, 20),
          unreadCount: Math.max(0, (old.unreadCount ?? 0) + 1),
        };
      });

      toast(notification.title, { description: notification.body || undefined });
    };

    socket.on('notification.created', handleNew);
    return () => {
      socket.off('notification.created', handleNew);
    };
  }, [queryClient]);
}
