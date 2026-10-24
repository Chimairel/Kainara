import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useResource } from '../../../lib/use-resource';
import { api } from '../../../lib/client';
import { shareGroceryPdf } from '../../../lib/report-pdf';
import type { GroceryList } from '../../../lib/contracts';
import {
  Button,
  Choice,
  Copy,
  Divider,
  Field,
  Icon,
  Notice,
  Panel,
  Screen,
  SelectField,
  useAction,
} from '../../../ui/components';
import { PortalHeader } from '../../../ui/portal';
import { fonts, useTheme } from '../../../ui/theme';

type Projection = {
  cycle?: { id: string; status?: string };
  groceryList: GroceryList | null;
  actionability: { canCheckItems: boolean; canExportPdf?: boolean; reason?: string; message?: string };
  coverage?: { clearedSlotCount?: number; expectedSlotCount?: number };
};
export default function Groceries() {
  const resource = useResource<{ current: Projection | null; upcoming: Projection | null }>('/user/grocery/workspace');
  const action = useAction();
  const theme = useTheme();
  const [scope, setScope] = useState('current');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState('ALL');
  const projection = scope === 'current' ? resource.data?.current : resource.data?.upcoming;
  const items = projection?.groceryList?.groceryItems ?? [];
  const checked = items.filter((item) => item.isChecked).length;
  const categories = Array.from(new Set(items.map((item) => item.category || 'Other'))).sort();
  const visible = items.filter(
    (item) =>
      (!query || (item.ingredientName + ' ' + (item.category || '')).toLowerCase().includes(query.toLowerCase())) &&
      (category === 'ALL' || (item.category || 'Other') === category) &&
      (filter === 'all' || (filter === 'ready' ? item.isChecked : !item.isChecked))
  );
  return (
    <Screen refreshing={resource.loading} onRefresh={() => void resource.reload()}>
      <PortalHeader title="Groceries" description="A simple checklist for the ingredients in your meal plan." />
      <Choice
        label="Grocery week"
        segmented
        value={scope}
        onChange={(value) => {
          setScope(value);
          setQuery('');
          setCategory('ALL');
          setFilter('all');
        }}
        options={[
          ['current', 'Current week'],
          ['upcoming', 'Next week'],
        ]}
      />
      {resource.error ? (
        <Notice error title="Groceries unavailable" body={resource.error} onRetry={() => void resource.reload()} />
      ) : null}
      {resource.loading ? (
        <Copy muted>Checking your shopping cycles…</Copy>
      ) : !projection || !items.length ? (
        <Notice
          title={scope === 'current' ? 'No grocery list for this week yet' : 'No grocery list for next week yet'}
          body="Ingredients will appear here when cleared meals for this cycle are available."
        />
      ) : (
        <>
          <Panel
            style={{
              padding: 24,
              paddingLeft: 76,
              borderRadius: 28,
              overflow: 'hidden',
              backgroundColor: theme.isDark ? theme.surface : theme.background,
              gap: 14,
            }}
          >
            <Svg
              width={112}
              height={112}
              viewBox="0 0 160 160"
              style={{ position: 'absolute', left: 0, top: 0 }}
              accessible={false}
            >
              <Path d="M0,0 H160 C120,80 70,130 0,155 Z" fill="#eb6a38" />
              <Path d="M0,0 H120 C90,60 55,100 0,120 Z" fill="#f09e6c" />
              <Path d="M0,0 H80 C60,40 30,64 0,80 Z" fill="#1b4e41" />
            </Svg>
            <Image
              source={require('../../../../assets/kainara-icon.png')}
              accessible={false}
              style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.08, width: 142, height: 142 }}
            />
            <Copy small muted style={{ fontSize: 10, fontWeight: '700' }}>
              {scope === 'current' ? 'CURRENT CYCLE' : 'NEXT CYCLE'}
              {projection.cycle?.status ? ' · ' + projection.cycle.status.replaceAll('_', ' ') : ''}
            </Copy>
            {projection.coverage?.expectedSlotCount !== undefined ? (
              <Copy small style={{ color: theme.green }}>
                {projection.coverage.clearedSlotCount ?? 0} of {projection.coverage.expectedSlotCount} meal slots
                included
              </Copy>
            ) : null}
            {projection.actionability.canExportPdf && projection.cycle?.id ? (
              <Button
                label="Download PDF"
                secondary
                busy={action.busy}
                onPress={() => action.run(() => shareGroceryPdf(projection.cycle!.id))}
              />
            ) : null}
            <Copy style={{ fontFamily: fonts.display, fontWeight: '800', fontSize: 24, lineHeight: 30 }}>
              {checked} of {items.length} items ready
            </Copy>
            <Copy small muted>
              {items.length - checked} remaining to buy
            </Copy>
            <View style={{ height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: theme.border }}>
              <View
                style={{ height: 10, width: `${(checked / items.length) * 100}%`, backgroundColor: theme.primary }}
              />
            </View>
            {!projection.actionability.canCheckItems ? (
              <Copy small muted>
                {projection.actionability.message ?? projection.actionability.reason ?? 'Read-only grocery list'}
              </Copy>
            ) : null}
          </Panel>
          <Panel style={{ padding: 16, gap: 12 }}>
            <Field
              label="Search ingredients"
              placeholder="Search ingredients, category..."
              value={query}
              onChangeText={setQuery}
              maxLength={120}
            />
            <SelectField
              label="Departments"
              value={category}
              onChange={setCategory}
              options={[
                ['ALL', `All Departments (${items.length})`],
                ...categories.map((value) => [value, value] as const),
              ]}
            />
            <Choice
              label="Shopping status"
              segmented
              value={filter}
              onChange={setFilter}
              options={[
                ['all', 'All items'],
                ['needed', 'To buy'],
                ['ready', 'Have'],
              ]}
            />
          </Panel>
          <Panel style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
            <View style={{ padding: 16, backgroundColor: theme.soft }}>
              <Copy small style={{ fontWeight: '700' }}>
                INGREDIENT · QUANTITY
              </Copy>
            </View>
            {visible.map((item) => (
              <View key={item.id}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={item.ingredientName}
                  accessibilityState={{
                    checked: item.isChecked,
                    disabled: !projection.actionability.canCheckItems || action.busy,
                  }}
                  disabled={!projection.actionability.canCheckItems || action.busy}
                  onPress={() =>
                    void action.run(async () => {
                      await api.request(`/user/grocery/items/${encodeURIComponent(item.id)}/toggle`, 'PATCH', {});
                      await resource.reload();
                    })
                  }
                  style={{
                    padding: 16,
                    minHeight: 64,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    opacity: projection.actionability.canCheckItems ? 1 : 0.6,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 1,
                      borderColor: item.isChecked ? theme.green : theme.border,
                      backgroundColor: item.isChecked ? theme.green : theme.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.isChecked ? <Icon name="check" size={15} color={theme.surface} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Copy style={{ fontWeight: '600', textDecorationLine: item.isChecked ? 'line-through' : 'none' }}>
                      {item.ingredientName}
                    </Copy>
                    <Copy small muted>
                      {item.category || 'Other'}
                    </Copy>
                  </View>
                  <Copy small>{item.quantity == null ? 'Not recorded' : `${item.quantity} ${item.unit ?? ''}`}</Copy>
                </Pressable>
                <Divider />
              </View>
            ))}
            {!visible.length ? (
              <View style={{ padding: 20 }}>
                <Copy muted>No ingredients match these filters.</Copy>
              </View>
            ) : null}
          </Panel>
        </>
      )}
      {action.error ? (
        <Notice
          error
          title="Could not complete this action"
          body={action.error}
          onRetry={() => void resource.reload()}
        />
      ) : null}
    </Screen>
  );
}
