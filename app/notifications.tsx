import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import {
    clearNotificationsHistory,
    clearRemoteNotifications,
    deleteNotificationFromHistory,
    deleteRemoteNotification,
    getNotificationsHistory,
    getRemoteNotifications,
    markRemoteNotificationsAsRead,
    NotificationItem
} from '@/services/notificationService';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, AtSign, Bell, BellOff, Heart, MapPin, MessageSquare, ShieldCheck, Trash2, UserPlus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Animated, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadHistory = async () => {
        setRefreshing(true);
        // Load local Proximity history
        const localHistory = await getNotificationsHistory();

        // Load remote Mentions/Likes/Follows history
        let remoteHistory: NotificationItem[] = [];
        if (user) {
            remoteHistory = await getRemoteNotifications(user.id);
            // Mark as read when entering the screen
            await markRemoteNotificationsAsRead(user.id);
        }

        // Merge and sort by newest first
        const all = [...localHistory, ...remoteHistory].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setNotifications(all);
        setRefreshing(false);
    };

    useEffect(() => {
        loadHistory();
    }, [user]);

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.round(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.round(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        return date.toLocaleDateString();
    };

    const handleDelete = async (item: NotificationItem) => {
        let success = false;
        if (item.isRemote) {
            success = await deleteRemoteNotification(item.id);
        } else {
            await deleteNotificationFromHistory(item.id);
            success = true;
        }
        
        if (success) {
            setNotifications(prev => prev.filter(n => n.id !== item.id));
        }
    };

    const handleClearAll = async () => {
        await clearNotificationsHistory();
        if (user) {
            const success = await clearRemoteNotifications(user.id);
            if (success) setNotifications([]);
        } else {
            setNotifications([]);
        }
    };

    const renderRightActions = (progress: any, dragX: any, item: NotificationItem) => {
        return (
            <RectButton style={[styles.deleteAction, { backgroundColor: theme.error }]} onPress={() => handleDelete(item)}>
                <Animated.View style={{ transform: [{ translateX: 0 }] }}>
                    <Trash2 size={24} color="#FFF" />
                </Animated.View>
            </RectButton>
        );
    };

    const handlePress = (item: NotificationItem) => {
        const { data } = item;

        // Priority to review/comment specific navigation
        if (data?.reviewId) {
            router.push({
                pathname: `/review/${data.reviewId}`,
                params: { commentId: data.commentId }
            } as any);
            return;
        }

        if (data?.establishmentId) {
            router.push(`/establishment/${data.establishmentId}`);
        } else if (data?.type === 'FOLLOW' && data?.followerId) {
            router.push(`/user/${data.followerId}`);
        }
    };

    const getIcon = (item: NotificationItem) => {
        const type = item.data?.type;
        const color = theme.primary;

        if (item.data?.establishmentId && !type) return <MapPin size={22} color={color} />; // Proximity

        switch (type) {
            case 'FOLLOW': return <UserPlus size={22} color={color} />;
            case 'LIKE':
            case 'COMMENT_LIKE': return <Heart size={22} color="#FF2D55" />;
            case 'SUPER_LIKE': return <ShieldCheck size={22} color={color} />;
            case 'COMMENT': return <MessageSquare size={22} color={color} />;
            case 'MENTION': return <AtSign size={22} color={color} />;
            default: return <Bell size={22} color={color} />;
        }
    };

    const renderNotification = ({ item }: { item: NotificationItem }) => (
        <Swipeable
            renderRightActions={(p, d) => renderRightActions(p, d, item)}
            friction={2}
            rightThreshold={40}
        >
            <TouchableOpacity
                style={[styles.notificationCard, { backgroundColor: theme.card }]}
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
            >
                <View style={[styles.iconContainer, { backgroundColor: theme.primary + '10' }]}>
                    {getIcon(item)}
                </View>
                <View style={styles.notificationContent}>
                    <Text style={[styles.notificationTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.notificationBody, { color: theme.textSecondary }]}>{item.body}</Text>
                    <View style={styles.timeContainer}>
                        {!item.read && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
                        <Text style={[styles.notificationTime, { color: theme.textSecondary }]}>{formatTime(item.timestamp)}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Swipeable>
    );

    const insets = useSafeAreaInsets();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
                {notifications.length > 0 ? (
                    <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
                        <Trash2 size={20} color={theme.error} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(20, insets.bottom + 10) }]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={loadHistory} tintColor={theme.primary} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <View style={[styles.emptyIconContainer, { backgroundColor: theme.card }]}>
                            <BellOff size={40} color={theme.textSecondary} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: theme.text }]}>Caught up</Text>
                        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                            Here you'll see your mentions, new followers, and nearby TopTop places.
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    clearBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    listContent: {
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    notificationCard: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 20,
        marginBottom: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(128,128,128,0.05)',
    },
    deleteAction: {
        width: 80,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        marginBottom: 10,
        marginLeft: 10,
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 2,
    },
    notificationBody: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 4,
        opacity: 0.9,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    unreadDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    notificationTime: {
        fontSize: 11,
        fontWeight: '600',
        opacity: 0.6,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 150,
        paddingHorizontal: 40,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
});
