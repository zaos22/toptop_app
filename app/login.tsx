import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/config/supabase';
import Colors from '@/constants/Colors';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { AccountService, SavedAccount } from '@/services/accountService';
import { BiometricService } from '@/services/biometricService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { ChevronRight, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// WebBrowser.maybeCompleteAuthSession() ya está en AuthContext


export default function LoginScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { showToast, showAlert, setGlobalLoading } = useGlobalUI();

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
    const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);

    // Animación de entrada: fade + slide up
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    useEffect(() => {
        loadSavedAccounts();
    }, []);

    useEffect(() => {
        if (selectedAccount) {
            checkAccountBiometrics(selectedAccount.id);
        } else {
            setIsBiometricEnabled(false);
        }
    }, [selectedAccount]);

    const loadSavedAccounts = async () => {
        const accounts = await AccountService.getSavedAccounts();
        setSavedAccounts(accounts);
    };

    const handleQuickLogin = async (accountId: string) => {
        const isTargetAccountGuarded = await AsyncStorage.getItem(`${accountId}_settings_biometric`) === 'true';

        if (isTargetAccountGuarded) {
            const verified = await BiometricService.verifyIdentity(`Confirm your identity to access this account`);
            if (!verified) return;
        }

        setGlobalLoading(true, 'Switching accounts...');
        try {
            const result = await AccountService.switchAccount(accountId);
            if (result.success) {
                // Dejamos que el layout central maneje la redirección
            } else {
                showAlert({
                    title: 'Attention',
                    message: 'Your session has expired, please log in again.'
                });
            }
        } finally {
            setGlobalLoading(false);
        }
    };

    const checkAccountBiometrics = async (accountId: string) => {
        const enabled = await AsyncStorage.getItem(`${accountId}_settings_biometric`) === 'true';
        setIsBiometricEnabled(enabled);
    };

    const handleBiometricLogin = async (accountOverride?: SavedAccount) => {
        const account = accountOverride || selectedAccount;
        if (!account) return;

        const credentials = await BiometricService.authenticate();
        if (credentials) {
            setGlobalLoading(true, 'Logging in with biometrics...');
            try {
                const { error } = await supabase.auth.signInWithPassword({
                    email: credentials.email,
                    password: credentials.password,
                });
                if (error) throw error;
                // Dejamos que el layout central maneje la redirección
            } catch (error: any) {
                console.error(error);
                showAlert({
                    title: 'Biometric Error',
                    message: 'Could not log in automatically. Please use your email and password.',
                });
            } finally {
                setGlobalLoading(false);
            }
        }
    };

    const handleAccountSelect = async (acc: SavedAccount) => {
        setSelectedAccount(acc);
        setIdentifier(acc.email);

        const isGoogle = acc.provider === 'google';
        const isBiometric = !isGoogle && (await AsyncStorage.getItem(`${acc.id}_settings_biometric`) === 'true');

        // 1. First, try to "Direct Link" / Switch if the session is still active
        // But if it's an email account with biometrics, we MUST ask biometrics first for security
        if (!isGoogle && isBiometric) {
            return handleBiometricLogin(acc);
        }

        // Try direct session switch
        setGlobalLoading(true, 'Entering...');
        try {
            const result = await AccountService.switchAccount(acc.id);
            if (result.success) {
                // Pequeño delay para que el contexto reaccione y redireccione
                setTimeout(() => setGlobalLoading(false), 300);
                return;
            }
        } catch (e) {
            console.error('[Login] Error al seleccionar cuenta:', e);
            showToast('Could not enter the account', 'error');
            setGlobalLoading(false);
            return;
        }

        setGlobalLoading(false);

        // 2. If direct switch failed (session expired or needs re-auth)
        if (isGoogle) {
            handleGoogleLogin(acc);
        } else if (isBiometric) {
            // This is a redundant check but safe as a fallback
            handleBiometricLogin(acc);
        } else {
            showAlert({
                title: 'Attention',
                message: 'Your session has expired, please log in again.'
            });
            setPassword('');
        }
    };

    const handleGoogleLogin = async (accountOverride?: SavedAccount) => {
        setGlobalLoading(true, 'Connecting with Google...');
        try {
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            let response;

            // 1. Try silent login if we know which account we want
            if (accountOverride?.email) {
                try {
                    const silentResponse = await GoogleSignin.signInSilently();
                    if (silentResponse.type === 'success' && silentResponse.data?.user?.email === accountOverride.email) {
                        response = silentResponse;
                        console.log('[Login] Multi-account: Silent login success for', accountOverride.email);
                    }
                } catch (silentError) {
                    console.log('[Login] Silent login failed, proceeding to interactive:', silentError);
                }
            }

            // 2. Interactive login if silent failed or not applicable
            if (!response) {
                if (Platform.OS === 'android' && accountOverride?.email) {
                    // Bypass account picker on Android for known account
                    GoogleSignin.configure({
                        webClientId: '34451604947-di63uoh0il1o4c4gte1dms4fpbnf7nsd.apps.googleusercontent.com',
                        accountName: accountOverride.email,
                    });
                } else if (Platform.OS === 'android') {
                    // Reset config for normal button
                    GoogleSignin.configure({
                        webClientId: '34451604947-di63uoh0il1o4c4gte1dms4fpbnf7nsd.apps.googleusercontent.com',
                    });
                }

                response = await GoogleSignin.signIn();
            }

            console.log('[Login] Google Sign-In response type:', response.type);

            if (response.type !== 'success') {
                // El usuario canceló o hubo un error no fatal
                console.log('[Login] Google sign-in cancelado o fallido:', response.type);
                return;
            }

            const idToken = response.data?.idToken;
            if (!idToken) {
                throw new Error('No se obtuvo el idToken de Google.');
            }

            console.log('[Login] idToken obtenido, autenticando con Supabase...');
            const { data, error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: idToken,
            });

            if (error) throw error;

            console.log('[Login] Autenticación Supabase exitosa:', data.user?.email);
            // Dejamos que el layout central maneje la redirección
        } catch (error: any) {
            console.error('[Login] Error en Google Sign-In:', error);

            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                // El usuario canceló manualmente, no mostramos error
                console.log('[Login] Usuario canceló el sign-in');
            } else if (error.code === statusCodes.IN_PROGRESS) {
                showToast('Login already in progress', 'info');
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                showToast('Google Play Services not available', 'error');
            } else {
                showToast('Error signing in with Google: ' + (error.message || 'Unknown error'), 'error');
            }
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!identifier || !password) {
            showToast('Please fill in your email/username and password', 'info');
            return;
        }

        setGlobalLoading(true, 'Logging into TopTop...');
        try {
            let loginEmail = identifier.trim();

            if (!loginEmail.includes('@')) {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', loginEmail.replace(/^@/, ''))
                    .maybeSingle();

                if (profileError) throw profileError;
                if (!profileData) {
                    throw new Error('No user found with that username.');
                }
                loginEmail = profileData.email;
            }

            const { error } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: password,
            });

            if (error) throw error;
            // Dejamos que el layout central maneje la redirección
        } catch (error: any) {
            console.error(error);
            showAlert({
                title: 'Login Error',
                message: 'Invalid credentials or the user does not exist.',
            });
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!identifier) {
            showToast('Introduce tu email primero para enviarte el enlace.', 'info');
            return;
        }

        setGlobalLoading(true, 'Sending recovery link...');
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(identifier.trim());
            if (error) throw error;
            showAlert({
                title: 'Email Sent',
                message: 'Check your inbox for the recovery link.',
            });
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                        <View style={styles.heroSection}>
                            <View style={[styles.mainLogoContainer, { backgroundColor: theme.backgroundSecondary, borderColor: theme.card }]}>
                                <Image
                                    source={colorScheme?.includes('dark') ? require('../assets/images/Logo_Oscuro_login.png') : require('../assets/images/Logo_login.png')}
                                    style={styles.mainLogo}
                                    resizeMode="cover"
                                />
                            </View>
                        </View>

                        {savedAccounts.length > 0 && (
                            <View style={styles.savedAccountsSection}>
                                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>RECENT ACCOUNTS</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsScroll}>
                                    {savedAccounts.map(acc => (
                                        <TouchableOpacity
                                            key={acc.id}
                                            style={[
                                                styles.accountCard,
                                                { backgroundColor: theme.card },
                                                selectedAccount?.id === acc.id && { borderColor: theme.primary, borderWidth: 2 }
                                            ]}
                                            onPress={() => handleAccountSelect(acc)}
                                            onLongPress={() => handleQuickLogin(acc.id)}
                                        >
                                            <Image
                                                source={{ uri: acc.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80' }}
                                                style={styles.avatarMini}
                                            />
                                            <Text style={[styles.accountName, { color: theme.text }]} numberOfLines={1}>{acc.displayName.split(' ')[0]}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        <View style={styles.formSection}>
                            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.card }]}>
                                <Mail size={20} color={theme.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    placeholder="Email or Username"
                                    placeholderTextColor={theme.textSecondary}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    spellCheck={false}
                                    textContentType="username"
                                    value={identifier}
                                    onChangeText={setIdentifier}
                                />
                            </View>

                            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.card }]}>
                                <Lock size={20} color={theme.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    placeholder="Password"
                                    placeholderTextColor={theme.textSecondary}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    spellCheck={false}
                                    textContentType="password"
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                                    {showPassword ? (
                                        <EyeOff size={20} color={theme.textSecondary} />
                                    ) : (
                                        <Eye size={20} color={theme.textSecondary} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
                                <Text style={[styles.forgotText, { color: theme.primary }]}>Forgot Password?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.loginBtn, { backgroundColor: theme.primary }]}
                                onPress={handleLogin}
                            >
                                <>
                                    <Text style={styles.loginBtnText}>Log In</Text>
                                    <ChevronRight size={20} color="#1C1F26" />
                                </>
                            </TouchableOpacity>

                            <View style={styles.dividerContainer}>
                                <View style={[styles.divider, { backgroundColor: theme.neutral + '40' }]} />
                                <Text style={[styles.dividerText, { color: theme.textSecondary }]}>OR CONTINUE WITH</Text>
                                <View style={[styles.divider, { backgroundColor: theme.neutral + '40' }]} />
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.googleBtn,
                                    {
                                        backgroundColor: colorScheme?.toLowerCase().includes('dark') ? '#1C1F26' : '#FFFFFF',
                                        borderColor: colorScheme?.toLowerCase().includes('dark') ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                    }
                                ]}
                                onPress={() => handleGoogleLogin()}
                            >
                                <View style={styles.googleIconContainer}>
                                    <Image
                                        source={{ uri: 'https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png' }}
                                        style={styles.googleIcon}
                                        resizeMode="contain"
                                    />
                                </View>
                                <Text style={[styles.googleBtnText, { color: theme.text }]}>
                                    Continue with Google
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.footer}>
                            <Text style={[styles.footerText, { color: theme.textSecondary }]}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => router.push('/signup')}>
                                <Text style={[styles.footerLink, { color: theme.primary }]}>Sign Up</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 25, flexGrow: 1 },
    heroSection: { alignItems: 'center', marginBottom: 40 },
    mainLogoContainer: {
        width: 120, height: 120, borderRadius: 30, overflow: 'hidden',
        borderWidth: 1.5, shadowColor: '#D6B25E', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10,
    },
    mainLogo: { width: '100%', height: '100%', transform: [{ scale: 1.7 }] },
    subtitle: { fontSize: 16, textAlign: 'center', fontWeight: '500' },
    formSection: { marginBottom: 30 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: 18, marginBottom: 15, paddingHorizontal: 15, borderWidth: 1 },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, fontWeight: '500', minHeight: 50, paddingVertical: Platform.OS === 'android' ? 8 : 0 },
    eyeIcon: { padding: 10 },
    forgotBtn: { alignSelf: 'flex-end', marginBottom: 25 },
    forgotText: { fontSize: 14, fontWeight: '700' },
    loginBtn: { height: 60, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', elevation: 5 },
    loginBtnText: { color: '#1C1F26', fontSize: 18, fontWeight: '800', marginRight: 8 },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
    footerText: { fontSize: 15, fontWeight: '500' },
    footerLink: { fontSize: 15, fontWeight: '800' },
    savedAccountsSection: { marginBottom: 30 },
    sectionTitle: { fontSize: 12, fontWeight: '800', marginBottom: 15, letterSpacing: 1 },
    accountsScroll: { gap: 12 },
    accountCard: { padding: 12, borderRadius: 20, alignItems: 'center', minWidth: 90 },
    avatarMini: { width: 45, height: 45, borderRadius: 22.5, marginBottom: 8 },
    accountName: { fontSize: 12, fontWeight: '700' },
    dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 25 },
    divider: { flex: 1, height: 1, opacity: 0.2 },
    dividerText: { marginHorizontal: 15, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    googleBtn: {
        height: 60,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 2,
    },
    googleIconContainer: {
        width: 32,
        height: 32,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        // Shadow for the white icon box
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    googleIcon: {
        width: 20,
        height: 20,
    },
    googleBtnText: {
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
