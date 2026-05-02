import { CommentText } from '@/components/CommentText';
import { MarqueeText } from '@/components/MarqueeText';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { getInternalReviews, Review } from '@/services/establishmentService';
import { getGooglePlaceDetails, getPhotoUrl, GooglePlaceDetails } from '@/services/googleMapsService';
import { addToList, createList, getUserLists, isEstablishmentFavorited, removeFromList } from '@/services/listService';
import { followUser, isFollowing, unfollowUser } from '@/services/userProfileService';
import { getCategoryFromTypes } from '@/utils/categoryUtils';
import { getPriceInfo } from '@/utils/priceUtils';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Globe, Heart, List, ListPlus, LogIn, MapPin, Phone, Share2 as ShareIcon, ShieldCheck, Star, Trash2, Wallet, X, Users } from 'lucide-react-native';
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Linking, Modal, Share, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { ShareService } from '@/services/shareService';
import { SocialShareCard } from '@/components/SocialShareCard';
import { getDefaultAvatarUrl } from '@/utils/userUtils';
import Animated, { Easing, Extrapolate, interpolate, runOnJS, useAnimatedReaction, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '@/context/SettingsContext';
import { AnnouncementBoard } from '@/components/AnnouncementBoard';
import { establishmentFollowService } from '@/services/establishmentFollowService';
import { supabase } from '@/config/supabase';

const { width } = Dimensions.get('window');

export default function EstablishmentDetailScreen() {
    const { id, reviewId } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { user } = useAuth();
    const { showToast, showAlert, setGlobalLoading } = useGlobalUI();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [googleData, setGoogleData] = useState<GooglePlaceDetails | null>(null);
    const [internalReviews, setInternalReviews] = useState<Review[]>([]);
    const [isLiked, setIsLiked] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const scrollY = useSharedValue(0);
    const flatListRef = React.useRef<FlatList>(null);
    const scrollViewRef = React.useRef<Animated.ScrollView>(null);
    const reviewPositions = React.useRef<Record<string, number>>({});
    const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(null);
    const [isFollowingEstablishment, setIsFollowingEstablishment] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const pagerRef = useRef<Animated.ScrollView>(null);
    const horizontalScrollX = useSharedValue(0);
    const hintVisible = useSharedValue(1);

    const onHorizontalScroll = useAnimatedScrollHandler((event) => {
        horizontalScrollX.value = event.contentOffset.x;
    });

    // Create List Modal State
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [newListIsPublic, setNewListIsPublic] = useState(false);
    const socialCardRef = useRef<any>(null);

    // Auto-play effect
    useEffect(() => {
        if (loading || !googleData?.photos || googleData.photos.length <= 1) return;

        const timer = setTimeout(() => {
            const nextIndex = (activeImageIndex + 1) % googleData.photos!.length;
            flatListRef.current?.scrollToIndex({
                index: nextIndex,
                animated: true,
            });
            setActiveImageIndex(nextIndex);
        }, 5000);

        return () => clearTimeout(timer);
    }, [activeImageIndex, loading, googleData]);

    const onScroll = useAnimatedScrollHandler((event) => {
        scrollY.value = event.contentOffset.y;
    });

    const floatingButtonStyle = useAnimatedStyle(() => {
        const opacity = interpolate(scrollY.value, [0, 150, 300], [0, 0.5, 1], Extrapolate.CLAMP);
        const translateY = interpolate(scrollY.value, [0, 300], [50, 0], Extrapolate.CLAMP);
        const scale = interpolate(scrollY.value, [0, 300], [0.8, 1], Extrapolate.CLAMP);
        return {
            opacity,
            transform: [{ translateY: withSpring(translateY) }, { scale: withSpring(scale) }],
            position: 'absolute',
            bottom: 30 + insets.bottom,
            left: 20,
            right: 20,
            zIndex: 100,
        };
    });

    const horizontalIndicatorStyle = useAnimatedStyle(() => {
        const scrollOpacity = interpolate(horizontalScrollX.value, [0, width / 2, width], [1, 0.5, 0]);
        return { opacity: scrollOpacity * hintVisible.value };
    });

    useEffect(() => {
        hintVisible.value = withDelay(3000, withTiming(0, { duration: 800 }));
    }, []);

    // Sync React state with SharedValue for non-style props to avoid render warnings
    const [showFloatingButton, setShowFloatingButton] = useState(false);
    useAnimatedReaction(
        () => scrollY.value > 100,
        (result, previous) => {
            if (result !== previous) {
                runOnJS(setShowFloatingButton)(result);
            }
        }
    );

    useEffect(() => {
        if (id) loadAllData(id as string, reviewId as string);
    }, [id, reviewId]);

    const { halalEnabled } = useSettings();

    const loadAllData = async (placeId: string, targetReviewId?: string) => {
        setLoading(true);
        const startTime = Date.now();
        try {
            const [gData, iReviews, favorited, followStatus, count] = await Promise.all([
                getGooglePlaceDetails(placeId),
                getInternalReviews(placeId, halalEnabled),
                user ? isEstablishmentFavorited(user.id, placeId) : Promise.resolve(false),
                user ? establishmentFollowService.checkFollowStatus(user.id, placeId) : Promise.resolve(false),
                establishmentFollowService.getFollowerCount(placeId)
            ]);

            const elapsed = Date.now() - startTime;
            if (elapsed < 1000) await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));

            setGoogleData(gData);
            setInternalReviews(iReviews);
            setIsLiked(favorited);
            setIsFollowingEstablishment(followStatus);
            setFollowerCount(count);

            // Scroll to specific review if requested
            if (targetReviewId) {
                setHighlightedReviewId(targetReviewId);
                // We need to wait for the layout to finish and the internal reviews to render
                setTimeout(() => {
                    if (reviewPositions.current[targetReviewId] !== undefined) {
                        scrollViewRef.current?.scrollTo({
                            y: reviewPositions.current[targetReviewId],
                            animated: true
                        });
                    }
                }, 800);
            }
        } catch (error) {
            console.error('Error loading detail data:', error);
            showToast('Could not load the information', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!googleData || !socialCardRef.current) return;
        try {
            await ShareService.shareViewAsImage(socialCardRef.current, `establishment-${googleData.name}.png`);
        } catch (error) {
            console.error(error);
        }
    };

    const handleFavoritePress = async () => {
        if (!user || !googleData) {
            showAlert({
                title: 'Log In',
                message: 'You must log in to save your favorite places and create custom lists.',
                options: [
                    { text: 'Cancel', style: 'cancel', onPress: () => { } },
                    { text: 'Log in now', style: 'primary', icon: LogIn, onPress: () => router.push('/login') }
                ]
            });
            return;
        }

        if (isLiked) {
            showAlert({
                title: 'Remove from favorites',
                message: 'Do you want to remove this place from all your favorite lists?',
                options: [
                    { text: 'Cancel', style: 'cancel', onPress: () => { } },
                    {
                        text: 'Remove from favorites',
                        style: 'destructive',
                        icon: Trash2,
                        onPress: async () => {
                            setGlobalLoading(true, 'Removing from favorites...');
                            try {
                                const lists = await getUserLists(user.id);
                                for (const list of lists) {
                                    await removeFromList(list.id, googleData.place_id);
                                }
                                setIsLiked(false);
                                showToast('Removed from favorites', 'success');
                            } finally {
                                setGlobalLoading(false);
                            }
                        }
                    }
                ]
            });
            return;
        }

        setGlobalLoading(true, 'Loading your lists...');
        try {
            const lists = await getUserLists(user.id);
            setGlobalLoading(false);

            const listOptions: any[] = [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                    text: 'My Favorites',
                    style: 'default',
                    icon: Heart,
                    onPress: async () => {
                        setGlobalLoading(true, 'Saving...');
                        let defaultList = lists.find(l => l.name === 'My Favorites');
                        if (!defaultList) defaultList = await createList(user.id, 'My Favorites') || undefined;
                        if (defaultList) {
                            await addToList(defaultList.id, googleData.place_id, googleData.name, heroImage);
                            setIsLiked(true);
                            showToast('Saved in My Favorites', 'success');
                        }
                        setGlobalLoading(false);
                    }
                }
            ];

            lists.filter(l => l.name !== 'My Favorites').forEach(list => {
                listOptions.push({
                    text: list.name,
                    style: 'default',
                    icon: List,
                    onPress: async () => {
                        setGlobalLoading(true, 'Saving...');
                        await addToList(list.id, googleData.place_id, googleData.name, heroImage);
                        setIsLiked(true);
                        showToast(`Added to ${list.name}`, 'success');
                        setGlobalLoading(false);
                    }
                });
            });

            listOptions.push({
                text: 'Create new list',
                style: 'primary',
                icon: ListPlus,
                onPress: () => setIsCreateModalVisible(true)
            });

            showAlert({
                title: 'Save to...',
                message: 'Choose a list or create a new one to organize your Top sites.',
                options: listOptions
            });
        } catch (error) {
            setGlobalLoading(false);
            showToast('Could not load lists', 'error');
        }
    };

    const handleCreateAndAddToList = async () => {
        if (!user || !newListName.trim() || !googleData) return;

        setGlobalLoading(true, 'Creating and saving...');
        try {
            const newList = await createList(user.id, newListName.trim(), newListIsPublic);
            if (newList) {
                await addToList(newList.id, googleData.place_id, googleData.name, heroImage);
                setIsLiked(true);
                setIsCreateModalVisible(false);
                setNewListName('');
                setNewListIsPublic(false);
                showToast(`Saved in ${newList.name}!`, 'success');
            }
        } catch (error) {
            console.error(error);
            showToast('Error creating list', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    const checkFollowStatus = async (userId: string, placeId: string) => {
        return establishmentFollowService.checkFollowStatus(userId, placeId);
    };

    const handleFollowToggle = async () => {
        if (!user) {
            showAlert({
                title: 'Log In',
                message: 'Follow establishments to get their latest updates and participate in the community.',
                options: [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Log In', style: 'primary', onPress: () => router.push('/login') }
                ]
            });
            return;
        }

        const placeId = Array.isArray(id) ? id[0] : id;
        const previousStatus = isFollowingEstablishment;
        
        // Optimistic UI update
        setIsFollowingEstablishment(!previousStatus);
        setFollowerCount(prev => previousStatus ? Math.max(0, prev - 1) : prev + 1);

        try {
            let success = false;
            if (previousStatus) {
                success = await establishmentFollowService.unfollowEstablishment(user.id, placeId);
                if (success) showToast('Unfollowed', 'info');
            } else {
                success = await establishmentFollowService.followEstablishment(user.id, placeId, googleData?.name);
                if (success) showToast('Following!', 'success');
            }

            if (!success) {
                // Revert if service call failed
                setIsFollowingEstablishment(previousStatus);
                // Fetch fresh count to be sure
                const freshCount = await establishmentFollowService.getFollowerCount(placeId);
                setFollowerCount(freshCount);
                showToast('Error updating follow status', 'error');
            } else {
                // Fetch fresh count even on success to sync with server
                const freshCount = await establishmentFollowService.getFollowerCount(placeId);
                setFollowerCount(freshCount);
            }
        } catch (error) {
            setIsFollowingEstablishment(previousStatus);
            const freshCount = await establishmentFollowService.getFollowerCount(placeId);
            setFollowerCount(freshCount);
            showToast('Error updating follow status', 'error');
        }
    };

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{ marginTop: 20, color: theme.textSecondary }}>Connecting with Google & TopTop...</Text>
            </View>
        );
    }

    if (!googleData) {
        return (
            <View style={[styles.centered, { backgroundColor: theme.background }]}>
                <Text style={{ color: theme.text }}>Establishment not found.</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <Text style={{ color: theme.primary, fontWeight: '600' }}>Know more</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const priceInfo = getPriceInfo(googleData.price_level, googleData.types);
    const heroImage = googleData.photos && googleData.photos.length > 0
        ? getPhotoUrl(googleData.photos[0].photo_reference)
        : 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80';

    return (
        <Animated.ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onHorizontalScroll}
            scrollEventThrottle={16}
            style={styles.container}
        >
            {/* TAB 1: DETAILS */}
            <View style={{ width, flex: 1 }}>
            {/* Floating Review Button (Appears on scroll) */}
            <Animated.View style={floatingButtonStyle} pointerEvents={showFloatingButton ? 'auto' : 'none'}>
                <TouchableOpacity
                    style={[styles.floatingAddBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                    onPress={() => router.push({
                        pathname: '/add-review',
                        params: {
                            establishmentId: id,
                            establishmentName: googleData.name
                        }
                    })}
                >
                    <Star size={22} color="#1C1F26" fill="#1C1F26" />
                    <Text style={styles.floatingAddBtnText}>Write review</Text>
                </TouchableOpacity>
            </Animated.View>


            {/* Fixed Header Overlay */}
            <View style={[styles.headerActions, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
                <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: 'rgba(28, 31, 38, 0.5)' }]} onPress={() => router.back()}>
                    <ChevronLeft size={24} color="#fff" />
                </TouchableOpacity>

                <View style={styles.rightActionsColumn} pointerEvents="box-none">
                    <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: 'rgba(28, 31, 38, 0.5)' }]} onPress={handleShare}>
                        <ShareIcon size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: 'rgba(28, 31, 38, 0.5)' }]} onPress={handleFavoritePress}>
                        <Heart size={20} color={isLiked ? theme.error : "#fff"} fill={isLiked ? theme.error : "transparent"} />
                    </TouchableOpacity>
                </View>
            </View>

            <Animated.ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingBottom: Math.max(100, insets.bottom + 80) }}
            >

                {/* Hero Section - Animated Carousel */}
                <View style={styles.heroContainer}>
                    <FlatList
                        ref={flatListRef}
                        data={googleData.photos || []}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(_, index) => index.toString()}
                        onMomentumScrollEnd={(e) => {
                            const x = e.nativeEvent.contentOffset.x;
                            const index = Math.round(x / width);
                            setActiveImageIndex(index);
                        }}
                        renderItem={({ item }) => (
                            <AnimatedCarouselItem photoReference={item.photo_reference} width={width} />
                        )}
                        ListEmptyComponent={
                            <Image
                                source={{ uri: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80' }}
                                style={{ width: width, height: 400 }}
                            />
                        }
                    />

                    {/* Hero Overlay - Compact & Non-blocking */}
                    <View style={styles.heroOverlay} pointerEvents="box-none">
                        <View style={styles.heroCompactRow} pointerEvents="box-none">
                            {/* Rating Badge */}
                            <View style={[styles.scoreBadgeCompact, { backgroundColor: theme.ranking1 }]}>
                                <Text style={styles.scoreTextSmall}>{googleData.rating || 'N/A'}</Text>
                            </View>

                            <View style={{ flex: 1, marginHorizontal: 15 }} pointerEvents="box-none">
                                <MarqueeText
                                    text={googleData.name}
                                    style={styles.heroNameCompact}
                                    containerStyle={{ flex: 1 }}
                                />
                                <View style={styles.heroBadgeRow} pointerEvents="box-none">
                                    <View style={[styles.gemLabel, { backgroundColor: theme.primary }]}>
                                        <Text style={styles.gemLabelText}>VERIFIED</Text>
                                    </View>
                                    <Text style={styles.heroCategorySmall} numberOfLines={1}>{getCategoryFromTypes(googleData.types, googleData.name).toUpperCase()}</Text>
                                </View>
                            </View>


                            {/* Pagination Dots - Moved inside for better touch area */}
                            {googleData.photos && googleData.photos.length > 1 && (
                                <View style={styles.compactPagination}>
                                    {googleData.photos.slice(0, 10).map((_, i) => ( // limit dots if too many
                                        <View
                                            key={i}
                                            style={[
                                                styles.dotSmall,
                                                { backgroundColor: i === activeImageIndex ? theme.primary : 'rgba(255,255,255,0.3)' }
                                            ]}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Content */}
                <View style={[styles.content, { backgroundColor: theme.background }]}>
                    <View style={styles.actionRow}>
                        {googleData.website && (
                            <TouchableOpacity
                                style={[styles.primaryAction, { backgroundColor: theme.primary }]}
                                onPress={() => Linking.openURL(googleData.website!)}
                            >
                                <Globe size={18} color="#1C1F26" style={styles.actionIcon} />
                                <Text style={styles.primaryActionText}>
                                    {googleData.website.toLowerCase().endsWith('.pdf') ? 'View Menu' : 'Visit Website'}
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.secondaryAction, { borderColor: theme.card }]}
                            onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${googleData.name}&query_place_id=${googleData.place_id}`)}
                        >
                            <MapPin size={18} color={theme.text} style={styles.actionIcon} />
                            <Text style={[styles.secondaryActionText, { color: theme.text }]}>Directions</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Contact Info */}
                    <View style={styles.section}>
                        <View style={styles.contactItem}>
                            <MapPin size={20} color={theme.textSecondary} />
                            <Text style={[styles.contactText, { color: theme.text }]}>{googleData.formatted_address}</Text>
                        </View>
                        {googleData.formatted_phone_number && (
                            <View style={[styles.contactItem, { marginTop: 15 }]}>
                                <Phone size={20} color={theme.textSecondary} />
                                <Text style={[styles.contactText, { color: theme.text }]}>{googleData.formatted_phone_number}</Text>
                            </View>
                        )}

                        <View style={styles.followRow}>
                            <TouchableOpacity 
                                style={[
                                    styles.followSectionBtn, 
                                    { backgroundColor: isFollowingEstablishment ? theme.card : theme.primary }
                                ]}
                                onPress={handleFollowToggle}
                            >
                                <Heart 
                                    size={18} 
                                    color={isFollowingEstablishment ? theme.primary : '#1C1F26'} 
                                    fill={isFollowingEstablishment ? theme.primary : 'transparent'} 
                                    style={{ marginRight: 8 }}
                                />
                                <Text style={[
                                    styles.followSectionBtnText, 
                                    { color: isFollowingEstablishment ? theme.text : '#1C1F26' }
                                ]}>
                                    {isFollowingEstablishment ? 'Following' : 'Follow'}
                                </Text>
                            </TouchableOpacity>

                            {/* Follower Counter */}
                            <View style={styles.followerBadge}>
                                <Users size={14} color={theme.textSecondary} />
                                <Text style={styles.followerCount}>
                                    {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
                                </Text>
                            </View>

                            {!isFollowingEstablishment && (
                                <Animated.View style={[styles.swipeHintInline, horizontalIndicatorStyle]}>
                                    <Text style={[styles.swipeHintText, { color: theme.primary }]}>Slide to see news »</Text>
                                </Animated.View>
                            )}
                        </View>
                        {priceInfo && (
                            <View style={[styles.contactItem, { marginTop: 15 }]}>
                                <Wallet size={20} color={theme.primary} />
                                <View style={styles.priceDetailRow}>
                                    <Text style={[styles.priceDetailSymbol, { color: theme.primary }]}>{priceInfo.symbol}</Text>
                                    {priceInfo.range ? (
                                        <Text style={[styles.priceDetailRange, { color: theme.text }]}>{priceInfo.range}</Text>
                                    ) : null}
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24, marginBottom: 16 }]}>Reviews</Text>
                        </View>

                        {/* TopTop Internal Reviews (Priority) */}
                        {internalReviews.map((rev, i) => (
                            <Animated.View
                                entering={ZoomIn.duration(400).delay(i * 100)}
                                key={rev.id || i.toString()}
                                onLayout={(e) => {
                                    const y = e.nativeEvent.layout.y;
                                    // Store position relative to content container
                                    // Add hero height (400) + actionRow + contact info approx
                                    // But better: onLayout gives relative to parent. Parent is 'content' View.
                                    // So we need to add the offset of 'content' View within ScrollView.
                                    // Simplest: store relative to parent and we'll calculate final Y.
                                    if (rev.id) reviewPositions.current[rev.id] = y + 450; // Approximated offset
                                }}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.reviewCard,
                                        {
                                            backgroundColor: theme.card,
                                            borderColor: highlightedReviewId === rev.id ? theme.primary : theme.primary + '30',
                                            borderWidth: highlightedReviewId === rev.id ? 2 : 1,
                                            transform: [{ scale: highlightedReviewId === rev.id ? 1.02 : 1 }]
                                        }
                                    ]}
                                    onPress={() => router.push({
                                        pathname: "/review/[id]",
                                        params: {
                                            id: rev.id || '',
                                            userId: rev.userId,
                                            user_name: rev.user_name,
                                            user_avatar: rev.user_avatar,
                                            comment: rev.comment,
                                            rating_quality: rev.rating_quality,
                                            rating_price: rev.rating_price,
                                            rating_service: rev.rating_service,
                                            rating_flavor: rev.rating_flavor,
                                            images: rev.images?.join(','),
                                            video: rev.video,
                                            created_at: rev.created_at
                                        }
                                    })}
                                >
                                    <View style={styles.reviewHeader}>
                                        <View style={styles.reviewUser}>
                                            <Image source={{ uri: rev.user_avatar || getDefaultAvatarUrl(rev.user_name || 'User') }} style={styles.avatar} />
                                            <View>
                                                <Text style={[styles.userName, { color: theme.text }]}>{rev.user_name}</Text>
                                                <View style={styles.topTopBadge}>
                                                    <ShieldCheck size={12} color={theme.primary} />
                                                    <Text style={[styles.topTopBadgeText, { color: theme.primary }]}>TopTop Member</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={[styles.reviewScore, { backgroundColor: theme.primary }]}>
                                            <Text style={styles.reviewScoreText}>{((rev.rating_quality + rev.rating_price + rev.rating_service + rev.rating_flavor) / 4).toFixed(1)}</Text>
                                        </View>
                                    </View>
                                    <CommentText
                                        text={rev.comment || ''}
                                        style={[styles.reviewComment, { color: theme.text }]}
                                        numberOfLines={3}
                                        ellipsizeMode="tail"
                                    />
                                </TouchableOpacity>
                            </Animated.View>
                        ))}

                        {/* Google Reviews */}
                        {googleData.reviews?.map((rev, i) => (
                            <View key={i} style={[styles.reviewCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.card, shadowOpacity: 0.05 }]}>
                                <View style={styles.reviewHeader}>
                                    <View style={styles.reviewUser}>
                                        <Image source={{ uri: rev.profile_photo_url }} style={styles.avatar} />
                                        <View>
                                            <Text style={[styles.userName, { color: theme.text }]}>{rev.author_name}</Text>
                                            <Text style={[styles.reviewDate, { color: theme.textSecondary }]}>{rev.relative_time_description}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.googleRating}>
                                        <Star size={14} color="#FBBC04" fill="#FBBC04" />
                                        <Text style={[styles.googleRatingText, { color: theme.text }]}>{rev.rating}</Text>
                                    </View>
                                </View>
                                <ExpandableReviewText
                                    text={rev.text}
                                    style={[styles.reviewComment, { color: theme.textSecondary }]}
                                    theme={theme}
                                />
                                <View style={styles.sourceTag}>
                                    <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} style={styles.sourceLogo} />
                                    <Text style={styles.sourceText}>Google Review</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                </View>
            </Animated.ScrollView >

            </View>

            {/* TAB 2: ANNOUNCEMENTS */}
            <View style={{ width, flex: 1 }}>
                <AnnouncementBoard 
                    establishmentId={id as string} 
                    isFollowing={isFollowingEstablishment}
                    onFollowPress={handleFollowToggle}
                />
            </View>

            {/* Creation Modal */}
            <Modal
                visible={isCreateModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsCreateModalVisible(false)}
                statusBarTranslucent
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>New Top List</Text>
                            <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
                                <X size={24} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.label, { color: theme.textSecondary }]}>List name</Text>
                        <TextInput
                            style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                            value={newListName}
                            onChangeText={setNewListName}
                            placeholder="e.g. My Top Hotels"
                            placeholderTextColor={theme.textSecondary}
                            autoFocus
                        />

                        <View style={styles.switchRow}>
                            <View>
                                <Text style={[styles.switchLabel, { color: theme.text }]}>Public List</Text>
                                <Text style={[styles.switchDesc, { color: theme.textSecondary }]}>Allow other users to discover your list.</Text>
                            </View>
                            <Switch
                                value={newListIsPublic}
                                onValueChange={setNewListIsPublic}
                                trackColor={{ false: '#333', true: theme.primary + '50' }}
                                thumbColor={newListIsPublic ? theme.primary : '#f4f3f4'}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.createBtn, { backgroundColor: theme.primary }]}
                            onPress={handleCreateAndAddToList}
                            disabled={!newListName.trim()}
                        >
                            <Text style={styles.createBtnText}>Create and Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Hidden Social Share Card */}
            <View style={{ position: 'absolute', top: -3000, left: 0, opacity: 0 }} pointerEvents="none">
                <View ref={socialCardRef} collapsable={false}>
                    <SocialShareCard 
                        type="establishment" 
                        theme={theme}
                        data={{
                            name: googleData?.name,
                            category: getCategoryFromTypes(googleData?.types || []),
                            address: googleData?.formatted_address,
                            rating: googleData?.rating,
                            photoUrl: googleData?.photos?.[0] ? getPhotoUrl(googleData.photos[0].photo_reference, 800) : null
                        }}
                    />
                </View>
            </View>
        </Animated.ScrollView >
    );
}

const AnimatedCarouselItem = ({ photoReference, width }: { photoReference: string, width: number }) => {
    const zoomValue = useSharedValue(1);

    useEffect(() => {
        zoomValue.value = withRepeat(
            withTiming(1.15, {
                duration: 6000,
                easing: Easing.inOut(Easing.quad),
            }),
            -1,
            true
        );
    }, []);

    const animatedImageStyle = useAnimatedStyle(() => ({
        transform: [{ scale: zoomValue.value }],
    }));

    return (
        <View style={{ width: width, height: 400, overflow: 'hidden' }}>
            <Animated.Image
                source={{ uri: getPhotoUrl(photoReference, 1200) }}
                style={[{ width: width, height: 400 }, animatedImageStyle]}
                resizeMode="cover"
            />
        </View>
    );
};

const ExpandableReviewText = ({
    text,
    style,
    theme,
    maxLines = 3,
}: {
    text: string;
    style?: any;
    theme: any;
    maxLines?: number;
}) => {
    const [expanded, setExpanded] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const [measuredLines, setMeasuredLines] = useState(0);

    const handleTextLayout = (e: any) => {
        const lines = e.nativeEvent.lines.length;
        setMeasuredLines(lines);
        if (lines > maxLines) setIsTruncated(true);
    };

    return (
        <View>
            {/* Hidden measurement view - renders full text off-screen to detect truncation */}
            {!isTruncated && measuredLines === 0 && (
                <Text
                    style={[style, { position: 'absolute', opacity: 0, zIndex: -1 }]}
                    onTextLayout={handleTextLayout}
                >
                    {text}
                </Text>
            )}
            <Text
                style={style}
                numberOfLines={expanded ? undefined : maxLines}
                ellipsizeMode="tail"
            >
                {text}
            </Text>
            {(isTruncated || expanded) && (
                <TouchableOpacity
                    onPress={() => setExpanded(prev => !prev)}
                    style={styles.expandBtn}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.expandBtnText, { color: theme.primary }]}>
                        {expanded ? 'See less ▲' : 'See more ▼'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const StarMetricRow = ({ label, value, theme }: { label: string; value: number; theme: any }) => (
    <View style={styles.starMetricRow}>
        <Text style={[styles.starMetricLabel, { color: theme.textSecondary }]}>{label}</Text>
        <View style={styles.starMetricStars}>
            {[1, 2, 3, 4, 5].map((s) => (
                <Star
                    key={s}
                    size={13}
                    color={s <= value ? '#FBBC04' : theme.textSecondary}
                    fill={s <= value ? '#FBBC04' : 'transparent'}
                />
            ))}
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    headerActions: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    rightActionsColumn: {
        flexDirection: 'column',
        gap: 15,
    },
    headerIconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroContainer: { height: 400, width: '100%' },
    heroImage: { ...StyleSheet.absoluteFillObject },
    heroOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 60, // Taller overlay to fully cover the rounded corners transition
        backgroundColor: 'rgba(28, 31, 38, 0.5)', // Slightly more opaque to match content card
    },
    heroCompactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12, // Ensure there is a gap between rating and text
    },
    scoreBadgeCompact: {
        width: 42,
        height: 42,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreTextSmall: { fontSize: 16, fontWeight: '900', color: '#1C1F26' },
    heroNameCompact: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 2 },
    heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    gemLabel: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
    gemLabelText: { fontSize: 9, fontWeight: '900', color: '#1C1F26' },
    heroCategorySmall: { fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: '700', letterSpacing: 0.5 },
    compactPagination: {
        flexDirection: 'row',
        gap: 4,
        alignItems: 'center',
        marginLeft: 10,
    },
    dotSmall: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    scoreBadge: {
        width: 50,
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    scoreText: { fontSize: 20, fontWeight: '900', color: '#1C1F26' },
    heroName: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 8 },
    heroCategory: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '700', letterSpacing: 1 },
    content: {
        marginTop: -30,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 20,
        paddingTop: 30,
        paddingBottom: 120,
    },
    actionRow: { flexDirection: 'row', marginBottom: 30 },
    primaryAction: {
        flex: 1.5,
        height: 55,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    primaryActionText: { fontSize: 16, fontWeight: '700', color: '#1C1F26' },
    secondaryAction: {
        flex: 1,
        height: 55,
        borderRadius: 15,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryActionText: { fontSize: 16, fontWeight: '700' },
    actionIcon: { marginRight: 8 },
    section: { marginBottom: 35 },
    sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
    contactItem: { flexDirection: 'row', alignItems: 'center' },
    contactText: { fontSize: 14, marginLeft: 12, fontWeight: '500', flex: 1 },
    reviewCard: {
        padding: 24,
        borderRadius: 28,
        marginBottom: 18,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    reviewUser: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    userName: { fontSize: 16, fontWeight: '700' },
    topTopBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    topTopBadgeText: { fontSize: 10, fontWeight: '800', marginLeft: 4 },
    reviewScore: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    reviewScoreText: { color: '#1C1F26', fontWeight: '900', fontSize: 14 },
    reviewComment: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
    metricsRow: { flexDirection: 'row', marginTop: 12, gap: 15 },
    metricSmall: { fontSize: 12, fontWeight: '700' },
    starMetricsGrid: { marginTop: 14, gap: 6 },
    starMetricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    starMetricLabel: { fontSize: 12, fontWeight: '600', width: 60 },
    starMetricStars: { flexDirection: 'row', gap: 2 },
    reviewDate: { fontSize: 12, fontWeight: '500' },
    googleRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    googleRatingText: { fontSize: 14, fontWeight: '800' },
    sourceTag: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    sourceLogo: { width: 14, height: 14, marginRight: 6 },
    sourceText: { fontSize: 11, fontWeight: '700', color: '#AEB4C0' },
    expandBtn: { marginTop: 6 },
    expandBtnText: { fontSize: 13, fontWeight: '700' },
    addReviewBtn: {
        height: 60,
        borderRadius: 15,
        borderWidth: 1,
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addReviewText: { fontSize: 16, fontWeight: '800', marginLeft: 10 },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    writeReviewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
    },
    writeReviewText: {
        color: '#1C1F26',
        fontSize: 13,
        fontWeight: '700',
    },
    followBtn: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 10,
        marginBottom: 10,
        marginTop: -5,
    },
    followBtnText: {
        fontSize: 12,
        fontWeight: '700',
    },
    floatingAddBtn: {
        height: 60,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
        gap: 10,
    },
    floatingAddBtnText: {
        fontWeight: '900',
        color: '#1C1F26',
        letterSpacing: -0.5,
    },
    // Shared Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 25 },
    modalContent: { borderRadius: 30, padding: 25 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { fontSize: 20, fontWeight: '900' },
    label: { fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
    input: { height: 55, borderRadius: 16, paddingHorizontal: 20, fontSize: 16, fontWeight: '600', marginBottom: 25 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    switchLabel: { fontSize: 16, fontWeight: '800' },
    switchDesc: { fontSize: 13, fontWeight: '500', marginTop: 2 },
    createBtn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    createBtnText: { color: '#1C1F26', fontSize: 16, fontWeight: '900' },
    priceDetailRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 12, gap: 6 },
    priceDetailSymbol: { fontSize: 15, fontWeight: '900' },
    priceDetailRange: { fontSize: 14, fontWeight: '600' },
    swipeIndicator: {
        position: 'absolute',
        bottom: 120,
        right: 20,
        backgroundColor: 'rgba(28, 31, 38, 0.7)',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        zIndex: 5,
    },
    swipeIndicatorText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    followRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 20,
    },
    followSectionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    followSectionBtnText: {
        fontSize: 13,
        fontWeight: '800',
    },
    swipeHintInline: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    swipeHintText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFD700',
    },
    followerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    followerCount: {
        fontSize: 13,
        fontWeight: '500',
        color: '#999',
    },
});
