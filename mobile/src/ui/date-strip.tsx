import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { dateLabel, manilaDate } from '../lib/policies';
import { Copy, Icon } from './components';
import { fonts, useTheme } from './theme';

export function DateStrip({
  dates,
  selected,
  onSelect,
}: {
  dates: string[];
  selected: string;
  onSelect(date: string): void;
}) {
  const theme = useTheme();
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Record<string, number>>({});
  useEffect(() => {
    scroller.current?.scrollTo({ x: Math.max(0, (positions.current[selected] ?? 0) - 60), animated: false });
  }, [selected]);
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 24,
        alignSelf: 'center',
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        boxShadow: '0px 3px 12px rgba(5,18,14,0.06)',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous day"
        accessibilityState={{ disabled: dates.indexOf(selected) <= 0 }}
        disabled={dates.indexOf(selected) <= 0}
        onPress={() => onSelect(dates[dates.indexOf(selected) - 1])}
        style={{
          width: 36,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: dates.indexOf(selected) <= 0 ? 0.3 : 1,
        }}
      >
        <View style={{ transform: [{ rotate: '180deg' }] }}>
          <Icon name="chevron-right" size={18} />
        </View>
      </Pressable>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
        accessibilityLabel="Meal plan dates"
      >
        {dates.map((date) => (
          <Pressable
            key={date}
            accessibilityRole="button"
            accessibilityLabel={dateLabel(date)}
            accessibilityState={{ selected: selected === date }}
            onPress={() => onSelect(date)}
            onLayout={(event) => {
              positions.current[date] = event.nativeEvent.layout.x;
              if (selected === date)
                scroller.current?.scrollTo({ x: Math.max(0, event.nativeEvent.layout.x - 60), animated: false });
            }}
            style={({ pressed }) => ({
              minWidth: 60,
              minHeight: 58,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: 8,
              borderRadius: 16,
              backgroundColor: selected === date ? theme.primary : date < manilaDate() ? theme.soft : theme.surface,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Copy
              small
              style={{ color: selected === date ? theme.onPrimary : theme.muted, fontSize: 9, fontWeight: '700' }}
            >
              {new Date(`${date}T12:00:00+08:00`)
                .toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' })
                .toUpperCase()}
            </Copy>
            <Copy
              style={{
                fontFamily: fonts.display,
                fontSize: 20,
                lineHeight: 24,
                fontWeight: '800',
                color: selected === date ? theme.onPrimary : theme.text,
              }}
            >
              {Number(date.slice(-2))}
            </Copy>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next day"
        accessibilityState={{ disabled: dates.indexOf(selected) === dates.length - 1 }}
        disabled={dates.indexOf(selected) === dates.length - 1}
        onPress={() => onSelect(dates[dates.indexOf(selected) + 1])}
        style={{
          width: 36,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: dates.indexOf(selected) === dates.length - 1 ? 0.3 : 1,
        }}
      >
        <Icon name="chevron-right" size={18} />
      </Pressable>
    </View>
  );
}
