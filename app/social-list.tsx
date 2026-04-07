import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/config/supabase';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { useSettings } from '@/context/SettingsContext';
import { followUser, isFollowing, syncUserStats, unfollowUser, UserProfile } from '@/services/userProfileService';
import { getDefaultAvatarUrl } from '@/utils/userUtils';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { ArrowLeft, Search, UserCheck, UserPlus } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SocialListScreen() {
    const { userId, mode } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { user: currentUser } = useAuth();
    const { showToast, setGlobalLoading } = useGlobalUI();
    const { halalEnabled } = useSettings();

    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Reload list every time the screen gets focus (e.g. after follow/unfollow on another screen)
    useFocusEffect(
        useCallback(() => {
            // If we already have data, silently refresh in the background (no full spinner)
            if (users.length > 0) {
                loadUsers(true);
            } else {
                loadUsers(false);
            }
        }, [userId, mode])
    );

    const loadUsers = async (silent = false) => {
        if (!userId) return;
        if (silent) {
            setIsRefreshing(true);
        } else {
            setLoading(true);
        }
        try {
            let data: any[] = [];
            if (mode === 'followers') {
                const { data: followers, error } = await supabase
                    .from('follows')
                    .select('follower_id, profiles!follows_follower_id_fkey(*)')
                    .eq('target_id', userId);
                if (error) throw error;
                data = (followers ?? []).map(f => f.profiles).filter(p => {
                    if (!p) return false;
                    if (halalEnabled) return (p as any).is_halal === true;
                    return true;
                });
            } else {
                const { data: following, error } = await supabase
                    .from('follows')
                    .select('target_id, profiles!follows_target_id_fkey(*)')
                    .eq('follower_id', userId);
                if (error) throw error;
                data = (following ?? []).map(f => f.profiles).filter(p => {
                    if (!p) return false;
                    if (halalEnabled) return (p as any).is_halal === true;
                    return true;
                });
            }

            // Check following status for each user
            const usersWithFollowStatus = await Promise.all(
                data.map(async (u: any) => {
                    const profile: UserProfile = {
                        uid: u.id,
                        displayName: u.display_name,
                        username: u.username,
                        email: u.email,
                        photoURL: u.photo_url,
                        bio: u.bio,
                        points: u.points,
                        profileViews: u.profile_views || 0,
                        visitedCount: u.visited_count,
                        reviewsCount: u.reviews_count,
                        followersCount: u.followers_count,
                        followingCount: u.following_count,
                        badges: u.badges || [],
                        isHalal: u.is_halal || false,
                        createdAt: u.created_at,
                        updatedAt: u.updated_at,
                    };

                    let isFollowed = false;
                    if (currentUser && profile.uid !== currentUser.id) {
                        isFollowed = await isFollowing(currentUser.id, profile.uid);
                    }

                    return { ...profile, isFollowed };
                })
            );

            setUsers(usersWithFollowStatus);
        } catch (error) {
            console.error('Error loading social list:', error);
            showToast('Could not load users', 'error');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const [processingUids, setProcessingUids] = useState<Set<string>>(new Set());

    const handleFollowToggle = async (targetUser: any) => {
        if (!currentUser || processingUids.has(targetUser.uid)) return;

        setProcessingUids(prev => new Set(prev).add(targetUser.uid));
        const isCurrentlyFollowed = targetUser.isFollowed;
        const previousUsers = [...users];

        // Optimistic update
        setUsers(users.map(u =>
            u.uid === targetUser.uid ? { ...u, isFollowed: !isCurrentlyFollowed } : u
        ));

        try {
            if (isCurrentlyFollowed) {
                await unfollowUser(currentUser.id, targetUser.uid);
                showToast(`You no longer follow @${targetUser.username || targetUser.displayName}`, 'info');
            } else {
                await followUser(currentUser.id, targetUser.uid);
                showToast(`You are now following @${targetUser.username || targetUser.displayName}`, 'success');
            }
        } catch (error) {
            console.error('Follow toggle error:', error);
            // Revert state
            setUsers(previousUsers);
            showToast('Could not process action', 'error');
        } finally {
            setProcessingUids(prev => {
                const next = new Set(prev);
                next.delete(targetUser.uid);
                return next;
            });
        }
    };

    const renderUser = ({ item }: { item: any }) => {
        const isMe = currentUser?.id === item.uid;

        return (
            <TouchableOpacity
                style={[styles.userCard, { backgroundColor: theme.card }]}
                onPress={() => router.push(`/user/${item.uid}`)}
            >
                <Image
                    source={{ uri: item.photoURL || getDefaultAvatarUrl(item.displayName || item.username || 'User') }}
                    style={styles.avatar}
                />
                <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: theme.text }]}>{item.displayName}</Text>
                    {item.username && <Text style={[styles.userHandle, { color: theme.textSecondary }]}>@{item.username}</Text>}
                </View>

                {!isMe && (
                    <TouchableOpacity
                        style={[
                            styles.miniFollowBtn,
                            { backgroundColor: item.isFollowed ? 'transparent' : theme.primary, borderColor: theme.primary }
                        ]}
                        onPress={() => handleFollowToggle(item)}
                    >
                        {item.isFollowed ? (
                            <UserCheck size={18} color={theme.text} />
                        ) : (
                            <UserPlus size={18} color="#1C1F26" />
                        )}
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                    {mode === 'followers' ? 'Followers' : 'Following'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={users}
                    renderItem={renderUser}
                    keyExtractor={(item) => item.uid}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={() => loadUsers(true)}
                            tintColor={theme.primary}
                            colors={[theme.primary]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Search size={48} color={theme.textSecondary} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                {mode === 'followers' ? 'No one follows you yet.' : "You don't follow anyone yet."}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    listContent: { padding: 20 },
    userCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: '700' },
    userHandle: { fontSize: 13, fontWeight: '500', opacity: 0.7 },
    miniFollowBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { fontSize: 16, fontWeight: '500', marginTop: 20 },
});
