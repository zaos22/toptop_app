import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getUserReviews } from '@/services/userProfileService';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MessageSquare, Star } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UserReviewsScreen() {
    const { id, name } = useLocalSearchParams();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadReviews();
    }, [id]);

    const loadReviews = async () => {
        if (!id) return;
        try {
            const data = await getUserReviews(id as string);
            setReviews(data);
        } catch (error) {
            console.error('Error loading user reviews:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderReview = ({ item }: { item: any }) => {
        const avgRating = ((item.rating_quality + item.rating_value + item.rating_reliability) / 3).toFixed(1);

        return (
            <TouchableOpacity
                style={[styles.reviewCard, { backgroundColor: theme.card }]}
                onPress={() => item.establishment_id && router.push({ pathname: "/establishment/[id]", params: { id: item.establishment_id } })}
            >
                <View style={styles.reviewHeader}>
                    <View style={styles.ratingBadge}>
                        <Star size={14} color={theme.primary} fill={theme.primary} />
                        <Text style={[styles.ratingText, { color: theme.primary }]}>{avgRating}</Text>
                    </View>
                    <Text style={[styles.reviewDate, { color: theme.textSecondary }]}>
                        {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>

                <Text style={[styles.comment, { color: theme.text }]}>{item.comment}</Text>

                {item.establishment_name && (
                    <View style={styles.establishmentInfo}>
                        <Text style={[styles.establishmentPrefix, { color: theme.textSecondary }]}>En </Text>
                        <Text style={[styles.establishmentName, { color: theme.primary }]}>{item.establishment_name}</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Reviews de {name || 'Usuario'}</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={reviews}
                    renderItem={renderReview}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MessageSquare size={48} color={theme.textSecondary} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Este usuario aún no ha escrito reviews.</Text>
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
    reviewCard: { padding: 20, borderRadius: 20, marginBottom: 15 },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(214, 178, 94, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    ratingText: { fontSize: 14, fontWeight: '800' },
    reviewDate: { fontSize: 12, fontWeight: '500' },
    comment: { fontSize: 15, fontWeight: '500', lineHeight: 22, marginBottom: 15 },
    establishmentInfo: { flexDirection: 'row', alignItems: 'center' },
    establishmentPrefix: { fontSize: 13, fontWeight: '500' },
    establishmentName: { fontSize: 13, fontWeight: '700' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { fontSize: 16, fontWeight: '500', marginTop: 20, textAlign: 'center' },
});
