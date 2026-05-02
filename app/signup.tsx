import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/config/supabase';
import Colors from '@/constants/Colors';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { BiometricService } from '@/services/biometricService';
import { useRouter } from 'expo-router';
import { ArrowLeft, AtSign, Eye, EyeOff, Lock, Mail, ShieldCheck, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignupScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { showToast, showAlert, setGlobalLoading } = useGlobalUI();

    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSignup = async () => {
        if (!email || !password || !fullName || !username) {
            showToast('Please fill in all fields', 'info');
            return;
        }

        setGlobalLoading(true, 'Creating your TopTop account...');
        try {
            // Clean username
            const cleanUsername = username.trim().replace(/^@/, '');

            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password: password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        username: cleanUsername,
                        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName.trim())}&background=random&color=fff&bold=true&size=512`,
                    }
                }
            });

            if (error) throw error;

            // Prompt for biometrics
            const canEnroll = await BiometricService.isCompatible();
            if (canEnroll) {
                showAlert({
                    title: 'Biometric Security',
                    message: 'Do you want to use Fingerprint or Face Recognition to log in faster next time?',
                    options: [
                        {
                            text: 'Not now', style: 'cancel', onPress: () => {
                                showToast('Account created! Welcome to TopTop', 'success');
                                // Let the central layout handle the redirection
                            }
                        },
                        {
                            text: 'Enable',
                            onPress: async () => {
                                const success = await BiometricService.enroll(email.trim(), password);
                                if (success) {
                                    showToast('Biometric security enabled.', 'success');
                                }
                                showToast('Account created! Welcome to TopTop', 'success');
                                // Let the central layout handle the redirection
                            }
                        }
                    ]
                });
            } else {
                showToast('Account created! Welcome to TopTop', 'success');
                // Dejamos que el layout central maneje la redirección
            }
        } catch (error: any) {
            console.error(error);
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
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <ArrowLeft size={24} color={theme.text} />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <View style={[styles.mainLogoContainer, { backgroundColor: theme.backgroundSecondary, borderColor: theme.card }]}>
                            <Image 
                                source={colorScheme?.includes('dark') ? require('../assets/images/Logo_Oscuro_login.png') : require('../assets/images/Logo_login.png')}
                                style={styles.mainLogo}
                                resizeMode="cover"
                            />
                        </View>
                    </View>

                    <View style={styles.form}>
                        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.card }]}>
                            <User size={20} color={theme.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Full Name"
                                placeholderTextColor={theme.textSecondary}
                                textContentType="name"
                                value={fullName}
                                onChangeText={setFullName}
                            />
                        </View>

                        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.card }]}>
                            <AtSign size={20} color={theme.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Username (e.g., zaos)"
                                placeholderTextColor={theme.textSecondary}
                                autoCapitalize="none"
                                autoCorrect={false}
                                spellCheck={false}
                                textContentType="username"
                                value={username}
                                onChangeText={setUsername}
                            />
                        </View>

                        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.card }]}>
                            <Mail size={20} color={theme.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Email Address"
                                placeholderTextColor={theme.textSecondary}
                                autoCapitalize="none"
                                autoCorrect={false}
                                spellCheck={false}
                                textContentType="emailAddress"
                                keyboardType="email-address"
                                value={email}
                                onChangeText={setEmail}
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

                        <TouchableOpacity
                            style={[styles.signupBtn, { backgroundColor: theme.primary }]}
                            onPress={handleSignup}
                        >
                            <Text style={styles.signupBtnText}>Create Account</Text>
                        </TouchableOpacity>

                        <View style={styles.termsContainer}>
                            <ShieldCheck size={16} color={theme.textSecondary} />
                            <Text style={[styles.termsText, { color: theme.textSecondary }]}>
                                By signing up, you agree to our Terms and Merit Policy.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <Text style={[styles.footerText, { color: theme.textSecondary }]}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => router.push('/login')}>
                            <Text style={[styles.footerLink, { color: theme.primary }]}>Log In</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 25, flexGrow: 1 },
    backBtn: { width: 40, height: 40, justifyContent: 'center', marginBottom: 20 },
    header: { marginBottom: 40, alignItems: 'center' },
    mainLogoContainer: {
        width: 100, height: 100, borderRadius: 25, overflow: 'hidden',
        borderWidth: 1.5, shadowColor: '#D6B25E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8,
    },
    mainLogo: { width: '100%', height: '100%' },
    title: { fontSize: 32, fontWeight: '900', marginBottom: 10 },
    subtitle: { fontSize: 16, fontWeight: '500' },
    form: { marginBottom: 30 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: 18, borderWidth: 1, marginBottom: 15, paddingHorizontal: 15 },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, fontWeight: '500', minHeight: 50, paddingVertical: Platform.OS === 'android' ? 8 : 0 },
    eyeIcon: { padding: 10 },
    signupBtn: { height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 15, shadowColor: '#D6B25E', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
    signupBtnText: { color: '#1C1F26', fontSize: 18, fontWeight: '800' },
    termsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    termsText: { fontSize: 12, marginLeft: 8, fontWeight: '500' },
    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 40 },
    footerText: { fontSize: 15, fontWeight: '500' },
    footerLink: { fontSize: 15, fontWeight: '800' },
});
