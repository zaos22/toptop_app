import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Camera, Landmark, ShieldCheck } from 'lucide-react-native';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { saveReview } from '@/services/establishmentService';

export default function AddReviewScreen() {
    const { place_id, place_name } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    const [quality, setQuality] = useState(10);
    const [value, setValue] = useState(10);
    const [reliability, setReliability] = useState(10);
    const [flavor, setFlavor] = useState(10);
    const [comment, setComment] = useState('');
    const { showToast, showAlert, setGlobalLoading } = useGlobalUI();

    const handleSubmit = async () => {
        if (!user) {
            showToast('You must be logged in to add reviews.', 'error');
            router.push('/login');
            return;
        }

        if (!comment || comment.length < 10) {
            showToast('Please explain a bit more about your experience (min. 10 characters).', 'info');
            return;
        }

        setGlobalLoading(true, 'Loading review...');
        try {
            await saveReview(user.id, place_id as string, {
                user_name: user.user_metadata?.full_name || user.user_metadata?.display_name || 'TopTop Member',
                user_avatar: user.user_metadata?.avatar_url || user.user_metadata?.photo_url || null,
                establishment_name: (place_name as string) || 'Verified Place',
                establishment_id: place_id as string,
                rating_quality: quality,
                rating_price: value,
                rating_service: reliability,
                rating_flavor: flavor,
                comment: comment,
                images: [], // Future: Implement photo upload
            });

            showAlert({
                title: 'Review Success!',
                message: 'Your review has been registered. You contribute veracity and quality to the TopTop ranking. Keep it up!',
                options: [{
                    text: 'Great',
                    style: 'primary',
                    onPress: () => router.replace(`/establishment/${place_id}`)
                }]
            });
        } catch (error: any) {
            console.error('Save review error:', error);
            showToast('Could not save review. Try again.', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    const RatingDial = ({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) => (
        <View style={styles.dialContainer}>
            <Text style={[styles.dialLabel, { color: theme.text }]}>{label}</Text>
            <View style={styles.dialRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <TouchableOpacity
                        key={num}
                        onPress={() => onChange(num)}
                        style={[
                            styles.dialStep,
                            { backgroundColor: num <= value ? theme.primary : theme.card }
                        ]}
                    />
                ))}
                <Text style={[styles.dialValue, { color: theme.primary }]}>{value}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft color={theme.text} size={24} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>New Review</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.establishmentInfo}>
                        <Landmark size={24} color={theme.primary} />
                        <Text style={[styles.establishmentName, { color: theme.text }]}>{place_name || 'Select a place'}</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SCORE (1-10)</Text>
                        <RatingDial label="Service and Product" value={quality} onChange={setQuality} />
                        <RatingDial label="Quality / Price" value={value} onChange={setValue} />
                        <RatingDial label="Reliability" value={reliability} onChange={setReliability} />
                        <RatingDial label="Flavor / Experience" value={flavor} onChange={setFlavor} />
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>YOUR EXPERIENCE</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.card, color: theme.text }]}
                            placeholder="Why do you recommend (or not) this place? Be specific about the quality..."
                            placeholderTextColor={theme.textSecondary}
                            multiline
                            numberOfLines={6}
                            value={comment}
                            onChangeText={setComment}
                        />
                    </View>

                    <TouchableOpacity style={styles.photoBtn}>
                        <Camera size={20} color={theme.textSecondary} />
                        <Text style={[styles.photoBtnText, { color: theme.textSecondary }]}>Add Photos (Optional)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.submitBtn, { backgroundColor: theme.primary }]}
                        onPress={handleSubmit}
                    >
                        <ShieldCheck size={20} color="#1C1F26" />
                        <Text style={styles.submitBtnText}>Publish Review</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    content: { flex: 1, paddingHorizontal: 20 },
    establishmentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(214, 178, 94, 0.1)',
        padding: 15,
        borderRadius: 15,
        marginBottom: 25,
        marginTop: 10,
    },
    establishmentName: { fontSize: 18, fontWeight: '700', marginLeft: 12 },
    section: { marginBottom: 30 },
    sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 15 },
    dialContainer: { marginBottom: 20 },
    dialLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
    dialRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dialStep: { flex: 1, height: 10, borderRadius: 3 },
    dialValue: { width: 25, textAlign: 'right', fontSize: 16, fontWeight: '800', marginLeft: 5 },
    input: {
        borderRadius: 15,
        padding: 15,
        fontSize: 15,
        height: 120,
        textAlignVertical: 'top',
    },
    photoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 55,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#AEB4C030',
        borderStyle: 'dashed',
        marginBottom: 30,
    },
    photoBtnText: { marginLeft: 10, fontSize: 14, fontWeight: '600' },
    submitBtn: {
        height: 60,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
        gap: 10,
    },
    submitBtnText: { color: '#1C1F26', fontSize: 16, fontWeight: '800' },
});
