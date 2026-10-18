import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from './themed-view';
import { ThemedText } from './themed-text';

import { MaxContentWidth, Spacing } from '@/constants/theme';

const tabIcons = {
  Home: { ios: 'house.fill', android: 'home', web: 'home' },
  Explore: { ios: 'safari', android: 'explore', web: 'explore' },
  Create: { ios: 'plus', android: 'add', web: 'add' },
  Activity: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  Profile: { ios: 'person.fill', android: 'person', web: 'person' },
} as const;

export default function AppTabs() {
  return (
    <Tabs style={styles.tabsRoot}>
      <TabSlot style={styles.tabSlot} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="Home">Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton icon="Explore">Explore</TabButton>
          </TabTrigger>
          <TabTrigger name="create" href="/create" asChild>
            <TabButton icon="Create">Create</TabButton>
          </TabTrigger>
          <TabTrigger name="activity" href="/activity" asChild>
            <TabButton icon="Activity">Activity</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton icon="Profile">Profile</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, icon, ...props }: TabTriggerSlotProps & { icon: keyof typeof tabIcons }) {
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabPressable, pressed && styles.pressed]}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={[styles.tabButtonView, { backgroundColor: isFocused ? '#626B42' : '#E8D5BD' }]}>
        <SymbolView name={tabIcons[icon]} size={19} tintColor={isFocused ? '#FFFFFF' : '#514239'} />
        <ThemedText style={[styles.tabLabel, { color: isFocused ? '#FFFFFF' : '#514239' }]}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const insets = useSafeAreaInsets();
  return (
    <View {...props} style={[styles.tabListContainer, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
      <ThemedView type="backgroundElement" style={[styles.innerContainer, { backgroundColor: '#E8D5BD' }]}>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsRoot: {
    flex: 1,
    minHeight: 0,
  },
  tabSlot: {
    flex: 1,
    minHeight: 0,
  },
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    zIndex: 10,
    width: '100%',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    width: '100%',
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.one,
    maxWidth: MaxContentWidth,
  },
  pressed: {
    opacity: 0.7,
  },
  tabPressable: { flex: 1, minWidth: 0 },
  tabButtonView: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: { fontSize: 10, lineHeight: 14, fontWeight: '600' },
});
