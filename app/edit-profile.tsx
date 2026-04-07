import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/config/supabase';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { uploadProfilePhoto } from '@/services/storageService';
import { getUserProfile, isUsernameAvailable, updateUserProfile } from '@/services/userProfileService';
import { getDefaultAvatarUrl } from '@/utils/userUtils';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, AtSign, Camera, FileText, Save, User as UserIcon } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { user, needsUsername, setNeedsUsername } = useAuth();

    const { showToast, showAlert, setGlobalLoading } = useGlobalUI();

    const [loading, setLoading] = useState(true);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const [displayName, setDisplayName] = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
    const [initialUsername, setInitialUsername] = useState('');

    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user?.id]);

    const loadProfile = async () => {
        if (!user) return;

        try {
            const profile = await getUserProfile(user.id);
            
            // Priority: DB Profile -> Auth Metadata -> Empty Fallback
            const dbUsername = profile?.username;
            const metaUsername = user.user_metadata?.username || user.user_metadata?.user_name;
            
            // If we need a username (onboarding/new registration), we DO NOT use the one from Auth metadata to force a new name
            const finalUsername = needsUsername ? (dbUsername || '') : (dbUsername || metaUsername || '');

            const dbDisplayName = profile?.displayName;
            const metaDisplayName = user.user_metadata?.full_name || user.user_metadata?.name;
            const finalDisplayName = dbDisplayName || metaDisplayName || '';

            setDisplayName(finalDisplayName);
            setUsername(finalUsername);
            setInitialUsername(finalUsername);
            
            if (profile) {
                setBio(profile.bio || '');
                setPhotoURL(profile.photoURL || '');
            } else {
                setPhotoURL(user.user_metadata?.avatar_url || '');
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            showToast('Could not load profile', 'error');
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== 'granted') {
                showToast('We need access to your photos', 'info');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                setLocalPhotoUri(result.assets[0].uri);
            }
        } catch (error) {
            console.error('Error picking image:', error);
            showToast('Could not select image', 'error');
        }
    };

    const handleSave = async () => {
        if (!user) return;

        const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
        
        if (!displayName.trim()) {
            showToast('Name cannot be empty', 'info');
            return;
        }

        if (cleanUsername && !/^[a-z0-9_.]+$/.test(cleanUsername)) {
            showToast('Username can only contain letters, numbers, dots, and underscores', 'info');
            return;
        }

        if (cleanUsername && cleanUsername.length < 3) {
            showToast('Username must be at least 3 characters long', 'info');
            return;
        }

        setGlobalLoading(true, 'Saving changes...');

        // Timeout helper (with comma to avoid conflict with JSX)
        const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => 
            Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
            ]) as Promise<T>;

        try {
            console.log('[EditProfile] Atomic save initiated');
            
            // 1. Validation
            const currentUsername = username.trim().replace(/^@/, '').toLowerCase();
            if (currentUsername && currentUsername !== initialUsername.toLowerCase()) {
                console.log('[EditProfile] Step 1: Validating username availability');
                const available = await withTimeout(
                    isUsernameAvailable(currentUsername, user.id),
                    10000,
                    'Availability check timed out'
                );
                
                if (!available) {
                    setGlobalLoading(false);
                    showToast('This username is already taken', 'error');
                    return;
                }
            }

            // 2. Photo Upload
            let finalizedPhotoURL = photoURL;
            if (localPhotoUri) {
                console.log('[EditProfile] Step 2: Uploading photo');
                setUploadingPhoto(true);
                try {
                    finalizedPhotoURL = await withTimeout(
                        uploadProfilePhoto(user.id, localPhotoUri),
                        25000,
                        'Image upload is too slow'
                    );
                } finally {
                    setUploadingPhoto(false);
                }
            }

            // 3. DATABASE UPDATE (Source of Truth)
            console.log('[EditProfile] Step 3: Updating DB profiles table');
            await withTimeout(
                updateUserProfile(user.id, {
                    displayName: displayName.trim(),
                    username: currentUsername || null,
                    bio: bio.trim() || null,
                    photoURL: finalizedPhotoURL || null,
                }),
                15000,
                'The database is not responding'
            );

            // 4. AUTH METADATA SYNC (Secondary)
            console.log('[EditProfile] Step 4: Syncing Auth metadata');
            try {
                const authUpdates = {
                    full_name: displayName.trim(),
                    avatar_url: finalizedPhotoURL || null,
                    username: currentUsername || null
                };

                const authPromise = supabase.auth.updateUser({ data: authUpdates });
                
                // We don't wait forever for Auth to respond if we already have the DB ok
                await Promise.race([
                    authPromise,
                    new Promise(resolve => setTimeout(resolve, 4000))
                ]);
            } catch (authError) {
                console.warn('[EditProfile] Auth sync slow but DB is updated');
            }

            // SUCCESS
            console.log('[EditProfile] Success! Finalizing UI...');
            setNeedsUsername(false);
            setGlobalLoading(false);
            showToast('Profile updated successfully', 'success');
            
            setTimeout(() => {
                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.replace('/(tabs)/profile');
                }
            }, 800);

        } catch (error: any) {
            console.error('[EditProfile] Critical error in handleSave:', error);
            setGlobalLoading(false);
            showToast(error.message || 'Error saving profile', 'error');
        } finally {
            setUploadingPhoto(false);
        }
    };






    const displayPhotoURL = localPhotoUri || photoURL || getDefaultAvatarUrl(displayName || user?.user_metadata?.full_name || 'User');

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {loading ? (
                <View style={[styles.container, styles.centered, { flex: 1 }]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            {!needsUsername && <ArrowLeft size={24} color={theme.text} />}
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>
                            {needsUsername ? 'Set up your Profile' : 'Edit Profile'}
                        </Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={styles.photoSection}>
                        <View style={[styles.photoContainer, { borderColor: theme.primary }]}>
                            <Image
                                source={{ uri: displayPhotoURL }}
                                style={styles.photo}
                            />
                            {uploadingPhoto && (
                                <View style={styles.uploadingOverlay}>
                                    <ActivityIndicator size="large" color="#fff" />
                                </View>
                            )}
                        </View>
                        <TouchableOpacity
                            style={[styles.changePhotoBtn, { backgroundColor: theme.primary }]}
                            onPress={pickImage}
                            disabled={uploadingPhoto}
                        >
                            <Camera size={20} color="#1C1F26" />
                            <Text style={styles.changePhotoText}>Change Photo</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.form}>
                        {needsUsername && (
                            <View style={[styles.onboardingInfo, { backgroundColor: theme.primary + '15' }]}>
                                <Text style={[styles.onboardingTitle, { color: theme.primary }]}>Welcome to TopTop! 🎉</Text>
                                <Text style={[styles.onboardingText, { color: theme.textSecondary }]}>
                                    To finish, please choose a unique username.
                                </Text>
                            </View>
                        )}
                        <Text style={[styles.label, { color: theme.textSecondary }]}>Choose Username</Text>
                        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.card }]}>
                            <AtSign size={20} color={theme.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="username"
                                placeholderTextColor={theme.textSecondary}
                                value={username}
                                onChangeText={(text) => setUsername(text.toLowerCase())}
                                autoCapitalize="none"
                                autoCorrect={false}
                                spellCheck={false}
                                textContentType="username"
                                maxLength={30}
                            />
                        </View>

                        <Text style={[styles.label, { color: theme.textSecondary }]}>Full Name</Text>
                        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.card }]}>
                            <UserIcon size={20} color={theme.textSecondary} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                placeholder="Your name"
                                placeholderTextColor={theme.textSecondary}
                                value={displayName}
                                onChangeText={setDisplayName}
                                textContentType="name"
                                maxLength={50}
                            />
                        </View>

                        <Text style={[styles.label, { color: theme.textSecondary }]}>Bio</Text>
                        <View style={[styles.inputContainer, styles.textAreaContainer, { backgroundColor: theme.card, borderColor: theme.card }]}>
                            <FileText size={20} color={theme.textSecondary} style={[styles.inputIcon, { marginTop: 15 }]} />
                            <TextInput
                                style={[styles.input, styles.textArea, { color: theme.text }]}
                                placeholder="Tell us something about yourself..."
                                placeholderTextColor={theme.textSecondary}
                                value={bio}
                                onChangeText={setBio}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                maxLength={160}
                            />
                        </View>


                        <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
                        <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.card, opacity: 0.7 }]}>
                            <Text style={[styles.emailText, { color: theme.textSecondary }]}>{user?.email}</Text>
                        </View>
                        <Text style={[styles.helperText, { color: theme.textSecondary }]}>
                            Email cannot be changed
                        </Text>
                    </View>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                            onPress={handleSave}
                            disabled={uploadingPhoto}
                        >
                            <>
                                <Save size={20} color="#1C1F26" />
                                <Text style={styles.saveBtnText}>Save Changes</Text>
                            </>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
};


const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    photoSection: { alignItems: 'center', paddingVertical: 30 },
    photoContainer: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, padding: 3, marginBottom: 15 },
    photo: { width: '100%', height: '100%', borderRadius: 57 },
    uploadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 57, justifyContent: 'center', alignItems: 'center' },
    changePhotoBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, gap: 8 },
    changePhotoText: { color: '#1C1F26', fontSize: 14, fontWeight: '700' },
    form: { paddingHorizontal: 20, marginBottom: 30 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 15 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', height: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 },
    textAreaContainer: { height: 120, alignItems: 'flex-start' },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, fontWeight: '500', paddingVertical: 0, textAlignVertical: 'center' },
    textArea: { paddingTop: 15, height: '100%' },
    emailText: { fontSize: 16, fontWeight: '600' },
    helperText: { fontSize: 12, marginTop: 6, fontStyle: 'italic' },
    buttonContainer: { paddingHorizontal: 20, paddingBottom: 30 },
    saveBtn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#D6B25E', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
    saveBtnText: { color: '#1C1F26', fontSize: 16, fontWeight: '800' },
    onboardingInfo: { padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(214, 178, 94, 0.2)' },
    onboardingTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
    onboardingText: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
});
