import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { dateLabel, manilaDate } from '../lib/policies';
import { Copy } from './components';
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
        width: dates.length < 4 ? dates.length * 66 + 16 : '100%',
        padding: 8,
        boxShadow: '0px 3px 12px rgba(5,18,14,0.06)',
      }}
    >
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
              minHeight: 72,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: 10,
              borderRadius: 18,
              backgroundColor: selected === date ? theme.primary : date < manilaDate() ? theme.soft : theme.surface,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Copy
              small
              style={{ color: selected === date ? theme.onPrimary : theme.muted, fontSize: 11, fontWeight: '700' }}
            >
              {new Date(`${date}T12:00:00+08:00`)
                .toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' })
                .toUpperCase()}
            </Copy>
            <Copy
              style={{
                fontFamily: fonts.display,
                fontSize: 24,
                lineHeight: 28,
                fontWeight: '800',
                color: selected === date ? theme.onPrimary : theme.text,
              }}
            >
              {Number(date.slice(-2))}
            </Copy>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
