import React from 'react';
import { View } from 'react-native';
import { Copy } from './components';
import { fonts, useTheme } from './theme';

/** Same small-screen page header structure as the PWA PortalPageHeader. */
export function PortalHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 12, paddingTop: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <View style={{ gap: 4 }}>
        <Copy title>{title}</Copy>
        <Copy muted>{description}</Copy>
      </View>
      {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{actions}</View> : null}
    </View>
  );
}

export function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: '48%',
        flexGrow: 1,
        borderRadius: 20,
        padding: 16,
        gap: 14,
        backgroundColor: theme.surface,
        borderColor: theme.border,
        borderWidth: 1,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: color + '18',
        }}
      >
        {icon}
      </View>
      <View style={{ gap: 4 }}>
        <Copy style={{ fontFamily: fonts.display, fontWeight: '800', fontSize: 24, lineHeight: 30 }}>{value}</Copy>
        <Copy small muted style={{ fontWeight: '600' }}>
          {label}
        </Copy>
      </View>
    </View>
  );
}
