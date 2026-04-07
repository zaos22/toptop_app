import { MarqueeText } from '@/components/MarqueeText';
import { useColorScheme } from '@/components/useColorScheme';
import { VideoThumbnail } from '@/components/VideoThumbnail';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { AccountService } from '@/services/accountService';
import { getUserReviews, Review } from '@/services/establishmentService';
import { createList, getUserLists, UserList } from '@/services/listService';
import { getRankByPoints, getRankProgress, RANKS } from '@/services/rankService';
import { getUserProfile, syncUserStats, UserProfile } from '@/services/userProfileService';
import { getDefaultAvatarUrl } from '@/utils/userUtils';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { AlignLeft, Film, Grid, Image as ImageIcon, Layout, LogOut, MessageCircle, Settings, Share2, TrendingUp, X, Zap } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { ShareService } from '@/services/shareService';
import { SocialShareCard } from '@/components/SocialShareCard';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const GRID_SIZE = width / 3;

import { useGlobalUI } from '@/context/GlobalUIContext';

export default function ProfileScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { user } = useAuth();
    const { showToast, showAlert, setGlobalLoading } = useGlobalUI();

    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [userLists, setUserLists] = useState<UserList[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRankUp, setShowRankUp] = useState(false);

    // Tabs state
    const [activeTab, setActiveTab] = useState<'all' | 'media' | 'text'>('all');
    const [allReviews, setAllReviews] = useState<Review[]>([]);
    const [textReviews, setTextReviews] = useState<Review[]>([]);
    const [mediaReviews, setMediaReviews] = useState<Review[]>([]);

    // Create List Modal State
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [newListIsPublic, setNewListIsPublic] = useState(false);

    const viewShotRef = useRef<any>(null);
    const socialCardRef = useRef<any>(null);

    const handleShareProfile = async () => {
        if (socialCardRef.current) {
            await ShareService.shareViewAsImage(socialCardRef.current, `profile-${userProfile?.username || 'user'}.png`);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadUserProfile();
        }, [user])
    );

    const getStoredPoints = async () => {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const val = await AsyncStorage.getItem(`last_points_${user?.id}`);
        return val ? parseInt(val, 10) : null;
    };

    const savePoints = async (points: number) => {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem(`last_points_${user?.id}`, points.toString());
    };

    const isFetchingRef = React.useRef(false);

    const loadUserProfile = async () => {
        if (!user) {
            console.log('[Profile] No user found in AuthContext');
            return;
        }

        if (isFetchingRef.current) {
            console.log('[Profile] Load already in progress, skipping...');
            return;
        }

        console.log('[Profile] Starting loadUserProfile for:', user.id);
        isFetchingRef.current = true;
        setLoading(true);

        try {
            // Sync stats from source-of-truth tables first so followers/following
            // counters are always accurate (e.g. after returning from social-list).
            // Use a 5s timeout so a slow sync never blocks the profile render.
            await Promise.race([
                syncUserStats(user.id),
                new Promise<void>(resolve => setTimeout(resolve, 5000))
            ]);

            console.log('[Profile] Fetching profile data in parallel (3 requests)');
            
            // Limit parallel requests to 3 to avoid OkHttp connection pool exhaustion (limit is 5)
            const dataPromise = Promise.all([
                getUserProfile(user.id),
                getUserLists(user.id),
                getUserReviews(user.id)
            ]);

            const [profile, listsData, fetchedReviews] = await Promise.race([
                dataPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_DATA')), 10000))
            ]) as [UserProfile | null, UserList[], Review[]];

            console.log('[Profile] Step 3: Updating state');
            setUserProfile(profile);
            setUserLists(listsData || []);

            if (fetchedReviews) {
                const sorted = fetchedReviews.sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );
                setAllReviews(sorted);
                setTextReviews(sorted.filter(r => !(r.images && r.images.length > 0) && !r.video));
                setMediaReviews(sorted.filter(r => (r.images && r.images.length > 0) || r.video));
            }

            // Check for rank up (celebration)
            if (profile) {
                const storedPoints = await getStoredPoints();
                if (storedPoints !== null && profile.points > storedPoints) {
                    const oldRank = getRankByPoints(storedPoints);
                    const currentRank = getRankByPoints(profile.points);
                    const oldIndex = RANKS.findIndex(r => r.name === oldRank.name);
                    const currentIndex = RANKS.findIndex(r => r.name === currentRank.name);

                    if (currentIndex > oldIndex) {
                        setShowRankUp(true);
                    }
                }
                await savePoints(profile.points);
            }
            console.log('[Profile] Load complete');

        } catch (error: any) {
            if (error?.message === 'TIMEOUT_DATA') {
                console.warn('[Profile] Data fetch timed out - UI will show partial info');
            } else {
                console.error('[Profile] Error loading profile:', error);
                showToast('Could not load your full profile', 'error');
            }
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    };





    const handleLogout = () => {
        showAlert({
            title: 'Log out',
            message: 'Are you sure you want to log out of your TopTop account?',
            options: [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                    text: 'Log out',
                    style: 'destructive',
                    icon: LogOut,
                    onPress: async () => {
                        try {
                            setGlobalLoading(true, 'Logging out...');

                            // Clear persistent location so next session starts fresh
                            const { locationStore } = require('@/services/locationStore');
                            await locationStore.clearLocation();

                            const { success, error } = await AccountService.logout();
                            if (!success) throw error;

                            showToast('Logged out', 'success');
                            router.replace('/login');
                        } catch (error: any) {
                            showToast(error.message, 'error');
                        } finally {
                            setGlobalLoading(false);
                        }
                    }
                }
            ]
        });
    };

    const handleCreateList = async () => {
        if (!user || !newListName.trim()) {
            showToast('Enter a name for the list', 'info');
            return;
        }

        setGlobalLoading(true, 'Creating list...');
        try {
            const newList = await createList(user.id, newListName.trim(), newListIsPublic);
            if (newList) {
                setUserLists([newList, ...userLists]);
                setIsCreateModalVisible(false);
                setNewListName('');
                setNewListIsPublic(false);
                showToast('List created successfully', 'success');
            }
        } catch (error) {
            showToast('Could not create the list', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    // Render Review Item
    const renderReviewItem = (rev: Review, index: number) => (
        <Animated.View
            entering={ZoomIn.duration(400).delay(index * 100)}
            key={rev.id || index}
        >
            <TouchableOpacity
                style={[styles.reviewCardX, { backgroundColor: theme.backgroundSecondary, borderColor: theme.card }]}
                onPress={() => rev.id && router.push({ pathname: '/review/[id]', params: { id: rev.id } })}
            >
                <View style={styles.reviewMain}>
                    <TouchableOpacity
                        style={styles.establishmentInfo}
                        onPress={() => rev.establishment_id && router.push(`/establishment/${rev.establishment_id}`)}
                    >
                        <MarqueeText
                            text={rev.establishment_name || 'Establishment'}
                            style={[styles.revEstablishment, { color: theme.text }]}
                            containerStyle={{ flex: 1 }}
                        />
                        <Text style={[styles.revDate, { color: theme.textSecondary }]}>{new Date(rev.created_at).toLocaleDateString()}</Text>
                    </TouchableOpacity>
                    <View style={[styles.revScoreBadge, { backgroundColor: theme.primary }]}>
                        <Text style={styles.revScoreText}>
                            {((rev.rating_quality + rev.rating_price + rev.rating_service + rev.rating_flavor) / 4).toFixed(1)}
                        </Text>
                    </View>
                </View>

                <Text style={[styles.revComment, { color: theme.text }]} numberOfLines={3}>{rev.comment}</Text>

                {(rev.images && rev.images.length > 0) || rev.video ? (
                    <View style={styles.revMediaPreview}>
                        {rev.images && rev.images.length > 0 ? (
                            <Image source={{ uri: rev.images[0] }} style={styles.revThumbnail} />
                        ) : rev.video ? (
                            <VideoThumbnail videoUrl={rev.video} style={styles.revThumbnail} />
                        ) : null}
                        {rev.images && rev.images.length > 1 && (
                            <View style={styles.moreMediaOverlay}>
                                <ImageIcon size={14} color="#FFF" />
                                <Text style={styles.moreMediaText}>+{rev.images.length - 1}</Text>
                            </View>
                        )}
                    </View>
                ) : null}

                <View style={styles.revInteraction}>
                    <View style={styles.interactionItem}>
                        <MessageCircle size={14} color={theme.textSecondary} />
                        <Text style={[styles.interactionText, { color: theme.textSecondary }]}>Reply</Text>
                    </View>
                    <View style={styles.interactionItem}>
                        <Zap size={14} color={theme.textSecondary} />
                        <Text style={[styles.interactionText, { color: theme.textSecondary }]}>{rev.likes || 0}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );

    const renderMediaGrid = () => (
        <View style={styles.gridContainer}>
            {mediaReviews.map((rev) => (
                <TouchableOpacity
                    key={rev.id}
                    style={styles.gridItem}
                    onPress={() => rev.id && router.push({ pathname: '/review/[id]', params: { id: rev.id } })}
                >
                    {rev.images && rev.images.length > 0 ? (
                        <Image source={{ uri: rev.images[0] }} style={styles.gridImage} />
                    ) : rev.video ? (
                        <VideoThumbnail videoUrl={rev.video} style={styles.gridImage} />
                    ) : (
                        <View style={[styles.gridImage, styles.gridPlaceholder]}>
                            <Film size={30} color={theme.primary} />
                        </View>
                    )}
                    {rev.video && (
                        <View style={styles.videoIndicator}>
                            <Film size={12} color="#FFF" />
                        </View>
                    )}
                    {(rev.images?.length || 0) > 1 && (
                        <View style={styles.multiPhotoIndicator}>
                            <Layout size={12} color="#FFF" />
                        </View>
                    )}
                </TouchableOpacity>
            ))}
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{ marginTop: 20, color: theme.textSecondary, fontSize: 16, fontWeight: '600' }}>
                    Loading your legacy...
                </Text>
            </View>
        );
    }

    const currentRank = userProfile ? getRankByPoints(userProfile.points) : RANKS[0];
    const progress = userProfile ? getRankProgress(userProfile.points) : 0;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {showRankUp && (
                <View style={styles.celebrationOverlay}>
                    <Animated.View entering={ZoomIn.duration(800)} exiting={FadeOut} style={[styles.celebrationCard, { backgroundColor: theme.card }]}>
                        <TrendingUp size={80} color={theme.primary} />
                        <Text style={[styles.celebrationTitle, { color: theme.text }]}>New Rank Achieved!</Text>
                        <Text style={[styles.celebrationRank, { color: theme.primary }]}>{currentRank.name}</Text>
                        <TouchableOpacity style={[styles.celebrationBtn, { backgroundColor: theme.primary }]} onPress={() => setShowRankUp(false)}>
                            <Text style={styles.celebrationBtnText}>Continue Legend</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ backgroundColor: theme.background, paddingBottom: 12 }}>
                    {/* Header - Instagram Style */}
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
                            <LogOut size={22} color={theme.error} />
                        </TouchableOpacity>
                        <Text style={[styles.headerUser, { color: theme.text }]}>{userProfile?.username || userProfile?.displayName}</Text>
                        <View style={{ flexDirection: 'row' }}>
                            <TouchableOpacity onPress={handleShareProfile} style={[styles.iconBtn, { marginRight: 10 }]}>
                                <Share2 size={22} color={theme.text} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconBtn}>
                                <Settings size={22} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={{ backgroundColor: theme.background }}>
                    <View style={{ backgroundColor: theme.background, paddingBottom: 12 }}>
                        {/* Header - Instagram Style (Inside ViewShot) */}
                        {userProfile && (
                            <>
                                <View style={styles.profileTop}>
                                    <View style={[styles.avatarWrapper, { borderColor: currentRank.color }]}>
                                        <Image
                                            source={{ uri: userProfile.photoURL || getDefaultAvatarUrl(userProfile.displayName || userProfile.username || 'User') }}
                                            style={styles.mainAvatar}
                                        />
                                        <View style={[styles.rankOrb, { backgroundColor: currentRank.color }]}>
                                            <Zap size={10} color="#1C1F26" />
                                        </View>
                                    </View>

                                    <View style={styles.statsRow}>
                                        <View style={styles.statBox}>
                                            <Text style={[styles.statNum, { color: theme.text }]}>{userProfile.reviewsCount}</Text>
                                            <Text style={[styles.statLab, { color: theme.textSecondary }]}>Reviews</Text>
                                        </View>
                                        <TouchableOpacity style={styles.statBox} onPress={() => router.push({ pathname: '/social-list', params: { userId: user?.id, mode: 'followers' } })}>
                                            <Text style={[styles.statNum, { color: theme.text }]}>{userProfile.followersCount}</Text>
                                            <Text style={[styles.statLab, { color: theme.textSecondary }]}>Followers</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.statBox} onPress={() => router.push({ pathname: '/social-list', params: { userId: user?.id, mode: 'following' } })}>
                                            <Text style={[styles.statNum, { color: theme.text }]}>{userProfile.followingCount}</Text>
                                            <Text style={[styles.statLab, { color: theme.textSecondary }]}>Following</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.bioSection}>
                                    <Text style={[styles.boldName, { color: theme.text }]}>{userProfile.displayName}</Text>
                                    {userProfile.bio && <Text style={[styles.bioText, { color: theme.text }]}>{userProfile.bio}</Text>}

                                    {/* Rank Indicator */}
                                    <View style={styles.rankBarContainer}>
                                        <Text style={[styles.rankLabel, { color: currentRank.color }]}>{currentRank.name} • {userProfile.points} pts</Text>
                                        <View style={[styles.barBg, { backgroundColor: theme.card }]}>
                                            <View style={[styles.barFill, { width: `${progress}%`, backgroundColor: currentRank.color }]} />
                                        </View>
                                    </View>

                                    {!userProfile.bio && (
                                        <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.card, marginTop: 15 }]} onPress={() => router.push('/edit-profile')}>
                                            <Text style={[styles.btnText, { color: theme.text }]}>Edit profile</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </>
                        )}

                        {/* Lists Section - Highlights style */}
                        <View style={styles.highlightsContainer}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20 }}>
                                <TouchableOpacity style={styles.highlightItem} onPress={() => setIsCreateModalVisible(true)}>
                                    <View style={[styles.hCircle, { borderColor: theme.card, backgroundColor: theme.card, borderStyle: 'dashed' }]}>
                                        <X size={24} color={theme.textSecondary} style={{ transform: [{ rotate: '45deg' }] }} />
                                    </View>
                                    <Text style={[styles.hText, { color: theme.text }]}>New</Text>
                                </TouchableOpacity>
                                {userLists.map((list) => (
                                    <TouchableOpacity
                                        key={list.id}
                                        style={styles.highlightItem}
                                        onPress={() => router.push({ pathname: '/list-detail', params: { id: list.id, initialName: list.name } })}
                                    >
                                        <View style={[styles.hCircle, { borderColor: theme.card, backgroundColor: theme.card }]}>
                                            <TrendingUp size={20} color={theme.primary} />
                                        </View>
                                        <Text style={[styles.hText, { color: theme.text }]} numberOfLines={1}>{list.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </ViewShot>

                {/* Tabs */}
                <View style={styles.profileTabs}>
                    <TouchableOpacity
                        style={[styles.tabTrigger, activeTab === 'all' && { borderBottomColor: theme.text }]}
                        onPress={() => setActiveTab('all')}
                    >
                        <AlignLeft size={22} color={activeTab === 'all' ? theme.text : theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabTrigger, activeTab === 'media' && { borderBottomColor: theme.text }]}
                        onPress={() => setActiveTab('media')}
                    >
                        <Grid size={22} color={activeTab === 'media' ? theme.text : theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabTrigger, activeTab === 'text' && { borderBottomColor: theme.text }]}
                        onPress={() => setActiveTab('text')}
                    >
                        <MessageCircle size={22} color={activeTab === 'text' ? theme.text : theme.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.feedContent}>
                    {activeTab === 'all' && (
                        allReviews.length > 0 ? allReviews.map((rev, idx) => renderReviewItem(rev, idx)) : <EmptyState text="You haven't posted any reviews yet" />
                    )}

                    {activeTab === 'media' && (
                        mediaReviews.length > 0 ? renderMediaGrid() : <EmptyState text="You don't have any shared photos or videos" />
                    )}

                    {activeTab === 'text' && (
                        textReviews.length > 0 ? textReviews.map((rev, idx) => renderReviewItem(rev, idx)) : <EmptyState text="You don't have any text-only reviews" />
                    )}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Modal for new list */}
            <Modal visible={isCreateModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>New Top List</Text>
                        <TextInput
                            style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                            value={newListName}
                            onChangeText={setNewListName}
                            placeholder="List name"
                            placeholderTextColor={theme.textSecondary}
                        />
                        <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.primary }]} onPress={handleCreateList}>
                            <Text style={[styles.btnText, { color: '#000' }]}>Create List</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ marginTop: 15, alignItems: 'center' }} onPress={() => setIsCreateModalVisible(false)}>
                            <Text style={{ color: theme.textSecondary }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Hidden Social Share Card */}
            <View style={{ position: 'absolute', top: -3000, left: 0, opacity: 0 }} pointerEvents="none">
                <View ref={socialCardRef} collapsable={false}>
                    <SocialShareCard 
                        type="profile" 
                        theme={theme}
                        data={{
                            displayName: userProfile?.displayName,
                            username: userProfile?.username,
                            photoURL: userProfile?.photoURL || (userProfile?.displayName || userProfile?.username ? getDefaultAvatarUrl(userProfile.displayName || userProfile.username || 'User') : null),
                            reviewsCount: userProfile?.reviewsCount || 0,
                            points: userProfile?.points || 0,
                            rankColor: currentRank.color
                        }}
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}

