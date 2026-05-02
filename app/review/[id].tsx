import { CommentText } from '@/components/CommentText';
import { useColorScheme } from '@/components/useColorScheme';
import { VideoThumbnail } from '@/components/VideoThumbnail';
import { supabase } from '@/config/supabase';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { addReviewComment, deleteReviewComment, getReviewComments, ReviewComment, toggleCommentLike, toggleSuperLike } from '@/services/commentService';
import { getReviewById, hasUserLikedReview, Review, toggleLikeReview, updateReview } from '@/services/establishmentService';
import { decode } from 'base64-arraybuffer';
import { ResizeMode, Video } from 'expo-av';
import * as ExpoFileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, Edit3, Film, Heart, Image as ImageIcon, MessageSquare, Save, Send, Share2, ShieldCheck, Star, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Dimensions, findNodeHandle, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import { ShareService } from '@/services/shareService';
import { SocialShareCard } from '@/components/SocialShareCard';
import { getDefaultAvatarUrl } from '@/utils/userUtils';

const { width } = Dimensions.get('window');

export default function ReviewDetailScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { showToast, showAlert, setGlobalLoading } = useGlobalUI();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const insets = useSafeAreaInsets();
    const commentInputRef = React.useRef<TextInput>(null);
    const scrollViewRef = React.useRef<ScrollView>(null);
    const commentPositions = React.useRef<Map<string, number>>(new Map());
    const [commentsSectionY, setCommentsSectionY] = useState(0);

    const [isEditing, setIsEditing] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [loading, setLoading] = useState(true);
    const [likesCount, setLikesCount] = useState(0);
    const [hasLiked, setHasLiked] = useState(false);

    // Review data state
    const [review, setReview] = useState<Review | null>(null);

    // States for editing
    const [editComment, setEditComment] = useState('');
    const [editQuality, setEditQuality] = useState(0);
    const [editPrice, setEditPrice] = useState(0);
    const [editService, setEditService] = useState(0);
    const [editFlavor, setEditFlavor] = useState(0);

    // States for media editing
    const [currentImages, setCurrentImages] = useState<string[]>([]);
    const [currentVideo, setCurrentVideo] = useState<string | null>(null);

    // Comments state
    const [comments, setComments] = useState<ReviewComment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [replyTo, setReplyTo] = useState<ReviewComment | null>(null);

    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const socialCardRef = useRef<any>(null);

    const handleShareReview = async () => {
        if (!review || !socialCardRef.current) return;
        try {
            await ShareService.shareViewAsImage(socialCardRef.current, `review-${review.establishment_name}.png`);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            (e) => {
                setKeyboardHeight(e.endCoordinates.height);
                setKeyboardVisible(true);
            }
        );
        const keyboardDidHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setKeyboardHeight(0);
                setKeyboardVisible(false);
            }
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    useEffect(() => {
        const init = async () => {
            await loadReview();
            const loadedComments = await loadComments();

            // If we have a target commentId in params, scroll to it
            if (params.commentId) {
                // Try multiple times as layout might take time to settle
                let attempts = 0;
                const scrollInterval = setInterval(() => {
                    const targetY = commentPositions.current.get(params.commentId as string);
                    if (targetY !== undefined && commentsSectionY > 0) {
                        scrollViewRef.current?.scrollTo({ 
                            y: Math.max(0, commentsSectionY + targetY - 100), 
                            animated: true 
                        });
                        clearInterval(scrollInterval);
                    }
                    attempts++;
                    if (attempts > 10) clearInterval(scrollInterval);
                }, 300);
            }
        };
        init();
    }, [params.id]);

    const loadComments = async () => {
        if (!params.id) return [];
        const data = await getReviewComments(params.id as string, user?.id);
        setComments(data);
        return data;
    };

    const loadReview = async () => {
        if (!params.id) return;
        setLoading(true);
        const startTime = Date.now();
        try {
            const data = await getReviewById(params.id as string);

            // Artificial delay to reach ~1.5s for premium feel
            const elapsed = Date.now() - startTime;
            if (elapsed < 1500) {
                await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
            }

            if (data) {
                setReview(data);
                setEditComment(data.comment);
                setEditQuality(data.rating_quality);
                setEditPrice(data.rating_price);
                setEditService(data.rating_service);
                setEditFlavor(data.rating_flavor);
                setCurrentImages(data.images || []);
                setCurrentVideo(data.video || null);
                setLikesCount(data.likes || 0);
                // Check if current user already liked this review
                if (user) {
                    const liked = await hasUserLikedReview(data.id!, user.id);
                    setHasLiked(liked);
                }
            }
        } catch (error) {
            console.error('Error loading review:', error);
            showToast('Error loading review', 'error');
        } finally {
            setLoading(false);
        }
    };

    const isOwner = user?.id === review?.userId;

    // Live average rating calculation for both view and edit modes
    const currentQuality = isEditing ? editQuality : (review?.rating_quality || 0);
    const currentPrice = isEditing ? editPrice : (review?.rating_price || 0);
    const currentService = isEditing ? editService : (review?.rating_service || 0);
    const currentFlavor = isEditing ? editFlavor : (review?.rating_flavor || 0);

    const averageRating = ((currentQuality + currentPrice + currentService + currentFlavor) / 4).toFixed(1);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setCurrentImages([...currentImages, result.assets[0].uri]);
            showToast('Image added', 'info');
        }
    };

    const pickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            setCurrentVideo(result.assets[0].uri);
            showToast('Video added', 'info');
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...currentImages];
        newImages.splice(index, 1);
        setCurrentImages(newImages);
        showToast('Image removed', 'info');
    };

    const uploadMedia = async (uri: string, type: 'image' | 'video'): Promise<string | null> => {
        if (uri.startsWith('http')) return uri; // Already uploaded

        try {
            const ext = uri.substring(uri.lastIndexOf('.') + 1).toLowerCase();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const filePath = `reviews/${user?.id}/${fileName}`;

            let mimeType = type === 'image' ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : `video/${ext}`;

            const base64 = await ExpoFileSystem.readAsStringAsync(uri, {
                encoding: 'base64'
            });

            const { error } = await supabase.storage
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
        } catch (error) {
            console.error('Upload error:', error);
            return null;
        }
    };

    const handleSave = async () => {
        setGlobalLoading(true, 'Saving changes...');
        try {
            // Upload new media first
            const finalImages: string[] = [];
            for (const img of currentImages) {
                const url = await uploadMedia(img, 'image');
                if (url) finalImages.push(url);
            }

            let finalVideo = null;
            if (currentVideo) {
                finalVideo = await uploadMedia(currentVideo, 'video');
            }

            await updateReview(review!.id!, {
                comment: editComment,
                rating_quality: editQuality,
                rating_price: editPrice,
                rating_service: editService,
                rating_flavor: editFlavor,
                images: finalImages,
                video: finalVideo || undefined
            });

            setCurrentImages(finalImages);
            if (finalVideo) setCurrentVideo(finalVideo);

            // Update local review state for immediate UI update
            setReview(prev => prev ? {
                ...prev,
                comment: editComment,
                rating_quality: editQuality,
                rating_price: editPrice,
                rating_service: editService,
                rating_flavor: editFlavor,
                images: finalImages,
                video: finalVideo || undefined
            } : null);

            setIsEditing(false);
            showToast('Review updated', 'success');
        } catch (error) {
            showToast('Could not update review', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!user || !newComment.trim() || isSubmittingComment) return;

        setIsSubmittingComment(true);
        try {
            const result = await addReviewComment(
                review!.id!,
                user.id,
                newComment,
                replyTo?.id || null
            );

            if (result) {
                setNewComment('');
                setReplyTo(null);
                await loadComments(); // Reload to see the new comment in place
            }
        } catch (error) {
            showToast('Could not send comment', 'error');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        showAlert({
            title: 'Delete comment',
            message: 'Are you sure you want to delete this comment?',
            options: [
                { text: 'Cancel', onPress: () => { }, style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteReviewComment(commentId);
                            await loadComments();
                        } catch (error) {
                            showToast('Could not delete', 'error');
                        }
                    }
                }
            ]
        });
    };

    const handleToggleLikeComment = async (commentId: string) => {
        if (!user) {
            showToast('Log in to like', 'info');
            return;
        }

        // Optimistic UI update
        const updateLikeRecursive = (list: ReviewComment[]): ReviewComment[] => {
            return list.map(c => {
                if (c.id === commentId) {
                    const isLiking = !c.has_liked;
                    return {
                        ...c,
                        has_liked: isLiking,
                        likes: isLiking ? (c.likes || 0) + 1 : Math.max(0, (c.likes || 1) - 1)
                    };
                }
                if (c.replies && c.replies.length > 0) {
                    return { ...c, replies: updateLikeRecursive(c.replies) };
                }
                return c;
            });
        };

        setComments(prev => updateLikeRecursive(prev));

        try {
            await toggleCommentLike(commentId, user.id);
            // No need to reload everything if optimistic update succeeded
        } catch (error) {
            await loadComments(); // Revert to server state on error
            showToast('Error processing like', 'error');
        }
    };

    const handleToggleSuperLike = async (commentId: string) => {
        if (user?.id !== review?.userId) return;

        // Optimistic UI update
        const updateSuperLikeRecursive = (list: ReviewComment[]): ReviewComment[] => {
            return list.map(c => {
                if (c.id === commentId) {
                    return { ...c, author_super_like: !c.author_super_like };
                }
                if (c.replies && c.replies.length > 0) {
                    return { ...c, replies: updateSuperLikeRecursive(c.replies) };
                }
                return c;
            });
        };

        setComments(prev => updateSuperLikeRecursive(prev));

        try {
            const result = await toggleSuperLike(commentId);
            showToast(result ? 'TopTop marked!' : 'TopTop removed', 'success');
        } catch (error) {
            await loadComments(); // Revert
            showToast('Could not process TopTop', 'error');
        }
    };

    const handleLike = async () => {
        if (isOwner || !review || !user || isLiking) return;

        setIsLiking(true);

        // Optimistic update
        const prevLiked = hasLiked;
        const prevCount = likesCount;
        setHasLiked(!prevLiked);
        setLikesCount(prev => prevLiked ? Math.max(0, prev - 1) : prev + 1);

        try {
            const result = await toggleLikeReview(review.id!, user.id);
            setHasLiked(result.liked);
            setLikesCount(result.newCount);
            if (result.liked) showToast('You liked this review!', 'success');
        } catch (error) {
            // Revert on error
            setHasLiked(prevLiked);
            setLikesCount(prevCount);
            showToast('Could not process like', 'error');
        } finally {
            setIsLiking(false);
        }
    };

    const renderComment = (comment: ReviewComment, isReply = false) => {
        return (
            <View
                key={comment.id}
                collapsable={false}
                style={[
                    styles.commentItem,
                    isReply && styles.replyItem,
                    params.commentId === comment.id && { backgroundColor: 'rgba(214, 178, 94, 0.05)', borderRadius: 12, padding: 8, marginHorizontal: -8 }
                ]}
                onLayout={(event) => {
                    commentPositions.current.set(comment.id, event.nativeEvent.layout.y);
                }}
            >
                <TouchableOpacity 
                    onPress={() => {
                        if (comment.user_id) {
                            setGlobalLoading(true, 'Loading Top Profile...');
                            router.push({ pathname: "/user/[id]", params: { id: comment.user_id } });
                        }
                    }}
                >
                    <Image
                        source={{ uri: comment.user_avatar || getDefaultAvatarUrl(comment.user_name || 'User') }}
                        style={isReply ? styles.replyAvatar : styles.commentAvatar}
                    />
                </TouchableOpacity>
                <View style={styles.commentContent}>
                    <View style={styles.commentHeaderRow}>
                        <TouchableOpacity 
                            onPress={() => {
                                if (comment.user_id) {
                                    setGlobalLoading(true, 'Abriendo perfil...');
                                    router.push({ pathname: "/user/[id]", params: { id: comment.user_id } });
                                }
                            }}
                        >
                            <Text style={[styles.commentUser, { color: theme.text }]}>{comment.user_name}</Text>
                        </TouchableOpacity>
                        <Text style={[styles.commentDate, { color: theme.textSecondary }]}>
                            {new Date(comment.created_at).toLocaleDateString()}
                        </Text>
                    </View>
                    <CommentText text={comment.content} style={[styles.commentBody, { color: theme.text }]} />

                    <View style={styles.commentActions}>
                        <TouchableOpacity
                            style={styles.commentActionBtn}
                            onPress={() => handleToggleLikeComment(comment.id)}
                        >
                            <Heart
                                size={14}
                                color={comment.has_liked ? theme.error : theme.textSecondary}
                                fill={comment.has_liked ? theme.error : 'transparent'}
                            />
                            {comment.likes > 0 && (
                                <Text style={[styles.commentActionText, { color: comment.has_liked ? theme.error : theme.textSecondary }]}>
                                    {comment.likes}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.commentActionBtn}
                            onPress={() => {
                                setReplyTo(comment);
                                commentInputRef.current?.focus();
                            }}
                        >
                            <MessageSquare size={14} color={theme.textSecondary} />
                        </TouchableOpacity>

                        {/* Super Like - Only for review owner */}
                        {(user?.id === review?.userId || comment.author_super_like) && (
                            <TouchableOpacity
                                style={[
                                    styles.commentActionBtn,
                                    comment.author_super_like && {
                                        backgroundColor: theme.primary,
                                        paddingHorizontal: 12,
                                        paddingVertical: 5,
                                        borderRadius: 20,
                                        shadowColor: theme.primary,
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: 0.3,
                                        shadowRadius: 6,
                                        elevation: 5
                                    }
                                ]}
                                onPress={() => handleToggleSuperLike(comment.id)}
                                disabled={user?.id !== review?.userId}
                                activeOpacity={0.7}
                            >
                                <ShieldCheck
                                    size={14}
                                    color={comment.author_super_like ? '#1C1F26' : theme.textSecondary}
                                />
                            </TouchableOpacity>
                        )}

                        {user?.id === comment.user_id && (
                            <TouchableOpacity
                                style={styles.commentActionBtn}
                                onPress={() => handleDeleteComment(comment.id)}
                            >
                                <Trash2 size={16} color={theme.error} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {comment.replies && comment.replies.length > 0 && (
                        <View style={styles.repliesList}>
                            {comment.replies.map(reply => renderComment(reply, true))}
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {loading ? (
                <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={{ marginTop: 20, color: theme.textSecondary, fontSize: 16, fontWeight: '600' }}>
                        Loading review...
                    </Text>
                </View>
            ) : review ? (
                <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                                <ArrowLeft size={24} color={theme.text} />
                            </TouchableOpacity>
                            <Text style={[styles.headerTitle, { color: theme.text, flex: 1, textAlign: 'center' }]}>Review</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {isOwner && !isEditing ? (
                                    <TouchableOpacity onPress={() => setIsEditing(true)} style={[styles.actionBtn, { marginRight: 8 }]}>
                                        <Edit3 size={20} color={theme.primary} />
                                    </TouchableOpacity>
                                ) : isEditing ? (
                                    <TouchableOpacity onPress={() => setIsEditing(false)} style={[styles.actionBtn, { marginRight: 8 }]}>
                                        <X size={24} color={theme.text} />
                                    </TouchableOpacity>
                                ) : null}
                                <TouchableOpacity onPress={handleShareReview} style={styles.actionBtn}>
                                    <Share2 size={24} color={theme.text} />
                                </TouchableOpacity>
                            </View>

                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} ref={scrollViewRef}>
                            <View style={styles.userSection}>
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center' }}
                                    onPress={() => {
                                        if (review.userId) {
                                            setGlobalLoading(true, 'Loading Top Profile...');
                                            router.push({ pathname: "/user/[id]", params: { id: review.userId } });
                                        }
                                    }}
                                >
                                    <Image
                                        source={{ uri: review.user_avatar || getDefaultAvatarUrl(review.user_name || 'User') }}
                                        style={styles.avatar}
                                    />
                                    <View>
                                        <Text style={[styles.userName, { color: theme.text }]}>{review.user_name}</Text>
                                        <View style={styles.topTopBadge}>
                                            <ShieldCheck size={14} color={theme.primary} />
                                            <Text style={[styles.topTopBadgeText, { color: theme.primary }]}>TopTop Member</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Score Cards */}
                            <View style={styles.scoreRow}>
                                <View style={[styles.mainScoreCard, { backgroundColor: theme.primary }]}>
                                    <Text style={styles.mainScoreValue}>{averageRating}</Text>
                                    <Text style={styles.mainScoreLabel}>Total</Text>
                                </View>
                                <View style={styles.subScoresColumn}>
                                    <View style={[styles.subScoreItem, { backgroundColor: theme.card }]}>
                                        <Text style={[styles.subScoreLabel, { color: theme.textSecondary }]}>Quality</Text>
                                        {isEditing ? (
                                            <View style={styles.starsSmall}>
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <TouchableOpacity key={s} onPress={() => setEditQuality(s)}>
                                                        <Star size={16} color={s <= editQuality ? theme.primary : theme.textSecondary} fill={s <= editQuality ? theme.primary : 'transparent'} />
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        ) : (
                                            <Text style={[styles.subScoreValue, { color: theme.text }]}>{review.rating_quality}</Text>
                                        )}
                                    </View>
                                    <View style={[styles.subScoreItem, { backgroundColor: theme.card }]}>
                                        <Text style={[styles.subScoreLabel, { color: theme.textSecondary }]}>Price</Text>
                                        {isEditing ? (
                                            <View style={styles.starsSmall}>
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <TouchableOpacity key={s} onPress={() => setEditPrice(s)}>
                                                        <Star size={16} color={s <= editPrice ? theme.primary : theme.textSecondary} fill={s <= editPrice ? theme.primary : 'transparent'} />
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        ) : (
                                            <Text style={[styles.subScoreValue, { color: theme.text }]}>{review.rating_price}</Text>
                                        )}
                                    </View>
                                    <View style={[styles.subScoreItem, { backgroundColor: theme.card }]}>
                                        <Text style={[styles.subScoreLabel, { color: theme.textSecondary }]}>Service</Text>
                                        {isEditing ? (
                                            <View style={styles.starsSmall}>
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <TouchableOpacity key={s} onPress={() => setEditService(s)}>
                                                        <Star size={16} color={s <= editService ? theme.primary : theme.textSecondary} fill={s <= editService ? theme.primary : 'transparent'} />
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        ) : (
                                            <Text style={[styles.subScoreValue, { color: theme.text }]}>{review.rating_service}</Text>
                                        )}
                                    </View>
                                    <View style={[styles.subScoreItem, { backgroundColor: theme.card }]}>
                                        <Text style={[styles.subScoreLabel, { color: theme.textSecondary }]}>Flavor</Text>
                                        {isEditing ? (
                                            <View style={styles.starsSmall}>
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <TouchableOpacity key={s} onPress={() => setEditFlavor(s)}>
                                                        <Star size={16} color={s <= editFlavor ? theme.primary : theme.textSecondary} fill={s <= editFlavor ? theme.primary : 'transparent'} />
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        ) : (
                                            <Text style={[styles.subScoreValue, { color: theme.text }]}>{review.rating_flavor}</Text>
                                        )}
                                    </View>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            {/* Comment */}
                            <View style={styles.commentSection}>
                                {isEditing ? (
                                    <TextInput
                                        style={[styles.editInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.primary }]}
                                        value={editComment}
                                        onChangeText={setEditComment}
                                        multiline
                                    />
                                ) : (
                                    <CommentText
                                        text={review.comment || ''}
                                        style={[styles.commentText, { color: theme.text }]}
                                    />
                                )}

                                <View style={styles.interactionRow}>
                                    <View style={styles.dateRow}>
                                        <Calendar size={14} color={theme.textSecondary} />
                                        <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                                            {review.created_at ? new Date(review.created_at).toLocaleDateString() : 'Pending'}
                                        </Text>
                                    </View>

                                    {!isEditing && (
                                        <TouchableOpacity
                                            style={styles.likeBtn}
                                            onPress={handleLike}
                                            disabled={isOwner || isLiking}
                                        >
                                            <Heart
                                                size={20}
                                                color={hasLiked ? theme.primary : theme.textSecondary}
                                                fill={hasLiked ? theme.primary : 'transparent'}
                                            />
                                            <Text style={[styles.likesCount, { color: theme.textSecondary }]}>{likesCount}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {isEditing && (
                                <TouchableOpacity
                                    style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                                    onPress={handleSave}
                                >
                                    <Save size={20} color="#1C1F26" />
                                    <Text style={styles.saveBtnText}>Save Changes</Text>
                                </TouchableOpacity>
                            )}

                            <View style={styles.mediaSection}>
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                                    {isEditing ? 'Manage Media' : 'Experience Gallery'}
                                </Text>

                                {isEditing ? (
                                    <View style={styles.editMediaContainer}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaEditRows}>
                                            {currentImages.map((img, index) => (
                                                <View key={index} style={styles.editMediaItem}>
                                                    <Image source={{ uri: img }} style={styles.editMediaImage} />
                                                    <TouchableOpacity style={styles.removeMediaBtn} onPress={() => removeImage(index)}>
                                                        <X size={14} color="#FFF" />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}

                                            {currentVideo && (
                                                <View style={styles.editMediaItem}>
                                                    <VideoThumbnail videoUrl={currentVideo} style={styles.editMediaImage} />
                                                    <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setCurrentVideo(null)}>
                                                        <X size={14} color="#FFF" />
                                                    </TouchableOpacity>
                                                </View>
                                            )}

                                            <TouchableOpacity style={[styles.addMediaBtn, { backgroundColor: theme.card, borderColor: theme.primary }]} onPress={pickImage}>
                                                <ImageIcon size={24} color={theme.primary} />
                                                <Text style={[styles.addMediaText, { color: theme.primary }]}>+ Photo</Text>
                                            </TouchableOpacity>

                                            {!currentVideo && (
                                                <TouchableOpacity style={[styles.addMediaBtn, { backgroundColor: theme.card, borderColor: theme.primary }]} onPress={pickVideo}>
                                                    <Film size={24} color={theme.primary} />
                                                    <Text style={[styles.addMediaText, { color: theme.primary }]}>+ Video</Text>
                                                </TouchableOpacity>
                                            )}
                                        </ScrollView>
                                    </View>
                                ) : (
                                    ((review.images && review.images.length > 0) || review.video) && (
                                        <>
                                            {review.video && (
                                                <View style={styles.videoContainer}>
                                                    <Video
                                                        source={{ uri: review.video }}
                                                        rate={1.0}
                                                        volume={1.0}
                                                        isMuted={false}
                                                        resizeMode={ResizeMode.COVER}
                                                        shouldPlay={false}
                                                        useNativeControls
                                                        style={styles.videoPlayer}
                                                    />
                                                </View>
                                            )}

                                            <View style={styles.imageGrid}>
                                                {(review.images || []).map((img, index) => (
                                                    <Image
                                                        key={index}
                                                        source={{ uri: img }}
                                                        style={[
                                                            styles.galleryImage,
                                                            (review.images || []).length === 1 && !review.video ? styles.fullImage : styles.halfImage
                                                        ]}
                                                        resizeMode="cover"
                                                    />
                                                ))}
                                            </View>
                                        </>
                                    )
                                )}
                            </View>

                            <View 
                                style={styles.commentsSection}
                                onLayout={(e) => setCommentsSectionY(e.nativeEvent.layout.y)}
                            >
                                <View style={styles.commentsHeader}>
                                    <MessageSquare size={20} color={theme.text} />
                                    <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0, marginLeft: 10 }]}>
                                        Comments
                                    </Text>
                                </View>

                                {comments.length === 0 ? (
                                    <View style={styles.emptyComments}>
                                        <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
                                            Be the first to comment on this review
                                        </Text>
                                    </View>
                                ) : (
                                    comments.map(comment => renderComment(comment))
                                )}
                            </View>
                            <View style={{ height: 40 }} />
                        </ScrollView>

                        {/* Comment Input Bar Section */}
                        {replyTo && (
                            <View style={[styles.replyStatus, { 
                                backgroundColor: theme.card,
                                borderTopLeftRadius: 20, 
                                borderTopRightRadius: 20,
                                shadowColor: '#000', 
                                shadowOffset: { width: 0, height: -2 }, 
                                shadowOpacity: 0.1, 
                                shadowRadius: 4, 
                                elevation: 4 
                            }]}>
                                <Text style={[styles.replyStatusText, { color: theme.textSecondary }]}>
                                    Replying to <Text style={[styles.replyStatusUser, { color: theme.primary }]}>@{replyTo.user_name}</Text>
                                </Text>
                                <TouchableOpacity onPress={() => setReplyTo(null)}>
                                    <X size={16} color={theme.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        )}
                        <View style={[styles.commentInputContainer, { 
                            backgroundColor: theme.card, 
                            borderTopColor: 'rgba(174, 180, 192, 0.05)',
                            paddingBottom: isKeyboardVisible ? 24 : (insets.bottom > 0 ? insets.bottom : 20)
                        }]}>
                            <TextInput
                                ref={commentInputRef}
                                style={[styles.commentInput, { color: theme.text }]}
                                placeholder={user ? "Write a comment..." : "Log in to comment"}
                                placeholderTextColor={theme.textSecondary}
                                value={newComment}
                                onChangeText={setNewComment}
                                multiline
                                editable={!!user && !isSubmittingComment}
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, { opacity: (newComment.trim() && user) ? 1 : 0.5 }]}
                                onPress={handleAddComment}
                                disabled={!newComment.trim() || !user || isSubmittingComment}
                            >
                                {isSubmittingComment ? (
                                    <ActivityIndicator size="small" color={theme.primary} />
                                ) : (
                                    <Send size={24} color={theme.primary} />
                                )}
                            </TouchableOpacity>
                        </View>
                        {/* Custom Keyboard Spacer. Far more reliable than KeyboardAvoidingView for edge-to-edge Android */}
                        <View style={{ height: keyboardHeight }} />
                    {/* Hidden Social Share Card */}
                <View style={{ position: 'absolute', top: -3000, left: 0, opacity: 0 }} pointerEvents="none">
                    <View ref={socialCardRef} collapsable={false}>
                        <SocialShareCard 
                            type="review" 
                            theme={theme}
                            data={{
                                user_name: review?.user_name,
                                user_avatar: review?.user_avatar,
                                establishmentName: review?.establishment_name,
                                rating: ((review?.rating_quality || 0) + (review?.rating_price || 0) + (review?.rating_service || 0) + (review?.rating_flavor || 0)) / 4,
                                comment: review?.comment,
                                photoUrl: review?.images?.[0] || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80',
                                quality: review?.rating_quality,
                                price: review?.rating_price,
                                service: review?.rating_service,
                                flavor: review?.rating_flavor
                            }}
                        />
                    </View>
                </View>
            </SafeAreaView>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    scrollContent: { padding: 20 },
    userSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
    avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 15 },
    userName: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    topTopBadge: { flexDirection: 'row', alignItems: 'center' },
    topTopBadgeText: { fontSize: 12, fontWeight: '700', marginLeft: 6 },
    scoreRow: { flexDirection: 'row', gap: 15, marginBottom: 30 },
    mainScoreCard: {
        flex: 1,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    mainScoreValue: { fontSize: 42, fontWeight: '900', color: '#1C1F26' },
    mainScoreLabel: { fontSize: 14, fontWeight: '700', color: '#1C1F26', opacity: 0.8 },
    subScoresColumn: { flex: 2, gap: 8 },
    subScoreItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 12,
    },
    subScoreLabel: { fontSize: 13, fontWeight: '600' },
    subScoreValue: { fontSize: 15, fontWeight: '800' },
    divider: { height: 1, backgroundColor: 'rgba(174, 180, 192, 0.1)', marginBottom: 25 },
    commentSection: { marginBottom: 35 },
    commentText: { fontSize: 17, lineHeight: 26, fontWeight: '500', marginBottom: 15 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dateText: { fontSize: 13, fontWeight: '600' },
    mediaSection: { marginBottom: 30 },
    sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 20 },
    editMediaContainer: { marginBottom: 20 },
    mediaEditRows: { flexDirection: 'row', gap: 12, paddingBottom: 10 },
    editMediaItem: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', position: 'relative' },
    editMediaImage: { width: '100%', height: '100%' },
    removeMediaBtn: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(255,0,0,0.8)',
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    addMediaBtn: {
        width: 100,
        height: 100,
        borderRadius: 12,
        borderWidth: 2,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8
    },
    addMediaText: { fontSize: 12, fontWeight: '800' },
    videoContainer: {
        width: '100%',
        height: 400,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 15,
        backgroundColor: '#000'
    },
    videoPlayer: { width: '100%', height: '100%' },
    imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    galleryImage: { borderRadius: 15 },
    fullImage: { width: '100%', height: 300 },
    halfImage: { width: (width - 50) / 2, height: 200 },
    actionBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    interactionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
    likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    likesCount: { fontSize: 14, fontWeight: '700' },
    editInput: { borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1, minHeight: 100, marginBottom: 10 },
    starsSmall: { flexDirection: 'row', gap: 3 },
    saveBtn: { flexDirection: 'row', height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
    saveBtnText: { color: '#1C1F26', fontWeight: '800', fontSize: 16 },

    // Comments Styles
    commentsSection: { paddingHorizontal: 20, paddingTop: 30, borderTopWidth: 1, borderTopColor: 'rgba(174, 180, 192, 0.1)' },
    commentsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
    emptyComments: { padding: 40, alignItems: 'center' },
    commentItem: { flexDirection: 'row', marginBottom: 25 },
    commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
    commentContent: { flex: 1 },
    commentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    commentUser: { fontSize: 14, fontWeight: '700' },
    commentDate: { fontSize: 11, fontWeight: '500' },
    commentBody: { fontSize: 14, lineHeight: 20 },
    commentActions: { flexDirection: 'row', marginTop: 8, gap: 15, flexWrap: 'wrap' },
    commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    commentActionText: { fontSize: 12, fontWeight: '700' },
    repliesList: { marginTop: 20 },
    replyItem: { marginTop: 0, marginBottom: 20 },
    replyAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 10 },

    replyStatus: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 20, 
        paddingVertical: 10, 
        zIndex: 1,
        marginBottom: -10
    },
    replyStatusText: { fontSize: 13, fontWeight: '600' },
    replyStatusUser: { fontWeight: '800' },
    commentInputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 16, 
        paddingVertical: 10, 
        borderTopWidth: 1,
        borderTopColor: 'rgba(174, 180, 192, 0.05)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10
    },
    commentInput: { 
        flex: 1, 
        minHeight: 45, 
        maxHeight: 120, 
        paddingHorizontal: 18, 
        paddingVertical: 10, 
        fontSize: 15, 
        borderRadius: 22, 
        backgroundColor: 'rgba(214, 178, 94, 0.06)',
        lineHeight: 20
    },
    sendBtn: { 
        width: 48, 
        height: 48, 
        borderRadius: 24,
        alignItems: 'center', 
        justifyContent: 'center', 
        marginLeft: 8,
        backgroundColor: 'rgba(214, 178, 94, 0.08)'
    },
});
