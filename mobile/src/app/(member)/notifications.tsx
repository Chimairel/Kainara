import React from 'react';
import { useResource } from '../../lib/use-resource';
import { api } from '../../lib/client';
import { Button, Copy, Notice, Panel, Screen, useAction } from '../../ui/components';
type Notification = { id: string; title: string; message: string; isRead: boolean; createdAt: string };
export default function Notifications() {
  const resource = useResource<{ notifications: Notification[]; unreadCount: number }>('/user/notifications');
  const action = useAction();
  return (
    <Screen refreshing={resource.loading} onRefresh={() => void resource.reload()}>
      <Copy title>Updates for you</Copy>
      <Copy muted>
        In-app notifications. Native push delivery is a separate setup and is not enabled by this screen.
      </Copy>
      {resource.error ? (
        <Notice title="Could not load updates" body={resource.error} error onRetry={() => void resource.reload()} />
      ) : null}
      {resource.data?.notifications.map((item) => (
        <Panel key={item.id}>
          <Copy small muted>
            {new Date(item.createdAt).toLocaleString('en-PH')}
          </Copy>
          <Copy style={{ fontWeight: '700' }}>{item.title}</Copy>
          <Copy>{item.message}</Copy>
          {!item.isRead ? (
            <Button
              label="Mark as read"
              secondary
              disabled={action.busy}
              onPress={() =>
                action.run(async () => {
                  await api.request(`/user/notifications/${encodeURIComponent(item.id)}/read`, 'PATCH', {});
                  await resource.reload();
                })
              }
            />
          ) : (
            <Copy small muted>
              Read
            </Copy>
          )}
        </Panel>
      ))}
      {!resource.loading && !resource.error && !resource.data?.notifications.length ? (
        <Notice title="You’re all caught up" body="Your account and planning updates will appear here." />
      ) : null}
      {action.error ? <Notice error title="Could not mark the update" body={action.error} /> : null}
    </Screen>
  );
}
