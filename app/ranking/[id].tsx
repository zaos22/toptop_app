import { BounceMarqueeText } from '@/components/BounceMarqueeText';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useSettings } from '@/context/SettingsContext';
import { searchNearbyPlaces, searchPlaces } from '@/services/googleMapsService';
import { isCompatibleWithRanking } from '@/utils/categoryUtils';
import { getPriceInfo } from '@/utils/priceUtils';
import { formatPlaces } from '@/utils/rankingDefinitions';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, ShieldAlert, TrendingUp } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RankingDetailScreen() {
    const { id, title, type, query, lat, lng, locationName, isWorld: isWorldParam } = useLocalSearchParams();
    const isWorld = isWorldParam === 'true';
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { halalEnabled } = useSettings();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);

    const isRestrictedRanking = halalEnabled && (
        id === 'nightlife' ||
        (title as string)?.toLowerCase().includes('bar') ||
        (title as string)?.toLowerCase().includes('nightlife') ||
        (title as string)?.toLowerCase().includes('club')
    );

    if (isRestrictedRanking) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <Stack.Screen options={{ title: 'Ranking Restricted', headerShown: true, headerLeft: () => <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 15 }}><ChevronLeft color={theme.text} /></TouchableOpacity> }} />
                <View style={styles.center}>
                    <ShieldAlert size={64} color={theme.primary} />
                    <Text style={[styles.noItems, { color: theme.text, marginTop: 20, fontSize: 18, fontWeight: '800' }]}>Universe Restricted</Text>
                    <Text style={[styles.noItems, { color: theme.textSecondary, marginTop: 10, paddingHorizontal: 40 }]}>
                        Nightlife rankings are not available in the Halal Universe.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            if (!isWorld && (!lat || !lng)) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                let results = [];
                const parsedLat = lat ? parseFloat(lat as string) : undefined;
                const parsedLng = lng ? parseFloat(lng as string) : undefined;

                if (type && !query) {
                    results = await searchNearbyPlaces(parsedLat || 0, parsedLng || 0, type as string);
                } else if (query) {
                    let searchQ = isWorld ? query as string : `${query} en ${locationName}`;
                    if (halalEnabled) {
                        searchQ = `halal ${searchQ}`;
                    }
                    results = await searchPlaces(searchQ, parsedLat, parsedLng, type as string);
                }

                if (isMounted) {
                    // 1. Initial Strict type check from Google
                    const strictResults = type
                        ? results.filter((r: any) => r.types && r.types.includes(type as string))
                        : results;

                    // 2. Format places to get our custom categories
                    const formatted = formatPlaces(strictResults);

                    // 3. APPLY GLOBAL Relevancy Filter (The "Global Fix")
                    let finalFiltered = formatted.filter(item => {
                        return isCompatibleWithRanking(item.category, title as string, id as string);
                    });

                    // 4. APPLY Halal Filter if enabled
                    if (halalEnabled) {
                        const HARAM_TYPES = ['night_club', 'bar', 'liquor_store', 'casino'];
                        finalFiltered = finalFiltered.filter(item => {
                            if (!item.rawTypes) return true;
                            return !item.rawTypes.some((t: string) => HARAM_TYPES.includes(t));
                        });
                    }

                    // 4. Sort and Map
                    const sorted = finalFiltered.sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        return (b.reviewCount || 0) - (a.reviewCount || 0);
                    });

                    const mapped = sorted.map(item => {
                        const seed = item.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                        const movementVal = (seed + new Date().getDate()) % 10;
                        let status: 'up' | 'down' | 'stable' = 'stable';
                        if (movementVal > 7) status = 'up';
                        else if (movementVal < 3) status = 'down';
                        return { ...item, status };
                    });

                    setData(mapped);
                }
            } catch (error) {
                console.error('Error loading full ranking:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [type, query, lat, lng, locationName]);

    const renderRankingItem = (item: any, index: number) => {
        const isTop3 = index < 3;
        const rankColors = ['#FFD700', '#C0C0C0', '#CD7132'];
        const priceInfo = getPriceInfo(item.priceLevel, item.rawTypes);

        return (
            <TouchableOpacity
                key={item.id}
                style={[
                    styles.rankingItem,
                    { backgroundColor: theme.card, borderColor: theme.card },
                    isTop3 && { borderColor: rankColors[index] + '40', borderWidth: 1.5 }
                ]}
                onPress={() => router.push(`/establishment/${item.id}`)}
                activeOpacity={0.8}
            >
                <View style={styles.rankingLeft}>
                    <View style={styles.rankBadgeContainer}>
                        <Text style={[
                            styles.rankNumber,
                            { color: isTop3 ? rankColors[index] : theme.textSecondary, fontSize: isTop3 ? 22 : 18 }
                        ]}>
                            #{index + 1}
                        </Text>
                        {item.status !== 'stable' && (
                            <View style={styles.movementDots}>
                                <TrendingUp
                                    size={10}
                                    color={item.status === 'up' ? theme.success : theme.error}
                                    style={{ transform: [{ rotate: item.status === 'down' ? '180deg' : '0deg' }] }}
                                />
                            </View>
                        )}
                    </View>

                    <Image
                        source={{ uri: item.photo || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80' }}
                        style={styles.rankingThumb}
                    />

                    <View style={styles.rankingDetails}>
                        <View style={styles.nameRow}>
                            <BounceMarqueeText
                                text={item.name}
                                style={[styles.itemName, { color: theme.text }]}
                                containerStyle={{ flex: 1 }}
                            />
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={[styles.itemSub, { color: theme.textSecondary }]} numberOfLines={1}>
                                {item.category}
                            </Text>
                            <View style={styles.dotSeparator} />
                            <Text style={[styles.itemSub, { color: theme.textSecondary }]}>
                                {item.reviewCount > 1000 ? `${(item.reviewCount / 1000).toFixed(1)}k` : item.reviewCount} reviews
                            </Text>
                        </View>
                        {priceInfo && (
                            <View style={[styles.priceBadge, { backgroundColor: theme.primary + '18' }]}>
                                <Text style={[styles.priceBadgeText, { color: theme.primary }]}>
                                    {priceInfo.full}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.rankingRight}>
                    <View style={[styles.scorePill, { backgroundColor: isTop3 ? rankColors[index] : theme.backgroundSecondary }]}>
                        <Text style={[styles.scoreText, { color: isTop3 ? '#1C1F26' : theme.text }]}>{item.score}</Text>
                    </View>
                    <ChevronRight size={18} color={theme.textSecondary} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: theme.card }]}>
                    <ChevronLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Ranking </Text>
                    <Text style={[styles.subTitle, { color: theme.primary }]} numberOfLines={1}>{title}</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : data.length === 0 ? (
                <View style={styles.center}>
                    <Text style={[styles.noItems, { color: theme.textSecondary }]}>No establishments found for this ranking.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                    {data.map((item, idx) => renderRankingItem(item, idx))}
                </ScrollView>
            )}
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
        marginBottom: 5,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    subTitle: {
        fontSize: 14,
        fontWeight: '700',
        marginTop: 2,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    noItems: {
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        gap: 12,
    },
    rankingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 20,
    },
    rankingLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    rankBadgeContainer: {
        width: 35,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankNumber: {
        fontWeight: '900',
        marginBottom: 2,
    },
    movementDots: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankingThumb: {
        width: 60,
        height: 60,
        borderRadius: 14,
        marginHorizontal: 15,
    },
    rankingDetails: {
        flex: 1,
        justifyContent: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    itemName: {
        fontSize: 15,
        fontWeight: '700',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    itemSub: {
        fontSize: 12,
    },
    dotSeparator: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#666',
        marginHorizontal: 6,
    },
    priceBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    priceBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    rankingRight: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 10,
    },
    scorePill: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
    },
    scoreText: {
        fontSize: 12,
        fontWeight: '800',
    }
});
