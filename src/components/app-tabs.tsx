import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Signal } from '@/constants/theme';

export default function AppTabs({ signedIn = true }: { signedIn?: boolean }) {
  return (
    <NativeTabs
      backgroundColor={Signal.paper}
      indicatorColor={Signal.forest}
      iconColor={{ default: Signal.inkSoft, selected: Signal.onDark }}
      labelStyle={{ default: { color: Signal.inkSoft }, selected: { color: Signal.forest } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="home" sf="house.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="explore" sf="safari" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="create" hidden={!signedIn}>
        <NativeTabs.Trigger.Label>Create</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="add" sf="plus" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity" hidden={!signedIn}>
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="notifications" sf="bell" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" hidden={!signedIn}>
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="person" sf="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
