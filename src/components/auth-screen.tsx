import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { Palette as C } from '@/constants/theme';

type AuthMode = 'login' | 'register';
const PROFILE_INTERESTS = ['Education', 'Environment', 'Community', 'Health', 'Accessibility', 'Arts & Culture'] as const;
const PROFILE_GENDERS = ['Male', 'Female', 'Trans', 'Other'] as const;
const PROFILE_OCCUPATIONS = ['Student', 'Employed', 'Self-employed', 'Unemployed', 'Other'] as const;

function friendlyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function Field({ label, error, accessory, ...props }: TextInputProps & { label: string; error?: string; accessory?: ReactNode }) {
  const multiline = props.multiline;
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, multiline && styles.multilineWrap, error && styles.inputError]}>
        <TextInput {...props} style={[styles.input, multiline && styles.multilineInput, props.style]} placeholderTextColor={C.placeholder} />
        {accessory}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const { configured, signIn, register } = useAuth();
  const registering = mode === 'register';
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [aboutMe, setAboutMe] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [occupation, setOccupation] = useState('');
  const [customOccupation, setCustomOccupation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (registering && name.trim().length < 2) next.name = 'Enter your name.';
    if (registering && location.trim().length > 100) next.location = 'Keep your location to 100 characters or fewer.';
    if (registering && aboutMe.trim().length > 280) next.aboutMe = 'Keep About me to 280 characters or fewer.';
    if (registering && age.trim() && (!/^\d{1,3}$/.test(age.trim()) || Number(age) < 1 || Number(age) > 120)) next.age = 'Enter a whole age from 1 to 120.';
    if (registering && customOccupation.trim().length > 80) next.occupation = 'Keep occupation to 80 characters or fewer.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    else if (registering && password.length < 8) next.password = 'Use at least 8 characters.';
    if (registering && confirmation !== password) next.confirmation = 'Passwords do not match.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setError('');
    setNotice('');
    if (!validate()) return;
    if (!configured) {
      setError('Authentication is not configured yet. Add the Supabase project URL and publishable key, then restart Expo.');
      return;
    }
    setLoading(true);
    try {
      if (registering) {
        const confirmationRequired = await register(name.trim(), email.trim().toLowerCase(), password, {
          location: location.trim(), interests, about_me: aboutMe.trim(),
          age: age.trim() ? Number(age.trim()) : null,
          gender,
          occupation: occupation === 'Other' ? customOccupation.trim() : occupation,
        });
        if (confirmationRequired) {
          setNotice('Account created. Confirm your email using the message from Supabase, then return here to sign in.');
        } else {
          router.replace('/');
        }
      } else {
        await signIn(email.trim().toLowerCase(), password);
        router.replace('/');
      }
    } catch (submitError) {
      setError(friendlyError(submitError));
    } finally {
      setLoading(false);
    }
  };

  const togglePassword = (visible: boolean, setVisible: (next: boolean) => void, label: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label}`} onPress={() => setVisible(!visible)} style={styles.visibilityButton}>
      <Text style={styles.visibilityText}>{visible ? 'Hide' : 'Show'}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
          <View style={styles.content}>
            <Pressable accessibilityRole="link" accessibilityLabel="Back to Home" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.backLink}>
              <Text style={styles.backLinkText}>{'← Back to Home'}</Text>
            </Pressable>
            <Text style={styles.wordmark}>SIGNAL</Text>
            <Text style={styles.title}>{registering ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={styles.intro}>{registering ? 'Join a community helping meaningful messages travel further.' : 'Sign in to continue to SIGNAL.'}</Text>

            {!configured ? (
              <View style={styles.setupNotice}>
                <Text style={styles.setupTitle}>Authentication setup required</Text>
                <Text style={styles.setupCopy}>Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your local .env file. No account can be created or signed in until a provider is configured.</Text>
              </View>
            ) : null}

            {registering ? <>
              <Field label="Name" value={name} onChangeText={setName} error={fieldErrors.name} placeholder="Your name" autoCapitalize="words" autoComplete="name" returnKeyType="next" />
              <Field label="Location (optional)" value={location} onChangeText={setLocation} error={fieldErrors.location} placeholder="City or region" autoCapitalize="words" returnKeyType="next" />
              <Field label="Age (optional)" value={age} onChangeText={setAge} error={fieldErrors.age} placeholder="Your age" keyboardType="number-pad" maxLength={3} />
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Gender (optional)</Text>
                <View style={styles.interestOptions}>{PROFILE_GENDERS.map((option) => {
                  const selected = gender === option;
                  return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setGender((current) => current === option ? '' : option)} style={[styles.interestChip, selected && styles.interestChipSelected]}>
                    <Text style={[styles.interestChipText, selected && styles.interestChipTextSelected]}>{option}</Text>
                  </Pressable>;
                })}</View>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Occupation (optional)</Text>
                <View style={styles.interestOptions}>{PROFILE_OCCUPATIONS.map((option) => {
                  const selected = occupation === option;
                  return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setOccupation((current) => current === option ? '' : option)} style={[styles.interestChip, selected && styles.interestChipSelected]}>
                    <Text style={[styles.interestChipText, selected && styles.interestChipTextSelected]}>{option}</Text>
                  </Pressable>;
                })}</View>
                {occupation === 'Other' ? <Field label="Your occupation (optional)" value={customOccupation} onChangeText={setCustomOccupation} error={fieldErrors.occupation} placeholder="Add your own" maxLength={80} /> : null}
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Interests (optional)</Text>
                <Text style={styles.fieldHint}>Choose any topics you care about.</Text>
                <View style={styles.interestOptions}>{PROFILE_INTERESTS.map((interest) => {
                  const selected = interests.includes(interest);
                  return <Pressable key={interest} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setInterests((current) => selected ? current.filter((item) => item !== interest) : [...current, interest])} style={[styles.interestChip, selected && styles.interestChipSelected]}>
                    <Text style={[styles.interestChipText, selected && styles.interestChipTextSelected]}>{interest}</Text>
                  </Pressable>;
                })}</View>
              </View>
              <Field label="About me (optional)" value={aboutMe} onChangeText={setAboutMe} error={fieldErrors.aboutMe} placeholder="A little about what you care about" multiline maxLength={280} />
            </> : null}
            <Field label="Email" value={email} onChangeText={setEmail} error={fieldErrors.email} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="next" />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              error={fieldErrors.password}
              placeholder={registering ? 'At least 8 characters' : 'Your password'}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoComplete={registering ? 'new-password' : 'current-password'}
              textContentType={registering ? 'newPassword' : 'password'}
              returnKeyType={registering ? 'next' : 'go'}
              onSubmitEditing={registering ? undefined : submit}
              accessory={togglePassword(passwordVisible, setPasswordVisible, 'password')}
            />
            {registering ? <Field
              label="Confirm password"
              value={confirmation}
              onChangeText={setConfirmation}
              error={fieldErrors.confirmation}
              placeholder="Enter your password again"
              secureTextEntry={!confirmationVisible}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
              accessory={togglePassword(confirmationVisible, setConfirmationVisible, 'confirmation')}
            /> : null}

            {error ? <Text accessibilityRole="alert" style={styles.errorMessage}>{error}</Text> : null}
            {notice ? <Text accessibilityRole="alert" style={styles.successMessage}>{notice}</Text> : null}

            <Pressable accessibilityRole="button" disabled={loading} onPress={submit} style={({ pressed }) => [styles.submitButton, (pressed || loading) && styles.pressed]}>
              {loading ? <ActivityIndicator color={C.espresso} /> : <Text style={styles.submitText}>{registering ? 'Create Account' : 'Sign In'}</Text>}
            </Pressable>

            <View style={styles.switchRow}>
              <Text style={styles.switchCopy}>{registering ? 'Already have an account?' : 'New to SIGNAL?'}</Text>
              <Pressable accessibilityRole="link" onPress={() => router.replace(registering ? '/login' : '/register')}>
                <Text style={styles.switchLink}>{registering ? 'Sign In' : 'Create Account'}</Text>
              </Pressable>
            </View>
            <Text style={styles.footer}>Contributions support message distribution, not direct donations to a cause.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: C.paper },
  flex: { flex: 1, minHeight: 0 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22, paddingVertical: 28 },
  content: { width: '100%', maxWidth: 460, alignSelf: 'center', justifyContent: 'center', flexGrow: 1 },
  backLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginBottom: 8 },
  backLinkText: { color: C.text, fontSize: 14, fontWeight: '600' },
  wordmark: { color: C.text, letterSpacing: 2.5, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 28 },
  title: { color: C.text, fontSize: 30, lineHeight: 37, fontWeight: '600', letterSpacing: -0.5 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 22 },
  setupNotice: { backgroundColor: C.surfaceSoft, borderRadius: 8, padding: 13, marginBottom: 17 },
  setupTitle: { color: C.text, fontSize: 12, fontWeight: '700' },
  setupCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  fieldGroup: { marginBottom: 15 },
  fieldLabel: { color: C.text, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  fieldHint: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: -3, marginBottom: 7 },
  inputWrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 7, backgroundColor: C.surface, paddingHorizontal: 12 },
  inputError: { borderColor: C.red },
  input: { flex: 1, minWidth: 0, minHeight: 46, color: C.text, fontSize: 13, paddingVertical: 10 },
  multilineWrap: { alignItems: 'stretch', paddingVertical: 3 },
  multilineInput: { minHeight: 88, textAlignVertical: 'top' },
  interestOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 3 },
  interestChip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  interestChipSelected: { backgroundColor: C.green, borderColor: C.green },
  interestChipText: { color: C.text, fontSize: 11, fontWeight: '600' },
  interestChipTextSelected: { color: C.paper },
  visibilityButton: { paddingVertical: 10, paddingLeft: 10 },
  visibilityText: { color: C.text, fontSize: 11, fontWeight: '700' },
  fieldError: { color: C.red, fontSize: 10, marginTop: 5 },
  errorMessage: { color: C.red, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  successMessage: { color: C.green, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  submitButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: C.brown, borderRadius: 7, marginTop: 5 },
  submitText: { color: C.paper, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.74 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 },
  switchCopy: { color: C.muted, fontSize: 11 },
  switchLink: { color: C.text, fontSize: 11, fontWeight: '700' },
  footer: { color: C.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 26 },
});