const EmptyState = ({ text }: { text: string }) => {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    return (
        <View style={styles.emptyWrap}>
            <Text style={[styles.emptyTxt, { color: theme.textSecondary }]}>{text}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 50 },
    iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerUser: { fontSize: 16, fontWeight: '700' },
    profileTop: { flexDirection: 'row', paddingHorizontal: 20, alignItems: 'center', marginTop: 10 },
    avatarWrapper: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, padding: 3, position: 'relative' },
    mainAvatar: { width: '100%', height: '100%', borderRadius: 40 },
    rankOrb: { position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#000' },
    statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 15 },
    statBox: { alignItems: 'center' },
    statNum: { fontSize: 17, fontWeight: '700' },
    statLab: { fontSize: 12, fontWeight: '400' },
    bioSection: { paddingHorizontal: 20, marginTop: 15 },
    boldName: { fontSize: 14, fontWeight: '700' },
    bioText: { fontSize: 14, fontWeight: '400', marginTop: 2, lineHeight: 18 },
    rankBarContainer: { marginTop: 12 },
    rankLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
    barBg: { height: 4, borderRadius: 2, width: '100%' },
    barFill: { height: '100%', borderRadius: 2 },
    mainBtn: { height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    btnText: { fontSize: 14, fontWeight: '600' },
    highlightsContainer: { marginTop: 20, marginBottom: 5 },
    highlightItem: { alignItems: 'center', marginRight: 18, width: 64 },
    hCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
    hText: { fontSize: 11, fontWeight: '400', textAlign: 'center' },
    profileTabs: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: 'rgba(128,128,128,0.2)', marginTop: 0 },
    tabTrigger: { flex: 1, height: 48, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
    feedContent: { marginTop: 0 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap' },
    gridItem: { width: GRID_SIZE, height: GRID_SIZE, padding: 1 },
    gridImage: { width: '100%', height: '100%' },
    gridPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' },
    videoIndicator: { position: 'absolute', top: 5, right: 5 },
    multiPhotoIndicator: { position: 'absolute', top: 5, right: 22 },
    reviewCardX: {
        padding: 24,
        borderRadius: 28,
        marginBottom: 18,
        marginHorizontal: 16,
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
    },
    reviewMain: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    establishmentInfo: { flex: 1 },
    revEstablishment: { fontSize: 16, fontWeight: '800' },
    revDate: { fontSize: 12, fontWeight: '500', marginTop: 1 },
    revScoreBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
    revScoreText: { fontSize: 13, fontWeight: '900', color: '#1C1F26' },
    revComment: { fontSize: 15, lineHeight: 22, marginBottom: 12, fontWeight: '400' },
    revMediaPreview: { width: '100%', height: 220, borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
    revThumbnail: { width: '100%', height: '100%' },
    moreMediaOverlay: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
    moreMediaText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
    revInteraction: { flexDirection: 'row', gap: 30, marginTop: 5 },
    interactionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    interactionText: { fontSize: 13, fontWeight: '500' },
    emptyWrap: { padding: 60, alignItems: 'center' },
    emptyTxt: { fontSize: 14, fontStyle: 'italic' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 },
    modalContent: { padding: 25, borderRadius: 25 },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
    input: { height: 50, borderRadius: 12, paddingHorizontal: 15, marginBottom: 20 },
    celebrationOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 1000, justifyContent: 'center', alignItems: 'center', padding: 30 },
    celebrationCard: { width: '100%', padding: 40, borderRadius: 30, alignItems: 'center' },
    celebrationTitle: { fontSize: 22, fontWeight: '700', marginTop: 20, textAlign: 'center' },
    celebrationRank: { fontSize: 32, fontWeight: '900', marginVertical: 10 },
    celebrationBtn: { width: '100%', height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    celebrationBtnText: { fontWeight: '800' },
});
