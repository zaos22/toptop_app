import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { BarChart2, Bell, MessageSquare, Settings, Star, TrendingUp, Users, Eye, User, LogOut } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BusinessDashboard() {
    const { setAppMode } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    const stats = [
        { label: 'Rating', value: '4.8', icon: <Star size={20} color="#D6B25E" />, trend: '+0.2' },
        { label: 'Visits', value: '1,284', icon: <Eye size={20} color={theme.primary} />, trend: '+12%' },
        { label: 'Reviews', value: '86', icon: <MessageSquare size={20} color="#4A90E2" />, trend: '5 new' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.topSection}>
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={[styles.welcomeText, { color: theme.textSecondary }]}>Control Panel</Text>
                            <Text style={[styles.businessName, { color: theme.text }]}>The Sun Terrace</Text>
                        </View>
                        <TouchableOpacity 
                            style={[styles.switchBtn, { backgroundColor: theme.primary + '20' }]}
                            onPress={() => {
                                setAppMode('user');
                                router.replace('/(tabs)');
                            }}
                        >
                            <User size={20} color={theme.primary} />
                            <Text style={[styles.switchBtnText, { color: theme.primary }]}>User Mode</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    {stats.map((stat, index) => (
                        <View key={index} style={[styles.statCard, { backgroundColor: theme.card }]}>
                            <View style={styles.statHeader}>
                                {stat.icon}
                                <Text style={[styles.statTrend, { color: theme.primary }]}>{stat.trend}</Text>
                            </View>
                            <Text style={[styles.statValue, { color: theme.text }]}>{stat.value}</Text>
                            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Main Action - Analytics */}
                <TouchableOpacity 
                    style={[styles.analyticsCard, { backgroundColor: theme.primary }]}
                    onPress={() => router.push('/business/analytics')}
                >
                    <View>
                        <Text style={styles.analyticsTitle}>Detailed Analytics</Text>
                        <Text style={styles.analyticsSubtitle}>Check your monthly performance</Text>
                    </View>
                    <TrendingUp size={32} color="#1C1F26" />
                </TouchableOpacity>

                {/* Announcements Board Section */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Announcements Board</Text>
                    <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.primary + '20' }]} onPress={() => router.push('/business/create-announcement')}>
                        <Text style={[styles.addBtnText, { color: theme.primary }]}>+ Create Post</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.announcementPreview, { backgroundColor: theme.card }]} onPress={() => router.push('/business/announcements')}>
                    <View style={[styles.announcementIcon, { backgroundColor: theme.primary + '10' }]}>
                        <Bell size={24} color={theme.primary} />
                    </View>
                    <View style={styles.announcementInfo}>
                        <Text style={[styles.announcementTitleText, { color: theme.text }]}>Active Announcements</Text>
                        <Text style={[styles.announcementDesc, { color: theme.textSecondary }]}>3 posts visible to your followers</Text>
                    </View>
                    <Settings size={20} color={theme.textSecondary} />
                </TouchableOpacity>

                {/* Recent Reviews Section */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Reviews</Text>
                    <TouchableOpacity>
                        <Text style={[styles.seeAll, { color: theme.primary }]}>See all</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.reviewsList}>
                    {[1, 2].map((_, i) => (
                        <View key={i} style={[styles.reviewItem, { backgroundColor: theme.card }]}>
                            <View style={styles.reviewHeader}>
                                <Image 
                                    source={{ uri: `https://i.pravatar.cc/100?u=${i}` }} 
                                    style={styles.reviewerAvatar} 
                                />
                                <View style={styles.reviewerInfo}>
                                    <Text style={[styles.reviewerName, { color: theme.text }]}>Carlos M.</Text>
                                    <View style={styles.ratingRow}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} size={12} color="#D6B25E" fill={s <= 4 ? "#D6B25E" : "transparent"} />
                                        ))}
                                        <Text style={[styles.reviewDate, { color: theme.textSecondary }]}>2 hours ago</Text>
                                    </View>
                                </View>
                            </View>
                            <Text style={[styles.reviewText, { color: theme.text }]} numberOfLines={2}>
                                Excellent service and the food was amazing. The atmosphere is very cozy...
                            </Text>
                            <TouchableOpacity style={[styles.replyBtn, { borderColor: theme.primary + '40' }]}>
                                <Text style={[styles.replyBtnText, { color: theme.primary }]}>Reply</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                {/* Local Info Management */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>My Establishment</Text>
                </View>
                
                <TouchableOpacity style={[styles.manageCard, { backgroundColor: theme.card }]}>
                    <View style={[styles.manageIcon, { backgroundColor: theme.primary + '20' }]}>
                        <BarChart2 size={24} color={theme.primary} />
                    </View>
                    <View style={styles.manageText}>
                        <Text style={[styles.manageTitle, { color: theme.text }]}>Update Information</Text>
                        <Text style={[styles.manageDesc, { color: theme.textSecondary }]}>Photos, hours and description</Text>
                    </View>
                    <Settings size={20} color={theme.textSecondary} />
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        padding: 20,
        paddingTop: 10,
        paddingBottom: 40,
    },
    topSection: {
        marginBottom: 25,
        marginTop: 10,
    },
    welcomeText: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    businessName: {
        fontSize: 26,
        fontWeight: '900',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    switchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 14,
        gap: 8,
    },
    switchBtnText: {
        fontSize: 13,
        fontWeight: '800',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF4B4B',
        borderWidth: 2,
        borderColor: '#1C1F26',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 12,
    },
    statCard: {
        flex: 1,
        padding: 15,
        borderRadius: 20,
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    statTrend: {
        fontSize: 11,
        fontWeight: '800',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '900',
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    analyticsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 24,
        borderRadius: 24,
        marginBottom: 30,
        elevation: 4,
        shadowColor: '#D6B25E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    analyticsTitle: {
        color: '#1C1F26',
        fontSize: 18,
        fontWeight: '900',
    },
    analyticsSubtitle: {
        color: 'rgba(28, 31, 38, 0.7)',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 2,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    addBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
    },
    addBtnText: {
        fontSize: 13,
        fontWeight: '800',
    },
    announcementPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        marginBottom: 30,
        gap: 15,
    },
    announcementIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    announcementInfo: {
        flex: 1,
    },
    announcementTitleText: {
        fontSize: 16,
        fontWeight: '700',
    },
    announcementDesc: {
        fontSize: 13,
        fontWeight: '500',
    },
    seeAll: {
        fontSize: 14,
        fontWeight: '700',
    },
    reviewsList: {
        gap: 12,
        marginBottom: 30,
    },
    reviewItem: {
        padding: 16,
        borderRadius: 20,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    reviewerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    reviewerInfo: {
        flex: 1,
    },
    reviewerName: {
        fontSize: 15,
        fontWeight: '700',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    reviewDate: {
        fontSize: 11,
        fontWeight: '600',
        marginLeft: 4,
    },
    reviewText: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
        marginBottom: 15,
    },
    replyBtn: {
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    replyBtnText: {
        fontSize: 13,
        fontWeight: '800',
    },
    manageCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 20,
        gap: 15,
    },
    manageIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    manageText: {
        flex: 1,
    },
    manageTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    manageDesc: {
        fontSize: 13,
        fontWeight: '500',
    },
});
