import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { getVisits } from '@/services/establishmentService';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Clock, MapPin, Search } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Visit {
    id: string;
    establishmentId: string;
    establishmentName: string;
    visitedAt: string;
}

export default function VisitHistoryScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    const [visits, setVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadVisits();
    }, []);

    const loadVisits = async () => {
        if (!user) return;
        try {
            const data = await getVisits(user.id);
            setVisits(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: Visit }) => {
        const date = new Date(item.visitedAt);
        const formattedDate = date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return (
            <TouchableOpacity
                style={[styles.visitItem, { backgroundColor: theme.card }]}
                onPress={() => router.push(`/establishment/${item.establishmentId}`)}
            >
                <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
                    <MapPin size={22} color={theme.primary} />
                </View>

                <View style={styles.visitContent}>
                    <Text style={[styles.establishmentName, { color: theme.text }]}>
                        {item.establishmentName}
                    </Text>

                    <View style={styles.visitDetails}>
                        <View style={styles.detailRow}>
                            <Clock size={12} color={theme.textSecondary} />
                            <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                                {formattedDate} • {formattedTime}
                            </Text>
                        </View>
                    </View>
                </View>

                <ArrowLeft size={16} color={theme.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Visit History</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchContainer}>
                <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
                    <Search size={20} color={theme.textSecondary} />
                    <Text style={[styles.searchText, { color: theme.textSecondary }]}>
                        You have visited {visits.length} places in total
                    </Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={visits}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MapPin size={48} color={theme.textSecondary} style={{ marginBottom: 15, opacity: 0.5 }} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                You haven't recorded any visits yet. Go explore!
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    searchContainer: { paddingHorizontal: 20, marginBottom: 20 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 16,
        gap: 12
    },
    searchText: { fontSize: 14, fontWeight: '600' },
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    visitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15
    },
    visitContent: { flex: 1 },
    establishmentName: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
    visitDetails: { gap: 4 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    detailText: { fontSize: 12, fontWeight: '600' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { padding: 40, alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 16, fontWeight: '600', textAlign: 'center', opacity: 0.7 },
});
