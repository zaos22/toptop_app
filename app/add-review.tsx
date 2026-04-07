import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/config/supabase';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { addVisit, saveReview } from '@/services/establishmentService';
import { POINTS_CONFIG } from '@/services/rankService';
import { addPoints, incrementUserStat } from '@/services/userProfileService';
import { decode } from 'base64-arraybuffer';
import * as ExpoFileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { ArrowLeft, Image as ImageIcon, Star, Video, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGlobalUI } from '@/context/GlobalUIContext';

export default function AddReviewScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { user } = useAuth();
    const { showToast, showAlert, setGlobalLoading } = useGlobalUI();
    const { establishmentId, establishmentName } = useLocalSearchParams();
    const insets = useSafeAreaInsets();

    const [ratingQuality, setRatingQuality] = useState(0);
    const [ratingPrice, setRatingPrice] = useState(0);
    const [ratingService, setRatingService] = useState(0);
    const [ratingFlavor, setRatingFlavor] = useState(0);
    const [comment, setComment] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [video, setVideo] = useState<string | null>(null);
    const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);

    const pickImage = async () => {
        // Limit to 4 images
        if (images.length >= 4) {
            showToast('You can upload a maximum of 4 images.', 'error');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            // Check file size (approximate from base64 length)
            const sizeInBytes = (result.assets[0].base64.length * 3) / 4;
            if (sizeInBytes > 5 * 1024 * 1024) { // 5MB limit
                showToast('Image size must not exceed 5MB.', 'error');
                return;
            }
            setImages([...images, result.assets[0].uri]);
        }
    };

    const pickVideo = async () => {
        if (video) {
            showToast('You can only upload 1 video per review.', 'error');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 0.5,
            videoMaxDuration: 10,
        });

        if (!result.canceled) {
            const asset = result.assets[0];

            // Generate thumbnail
            try {
                const { uri } = await VideoThumbnails.getThumbnailAsync(asset.uri, {
                    time: 1000,
                });

                // Duration check fallback (in case editing didn't trim correctly)
                if (asset.duration && asset.duration > 10500) { // 10.5 tolerance
                    showToast('The video must be a maximum of 10 seconds long.', 'error');
                    return;
                }

                setVideo(asset.uri);
                setVideoThumbnail(uri);
            } catch (e) {
                console.warn(e);
                setVideo(asset.uri); // Fallback without thumbnail
            }
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);
    };

    const removeVideo = () => {
        setVideo(null);
        setVideoThumbnail(null);
    };

    const uploadMedia = async (uri: string, type: 'image' | 'video'): Promise<string | null> => {
        try {
            const ext = uri.substring(uri.lastIndexOf('.') + 1).toLowerCase();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const filePath = `reviews/${user?.id}/${fileName}`;

            let mimeType = '';
            const extension = ext.toLowerCase();
            if (type === 'image') {
                mimeType = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : `image/${extension}`;
            } else {
                if (extension === 'mov' || extension === 'quicktime') {
                    mimeType = 'video/quicktime';
                } else if (extension === 'mp4') {
                    mimeType = 'video/mp4';
                } else {
                    mimeType = `video/${extension}`;
                }
            }

            const base64 = await ExpoFileSystem.readAsStringAsync(uri, {
                encoding: ExpoFileSystem.EncodingType.Base64
            });

            if (!base64 || base64.length === 0) {
                throw new Error("File is empty or could not be read");
            }

            const { data, error } = await supabase.storage
                .from('reviews-media')
                .upload(filePath, decode(base64), {
                    contentType: mimeType,
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('reviews-media')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error: any) {
            console.error('Error uploading media:', error);
            showToast(`Upload error: ${error.message || 'Unknown error'}`, 'error');
            return null;
        }
    };

    const handleSubmit = async () => {
        if (!user) {
            showToast('You must log in to leave a review', 'error');
            return;
        }

        if (ratingQuality === 0 || ratingPrice === 0 || ratingService === 0 || ratingFlavor === 0) {
            showToast('Please rate all categories', 'error');
            return;
        }

        if (!comment.trim()) {
            showToast('Please write a comment', 'error');
            return;
        }

        setGlobalLoading(true, 'Posting your review...');
        try {
            // Upload media
            const uploadedImages: string[] = [];
            for (const imgUri of images) {
                const url = await uploadMedia(imgUri, 'image');
                if (url) uploadedImages.push(url);
            }

            let uploadedVideo = null;
            if (video) {
                uploadedVideo = await uploadMedia(video, 'video');
            }

            // Save review
            await saveReview(user.id, establishmentId as string, {
                user_name: user.user_metadata?.full_name || 'User',
                user_avatar: user.user_metadata?.avatar_url || undefined,
                establishment_name: establishmentName as string,
                rating_quality: ratingQuality,
                rating_price: ratingPrice,
                rating_service: ratingService,
                rating_flavor: ratingFlavor,
                comment: comment,
                images: uploadedImages,
                video: uploadedVideo || undefined,
            });

            // Parallel updates for performance and async feel
            await Promise.all([
                incrementUserStat(user.id, 'reviewsCount'),
                addVisit(user.id, establishmentId as string, establishmentName as string),
                addPoints(user.id, POINTS_CONFIG.REVIEW_SUBMITTED + POINTS_CONFIG.FIRST_VISIT_PLACE)
            ]);

            setGlobalLoading(false);
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                router.back();
            }, 3000);
        } catch (error: any) {
            console.error('Error submitting review:', error);
            setGlobalLoading(false);
            showToast('Could not post your review', 'error');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {showSuccess && (
                <View style={styles.successOverlay}>
                    <Animated.View entering={ZoomIn.duration(600)} exiting={FadeOut} style={[styles.successCard, { backgroundColor: theme.card }]}>
                        <Animated.View entering={FadeInDown.delay(300)}>
                            <Star size={80} color={theme.primary} fill={theme.primary} />
                        </Animated.View>
                        <Text style={[styles.successTitle, { color: theme.text }]}>Review Posted!</Text>
                        <Text style={[styles.successSubtitle, { color: theme.textSecondary }]}>You've earned {POINTS_CONFIG.REVIEW_SUBMITTED + POINTS_CONFIG.FIRST_VISIT_PLACE} points</Text>
                        <View style={styles.pointsBadge}>
                            <Text style={styles.pointsBadgeText}>+50 XP</Text>
                        </View>
                    </Animated.View>
                </View>
            )}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <ArrowLeft size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>Leave Review</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={styles.establishmentSection}>
                        <Text style={[styles.establishmentName, { color: theme.text }]}>{establishmentName || 'Establishment'}</Text>
                    </View>

                    {/* Media Section */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Photos & Video (Optional)</Text>
                        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                            Share your visual experience. Max 4 photos and 1 video (10s).
                        </Text>

                        <View style={styles.mediaButtons}>
                            <TouchableOpacity
                                style={[styles.mediaBtn, { backgroundColor: theme.card, borderColor: theme.textSecondary }]}
                                onPress={pickImage}
                            >
                                <ImageIcon size={24} color={theme.primary} />
                                <Text style={[styles.mediaBtnText, { color: theme.text }]}>Photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.mediaBtn, { backgroundColor: theme.card, borderColor: theme.textSecondary }]}
                                onPress={pickVideo}
                            >
                                <Video size={24} color={theme.primary} />
                                <Text style={[styles.mediaBtnText, { color: theme.text }]}>Video (10s)</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Media Preview Grid */}
                        <View style={styles.mediaGrid}>
                            {images.map((uri, index) => (
                                <View key={index} style={styles.mediaPreview}>
                                    <Image source={{ uri }} style={styles.mediaImage} />
                                    <TouchableOpacity
                                        style={styles.removeMediaBtn}
                                        onPress={() => removeImage(index)}
                                    >
                                        <X size={14} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {videoThumbnail && (
                                <View style={styles.mediaPreview}>
                                    <Image source={{ uri: videoThumbnail }} style={styles.mediaImage} />
                                    <View style={styles.videoBadge}>
                                        <Video size={12} color="#FFF" />
                                    </View>
                                    <TouchableOpacity
                                        style={styles.removeMediaBtn}
                                        onPress={removeVideo}
                                    >
                                        <X size={14} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Detailed Rating</Text>

                        {/* Rating Row: Quality */}
                        <View style={styles.ratingRow}>
                            <Text style={[styles.ratingLabel, { color: theme.textSecondary }]}>Quality</Text>
                            <View style={styles.starsRow}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <TouchableOpacity key={star} onPress={() => setRatingQuality(star)} style={styles.starSmallBtn}>
                                        <Star size={24} color={star <= ratingQuality ? theme.primary : theme.textSecondary} fill={star <= ratingQuality ? theme.primary : 'transparent'} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Rating Row: Price */}
                        <View style={styles.ratingRow}>
                            <Text style={[styles.ratingLabel, { color: theme.textSecondary }]}>Price</Text>
                            <View style={styles.starsRow}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <TouchableOpacity key={star} onPress={() => setRatingPrice(star)} style={styles.starSmallBtn}>
                                        <Star size={24} color={star <= ratingPrice ? theme.primary : theme.textSecondary} fill={star <= ratingPrice ? theme.primary : 'transparent'} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Rating Row: Service */}
                        <View style={styles.ratingRow}>
                            <Text style={[styles.ratingLabel, { color: theme.textSecondary }]}>Service</Text>
                            <View style={styles.starsRow}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <TouchableOpacity key={star} onPress={() => setRatingService(star)} style={styles.starSmallBtn}>
                                        <Star size={24} color={star <= ratingService ? theme.primary : theme.textSecondary} fill={star <= ratingService ? theme.primary : 'transparent'} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Rating Row: Flavor */}
                        <View style={styles.ratingRow}>
                            <Text style={[styles.ratingLabel, { color: theme.textSecondary }]}>Flavor</Text>
                            <View style={styles.starsRow}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <TouchableOpacity key={star} onPress={() => setRatingFlavor(star)} style={styles.starSmallBtn}>
                                        <Star size={24} color={star <= ratingFlavor ? theme.primary : theme.textSecondary} fill={star <= ratingFlavor ? theme.primary : 'transparent'} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={[styles.averageContainer, { backgroundColor: theme.card }]}>
                            <Text style={[styles.averageLabel, { color: theme.textSecondary }]}>Overall Rating</Text>
                            <Text style={[styles.averageValue, { color: theme.primary }]}>
                                {((ratingQuality + ratingPrice + ratingService + ratingFlavor) / 4).toFixed(1)}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Opinion</Text>
                        <TextInput
                            style={[styles.commentInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.card }]}
                            placeholder="Tell us about your experience..."
                            placeholderTextColor={theme.textSecondary}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                            value={comment}
                            onChangeText={setComment}
                        />
                    </View>

                    <View style={[styles.buttonContainer, { paddingBottom: Math.max(30, insets.bottom + 20) }]}>
                        <TouchableOpacity style={[styles.submitBtn, { backgroundColor: theme.primary }]} onPress={handleSubmit}>
                            <Text style={styles.submitBtnText}>Post Review</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};


