import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getPriceInfo } from '@/utils/priceUtils';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Heart } from 'lucide-react-native';

interface RankingBlockProps {
    subcategory: any;
    userLocation: { lat: number; lng: number } | null;
    locationName: string;
    data: any[];
    loading: boolean;
    followedPlaceIds?: string[];
    onFollowToggle?: (item: any) => void;
}

export default function RankingBlock({ subcategory, userLocation, locationName, data, loading, followedPlaceIds = [], onFollowToggle }: RankingBlockProps) {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const rankColors = ['#FFD700', '#C0C0C0', '#CD7132'];
    const isFollowed = (placeId: string) => followedPlaceIds.includes(placeId);

    if (loading && (!data || data.length === 0)) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={[styles.titleLine, { backgroundColor: theme.primary }]} />
                    <Text style={[styles.title, { color: theme.text }]}>Top 3: {subcategory.title}</Text>
                </View>
                <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
            </View>
        );
    }

    if (data.length === 0) return null;

    const isWorld = (subcategory as any).isWorld;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.titleLine, { backgroundColor: theme.primary }]} />
                    <Text style={[styles.title, { color: theme.text }]}>Top 3: {subcategory.title}</Text>
                </View>
                <TouchableOpacity 
                    onPress={() => {
                        router.push({
                            pathname: `/ranking/${subcategory.id}` as any,
                            params: {
                                title: subcategory.title,
                                type: subcategory.type || '',
                                query: subcategory.query || '',
                                lat: isWorld ? '' : (userLocation?.lat.toString() || ''),
                                lng: isWorld ? '' : (userLocation?.lng.toString() || ''),
                                locationName: isWorld ? 'Global' : locationName,
                                isWorld: isWorld ? 'true' : 'false'
                            }
                        });
                    }}
                    style={styles.viewFullContainer}
                >
                    <Text style={[styles.viewFull, { color: theme.primary }]}>View all</Text>
                    <ChevronRight size={14} color={theme.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.list}>
                {data.map((item, index) => {
                    const isTop3 = index < 3;
                    const priceInfo = getPriceInfo(item.priceLevel, item.rawTypes);

                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.itemContainer,
                                { backgroundColor: theme.card }
                            ]}
                            onPress={() => router.push(`/establishment/${item.id}`)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.rankContainer}>
                                <Text style={[styles.rankNumber, { color: rankColors[index] || theme.textSecondary }]}>
                                    #{index + 1}
                                </Text>
                            </View>

                            <Image
                                source={{ uri: item.photo || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80' }}
                                style={styles.image}
                            />

                            <View style={styles.infoContainer}>
                                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                                    {item.name}
                                </Text>

                                <Text style={[styles.subText, { color: theme.textSecondary }]} numberOfLines={1}>
                                    {item.category} {priceInfo ? `• ${priceInfo.full}` : ''}
                                </Text>

                                <View style={styles.scoreRow}>
                                    <View style={[styles.scorePill, { backgroundColor: theme.primary + '20' }]}>
                                        <Text style={[styles.scoreText, { color: theme.primary }]}>{item.score}</Text>
                                    </View>
                                    <Text style={[styles.reviewsText, { color: theme.textSecondary }]}>
                                        {item.reviewCount > 1000 ? `${(item.reviewCount / 1000).toFixed(1)}k` : item.reviewCount} revs
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={[
                                    styles.followBtn, 
                                    { backgroundColor: isFollowed(item.id) ? theme.primary + '20' : theme.card }
                                ]}
                                onPress={() => onFollowToggle && onFollowToggle(item)}
                            >
                                <Heart 
                                    size={18} 
                                    color={isFollowed(item.id) ? theme.error : theme.textSecondary} 
                                    fill={isFollowed(item.id) ? theme.error : 'transparent'} 
                                />
                            </TouchableOpacity>

                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 35,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    titleLine: {
        width: 4,
        height: 18,
        borderRadius: 2,
        marginRight: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
    },
    viewFullContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    viewFull: {
        fontSize: 12,
        fontWeight: '700',
        marginRight: 2,
    },
    list: {
        gap: 12,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 20,
    },
    rankContainer: {
        width: 35,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankNumber: {
        fontSize: 18,
        fontWeight: '900',
    },
    image: {
        width: 55,
        height: 55,
        borderRadius: 14,
        marginRight: 15,
    },
    infoContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 4,
    },
    subText: {
        fontSize: 12,
        marginBottom: 5,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    scorePill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginRight: 6,
    },
    scoreText: {
        fontSize: 11,
        fontWeight: '800',
    },
    reviewsText: {
        fontSize: 11,
        fontWeight: '500',
    },
    followBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 10,
    }
});
