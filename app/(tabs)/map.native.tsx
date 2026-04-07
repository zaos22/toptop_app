import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getGooglePlaceDetails, getPhotoUrl, searchNearbyPlaces, searchPlaces } from '@/services/googleMapsService';
import { getCurrentLocation } from '@/services/locationService';
import { locationStore } from '@/services/locationStore';
import { getCategoryFromTypes } from '@/utils/categoryUtils';
import { useFocusEffect, useRouter } from 'expo-router';
import { Navigation as NavIcon, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Keyboard, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { Extrapolate, FadeIn, FadeOut, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSettings } from '@/context/SettingsContext';

const { width } = Dimensions.get('window');

// Memoized Marker component to prevent flickering
const MapMarker = React.memo(({ item, theme, onPress }: any) => {
    const [tracksViewChanges, setTracksViewChanges] = React.useState(true);

    // Disable view tracking after initial render to stop flickering
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setTracksViewChanges(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <Marker
            coordinate={{ latitude: item.latitude, longitude: item.longitude }}
            onPress={onPress}
            tracksViewChanges={tracksViewChanges}
        >
            <View style={[styles.marker, { backgroundColor: theme.primary, borderColor: theme.background }]}>
                <Text style={styles.markerText}>{item.score}</Text>
            </View>
        </Marker>
    );
});

const darkMapStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#1C1F26" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#AEB4C0" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1C1F26" }] },
    { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#2E3440" }] },
    { "featureType": "landscape.man_made", "elementType": "geometry.fill", "stylers": [{ "color": "#252A34" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#D6B25E" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#2E3440" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#1C1F26" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#15181E" }] }
];


export default function MapScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const { halalEnabled } = useSettings();
    
    const theme = Colors[colorScheme as keyof typeof Colors ?? 'dark'] || Colors.dark;
    const [establishments, setEstablishments] = useState<any[]>([]);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [isCardVisible, setIsCardVisible] = useState(false);
    const [region, setRegion] = useState<any>(null);

    // Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const searchTimeoutRef = useRef<any>(null);
    const mapRef = useRef<MapView>(null);
    const translateX = useSharedValue(0);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            translateX.value = event.translationX;
        })
        .onEnd((event) => {
            const swipeThreshold = width * 0.15;
            if (Math.abs(event.translationX) > swipeThreshold) {
                const targetX = event.translationX > 0 ? width : -width;
                translateX.value = withTiming(targetX, { duration: 250 }, (finished) => {
                    if (finished) {
                        runOnJS(setIsCardVisible)(false);
                        // We keep the selectedItem data for a moment so the exiting animation 
                        // has something to render, but the card is no longer "visible" to the user
                    }
                });
            } else {
                translateX.value = withSpring(0, { damping: 20, stiffness: 90 });
            }
        });

    const animatedCardStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }],
            opacity: interpolate(Math.abs(translateX.value), [0, width * 0.7], [1, 0], Extrapolate.CLAMP),
        };
    });

    // Handle local region state and map synchronization
    const updateRegion = useCallback((lat: number, lng: number, animate: boolean = true) => {
        const newRegion = {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        };
        
        setRegion(newRegion);
        if (animate && mapRef.current) {
            mapRef.current.animateToRegion(newRegion, 1000);
        }
        loadData(lat, lng);
    }, []);

    // Revert to predefined location and clear cards whenever we go back to the map tab
    useFocusEffect(
        useCallback(() => {
            const stored = locationStore.getLocation();
            if (stored) {
                updateRegion(stored.lat, stored.lng, true);
            } else {
                initMap();
            }
            setIsCardVisible(false);
            setSelectedItem(null);
            setSearchQuery('');
            setShowSearchResults(false);
        }, [updateRegion])
    );

    // Effect to clear data after dismissal animation finishes
    useEffect(() => {
        if (!isCardVisible && selectedItem) {
            const timer = setTimeout(() => {
                setSelectedItem(null);
                translateX.value = 0;
            }, 300); // Matches animation duration (250ms) + buffer
            return () => clearTimeout(timer);
        }
    }, [isCardVisible, selectedItem]);

    // Use a ref for current region to avoid subscription dependency cycle
    const regionRef = useRef(region);
    useEffect(() => {
        regionRef.current = region;
    }, [region]);

    useEffect(() => {
        // Subscribe to global location changes
        const unsubscribe = locationStore.subscribe((location) => {
            // Check if we are already showing this general area to avoid unnecessary jumps
            const currentRegion = regionRef.current;
            let shouldAnimate = true;
            
            if (currentRegion) {
                const diffLat = Math.abs(currentRegion.latitude - location.lat);
                const diffLng = Math.abs(currentRegion.longitude - location.lng);
                // If the difference is tiny (user likely didn't change city/zone), don't force-jump
                // Also helps avoid jumping back after selecting a search result
                if (diffLat < 0.001 && diffLng < 0.001) {
                    shouldAnimate = false;
                }
            }

            if (shouldAnimate) {
                setSelectedItem(null);
                updateRegion(location.lat, location.lng, true);
            }
        });

        return () => {
            unsubscribe();
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [updateRegion]);

    const performSearch = async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        setShowSearchResults(true);

        try {
            // Append "halal" to search query if needed
            let finalQuery = query;
            if (halalEnabled && !query.toLowerCase().includes('halal')) {
                finalQuery = `${query} halal`;
            }

            const places = await searchPlaces(finalQuery, region?.latitude, region?.longitude);

            // Filter to only include physical establishments with location data
            const formattedPlaces = places
                .filter((item: any) => item.geometry?.location)
                .map((item: any) => {
                    // Cleaner address logic: use formatted_address if available, otherwise vicinity
                    let address = item.formatted_address || item.vicinity || '';
                    
                    // Simple cleaning for map context: remove country if it's redundant
                    if (address.endsWith(', España')) {
                        address = address.replace(', España', '');
                    }

                    return {
                        id: item.place_id,
                        name: item.name,
                        category: getCategoryFromTypes(item.types, item.name),
                        score: item.rating || 0,
                        address: address,
                        photo: item.photos?.[0]?.photo_reference ? getPhotoUrl(item.photos[0].photo_reference, 200) : null,
                        latitude: item.geometry.location.lat,
                        longitude: item.geometry.location.lng
                    };
                });

            setSearchResults(formattedPlaces);
        } catch (error) {
            console.error('Map search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchInputChange = (text: string) => {
        setSearchQuery(text);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (text.trim().length > 1) {
            searchTimeoutRef.current = setTimeout(() => {
                performSearch(text);
            }, 300);
        } else {
            setShowSearchResults(false);
        }
    };

    const selectSearchResult = (item: any) => {
        if (!item || !item.latitude || !item.longitude) {
            console.warn('Selected item missing coordinates');
            return;
        }

        Keyboard.dismiss();
        
        // Hide search results and clean up search bar immediately
        setShowSearchResults(false);
        setSearchQuery('');
        
        // Set item and show card immediately with reset animation value
        const enrichedItem = {
            ...item,
            image: item.photo || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80',
            price: item.price || '$$'
        };
        
        translateX.value = 0;
        setSelectedItem(enrichedItem);
        setIsCardVisible(true);

        const newRegion = {
            latitude: item.latitude,
            longitude: item.longitude,
            latitudeDelta: 0.001, // Zoomed in closer as requested
            longitudeDelta: 0.001,
        };

        // Move map
        if (mapRef.current) {
            mapRef.current.animateToRegion(newRegion, 800);
        }
        setRegion(newRegion);
        
        // Add it manually to the establishments list so the pin is immediately there
        setEstablishments(prev => {
            const exists = prev.find(e => e.id === item.id);
            if (exists) return prev;
            return [enrichedItem, ...prev];
        });

        // Load extra data for that location
        loadData(item.latitude, item.longitude);
    };

    const handleMarkerPress = (item: any) => {
        translateX.value = 0;
        setSelectedItem(item);
        setIsCardVisible(true);
        
        // Center map on marker with zoom
        const newReg = {
            latitude: item.latitude,
            longitude: item.longitude,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
        };
        setRegion(newReg);
        mapRef.current?.animateToRegion(newReg, 600);
    };

    const handleNavigate = (item: any) => {
        const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
        const latLng = `${item.latitude},${item.longitude}`;
        const label = item.name;
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`
        });

        if (url) {
            Linking.openURL(url);
        }
    };

    const handlePoiClick = async (event: any) => {
        const { placeId, name, coordinate } = event.nativeEvent;
        if (!placeId) return;

        // Immediately set a partial object so the user sees something is happening
        // (will be updated once details are fetched)
        setSelectedItem({
            id: placeId,
            name: name,
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            category: 'Loading...',
            score: 0,
            price: '$$',
            image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80'
        });
        translateX.value = 0;
        setIsCardVisible(true);

        try {
            const details = await getGooglePlaceDetails(placeId);
            if (details) {
                setSelectedItem({
                    id: placeId,
                    name: details.name || name,
                    category: getCategoryFromTypes(details.types, details.name || name),
                    score: details.rating || 0,
                    price: '$'.repeat(details.price_level || 2),
                    image: details.photos?.[0]
                        ? getPhotoUrl(details.photos[0].photo_reference, 400)
                        : 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80',
                    latitude: details.geometry.location.lat,
                    longitude: details.geometry.location.lng,
                    address: details.formatted_address
                });
            }
        } catch (error) {
            console.error('Error fetching POI details:', error);
        }
    };

    const initMap = async (forceGps: boolean = false) => {
        // 1. First, check if we have a stored location
        const stored = locationStore.getLocation();
        
        // If we have a stored location and aren't forcing GPS, just use it
        if (stored && !forceGps) {
            updateRegion(stored.lat, stored.lng, false);
            return;
        }

        // 2. Otherwise (or if forcing GPS), try to get the REAL current location
        const location = await getCurrentLocation();
        if (location) {
            const name = "Current Location";
            const newLoc = { lat: location.latitude, lng: location.longitude, name };
            
            // Save to store so other screens (like the feed) also update
            locationStore.setLocation(newLoc);
            updateRegion(location.latitude, location.longitude, true);
        } else if (!stored) {
            // 3. Absolute fallback only if we have NOTHING
            const madrid = {
                latitude: 40.4168,
                longitude: -3.7038,
            };
            updateRegion(madrid.latitude, madrid.longitude, false);
        }
    };

    const loadData = async (lat: number, lng: number) => {
        // Fetch multiple types to provide a better mix
        let types = ['restaurant', 'lodging', 'tourist_attraction', 'gas_station', 'convenience_store'];
        
        // If Halal mode is enabled, we prioritize food categories and search for halal specifically
        if (halalEnabled) {
            types = ['restaurant', 'cafe', 'meal_takeaway', 'bakery', 'supermarket'];
        }

        try {
            // We'll perform multiple searches to get a mix of categories
            const searchPromises = types.map(type => {
                // If halal is enabled, we add it as a keyword to the nearby search
                // Note: nearbysearch text query is messy, better use textsearch or append keyword if supported
                // For now, we search normally but we could also filter results after
                return searchNearbyPlaces(lat, lng, type);
            });
            const resultsArrays = await Promise.all(searchPromises);

            // Flatten and remove duplicates by place_id
            const allResults = resultsArrays.flat();
            const uniqueResults = Array.from(new Map(allResults.map((item: any) => [item.place_id, item])).values());

            const formatted = uniqueResults
                .filter((item: any) => (item.user_ratings_total || 0) > 0)
                .map((item: any) => ({
                    id: item.place_id,
                    name: item.name,
                    category: getCategoryFromTypes(item.types, item.name),
                    score: item.rating || 0,
                    price: '$'.repeat(item.price_level || 2),
                    image: item.photos?.[0]
                        ? getPhotoUrl(item.photos[0].photo_reference, 400)
                        : 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80',
                    latitude: item.geometry.location.lat,
                    longitude: item.geometry.location.lng,
                    address: item.vicinity || ''
                }));
            
            // Post-filter if Halal enabled and we want to be strict (though nearbysearch is broad)
            setEstablishments(formatted);
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={styles.container}>
                {region ? (
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        initialRegion={region}
                        onPoiClick={handlePoiClick}
                        showsUserLocation={true}
                        showsMyLocationButton={false}
                        customMapStyle={colorScheme?.toLowerCase().includes('dark') ? darkMapStyle : []}
                    >
                        {establishments.map((item: any) => (
                            <MapMarker
                                key={item.id}
                                item={item}
                                theme={theme}
                                onPress={() => {
                                    handleMarkerPress(item);
                                }}
                            />
                        ))}

                        {/* Force show selected item marker if not already in the main list */}
                        {selectedItem && !establishments.find(e => e.id === selectedItem.id) && (
                            <MapMarker
                                key={`selected-${selectedItem.id}`}
                                item={selectedItem}
                                theme={theme}
                                onPress={() => handleMarkerPress(selectedItem)}
                            />
                        )}
                    </MapView>
                ) : (
                    <View style={[styles.centered, { backgroundColor: theme.background }]}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={{ color: theme.textSecondary, marginTop: 15, fontWeight: '600' }}>Cargando mapa...</Text>
                    </View>
                )}

                <View style={styles.topOverlay}>
                    <View style={[styles.searchBar, { backgroundColor: theme.background, borderColor: theme.card }]}>
                        <Search size={18} color={theme.textSecondary} />
                        <TextInput
                            placeholder="Buscar un lugar..."
                            placeholderTextColor={theme.textSecondary}
                            style={[styles.searchInput, { color: theme.text }]}
                            value={searchQuery}
                            onChangeText={handleSearchInputChange}
                            onFocus={() => {
                                if (searchQuery.trim().length > 1) setShowSearchResults(true);
                            }}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => { setSearchQuery(''); setShowSearchResults(false); }}>
                                <X size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {showSearchResults && (
                        <Animated.View
                            entering={FadeIn}
                            exiting={FadeOut}
                            style={[styles.searchResults, { backgroundColor: theme.background, borderColor: theme.card }]}
                        >
                            {isSearching ? (
                                <ActivityIndicator style={{ padding: 20 }} color={theme.primary} />
                            ) : (
                                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>
                                    {searchResults.length > 0 ? (
                                        searchResults.map((item) => (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={[styles.searchResultItem, { borderBottomColor: theme.card }]}
                                                onPress={() => selectSearchResult(item)}
                                            >
                                                <View style={styles.searchResultLeft}>
                                                    <Image
                                                        source={{ uri: item.photo || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=200&q=80' }}
                                                        style={styles.searchResultThumb}
                                                    />
                                                    <View style={styles.searchResultInfo}>
                                                        <Text style={[styles.searchResultName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                                                        <Text style={[styles.searchResultSub, { color: theme.textSecondary }]} numberOfLines={1}>{item.address}</Text>
                                                    </View>
                                                </View>
                                                <View style={[styles.searchResultScore, { backgroundColor: theme.primary }]}>
                                                    <Text style={styles.searchResultScoreText}>{item.score}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))
                                    ) : (
                                        <View style={{ padding: 30, alignItems: 'center' }}>
                                            <Search size={32} color={theme.textSecondary} opacity={0.3} style={{ marginBottom: 10 }} />
                                            <Text style={{ color: theme.textSecondary, textAlign: 'center', fontWeight: '500' }}>No se encontraron lugares cerca de ti</Text>
                                        </View>
                                    )}
                                </ScrollView>
                            )}
                        </Animated.View>
                    )}
                </View>

                {/* Floating "My Location" Button */}
                <TouchableOpacity
                    style={[styles.myLocationBtn, { backgroundColor: theme.background, borderColor: theme.card }]}
                    onPress={() => initMap(true)}
                >
                    <NavIcon size={20} color={theme.primary} />
                </TouchableOpacity>

                {selectedItem && isCardVisible && (
                    <GestureDetector gesture={panGesture}>
                        <Animated.View
                            entering={FadeIn.duration(300)}
                            exiting={FadeOut.duration(200)}
                            style={[styles.cardWrapper, animatedCardStyle]}
                        >
                            <TouchableOpacity
                                style={[styles.card, { backgroundColor: theme.card }]}
                                onPress={() => router.push(`/establishment/${selectedItem.id}`)}
                                activeOpacity={1}
                            >
                                <Image source={{ uri: selectedItem.image }} style={styles.cardImage} />
                                <View style={styles.cardInfo}>
                                    <View style={styles.cardHeader}>
                                        <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>{selectedItem.name}</Text>
                                        <View style={[styles.cardScore, { backgroundColor: theme.ranking1 }]}>
                                            <Text style={styles.cardScoreText}>{selectedItem.score}</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{selectedItem.category} • {selectedItem.price}</Text>
                                    <View style={styles.cardActions}>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                router.push(`/establishment/${selectedItem.id}`);
                                            }}
                                        >
                                            <Text style={styles.actionBtnText}>Ver Detalles</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.iconAction, { backgroundColor: theme.backgroundSecondary }]}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleNavigate(selectedItem);
                                            }}
                                        >
                                            <NavIcon size={16} color={theme.primary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </Animated.View>
                    </GestureDetector>
                )}
            </View>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topOverlay: { position: 'absolute', top: 60, left: 20, right: 20 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '500',
    },
    searchResults: {
        marginTop: 10,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderBottomWidth: 1,
    },
    searchResultLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    searchResultThumb: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginRight: 12,
    },
    searchResultInfo: {
        flex: 1,
        marginRight: 10, // Ensure space before the score pill
    },
    searchResultName: {
        fontSize: 14,
        fontWeight: '700',
    },
    searchResultSub: {
        fontSize: 12,
    },
    searchResultScore: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginLeft: 10,
    },
    searchResultScoreText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#1C1F26',
    },
    marker: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 2 },
    markerText: { color: '#1C1F26', fontWeight: '800', fontSize: 12 },
    cardWrapper: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
    },
    card: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    cardImage: { width: 100, height: 100, borderRadius: 15 },
    cardInfo: { flex: 1, marginLeft: 15, justifyContent: 'center' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    cardName: { fontSize: 18, fontWeight: '700', flex: 1 },
    cardScore: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 10 },
    cardScoreText: { fontSize: 12, fontWeight: '800', color: '#1C1F26' },
    cardSub: { fontSize: 12, marginBottom: 10 },
    cardActions: { flexDirection: 'row', alignItems: 'center' },
    actionBtn: {
        flex: 1,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    actionBtnText: { fontSize: 13, fontWeight: '700', color: '#1C1F26' },
    iconAction: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    myLocationBtn: {
        position: 'absolute',
        top: 120,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
});
