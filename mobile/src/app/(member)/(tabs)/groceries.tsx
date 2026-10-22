import React from 'react';
import { View } from 'react-native';
import { useResource } from '../../../lib/use-resource';
import { api } from '../../../lib/client';
import type { GroceryList } from '../../../lib/contracts';
import { Button, Copy, Divider, Notice, Panel, Screen, useAction } from '../../../ui/components';

type Projection = {
  groceryList: GroceryList | null;
  actionability: { canCheckItems: boolean; reason?: string; message?: string };
  coverage?: { clearedSlotCount?: number; expectedSlotCount?: number };
};
export default function Groceries() {
  const resource = useResource<{ current: Projection | null; upcoming: Projection | null }>('/user/grocery/workspace');
  const action = useAction();
  return (
    <Screen refreshing={resource.loading} onRefresh={() => void resource.reload()}>
      <Copy title>A little preparation goes a long way.</Copy>
      <Copy muted>
        Grocery quantities come from your cleared plan. A partial list may still change while meals are reviewed.
      </Copy>
      {resource.error ? (
        <Notice error title="Groceries unavailable" body={resource.error} onRetry={() => void resource.reload()} />
      ) : null}
      {resource.loading ? (
        <Copy muted>Checking your shopping cycles…</Copy>
      ) : (
        (['current', 'upcoming'] as const).map((scope) => {
          const projection = resource.data?.[scope];
          const items = projection?.groceryList?.groceryItems ?? [];
          return (
            <View key={scope} style={{ gap: 16 }}>
              <Copy style={{ fontSize: 24, fontWeight: '700' }}>
                {scope === 'current' ? 'Current cycle' : 'Upcoming cycle'}
              </Copy>
              {!projection || !items.length ? (
                <Notice
                  title="No grocery list yet"
                  body="This cycle’s list appears when eligible meals are available. Keep pending meal reviews separate from shopping-ready items."
                />
              ) : (
                <>
                  {!projection.actionability.canCheckItems ? (
                    <Notice
                      title="Read-only grocery list"
                      body={
                        projection.actionability.message ??
                        projection.actionability.reason ??
                        'Shopping is not available for this cycle yet.'
                      }
                    />
                  ) : null}
                  <Panel>
                    {items.map((item) => (
                      <View key={item.id} style={{ gap: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Copy style={{ textDecorationLine: item.isChecked ? 'line-through' : 'none' }}>
                              {item.ingredientName}
                            </Copy>
                            {item.quantity != null ? (
                              <Copy small muted>
                                {item.quantity} {item.unit ?? ''}
                              </Copy>
                            ) : null}
                          </View>
                          <Button
                            label={item.isChecked ? 'Uncheck' : 'Check'}
                            secondary
                            disabled={!projection.actionability.canCheckItems || action.busy}
                            onPress={() =>
                              action.run(async () => {
                                await api.request(
                                  `/user/grocery/items/${encodeURIComponent(item.id)}/toggle`,
                                  'PATCH',
                                  {}
                                );
                                await resource.reload();
                              })
                            }
                          />
                        </View>
                        <Divider />
                      </View>
                    ))}
                  </Panel>
                </>
              )}
            </View>
          );
        })
      )}
      {action.error ? (
        <Notice error title="Could not change this item" body={action.error} onRetry={() => void resource.reload()} />
      ) : null}
    </Screen>
  );
}
