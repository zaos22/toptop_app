import { BounceMarqueeText } from '@/components/BounceMarqueeText';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getPhotoUrl, searchNearbyPlaces } from '@/services/googleMapsService';
import { getCategoryFromTypes } from '@/utils/categoryUtils';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, MapPin, TrendingUp } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GemsScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const [loading, setLoading] = useState(true);
    const [gems, setGems] = useState<any[]>([]);

    useEffect(() => {
        loadGems();
    }, []);

    const loadGems = async () => {
        try {
            setLoading(true);

            // 1. FAST LOCATION: Use last known position for near-instant results
            const location = await Location.getLastKnownPositionAsync({}) ||
                await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

            if (!location) {
                setLoading(false);
                return;
            }

            // 2. SEARCH: Immediate fetch of nearby places
            const results = await searchNearbyPlaces(location.coords.latitude, location.coords.longitude);

            // 3. OPTIMIZED FILTERING: Processing on-the-fly without deep detail calls where not needed
            const gemsFound = results
                .map((item: any) => {
                    const rating = item.rating || 0;
                    const reviewCount = item.user_ratings_total || 0;
                    const isGem = rating >= 4.0 && reviewCount < 300;

                    if (!isGem) return null;

                    const photoRef = item.photos?.[0]?.photo_reference;
                    const photoUri = photoRef
                        ? getPhotoUrl(photoRef, 400)
                        : 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80';

                    // Deterministic status for dynamic feel
                    const seed = item.place_id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                    const daySeed = new Date().getDate();
                    const movementVal = (seed + daySeed) % 10;
                    let movement: 'up' | 'down' | 'stable' = 'stable';
                    if (movementVal > 7) movement = 'up';
                    else if (movementVal < 3) movement = 'down';

                    return {
                        id: item.place_id,
                        name: item.name,
                        category: getCategoryFromTypes(item.types, item.name),
                        score: rating,
                        reviewCount: reviewCount,
                        media: [{ uri: photoUri }],
                        status: movement,
                        address: item.vicinity,
                    };
                })
                .filter((g: any) => g !== null);

            setGems(gemsFound);
        } catch (error) {
            console.error('Error loading gems:', error);
        } finally {
            setGems(prev => prev.length > 0 ? prev : []); // Ensure state update
            setLoading(false);
        }
    };

    const renderGemItem = ({ item, index }: { item: any; index: number }) => (
        <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
            <TouchableOpacity
                style={[styles.gemCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.card }]}
                onPress={() => router.push(`/establishment/${item.id}`)}
            >
                <Image
                    source={{ uri: item.media?.[0]?.uri }}
                    style={styles.gemImage}
                />
                <View style={styles.gemInfo}>
                    <View style={styles.nameRow}>
                        <BounceMarqueeText
                            text={item.name}
                            style={[styles.gemName, { color: theme.text }]}
                            containerStyle={{ flex: 1 }}
                        />
                        <View style={[styles.scorePill, { backgroundColor: theme.primary }]}>
                            <Text style={styles.scoreText}>{item.score}</Text>
                        </View>
                    </View>

                    <View style={styles.metaRow}>
                        <Text style={[styles.gemCategory, { color: theme.textSecondary }]}>{item.category}</Text>
                        <View style={styles.dot} />
                        <Text style={[styles.gemReviews, { color: theme.textSecondary }]}>{item.reviewCount} reviews</Text>
                    </View>

                    <View style={styles.locationRow}>
                        <MapPin size={12} color={theme.primary} />
                        <Text style={[styles.gemAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                            {item.address}
                        </Text>
                    </View>
                </View>

                {item.status !== 'stable' && (
                    <View style={styles.statusBadge}>
                        <TrendingUp size={12} color={item.status === 'up' ? theme.success : theme.error} style={{ transform: [{ rotate: item.status === 'down' ? '180deg' : '0deg' }] }} />
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.card }]}>
                    <ChevronLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <View>
                    <Text style={[styles.title, { color: theme.text }]}>Hidden Gems</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Discovered by quality, not fame</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={gems}
                    renderItem={renderGemItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={{ color: theme.textSecondary }}>No gems found in this area yet.</Text>
                        </View>
                    }
                />
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
        paddingHorizontal: 20,
        paddingVertical: 15,
        gap: 15,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
    },
    subtitle: {
        fontSize: 14,
    },
    list: {
        padding: 20,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gemCard: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 20,
        marginBottom: 15,
        borderWidth: 1,
        alignItems: 'center',
    },
    gemImage: {
        width: 80,
        height: 80,
        borderRadius: 15,
    },
    gemInfo: {
        flex: 1,
        marginLeft: 15,
        justifyContent: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    gemName: {
        fontSize: 16,
        fontWeight: '800',
    },
    scorePill: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginLeft: 10,
    },
    scoreText: {
        color: '#1C1F26',
        fontSize: 12,
        fontWeight: '900',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    gemCategory: {
        fontSize: 12,
        fontWeight: '600',
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: 'rgba(128,128,128,0.4)',
        marginHorizontal: 6,
    },
    gemReviews: {
        fontSize: 12,
        fontWeight: '500',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    gemAddress: {
        fontSize: 11,
        flex: 1,
    },
    statusBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
    }
});
