import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Signal, SignalFonts } from '@/constants/theme';
import type { HomePerson } from '@/data/home-demo';

const PORTRAIT = 92;
const PANEL_PADDING = 24;

function PersonModal({ person, onClose }: { person: HomePerson | null; onClose: () => void }) {
  const [showNotice, setShowNotice] = useState(false);
  const close = () => { setShowNotice(false); onClose(); };

  return (
    <Modal visible={Boolean(person)} transparent animationType="fade" onRequestClose={close}>
      <View style={m.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close profile" />
        {person && (
          <View style={m.card} accessibilityViewIsModal>
            <Image source={person.image} style={m.portrait} contentFit="cover" accessibilityLabel={`Portrait of ${person.name}`} />
            <Text accessibilityRole="header" style={m.name}>{person.name}</Text>
            <Text style={m.area}>{person.area}</Text>
            <Text style={m.summary}>{person.summary}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowNotice(true)}
              style={({ pressed }) => [m.primary, pressed && m.pressed]}>
              <Text style={m.primaryText}>Explore Profile</Text>
              <Text style={m.primaryText}>{'→'}</Text>
            </Pressable>
            {showNotice && (
              <Text style={m.notice} accessibilityLiveRegion="polite">Full creator profiles are coming soon. This is a demo profile.</Text>
            )}
            <Pressable accessibilityRole="button" onPress={close} hitSlop={8} style={m.closeHit}>
              <Text style={m.close}>Close</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

export function PeoplePanel({ people }: { people: HomePerson[] }) {
  const [selected, setSelected] = useState<HomePerson | null>(null);

  return (
    <View style={s.section}>
      <View style={s.leftSpace} />
      {/* overflow hidden keeps the scrolling row clipped to the panel so nothing crosses the off-white quarter */}
      <View style={s.panel}>
        <Text accessibilityRole="header" style={s.heading}>People Who Made a Difference</Text>
        <Text style={s.note}>Demo profiles</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.scroll}
          contentContainerStyle={s.row}>
          {people.map((person) => (
            <Pressable
              key={person.id}
              accessibilityRole="button"
              accessibilityLabel={`${person.name}, ${person.area}. Open profile.`}
              onPress={() => setSelected(person)}
              style={({ pressed }) => [s.person, pressed && s.pressed]}>
              <Image source={person.image} style={s.portrait} contentFit="cover" />
              <Text style={s.name} numberOfLines={1}>{person.name}</Text>
              <Text style={s.area} numberOfLines={2}>{person.area}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <PersonModal person={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  section: { flexDirection: 'row', width: '100%', marginTop: 64, backgroundColor: Signal.paper },
  leftSpace: { flex: 1 },
  panel: { flex: 3, minWidth: 0, overflow: 'hidden', backgroundColor: Signal.butter, paddingTop: 36, paddingBottom: 32 },
  heading: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 28, lineHeight: 34, paddingHorizontal: PANEL_PADDING, maxWidth: 420 },
  note: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 13, lineHeight: 18, paddingHorizontal: PANEL_PADDING, marginTop: 6, marginBottom: 22 },
  scroll: { width: '100%', overflow: 'hidden' },
  row: { gap: 18, paddingHorizontal: PANEL_PADDING },
  person: { width: 112, alignItems: 'center' },
  pressed: { opacity: 0.7 },
  portrait: { width: PORTRAIT, height: PORTRAIT, borderRadius: PORTRAIT / 2, backgroundColor: Signal.paperDeep },
  name: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 14, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  area: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 16, marginTop: 3, textAlign: 'center' },
});

const m = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(14,19,15,0.55)' },
  card: { width: '100%', maxWidth: 360, alignItems: 'center', backgroundColor: Signal.paper, borderRadius: 6, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16 },
  portrait: { width: 136, height: 136, borderRadius: 68, backgroundColor: Signal.butter },
  name: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 26, lineHeight: 32, marginTop: 18, textAlign: 'center' },
  area: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 14, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  summary: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 15, lineHeight: 22, marginTop: 12, textAlign: 'center' },
  primary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', minHeight: 48, borderRadius: 24, backgroundColor: Signal.ink, marginTop: 22 },
  primaryText: { color: Signal.onDark, fontFamily: SignalFonts.sans, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  notice: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 13, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  closeHit: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
  close: { color: Signal.lake, fontFamily: SignalFonts.sans, fontSize: 15, fontWeight: '700' },
});
