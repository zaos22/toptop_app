import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { MessageSquare, ThumbsUp, Vote, User, Calendar, Smile } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { establishmentFollowService, Announcement } from '@/services/establishmentFollowService';
import { useAuth } from '@/context/AuthContext';

interface AnnouncementBoardProps {
    establishmentId: string;
    isFollowing: boolean;
    onFollowPress: () => void;
}

export const AnnouncementBoard = ({ establishmentId, isFollowing, onFollowPress }: AnnouncementBoardProps) => {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { user } = useAuth();
    
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isFollowing) {
            loadAnnouncements();
        }
    }, [establishmentId, isFollowing]);

    const loadAnnouncements = async () => {
        setLoading(true);
        const data = await establishmentFollowService.getAnnouncements(establishmentId, user?.id);
        setAnnouncements(data);
        setLoading(false);
    };

    const handleReaction = async (announcementId: string, emoji: string) => {
        if (!user) return;
        const success = await establishmentFollowService.toggleReaction(announcementId, user.id, emoji);
        if (success) loadAnnouncements();
    };

    const handleVote = async (announcementId: string, optionId: number) => {
        if (!user) return;
        const success = await establishmentFollowService.voteInPoll(announcementId, user.id, optionId);
        if (success) loadAnnouncements();
    };

    if (!isFollowing) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
                <View style={[styles.lockedCard, { backgroundColor: theme.card }]}>
                    <Smile size={48} color={theme.primary} style={styles.lockedIcon} />
                    <Text style={[styles.lockedTitle, { color: theme.text }]}>Exclusive Board</Text>
                    <Text style={[styles.lockedDesc, { color: theme.textSecondary }]}>
                        Follow this establishment to see their latest news, react to announcements and participate in votes.
                    </Text>
                    <TouchableOpacity 
                        style={[styles.followBtn, { backgroundColor: theme.primary }]}
                        onPress={onFollowPress}
                    >
                        <Text style={styles.followBtnText}>Follow to Unlock</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
                <ActivityIndicator color={theme.primary} size="large" />
                <Text style={{ marginTop: 15, color: theme.textSecondary }}>Fetching latest news...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Announcements</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Exclusive updates for followers</Text>
            </View>

            <FlatList
                data={announcements}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listPadding}
                onRefresh={loadAnnouncements}
                refreshing={loading}
                renderItem={({ item }) => (
                    <View style={[styles.announcementCard, { backgroundColor: theme.card, borderColor: theme.card }]}>
                        <View style={styles.announcementHeader}>
                            <Text style={[styles.announcementTitle, { color: theme.text }]}>{item.title}</Text>
                            <View style={styles.dateRow}>
                                <Calendar size={12} color={theme.textSecondary} />
                                <Text style={[styles.announcementDate, { color: theme.textSecondary }]}>
                                    {new Date(item.created_at).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                        
                        <Text style={[styles.announcementContent, { color: theme.textSecondary }]}>{item.content}</Text>

                        {item.type === 'poll' && item.poll_data && (
                            <View style={styles.votesContainer}>
                                <Text style={[styles.votesTitle, { color: theme.text }]}>Vote now:</Text>
                                {item.poll_data.options.map((option, idx) => {
                                    const totalVotes = item.poll_data?.total_votes || 0;
                                    const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                                    const isVoted = item.poll_data?.user_voted_option_id === option.id;
                                    
                                    return (
                                        <TouchableOpacity 
                                            key={idx} 
                                            style={[styles.voteOption, { backgroundColor: theme.background, borderColor: isVoted ? theme.primary : 'transparent', borderWidth: isVoted ? 1 : 0 }]}
                                            onPress={() => handleVote(item.id, option.id)}
                                        >
                                            <View style={[styles.voteProgress, { backgroundColor: theme.primary + '20', width: `${percentage}%` }]} />
                                            <Text style={[styles.voteText, { color: theme.text }]}>{option.text}</Text>
                                            <Text style={[styles.voteCount, { color: theme.textSecondary }]}>{Math.round(percentage)}%</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        <View style={styles.footer}>
                            <View style={styles.reactionsRow}>
                                {item.reactions && Object.entries(item.reactions).map(([emoji, count], idx) => (
                                    <TouchableOpacity 
                                        key={idx} 
                                        style={[styles.reactionBadge, { backgroundColor: item.user_reaction === emoji ? theme.primary + '20' : theme.background }]}
                                        onPress={() => handleReaction(item.id, emoji)}
                                    >
                                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                                        <Text style={[styles.reactionCount, { color: theme.textSecondary }]}>{count}</Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity 
                                    style={[styles.addReaction, { backgroundColor: theme.background }]}
                                    onPress={() => handleReaction(item.id, '👍')} // Default for now
                                >
                                    <Smile size={16} color={theme.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MessageSquare size={48} color={theme.card} />
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No announcements yet.</Text>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { justifyContent: 'center', alignItems: 'center', padding: 20 },
    header: { padding: 20, paddingTop: 60 },
    headerTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 14, fontWeight: '600', marginTop: 4 },
    listPadding: { padding: 15, paddingBottom: 100 },
    announcementCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
    },
    announcementHeader: { marginBottom: 12 },
    announcementTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    announcementDate: { fontSize: 12, fontWeight: '600' },
    announcementContent: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
    votesContainer: { marginTop: 20, gap: 10 },
    votesTitle: { fontSize: 14, fontWeight: '700', marginBottom: 5 },
    voteOption: {
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        overflow: 'hidden',
        position: 'relative',
    },
    voteProgress: { position: 'absolute', top: 0, left: 0, bottom: 0 },
    voteText: { fontSize: 14, fontWeight: '600' },
    voteCount: { fontSize: 12, fontWeight: '700' },
    footer: { marginTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 15 },
    reactionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    reactionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    reactionEmoji: { fontSize: 14 },
    reactionCount: { fontSize: 12, fontWeight: '700' },
    addReaction: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lockedCard: {
        padding: 40,
        borderRadius: 35,
        alignItems: 'center',
        textAlign: 'center',
        width: '100%',
    },
    lockedIcon: { marginBottom: 20 },
    lockedTitle: { fontSize: 24, fontWeight: '900', marginBottom: 15 },
    lockedDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
    followBtn: {
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 20,
    },
    followBtnText: { color: '#1C1F26', fontWeight: '900', fontSize: 16 },
    emptyContainer: { alignItems: 'center', marginTop: 100, gap: 20 },
    emptyText: { fontSize: 16, fontWeight: '600' },
});
