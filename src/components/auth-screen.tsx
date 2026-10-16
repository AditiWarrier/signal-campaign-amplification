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

type AuthMode = 'login' | 'register';

const C = {
  paper: '#EEE8DF', white: '#FFFEFA', ink: '#302A25', muted: '#776E65',
  line: '#E8E1D7', brown: '#74563F', brownLight: '#EDE5DA', red: '#8A5140',
  green: '#536D58',
};

function friendlyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function Field({ label, error, accessory, ...props }: TextInputProps & { label: string; error?: string; accessory?: ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, error && styles.inputError]}>
        <TextInput {...props} style={[styles.input, props.style]} placeholderTextColor="#92877D" />
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
        const confirmationRequired = await register(name.trim(), email.trim().toLowerCase(), password);
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
            <Text style={styles.wordmark}>SIGNAL</Text>
            <Text style={styles.title}>{registering ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={styles.intro}>{registering ? 'Join a community helping meaningful messages travel further.' : 'Sign in to continue to SIGNAL.'}</Text>

            {!configured ? (
              <View style={styles.setupNotice}>
                <Text style={styles.setupTitle}>Authentication setup required</Text>
                <Text style={styles.setupCopy}>Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your local .env file. No account can be created or signed in until a provider is configured.</Text>
              </View>
            ) : null}

            {registering ? <Field label="Name" value={name} onChangeText={setName} error={fieldErrors.name} placeholder="Your name" autoCapitalize="words" autoComplete="name" returnKeyType="next" /> : null}
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
              {loading ? <ActivityIndicator color={C.white} /> : <Text style={styles.submitText}>{registering ? 'Create Account' : 'Sign In'}</Text>}
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
  wordmark: { color: C.brown, letterSpacing: 2.5, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 28 },
  title: { color: C.ink, fontSize: 30, lineHeight: 37, fontWeight: '600', letterSpacing: -0.5 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 22 },
  setupNotice: { backgroundColor: '#E8E1D7', borderRadius: 8, padding: 13, marginBottom: 17 },
  setupTitle: { color: C.ink, fontSize: 12, fontWeight: '700' },
  setupCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  fieldGroup: { marginBottom: 15 },
  fieldLabel: { color: C.ink, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inputWrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 7, backgroundColor: C.white, paddingHorizontal: 12 },
  inputError: { borderColor: C.red },
  input: { flex: 1, minWidth: 0, minHeight: 46, color: C.ink, fontSize: 13, paddingVertical: 10 },
  visibilityButton: { paddingVertical: 10, paddingLeft: 10 },
  visibilityText: { color: C.brown, fontSize: 11, fontWeight: '700' },
  fieldError: { color: C.red, fontSize: 10, marginTop: 5 },
  errorMessage: { color: C.red, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  successMessage: { color: C.green, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  submitButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: C.brown, borderRadius: 7, marginTop: 5 },
  submitText: { color: C.white, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.74 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 18 },
  switchCopy: { color: C.muted, fontSize: 11 },
  switchLink: { color: C.brown, fontSize: 11, fontWeight: '700' },
  footer: { color: C.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 26 },
});
