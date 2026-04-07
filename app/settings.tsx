import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/config/supabase';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { AccountService, SavedAccount } from '@/services/accountService';
import { BiometricService } from '@/services/biometricService';
import { registerForPushNotificationsAsync } from '@/services/notificationService';
import { updateUserProfile } from '@/services/userProfileService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Beef, Bell, Fingerprint, Globe, Lock, LogOut, MapPin, Moon, ShieldCheck, Star, Sun, Trash2, UserPlus, Users, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { useGlobalUI } from '@/context/GlobalUIContext';

export default function SettingsScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { user } = useAuth();
    const { showToast, showAlert, setGlobalLoading } = useGlobalUI();

    // Use the Settings Context
    const {
        theme: settingsTheme, setTheme,
        notificationsEnabled, setNotificationsEnabled,
        biometricEnabled, setBiometricEnabled,
        language, setLanguage,
        halalEnabled, setHalalEnabled
    } = useSettings();

    const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
    const [biometricSupported, setBiometricSupported] = useState(false);

    // States for password modal
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    // States for account management
    const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
    const [showSwitchModal, setShowSwitchModal] = useState(false);
    const [tempPassword, setTempPassword] = useState('');

    useEffect(() => {
        loadSavedAccounts();
        (async () => {
            const compatible = await BiometricService.isCompatible();
            setBiometricSupported(compatible);

            // Sync context state with actual biometric service state
            const isActuallyEnabled = await BiometricService.isEnabled();
            if (isActuallyEnabled !== biometricEnabled) {
                setBiometricEnabled(isActuallyEnabled);
            }
        })();
    }, []);

    const handleUpdateProfile = async () => {
        if (!user) return;
        setGlobalLoading(true, 'Updating profile...');
        try {
            await updateUserProfile(user.id, {
                displayName: fullName
            });

            // Also update Supabase auth metadata
            await supabase.auth.updateUser({
                data: { full_name: fullName }
            });

            showToast('Profile updated successfully', 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    const toggleTheme = () => {
        setTheme(settingsTheme === 'dark' ? 'light' : 'dark');
        showToast(`${settingsTheme === 'dark' ? 'Light' : 'Dark'} mode activated`, 'info');
    };

    const toggleNotifications = async () => {
        if (!notificationsEnabled) {
            setGlobalLoading(true, 'Activating notifications...');
            const token = await registerForPushNotificationsAsync();
            
            if (token && user) {
                // Import if not available, but should already be from the import above
                const { savePushTokenToProfile } = require('@/services/notificationService');
                await savePushTokenToProfile(user.id, token);
                
                setNotificationsEnabled(true);
                setGlobalLoading(false);
                showToast('Notifications activated', 'success');
            } else {
                setGlobalLoading(false);
                showAlert({
                    title: 'Permissions needed',
                    message: 'Please enable notifications in your device settings.',
                    options: [{ text: 'Understood', style: 'primary', onPress: () => { } }]
                });
                return;
            }
        } else {
            setNotificationsEnabled(false);
            showToast('Notifications disabled', 'info');
        }
    };

    const toggleBiometric = async () => {
        if (!biometricSupported) {
            showToast('Device not compatible with biometrics', 'error');
            return;
        }

        // Disable for Google accounts
        if (user?.app_metadata?.provider === 'google') {
            showToast('Biometric access is not available for Google accounts', 'info');
            return;
        }

        if (!biometricEnabled) {
            setShowPasswordModal(true);
        } else {
            await BiometricService.disable();
            setBiometricEnabled(false);
            showToast('Biometrics disabled', 'info');
        }
    };

    const confirmBiometricEnable = async () => {
        if (!tempPassword) {
            showToast('Enter your password', 'error');
            return;
        }

        setGlobalLoading(true, 'Verifying...');
        try {
            const success = await BiometricService.enroll(user?.email || '', tempPassword);
            if (success) {
                setBiometricEnabled(true);
                setShowPasswordModal(false);
                setTempPassword('');
                showToast('Biometrics activated!', 'success');
            } else {
                showToast('Authentication failed', 'error');
            }
        } catch (error) {
            showToast('Could not activate biometrics', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleChangeLanguage = () => {
        const newLang = language === 'en' ? 'es' : 'en';
        setLanguage(newLang);
        showToast(`Language: ${newLang === 'es' ? 'Spanish' : 'English'}`, 'success');
    }

    const toggleHalalMode = async (enabled: boolean) => {
        setHalalEnabled(enabled);
        if (user) {
            try {
                await updateUserProfile(user.id, { isHalal: enabled });
                showToast(`Halal Mode ${enabled ? 'enabled' : 'disabled'}`, 'success');
            } catch (error) {
                console.error('Error updating halal mode:', error);
                showToast('Error saving Halal preference', 'error');
            }
        }
    };

    const handleChangePassword = () => {
        if (!user?.email) return;
        showAlert({
            title: 'Change Password',
            message: `We will send a recovery email to ${user.email}. Continue?`,
            options: [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                    text: 'Send Email',
                    style: 'primary',
                    onPress: async () => {
                        setGlobalLoading(true, 'Sending email...');
                        try {
                            const { error } = await supabase.auth.resetPasswordForEmail(user.email!);
                            if (error) throw error;
                            showToast('Recovery email sent', 'success');
                        } catch (e: any) {
                            showToast(e.message, 'error');
                        } finally {
                            setGlobalLoading(false);
                        }
                    }
                }
            ]
        });
    };

    const handlePrivacyPolicy = () => {
        showAlert({
            title: 'Privacy Policy',
            message: 'TopTop respects your privacy. We store your data securely and never sell it to third parties.',
            options: [{ text: 'Understood', style: 'primary', onPress: () => { } }]
        });
    };

    const loadSavedAccounts = async () => {
        const accounts = await AccountService.getSavedAccounts();
        setSavedAccounts(accounts);
    };

    const handleSwitchAccount = async (accountId: string) => {
        const targetAccount = savedAccounts.find(acc => acc.id === accountId);
        if (!targetAccount) {
            showToast('Account not found', 'error');
            return;
        }

        const isGoogleAccount = targetAccount.provider === 'google';
        let isTargetAccountGuarded = false;

        if (!isGoogleAccount) {
            isTargetAccountGuarded = await AsyncStorage.getItem(`${accountId}_settings_biometric`) === 'true';
        }

        if (isTargetAccountGuarded) {
            const verified = await BiometricService.verifyIdentity('Confirm your identity to access the account');
            if (!verified) return;
        }

        setGlobalLoading(true, 'Switching account...');
        try {
            // Save current first for safekeeping
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (user && currentSession) {
                await AccountService.saveCurrentAccount(user, currentSession);
            }

            const result = await AccountService.switchAccount(accountId);
            setGlobalLoading(false);
            
            if (result.success) {
                setShowSwitchModal(false);
                showToast('Session switched successfully', 'success');
                router.replace('/(tabs)');
            } else if (result.requiresAuth) {
                // Session expired or needs re-auth
                if (isGoogleAccount) {
                    await handleGoogleLoginForSwitch(targetAccount);
                } else {
                    // If it's email and has biometrics, try that
                    const hasBiometrics = await AsyncStorage.getItem(`${accountId}_settings_biometric`) === 'true';
                    if (hasBiometrics) {
                        await handleBiometricLoginForSwitch(targetAccount);
                    } else {
                        // Fallback: take to login
                        showToast('The session has expired. Please log in again.', 'info');
                        await AccountService.logout();
                        router.replace('/login');
                    }
                }
            } else {
                showToast('Could not switch account', 'error');
            }
        } catch (e) {
            console.error('[Settings] Error switching account:', e);
            showToast('Technical error switching account', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleGoogleLoginForSwitch = async (acc: SavedAccount) => {
        try {
            await GoogleSignin.hasPlayServices();
            
            // Try silent first
            let googleResponse: any = await GoogleSignin.signInSilently();
            if (googleResponse.type !== 'success' || googleResponse.data?.user?.email !== acc.email) {
                if (Platform.OS === 'android') {
                    GoogleSignin.configure({
                        webClientId: '34451604947-di63uoh0il1o4c4gte1dms4fpbnf7nsd.apps.googleusercontent.com',
                        accountName: acc.email,
                    });
                }
                googleResponse = await GoogleSignin.signIn();
            }

            if (googleResponse.type === 'success' && googleResponse.data.idToken) {
                const { error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: googleResponse.data.idToken,
                });
                if (error) throw error;
                setShowSwitchModal(false);
                router.replace('/(tabs)');
            }
        } catch (err) {
            console.error('[Settings] Google switch error:', err);
            router.replace('/login');
        }
    };

    const handleBiometricLoginForSwitch = async (acc: SavedAccount) => {
        const credentials = await BiometricService.authenticate();
        if (credentials && credentials.email === acc.email) {
            const { error } = await supabase.auth.signInWithPassword({
                email: credentials.email,
                password: credentials.password,
            });
            if (!error) {
                setShowSwitchModal(false);
                router.replace('/(tabs)');
            } else {
                router.replace('/login');
            }
        } else {
            router.replace('/login');
        }
    };

    const handleAddNewAccount = () => {
        showAlert({
            title: 'Add new account',
            message: 'Do you want to add another active session? You will need to log in again.',
            options: [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                    text: 'Continue',
                    style: 'primary',
                    onPress: async () => {
                        // Save current first
                        const { data: { session } } = await supabase.auth.getSession();
                        if (user && session) await AccountService.saveCurrentAccount(user, session);

                        // Logout locally to preserve the session tokens on the server for the old account
                        await AccountService.logout(true);
                        router.replace('/login');
                    }
                }
            ]
        });
    };

    const handleResetAccounts = async () => {
        showAlert({
            title: 'Reset accounts?',
            message: 'The list of saved accounts for quick access will be cleared. Your current session will not be closed.',
            options: [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        await AccountService.clearAllAccounts();
                        setSavedAccounts([]);
                        showToast('Account list reset', 'info');
                    }
                }
            ]
        });
    };

    const handleDeleteAccountData = async () => {
        showAlert({
            title: '⚠️ Delete account?',
            message: 'This action will permanently delete all your data, reviews, and profile. It cannot be undone.',
            options: [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                    text: 'DELETE ALL',
                    style: 'destructive',
                    onPress: async () => {
                        setGlobalLoading(true, 'Deleting...');
                        try {
                            if (!user) return;
                            await AccountService.deleteUserAccount(user.id);
                            await AccountService.logout();
                            router.replace('/login');
                            showToast('Account deleted successfully', 'success');
                        } catch (e: any) {
                            console.error('[Settings] Error en borrado de cuenta:', e);
                            showToast(e.message || 'Error deleting account', 'error');
                        } finally {
                            setGlobalLoading(false);
                        }
                    }
                }
            ]
        });
    };

    const SettingItem = ({ icon: Icon, title, value, onPress, danger, isSwitch, switchValue, onSwitch }: any) => (
        <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.background }]}
            onPress={isSwitch ? () => onSwitch(!switchValue) : onPress}
            disabled={isSwitch}
        >
            <View style={styles.settingLeft}>
                <View style={[styles.iconContainer, { backgroundColor: danger ? theme.error + '20' : theme.primary + '20' }]}>
                    <Icon size={20} color={danger ? theme.error : theme.primary} />
                </View>
                <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
            </View>
            <View style={styles.settingRight}>
                {isSwitch ? (
                    <Switch
                        value={switchValue}
                        onValueChange={onSwitch}
                        trackColor={{ false: theme.background, true: theme.primary }}
                        thumbColor={switchValue ? '#fff' : '#f4f3f4'}
                    />
                ) : (
                    <>
                        {value && <Text style={[styles.settingValue, { color: theme.textSecondary }]}>{value}</Text>}
                        <ArrowLeft size={16} color={theme.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
                    </>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <Modal visible={showPasswordModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Enable Biometrics</Text>
                        <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
                            Enter your current password to confirm your identity and enable biometric access.
                        </Text>
                        <TextInput
                            style={[styles.modalInput, { color: theme.text, borderColor: theme.textSecondary }]}
                            placeholder="Password"
                            placeholderTextColor={theme.textSecondary}
                            secureTextEntry={true}
                            value={tempPassword}
                            onChangeText={setTempPassword}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.background }]}
                                onPress={() => {
                                    setShowPasswordModal(false);
                                    setTempPassword('');
                                }}
                            >
                                <Text style={{ color: theme.text, fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                                onPress={confirmBiometricEnable}
                            >
                                <Text style={{ color: '#1C1F26', fontWeight: '700' }}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={showSwitchModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card, maxHeight: '80%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Switch Account</Text>
                            <TouchableOpacity onPress={() => setShowSwitchModal(false)}>
                                <X size={24} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ width: '100%', marginTop: 20 }}>
                            {savedAccounts.map(acc => (
                                <TouchableOpacity
                                    key={acc.id}
                                    style={[styles.accountItem, { backgroundColor: user?.id === acc.id ? theme.primary + '10' : 'transparent' }]}
                                    onPress={() => handleSwitchAccount(acc.id)}
                                >
                                    <Image
                                        source={{ uri: acc.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80' }}
                                        style={styles.accountAvatar}
                                    />
                                    <View style={styles.accountInfo}>
                                        <Text style={[styles.accountName, { color: theme.text }]}>{acc.displayName}</Text>
                                        <Text style={[styles.accountEmail, { color: theme.textSecondary }]}>{acc.email}</Text>
                                    </View>
                                    {user?.id === acc.id && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
                                </TouchableOpacity>
                            ))}

                            <TouchableOpacity
                                style={[styles.accountItem, { marginTop: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.primary }]}
                                onPress={handleAddNewAccount}
                            >
                                <View style={[styles.accountAvatar, { backgroundColor: theme.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
                                    <UserPlus size={20} color={theme.primary} />
                                </View>
                                <Text style={[styles.accountName, { color: theme.primary, marginLeft: 15 }]}>Add another account</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PREFERENCES</Text>
                    <View style={[styles.card, { backgroundColor: theme.card }]}>
                        <SettingItem
                            icon={Bell}
                            title="Notifications"
                            isSwitch
                            switchValue={notificationsEnabled}
                            onSwitch={toggleNotifications}
                        />
                        <SettingItem
                            icon={settingsTheme === 'dark' ? Moon : Sun}
                            title="Dark Mode"
                            isSwitch
                            switchValue={settingsTheme === 'dark'}
                            onSwitch={toggleTheme}
                        />
                        <SettingItem
                            icon={Globe}
                            title="Language"
                            value={language === 'en' ? 'English' : 'Spanish'}
                            onPress={handleChangeLanguage}
                        />
                        <SettingItem
                            icon={Star}
                            title="Manage my Reviews"
                            onPress={() => router.push('/manage-reviews')}
                        />
                        <SettingItem
                            icon={MapPin}
                            title="My Visit History"
                            onPress={() => router.push('/visit-history')}
                        />
                        <SettingItem
                            icon={Beef}
                            title="Halal Mode"
                            isSwitch
                            switchValue={halalEnabled}
                            onSwitch={toggleHalalMode}
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SECURITY</Text>
                    <View style={[styles.card, { backgroundColor: theme.card }]}>
                        {user?.app_metadata?.provider !== 'google' && (
                            <SettingItem
                                icon={Fingerprint}
                                title="Biometric Login"
                                isSwitch
                                switchValue={biometricEnabled}
                                onSwitch={toggleBiometric}
                            />
                        )}
                        <SettingItem
                            icon={Users}
                            title="Switch / Add Account"
                            value={`${savedAccounts.length} active`}
                            onPress={() => setShowSwitchModal(true)}
                        />
                        <SettingItem icon={Lock} title="Change Password" onPress={handleChangePassword} />
                        <SettingItem icon={ShieldCheck} title="Privacy Policy" onPress={handlePrivacyPolicy} />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: theme.error }]}>DANGER</Text>
                    <View style={[styles.card, { backgroundColor: theme.card }]}>
                        <SettingItem
                            icon={Trash2}
                            title="Delete Account and Data"
                            danger
                            onPress={handleDeleteAccountData}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={() => {
                        showAlert({
                            title: 'Log out',
                            message: 'Are you sure you want to log out?',
                            options: [
                                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                                {
                                    text: 'Log out',
                                    style: 'destructive',
                                    icon: LogOut,
                                    onPress: async () => {
                                        setGlobalLoading(true, 'Logging out...');
                                        try {
                                            const { success, error } = await AccountService.logout();
                                            if (!success) throw error;
                                            router.replace('/login');
                                        } catch (error) {
                                            console.error('Logout error:', error);
                                        } finally {
                                            setGlobalLoading(false);
                                        }
                                    }
                                }
                            ]
                        });
                    }}
                >
                    <LogOut size={20} color={theme.error} />
                    <Text style={[styles.logoutText, { color: theme.error }]}>Log Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    content: { padding: 20 },
    section: { marginBottom: 30 },
    sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 10, marginLeft: 5 },
    card: { borderRadius: 20, overflow: 'hidden', padding: 15 },
    inputGroup: { marginBottom: 15 },
    inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
    input: { height: 45, fontSize: 16, fontWeight: '600', borderBottomWidth: 1 },
    saveBtn: { height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    saveBtnText: { color: '#1C1F26', fontSize: 14, fontWeight: '700' },
    settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1 },
    settingLeft: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    settingTitle: { fontSize: 16, fontWeight: '600' },
    settingRight: { flexDirection: 'row', alignItems: 'center' },
    settingValue: { fontSize: 14, fontWeight: '500', marginRight: 10 },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 40, gap: 10 },
    logoutText: { fontSize: 16, fontWeight: '700' },
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', borderRadius: 25, padding: 25, alignItems: 'center' },
    modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
    modalDesc: { fontSize: 14, textAlign: 'center', marginBottom: 20, fontWeight: '500' },
    modalInput: { width: '100%', height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15, marginBottom: 20, fontSize: 16 },
    modalActions: { flexDirection: 'row', gap: 10 },
    modalBtn: { flex: 1, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
    accountItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 10, position: 'relative' },
    accountAvatar: { width: 45, height: 45, borderRadius: 22.5 },
    accountInfo: { marginLeft: 15, flex: 1 },
    accountName: { fontSize: 16, fontWeight: '700' },
    accountEmail: { fontSize: 13, fontWeight: '500' },
    activeIndicator: { width: 8, height: 8, borderRadius: 4, position: 'absolute', right: 15, top: '50%', marginTop: -4 },
});
