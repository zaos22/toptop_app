import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { Filter, List, Navigation, Search } from 'lucide-react-native';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

/**
 * WEB VERSION OF MAPS
 * Since react-native-maps doesn't support web, we show a premium placeholder.
 * For a real production web app, we could use google-maps-react here.
 */
export default function MapScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.mapPlaceholder}>
                <Navigation size={64} color={theme.primary} />
                <Text style={[styles.placeholderText, { color: theme.text }]}>
                    Interactive Maps are Mobile-First.
                </Text>
                <Text style={[styles.placeholderSub, { color: theme.textSecondary }]}>
                    Explore the full map experience on our iOS and Android apps.
                </Text>

                <TouchableOpacity
                    style={[styles.backBtn, { backgroundColor: theme.primary }]}
                    onPress={() => router.push('/')}
                >
                    <List size={20} color="#1C1F26" />
                    <Text style={styles.backBtnText}>Go to Discovery List</Text>
                </TouchableOpacity>
            </View>

            {/* Top Search Overlay (keeps the UI consistent) */}
            <View style={[styles.topOverlay, { top: insets.top + 20 }]}>
                <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.card }]}>
                    <Search size={18} color={theme.textSecondary} />
                    <Text style={[styles.searchText, { color: theme.textSecondary }]}>Search nearby...</Text>
                    <Filter size={18} color={theme.primary} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    mapPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        textAlign: 'center',
    },
    placeholderText: {
        fontSize: 22,
        fontWeight: '800',
        marginTop: 24,
        textAlign: 'center',
    },
    placeholderSub: {
        fontSize: 14,
        marginTop: 12,
        textAlign: 'center',
        lineHeight: 20,
        maxWidth: 300,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 15,
        marginTop: 30,
        gap: 10,
    },
    backBtnText: {
        color: '#1C1F26',
        fontWeight: '700',
        fontSize: 16,
    },
    topOverlay: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        justifyContent: 'space-between',
    },
    searchText: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '500',
    },
});
