'use client';
import { useEffect, useState, useRef } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Switch from '@/components/ui/Switch';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import MealTimesFields from './MealTimesFields';
import DeviceNotificationsPanel from './DeviceNotificationsPanel';
import { suggestedMealTimes, mealSchedulePayload, type MealReminderSettings } from './types';

export default function MealReminderSettingsPanel() {
  const { user } = useAuth();
  const ownerId = user?.userId;
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const [resolvedOwner, setResolvedOwner] = useState<string | null>(null);
  const [settings, setSettings] = useState<MealReminderSettings>({
    ...suggestedMealTimes,
    breakfastTime: '',
    lunchTime: '',
    dinnerTime: '',
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage('');
    setError('');
    setBusy(false);
    setSettings({
      ...suggestedMealTimes,
      breakfastTime: '',
      lunchTime: '',
      dinnerTime: '',
    });
    if (!ownerId) return;
    void api
      .get('/user/meal-reminders')
      .then((response) => {
        if (!cancelled)
          setSettings(
            response.data.data ?? {
              ...suggestedMealTimes,
              breakfastTime: '',
              lunchTime: '',
              dinnerTime: '',
            }
          );
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Could not load meal times.'));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setResolvedOwner(ownerId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);
  if (loading || resolvedOwner !== ownerId)
    return (
      <Card className="mb-8 p-6">
        <p role="status">Loading meal times…</p>
      </Card>
    );
  return (
    <Card className="mb-8 space-y-5 p-6 text-left">
      <h2 className="font-display text-lg font-bold text-brand-green">Meal times & reminders</h2>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || loading) return;
          setBusy(true);
          setMessage('');
          setError('');
          try {
            await api.put('/user/meal-reminders', mealSchedulePayload(settings));
            if (currentOwner.current === ownerId) setMessage('Meal times and reminder preferences saved.');
          } catch (err) {
            if (currentOwner.current === ownerId) setError(getApiErrorMessage(err, 'Could not save meal times.'));
          } finally {
            if (currentOwner.current === ownerId) setBusy(false);
          }
        }}
      >
        <MealTimesFields value={settings} onChange={setSettings} disabled={loading || busy} />
        <div className="space-y-3 text-sm text-brand-text">
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>Send meal reminders</span>
            <Switch
              aria-label="Send meal reminders"
              checked={settings.remindersEnabled}
              disabled={loading || busy}
              onCheckedChange={(checked) => setSettings({ ...settings, remindersEnabled: checked })}
            />
          </label>
          <fieldset
            aria-label="Meal reminder options"
            disabled={loading || busy || !settings.remindersEnabled}
            className={`ml-2 space-y-3 border-l-2 border-brand-border/70 pl-4 sm:ml-4 sm:pl-5 ${!settings.remindersEnabled ? 'opacity-50' : ''}`}
          >
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span>Preparation reminder</span>
              <Switch
                aria-label="Preparation reminder"
                checked={settings.prepareEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, prepareEnabled: checked })}
              />
            </label>
            <Input
              type="number"
              min={0}
              max={180}
              step={1}
              required
              disabled={loading || busy || !settings.remindersEnabled || !settings.prepareEnabled}
              label="Preparation lead time (minutes before eating)"
              value={Number.isFinite(settings.prepareMinutesBefore ?? 60) ? (settings.prepareMinutesBefore ?? 60) : ''}
              onChange={(event) =>
                setSettings({ ...settings, prepareMinutesBefore: event.currentTarget.valueAsNumber })
              }
              helperText="Choose 0–180 minutes. Use 0 for a reminder at the eating time."
            />
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span>Logging reminder</span>
              <Switch
                aria-label="Logging reminder"
                checked={settings.logEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, logEnabled: checked })}
              />
            </label>
            <p className="text-xs text-brand-muted">60 minutes after eating, if still unlogged.</p>
          </fieldset>
        </div>
        <p className="text-xs text-brand-muted">
          Meal times and reminder preferences apply to your account across devices. The breakfast, lunch and dinner
          fields are your eating times. Preparation follows the lead time above. Reminders only apply to cleared,
          unlogged meals. Delivery depends on your connection and device notification settings.
        </p>
        <Button type="submit" variant="primary" disabled={loading || busy} isLoading={busy}>
          Save meal times
        </Button>
        {message && (
          <p role="status" className="text-xs text-brand-green">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-status-error-text">
            {error}
          </p>
        )}
      </form>
      <DeviceNotificationsPanel />
    </Card>
  );
}
