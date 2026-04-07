import { MarqueeText } from '@/components/MarqueeText';
import { useColorScheme } from '@/components/useColorScheme';
import { VideoThumbnail } from '@/components/VideoThumbnail';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { getUserReviews, Review } from '@/services/establishmentService';
import { getUserLists, UserList } from '@/services/listService';
import { getRankByPoints, getRankProgress } from '@/services/rankService';
import { followUser, getUserProfile, isFollowing, unfollowUser, UserProfile } from '@/services/userProfileService';
import { getDefaultAvatarUrl } from '@/utils/userUtils';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { AlignLeft, ArrowLeft, Award, Film, Grid, Image as ImageIcon, Layout, MessageCircle, Share2, ShieldAlert, Zap } from 'lucide-react-native';
import React, { useCallback, useState, useRef } from 'react';
import { ActivityIndicator, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { ShareService } from '@/services/shareService';
import { SocialShareCard } from '@/components/SocialShareCard';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '@/context/SettingsContext';

const { width } = Dimensions.get('window');
const GRID_SIZE = width / 3;

export default function UserProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { user: currentUser } = useAuth();
    const { showToast, setGlobalLoading } = useGlobalUI();
    const { halalEnabled } = useSettings();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [following, setFollowing] = useState(false);
    const [userLists, setUserLists] = useState<UserList[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'media' | 'text'>('all');
    const [allReviews, setAllReviews] = useState<Review[]>([]);
    const [textReviews, setTextReviews] = useState<Review[]>([]);
    const [mediaReviews, setMediaReviews] = useState<Review[]>([]);

    const socialCardRef = useRef<any>(null);

    const handleShareProfile = async () => {
        if (!profile || !socialCardRef.current) return;
        try {
            await ShareService.shareViewAsImage(socialCardRef.current, `profile-${profile.username}.png`);
        } catch (error) {
            console.error(error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadProfile();
        }, [id, halalEnabled])
    );

    const loadProfile = async () => {
        const startTime = Date.now();
        setLoading(true);
        try {
            const data = await getUserProfile(id as string);
            
            // Check Halal mode visibility restriction
            if (data && !!data.isHalal !== !!halalEnabled) {
                setProfile(null);
                setLoading(false);
                return;
            }

            setProfile(data);

            if (currentUser && id !== currentUser.id) {
                const followingStatus = await isFollowing(currentUser.id, id as string);
                setFollowing(followingStatus);
            }

            // Load user's public lists
            const lists = await getUserLists(id as string);
            const publicLists = (currentUser && id === currentUser.id) ? lists : lists.filter(l => l.isPublic);
            setUserLists(publicLists);

            // Load reviews for tabs
            const fetched = await getUserReviews(id as string);
            const sorted = fetched.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setAllReviews(sorted);
            setTextReviews(sorted.filter(r => !(r.images && r.images.length > 0) && !r.video));
            setMediaReviews(sorted.filter(r => (r.images && r.images.length > 0) || r.video));

        } catch (error) {
            console.error('Error loading user profile:', error);
            showToast('Could not load profile', 'error');
        } finally {
            const duration = Date.now() - startTime;
            if (duration < 1000) {
                await new Promise(resolve => setTimeout(resolve, 1000 - duration));
            }
            setLoading(false);
        }
    };

    const [isProcessing, setIsProcessing] = useState(false);

    const handleFollowToggle = async () => {
        if (!currentUser || !id || !profile || isProcessing) return;

        setIsProcessing(true);
        const nextState = !following;
        const previousFollowing = following;
        const previousProfile = { ...profile };

        // Optimistic update
        setFollowing(nextState);
        setProfile((prev: any) => {
            if (!prev) return prev;
            return {
                ...prev,
                followersCount: nextState ? prev.followersCount + 1 : Math.max(0, prev.followersCount - 1)
            };
        });

        try {
            if (previousFollowing) {
                await unfollowUser(currentUser.id, id as string);
                showToast(`You no longer follow @${profile.username || profile.displayName}`, 'info');
            } else {
                await followUser(currentUser.id, id as string);
                showToast(`You are now following @${profile.username || profile.displayName}`, 'success');
            }
        } catch (error) {
            console.error('Follow error:', error);
            setFollowing(previousFollowing);
            setProfile(previousProfile);
            showToast('Could not process your request', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{ marginTop: 20, color: theme.textSecondary, fontSize: 16, fontWeight: '600' }}>
                    Loading legacy...
                </Text>
            </View>
        );
    }

    const isOwnProfile = currentUser?.id === id;
    const isRestricted = halalEnabled && profile && !profile.isHalal && !isOwnProfile;

    if (isRestricted) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
                <Stack.Screen options={{ 
                    headerShown: true, 
                    title: 'Separated Universe',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 15 }}>
                            <ArrowLeft color={theme.text} />
                        </TouchableOpacity>
                    ),
                    headerTitle: "Universe Restricted"
                }} />
                <View style={[styles.centered, { padding: 40 }]}>
                    <ShieldAlert size={64} color={theme.primary} style={{ marginBottom: 20 }} />
                    <Text style={[styles.errorTitle, { color: theme.text, textAlign: 'center', fontSize: 22, fontWeight: '800' }]}>Standard Universe User</Text>
                    <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 15, fontSize: 16, lineHeight: 22 }}>
                        This user is part of the Standard Universe. In Halal Mode, you can only interact with other Halal Universe members.
                    </Text>
                    <TouchableOpacity 
                        style={[styles.mainBtn, { marginTop: 30, width: '100%' }]}
                        onPress={() => router.push('/settings')}
                    >
                        <Text style={[styles.btnText, { color: '#FFF' }]}>Go to Settings</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (!profile) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <Stack.Screen options={{ title: 'Profile', headerShown: true, headerLeft: () => <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 15 }}><ArrowLeft color={theme.text} /></TouchableOpacity>, headerTitle: "" }} />
                <View style={styles.centered}>
                    <ShieldAlert size={64} color={theme.tabIconDefault} />
                    <Text style={[styles.errorTitle, { color: theme.text }]}>Profile Private</Text>
                    <Text style={[styles.errorSubtitle, { color: theme.tabIconDefault }]}>
                        {halalEnabled 
                          ? "This profile is not available in Halal mode."
                          : "This profile is only available in Halal mode."}
                    </Text>
                    <TouchableOpacity 
                        style={[styles.backButton, { backgroundColor: theme.tint }]}
                        onPress={() => router.back()}
                    >
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const currentRank = getRankByPoints(profile.points || 0);
    const rankProgress = getRankProgress(profile.points || 0);

    const renderReviewItem = (rev: Review, index: number) => (
        <Animated.View
            entering={ZoomIn.duration(400).delay(index * 100)}
            key={rev.id || index}
        >
            <TouchableOpacity
                style={[styles.reviewCardX, { backgroundColor: theme.backgroundSecondary, borderColor: theme.card }]}
                onPress={() => router.push({
                    pathname: "/review/[id]",
                    params: { id: rev.id! }
                })}
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
                    <TouchableOpacity
                        style={styles.interactionItem}
                        onPress={() => {
                            showToast('Liked!', 'success');
                        }}
                    >
                        <Zap size={14} color={theme.textSecondary} />
                        <Text style={[styles.interactionText, { color: theme.textSecondary }]}>{rev.likes || 0}</Text>
                    </TouchableOpacity>
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
                    onPress={() => router.push({
                        pathname: "/review/[id]",
                        params: { id: rev.id! }
                    })}
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

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                            <ArrowLeft size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[styles.headerUser, { color: theme.text }]}>{profile.username || profile.displayName}</Text>
                        {isOwnProfile ? (
                            <TouchableOpacity onPress={handleShareProfile} style={styles.iconBtn}>
                                <Share2 size={24} color={theme.text} />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.iconBtn} />
                        )}
                    </View>
                    
                    <View style={{ backgroundColor: theme.background, paddingBottom: 10 }}>
                        <View style={styles.profileTop}>
                            <View style={[styles.avatarWrapper, { borderColor: currentRank.color }]}>
                                <Image
                                    source={{ uri: profile.photoURL || getDefaultAvatarUrl(profile.displayName || profile.username || 'User') }}
                                    style={styles.mainAvatar}
                                />
                                <View style={[styles.rankOrb, { backgroundColor: currentRank.color }]}>
                                    <Award size={14} color="#FFF" />
                                </View>
                            </View>
                            <View style={styles.statsRow}>
                                <View style={styles.statBox}>
                                    <Text style={[styles.statNum, { color: theme.text }]}>{profile.reviewsCount || 0}</Text>
                                    <Text style={[styles.statLab, { color: theme.textSecondary }]}>Reviews</Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.statBox}
                                    onPress={() => router.push({
                                        pathname: "/social-list",
                                        params: { userId: id as string, mode: 'followers' }
                                    })}
                                >
                                    <Text style={[styles.statNum, { color: theme.text }]}>{profile.followersCount || 0}</Text>
                                    <Text style={[styles.statLab, { color: theme.textSecondary }]}>Followers</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={styles.statBox}
                                    onPress={() => router.push({
                                        pathname: "/social-list",
                                        params: { userId: id as string, mode: 'following' }
                                    })}
                                >
                                    <Text style={[styles.statNum, { color: theme.text }]}>{profile.followingCount || 0}</Text>
                                    <Text style={[styles.statLab, { color: theme.textSecondary }]}>Following</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.bioSection}>
                            <Text style={[styles.boldName, { color: theme.text }]}>{profile.displayName}</Text>
                            {profile.bio && <Text style={[styles.bioText, { color: theme.text }]}>{profile.bio}</Text>}

                            <View style={styles.rankBarContainer}>
                                <Text style={[styles.rankLabel, { color: currentRank.color }]}>{currentRank.name} • {profile.points} pts</Text>
                                <View style={[styles.barBg, { backgroundColor: theme.tabIconDefault + '20' }]}>
                                    <View style={[styles.barFill, { backgroundColor: currentRank.color, width: `${rankProgress}%` }]} />
                                </View>
                            </View>

                            {!isOwnProfile && currentUser && (
                                <View style={styles.actionRow}>
                                    <TouchableOpacity
                                        style={[
                                            styles.mainBtn,
                                            { backgroundColor: following ? theme.tabIconDefault + '20' : theme.tint }
                                        ]}
                                        onPress={handleFollowToggle}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? (
                                            <ActivityIndicator size="small" color={following ? theme.text : "#FFF"} />
                                        ) : (
                                            <Text style={[styles.btnText, { color: following ? theme.text : "#FFF" }]}>
                                                {following ? 'Following' : 'Follow'}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {userLists.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.highlightsContainer} contentContainerStyle={{ paddingHorizontal: 20 }}>
                                {userLists.map((list) => (
                                    <TouchableOpacity key={list.id} style={styles.highlightItem}>
                                        <View style={[styles.hCircle, { borderColor: theme.tabIconDefault + '30' }]}>
                                            <Layout size={24} color={theme.textSecondary} />
                                        </View>
                                        <Text numberOfLines={1} style={[styles.hText, { color: theme.text }]}>{list.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>

                    <View style={styles.profileTabs}>
                        <TouchableOpacity
                            style={[styles.tabTrigger, activeTab === 'all' && { borderBottomColor: theme.text }]}
                            onPress={() => setActiveTab('all')}
                        >
                            <Grid size={22} color={activeTab === 'all' ? theme.text : theme.tabIconDefault} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabTrigger, activeTab === 'media' && { borderBottomColor: theme.text }]}
                            onPress={() => setActiveTab('media')}
                        >
                            <Film size={22} color={activeTab === 'media' ? theme.text : theme.tabIconDefault} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabTrigger, activeTab === 'text' && { borderBottomColor: theme.text }]}
                            onPress={() => setActiveTab('text')}
                        >
                            <AlignLeft size={22} color={activeTab === 'text' ? theme.text : theme.tabIconDefault} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.feedContent}>
                        {activeTab === 'all' && (
                            <View style={{ paddingVertical: 15 }}>
                                {allReviews.length > 0 ? (
                                    allReviews.map((rev, idx) => renderReviewItem(rev, idx))
                                ) : (
                                    <EmptyState text="No reviews yet" />
                                )}
                            </View>
                        )}
                        {activeTab === 'media' && (
                            mediaReviews.length > 0 ? renderMediaGrid() : <EmptyState text="No media posts yet" />
                        )}
                        {activeTab === 'text' && (
                            <View style={{ paddingVertical: 15 }}>
                                {textReviews.length > 0 ? (
                                    textReviews.map((rev, idx) => renderReviewItem(rev, idx))
                                ) : (
                                    <EmptyState text="No text reviews yet" />
                                )}
                            </View>
                        )}
                    </View>
                    <View style={{ height: 100 }} />
                </ScrollView>
                
                {isOwnProfile && (
                    <View style={{ position: 'absolute', top: -3000, left: 0, opacity: 0 }} pointerEvents="none">
                        <ViewShot ref={socialCardRef} options={{ format: 'png', quality: 1 }}>
                            <SocialShareCard 
                                type="profile" 
                                theme={theme}
                                data={{
                                    displayName: profile.displayName,
                                    username: profile.username,
                                    photoURL: profile.photoURL || getDefaultAvatarUrl(profile.displayName || profile.username || 'User'),
                                    reviewsCount: profile.reviewsCount || 0,
                                    points: profile.points || 0,
                                    rankColor: getRankByPoints(profile.points || 0).color
                                }}
                            />
                        </ViewShot>
                    </View>
                )}
            </SafeAreaView>
        </View>
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

    actionRow: { marginTop: 15 },
    mainBtn: { height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
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
        padding: 20,
        borderRadius: 20,
        marginBottom: 16,
        marginHorizontal: 16,
        borderWidth: 1,
    },
    reviewMain: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    establishmentInfo: { flex: 1 },
    revEstablishment: { fontSize: 16, fontWeight: '700' },
    revDate: { fontSize: 12, fontWeight: '400', marginTop: 1 },
    revScoreBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
    revScoreText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
    revComment: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
    revMediaPreview: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
    revThumbnail: { width: '100%', height: '100%' },
    moreMediaOverlay: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    moreMediaText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    revInteraction: { flexDirection: 'row', gap: 20 },
    interactionItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    interactionText: { fontSize: 12 },
    emptyWrap: { padding: 40, alignItems: 'center' },
    emptyTxt: { fontSize: 14, fontStyle: 'italic' },

    errorTitle: { fontSize: 24, fontWeight: '800', marginTop: 20 },
    errorSubtitle: { fontSize: 16, textAlign: 'center', marginTop: 10, paddingHorizontal: 40, lineHeight: 22 },
    backButton: { marginTop: 30, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
    backButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