const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    establishmentSection: { paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center' },
    establishmentName: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
    section: { paddingHorizontal: 20, marginBottom: 30 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 15 },
    starsContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 10 },
    starBtn: { padding: 5 },
    ratingText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 10 },
    ratingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    ratingLabel: { fontSize: 15, fontWeight: '600' },
    starsRow: { flexDirection: 'row', gap: 5 },
    starSmallBtn: { padding: 2 },
    averageContainer: { marginTop: 20, padding: 15, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    averageLabel: { fontSize: 14, fontWeight: '700' },
    averageValue: { fontSize: 24, fontWeight: '900' },
    commentInput: { borderRadius: 16, borderWidth: 1, padding: 15, fontSize: 16, minHeight: 150, fontWeight: '500' },
    buttonContainer: { paddingHorizontal: 20, paddingBottom: 30 },
    submitBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#D6B25E', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
    submitBtnText: { color: '#1C1F26', fontSize: 16, fontWeight: '800' },
    successOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(28, 31, 38, 0.9)',
        zIndex: 100,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    successCard: {
        width: '100%',
        padding: 40,
        borderRadius: 30,
        alignItems: 'center',
        gap: 20,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
    },
    successSubtitle: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    pointsBadge: {
        backgroundColor: '#4ADE80',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        marginTop: 10,
    },
    pointsBadgeText: {
        color: '#1C1F26',
        fontWeight: '900',
        fontSize: 18,
    },
    // Media Styles
    sectionSubtitle: { fontSize: 13, marginBottom: 15 },
    mediaButtons: { flexDirection: 'row', gap: 15, marginBottom: 20 },
    mediaBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8
    },
    mediaBtnText: { fontWeight: '600', fontSize: 14 },
    mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    mediaPreview: { width: 80, height: 80, borderRadius: 12, overflow: 'hidden', position: 'relative' },
    mediaImage: { width: '100%', height: '100%' },
    removeMediaBtn: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    videoBadge: {
        position: 'absolute',
        bottom: 5,
        left: 5,
        backgroundColor: 'rgba(214, 178, 94, 0.9)',
        padding: 4,
        borderRadius: 6,
    }
});
