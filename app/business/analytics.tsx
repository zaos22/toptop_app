import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, Download, Info, TrendingUp, Users, MapPin, Star } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function BusinessAnalytics() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    // Mock data for charts (simplified for now without external libs)
    const weeklyData = [65, 80, 55, 90, 110, 145, 130];
    const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const maxVal = Math.max(...weeklyData);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Analíticas</Text>
                <TouchableOpacity style={styles.downloadBtn}>
                    <Download size={22} color={theme.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Period Selector */}
                <View style={[styles.periodSelector, { backgroundColor: theme.card }]}>
                    <Calendar size={18} color={theme.textSecondary} />
                    <Text style={[styles.periodText, { color: theme.text }]}>Últimos 7 días</Text>
                    <View style={styles.chevron} />
                </View>

                {/* Summary Section */}
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>2,482</Text>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Visitas al perfil</Text>
                        <View style={[styles.trendBadge, { backgroundColor: '#E1F5FE' }]}>
                            <TrendingUp size={12} color="#039BE5" />
                            <Text style={styles.trendText}>+18.4%</Text>
                        </View>
                    </View>
                    <View style={[styles.divider, { backgroundColor: theme.card }]} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: theme.text }]}>4.9</Text>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Rating Medio</Text>
                        <View style={[styles.trendBadge, { backgroundColor: '#F1F8E9' }]}>
                            <Star size={12} color="#7CB342" />
                            <Text style={[styles.trendText, { color: '#7CB342' }]}>Estable</Text>
                        </View>
                    </View>
                </View>

                {/* Performance Chart Mockup */}
                <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
                    <View style={styles.chartHeader}>
                        <Text style={[styles.chartTitle, { color: theme.text }]}>Visitas Semanales</Text>
                        <Info size={16} color={theme.textSecondary} />
                    </View>
                    
                    <View style={styles.barChart}>
                        {weeklyData.map((val, i) => (
                            <View key={i} style={styles.barWrapper}>
                                <View 
                                    style={[
                                        styles.bar, 
                                        { 
                                            height: (val / maxVal) * 150,
                                            backgroundColor: i === 5 ? theme.primary : theme.primary + '40'
                                        }
                                    ]} 
                                />
                                <Text style={[styles.barLabel, { color: theme.textSecondary }]}>{days[i]}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Audience Section */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Tu Audiencia</Text>
                </View>

                <View style={styles.audienceGrid}>
                    <View style={[styles.audienceCard, { backgroundColor: theme.card }]}>
                        <Users size={24} color={theme.primary} style={styles.audienceIcon} />
                        <Text style={[styles.audienceValue, { color: theme.text }]}>64%</Text>
                        <Text style={[styles.audienceLabel, { color: theme.textSecondary }]}>Nuevos Clientes</Text>
                    </View>
                    <View style={[styles.audienceCard, { backgroundColor: theme.card }]}>
                        <MapPin size={24} color={theme.primary} style={styles.audienceIcon} />
                        <Text style={[styles.audienceValue, { color: theme.text }]}>1.2km</Text>
                        <Text style={[styles.audienceLabel, { color: theme.textSecondary }]}>Radio Medio</Text>
                    </View>
                </View>

                {/* Insights List */}
                <View style={[styles.insightBox, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '20' }]}>
                    <TrendingUp size={24} color={theme.primary} />
                    <View style={styles.insightText}>
                        <Text style={[styles.insightTitle, { color: theme.text }]}>TopTip del Mes</Text>
                        <Text style={[styles.insightDesc, { color: theme.textSecondary }]}>
                            Tus visitas aumentan un 25% los sábados por la tarde. Considera lanzar una oferta "Happy Hour" para maximizar ingresos.
                        </Text>
                    </View>
                </View>
            </ScrollView>
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
        height: 60,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    downloadBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20, paddingBottom: 40 },
    periodSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 25,
        alignSelf: 'flex-start',
        gap: 8,
    },
    periodText: { fontSize: 14, fontWeight: '700' },
    summaryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryValue: { fontSize: 32, fontWeight: '900' },
    summaryLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginTop: 10,
        gap: 4,
    },
    trendText: { fontSize: 11, fontWeight: '800', color: '#039BE5' },
    divider: { width: 1, height: 60, marginHorizontal: 20 },
    chartContainer: {
        padding: 20,
        borderRadius: 24,
        marginBottom: 30,
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    chartTitle: { fontSize: 16, fontWeight: '800' },
    barChart: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 180,
        paddingTop: 10,
    },
    barWrapper: { alignItems: 'center', flex: 1 },
    bar: { width: 25, borderRadius: 6 },
    barLabel: { fontSize: 12, fontWeight: '700', marginTop: 10 },
    sectionHeader: { marginBottom: 15 },
    sectionTitle: { fontSize: 18, fontWeight: '800' },
    audienceGrid: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 30,
    },
    audienceCard: {
        flex: 1,
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
    },
    audienceIcon: { marginBottom: 12 },
    audienceValue: { fontSize: 24, fontWeight: '900' },
    audienceLabel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
    insightBox: {
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 15,
    },
    insightText: { flex: 1 },
    insightTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
    insightDesc: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
