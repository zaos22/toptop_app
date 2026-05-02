import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { ArrowLeft, BarChart3, Building2, CheckCircle2, MessageSquare, ShieldCheck, Star, Users } from 'lucide-react-native';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function BusinessLandingScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    const features = [
        {
            icon: <BarChart3 size={24} color={theme.primary} />,
            title: 'Advanced Analytics',
            description: 'Discover who visits you, what they think, and how to improve your TopTop score.'
        },
        {
            icon: <MessageSquare size={24} color={theme.primary} />,
            title: 'Review Management',
            description: 'Respond to your customers and retain users who value you positively.'
        },
        {
            icon: <ShieldCheck size={24} color={theme.primary} />,
            title: 'Verified Profile',
            description: 'Get the trust badge and stand out from the competition in the rankings.'
        },
        {
            icon: <Users size={24} color={theme.primary} />,
            title: 'Exclusive Reach',
            description: 'Appear in the top positions for premium users and foodies.'
        }
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <ArrowLeft size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>TopTop Business</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.heroSection}>
                    <LinearGradient
                        colors={[theme.primary + '30', 'transparent']}
                        style={styles.heroGradient}
                    />
                    <View style={[styles.iconBadge, { backgroundColor: theme.primary + '20' }]}>
                        <Building2 size={40} color={theme.primary} />
                    </View>
                    <Text style={[styles.heroTitle, { color: theme.text }]}>Take your venue to the next level</Text>
                    <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                        Join the most exclusive reviews platform and manage your reputation with professional tools.
                    </Text>
                </View>

                <View style={styles.featuresSection}>
                    {features.map((feature, index) => (
                        <View key={index} style={[styles.featureCard, { backgroundColor: theme.card }]}>
                            <View style={styles.featureIcon}>{feature.icon}</View>
                            <View style={styles.featureText}>
                                <Text style={[styles.featureTitle, { color: theme.text }]}>{feature.title}</Text>
                                <Text style={[styles.featureDesc, { color: theme.textSecondary }]}>{feature.description}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={[styles.infoBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.card }]}>
                    <CheckCircle2 size={20} color={theme.primary} />
                    <Text style={[styles.infoText, { color: theme.text }]}>
                        More than 500 establishments are already growing with TopTop.
                    </Text>
                </View>
            </ScrollView>

            <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.card }]}>
                <TouchableOpacity 
                    style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                    onPress={() => router.push('/business-request')}
                >
                    <Text style={styles.primaryBtnText}>Request Access</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.secondaryBtn}
                    onPress={() => {
                        // For preview purposes, we navigate directly to the dashboard
                        router.push('/business/dashboard');
                    }}
                >
                    <Text style={[styles.secondaryBtnText, { color: theme.text }]}>I am already a Manager (Log In)</Text>
                </TouchableOpacity>
            </View>
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
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    scrollContent: {
        padding: 25,
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: 40,
        marginTop: 20,
        position: 'relative',
    },
    heroGradient: {
        position: 'absolute',
        top: -100,
        left: 0,
        right: 0,
        height: 300,
        borderRadius: 150,
        transform: [{ scaleX: 2 }],
    },
    iconBadge: {
        width: 80,
        height: 80,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 15,
        lineHeight: 34,
    },
    heroSubtitle: {
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    featuresSection: {
        gap: 15,
        marginBottom: 30,
    },
    featureCard: {
        padding: 20,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 15,
    },
    featureIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 4,
    },
    featureDesc: {
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
    },
    infoText: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        gap: 12,
    },
    primaryBtn: {
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#D6B25E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    primaryBtnText: {
        color: '#1C1F26',
        fontSize: 16,
        fontWeight: '800',
    },
    secondaryBtn: {
        height: 56,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryBtnText: {
        fontSize: 15,
        fontWeight: '700',
    },
});
