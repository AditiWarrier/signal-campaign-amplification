import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Signal, SignalFonts } from '@/constants/theme';
import type { HomePerson } from '@/data/home-demo';

const PORTRAIT = 92;
const PANEL_PADDING = 24;
export const PEOPLE_SECTION_YELLOW = '#F6EECB';

export function PeoplePanel({ people }: { people: HomePerson[] }) {
  return (
    <View style={s.section}>
      <View style={s.leftSpace} />
      {/* overflow hidden keeps the scrolling row clipped to the panel so nothing crosses the off-white quarter */}
      <View style={s.panel}>
        <Text accessibilityRole="header" style={s.heading}>Meet the People Who Keep Change Moving Forward</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.scroll}
          contentContainerStyle={s.row}>
          {people.map((person) => (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={`${person.name}, ${person.role}, ${person.country}. See Profile.`}
              onPress={() => router.push({ pathname: '/creator/[id]', params: { id: person.id } } as never)}
              style={({ pressed }) => [s.person, pressed && s.pressed]}>
              <Image source={person.image} style={s.portrait} contentFit="cover" accessibilityLabel={`Portrait of ${person.name}`} />
              <Text style={s.name} numberOfLines={1}>{person.name}</Text>
              <Text style={s.area} numberOfLines={2}>{person.role} · {person.country}</Text>
              <Text style={s.link}>See Profile →</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { flexDirection: 'row', width: '100%', marginTop: 64, backgroundColor: Signal.paper },
  leftSpace: { flex: 1 },
  panel: { flex: 3, minWidth: 0, overflow: 'hidden', backgroundColor: PEOPLE_SECTION_YELLOW, paddingTop: 36, paddingBottom: 32 },
  heading: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 28, lineHeight: 34, paddingHorizontal: PANEL_PADDING, maxWidth: 420, marginBottom: 22 },
  scroll: { width: '100%', overflow: 'hidden' },
  row: { gap: 18, paddingHorizontal: PANEL_PADDING },
  person: { width: 112, alignItems: 'center' },
  pressed: { opacity: 0.7 },
  portrait: { width: PORTRAIT, height: PORTRAIT, borderRadius: PORTRAIT / 2, backgroundColor: Signal.paperDeep },
  name: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 14, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  area: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: 'center' },
  link: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 9 },
});
