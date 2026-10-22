import React from 'react';
import { Button, Copy, Notice, Screen, openExternal } from '../../ui/components';
import { useSession } from '../../lib/session';
import { webUrl } from '../../lib/web-links';
import { router } from 'expo-router';
export default function AccountHelp() {
  const { profile, refresh, signOut } = useSession();
  return (
    <Screen>
      <Copy title>Continue your account setup</Copy>
      <Notice
        title="Some account workflows remain on the website"
        body="Staff workspaces, Google account linking and detailed clinical clarification are available on the KAINARA website. Sign in there separately, then return here and refresh your account."
      />
      <Copy muted>{profile?.email}</Copy>
      <Button label="Open KAINARA website" onPress={() => openExternal(webUrl('/profile'))} />
      <Button label="Account & privacy" secondary onPress={() => router.push('/account')} />
      <Button label="Refresh account" secondary onPress={refresh} />
      <Button label="Sign out" secondary onPress={signOut} />
    </Screen>
  );
}
