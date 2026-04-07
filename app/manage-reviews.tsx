import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { archiveReview, deleteReview, getUserReviews, Review } from '@/services/establishmentService';
import { Stack, useRouter } from 'expo-router';
import { Archive, ArrowLeft, CheckCircle2, Circle, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ManageReviewsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { showToast, showAlert, setGlobalLoading } = useGlobalUI();

    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        loadReviews();
    }, []);

    const loadReviews = async () => {
        if (!user) return;
        try {
            const data = await getUserReviews(user.id);
            setReviews(data);
        } catch (error) {
            console.error(error);
            showToast('Could not load reviews', 'error');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (reviews.length === 0) return;
        if (selectedIds.length === reviews.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(reviews.map(r => r.id!).filter(id => !!id));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;

        showAlert({
            title: "Delete Reviews",
            message: `Are you sure you want to delete ${selectedIds.length} reviews? This action cannot be undone.`,
            options: [
                { text: "Cancel", style: "cancel", onPress: () => { } },
                {
                    text: "Delete",
                    style: "destructive",
                    icon: Trash2,
                    onPress: async () => {
                        setGlobalLoading(true, `Deleting ${selectedIds.length} reviews...`);
                        try {
                            const idsToDelete = [...selectedIds];
                            for (const id of idsToDelete) {
                                await deleteReview(id);
                            }
                            setReviews(prev => prev.filter(r => !idsToDelete.includes(r.id!)));
                            setSelectedIds([]);
                            showToast("Reviews deleted successfully", "success");
                        } catch (error) {
                            console.error('Delete error:', error);
                            showToast("Could not delete reviews", "error");
                        } finally {
                            setGlobalLoading(false);
                        }
                    }
                }
            ]
        });
    };

    const handleBulkArchive = async () => {
        if (selectedIds.length === 0) return;

        showAlert({
            title: "Archive Reviews",
            message: "Archived reviews will be hidden from your profile and permanently deleted after 60 days.",
            options: [
                { text: "Cancel", style: "cancel", onPress: () => { } },
                {
                    text: "Archive",
                    icon: Archive,
                    onPress: async () => {
                        setGlobalLoading(true, "Archiving reviews...");
                        try {
                            const idsToArchive = [...selectedIds];
                            for (const id of idsToArchive) {
                                await archiveReview(id);
                            }
                            setReviews(prev => prev.filter(r => !idsToArchive.includes(r.id!)));
                            setSelectedIds([]);
                            showToast("Reviews successfully moved to archive", "success");
                        } catch (error) {
                            showToast("Could not archive reviews", "error");
                        } finally {
                            setGlobalLoading(false);
                        }
                    }
                }
            ]
        });
    };

    const renderItem = ({ item }: { item: Review }) => {
        const isSelected = selectedIds.includes(item.id!);
        const avgScore = ((item.rating_quality + (item.rating_price || 0) + (item.rating_service || 0) + (item.rating_flavor || 0)) / 4).toFixed(1);

        return (
            <TouchableOpacity
                style={[
                    styles.reviewItem,
                    {
                        backgroundColor: theme.card,
                        borderColor: isSelected ? theme.primary : 'rgba(174, 180, 192, 0.1)'
                    }
                ]}
                onPress={() => toggleSelect(item.id!)}
            >
                <View style={styles.selectionIndicator}>
                    {isSelected ? (
                        <CheckCircle2 size={24} color={theme.primary} fill={theme.primary + '20'} />
                    ) : (
                        <Circle size={24} color={theme.textSecondary} />
                    )}
                </View>

                <View style={styles.reviewContent}>
                    <View style={styles.reviewHeader}>
                        <Text style={[styles.establishmentName, { color: theme.text }]} numberOfLines={1}>
                            {item.establishment_name || 'Establishment'}
                        </Text>
                        <View style={[styles.scoreBadge, { backgroundColor: isSelected ? theme.primary : theme.primary + '20' }]}>
                            <Text style={[styles.scoreText, { color: isSelected ? '#1C1F26' : theme.primary }]}>{avgScore}</Text>
                        </View>
                    </View>

                    <Text style={[styles.commentPreview, { color: theme.textSecondary }]} numberOfLines={2}>
                        {item.comment}
                    </Text>

                    <View style={styles.reviewFooter}>
                        <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                            {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                        {(item.images?.length || item.video) && (
                            <View style={styles.mediaTag}>
                                <ImageIcon size={12} color={theme.primary} />
                                <Text style={[styles.mediaTagText, { color: theme.primary }]}>Media</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>
                        {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Manage Reviews'}
                    </Text>
                </View>

                {reviews.length > 0 && (
                    <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn}>
                        <Text style={[styles.selectAllText, { color: theme.primary }]}>
                            {selectedIds.length === reviews.length ? 'Deselect' : 'All'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.searchBar}>
                <Text style={[styles.totalCount, { color: theme.textSecondary }]}>
                    You have a total of {reviews.length} published reviews
                </Text>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={reviews}
                    renderItem={renderItem}
                    keyExtractor={item => item.id!}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                You have no reviews to manage.
                            </Text>
                        </View>
                    }
                />
            )}

            {selectedIds.length > 0 && (
                <View style={[styles.bottomActions, { backgroundColor: theme.card, borderTopColor: theme.background }]}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.archiveBtn]}
                        onPress={handleBulkArchive}
                    >
                        <Archive size={20} color={theme.text} />
                        <Text style={[styles.actionText, { color: theme.text }]}>Archive</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.deleteBtn]}
                        onPress={handleBulkDelete}
                    >
                        <Trash2 size={20} color="#FFF" />
                        <Text style={[styles.actionText, { color: '#FFF' }]}>Delete</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
    selectAllBtn: { paddingVertical: 5, paddingHorizontal: 10 },
    selectAllText: { fontSize: 14, fontWeight: '700' },
    searchBar: { paddingHorizontal: 20, marginBottom: 15 },
    totalCount: { fontSize: 13, fontWeight: '600', opacity: 0.7 },
    selectionBar: { paddingVertical: 8, alignItems: 'center' },
    selectionText: { fontSize: 13, fontWeight: '800', color: '#1C1F26' },
    listContent: { paddingHorizontal: 20, paddingBottom: 120 },
    reviewItem: {
        flexDirection: 'row',
        padding: 15,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 2,
        alignItems: 'center'
    },
    selectionIndicator: { marginRight: 15 },
    reviewContent: { flex: 1 },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    establishmentName: { fontSize: 16, fontWeight: '800', flex: 1, marginRight: 10 },
    scoreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    scoreText: { fontSize: 12, fontWeight: '900' },
    commentPreview: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 8 },
    reviewFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateText: { fontSize: 11, fontWeight: '600' },
    mediaTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(174, 180, 192, 0.05)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    mediaTagText: { fontSize: 10, fontWeight: '700' },
    bottomActions: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        flexDirection: 'row',
        padding: 20,
        gap: 15,
        borderTopWidth: 1,
        paddingBottom: 40
    },
    actionButton: {
        flex: 1,
        height: 55,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10
    },
    archiveBtn: { backgroundColor: 'rgba(174, 180, 192, 0.1)' },
    deleteBtn: { backgroundColor: '#FF4444' },
    actionText: { fontSize: 16, fontWeight: '800' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
