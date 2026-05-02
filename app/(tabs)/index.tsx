import { BounceMarqueeText } from '@/components/BounceMarqueeText';
import GemCarousel from '@/components/GemCarousel';
import RankingBlock from '@/components/RankingBlock';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useSettings } from '@/context/SettingsContext';
import { Establishment } from '@/services/establishmentService';
import { getGooglePlaceDetails, getPhotoUrl, getPlaceGeometry, searchLocations, searchNearbyPlaces, searchPlaces } from '@/services/googleMapsService';
import { getUserProfile, searchUsers, UserProfile } from '@/services/userProfileService';
import { getCategoryFromTypes, isCompatibleWithRanking } from '@/utils/categoryUtils';
import { getPriceInfo } from '@/utils/priceUtils';
import { CATEGORY_DEFINITIONS, formatPlaces } from '@/utils/rankingDefinitions';
import { getDefaultAvatarUrl } from '@/utils/userUtils';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Bell, MapPin, Search, Star, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { establishmentFollowService } from '@/services/establishmentFollowService';
import { Heart } from 'lucide-react-native';



import { getCityCountryFromCoordinates } from '@/services/locationService';
import { locationStore } from '@/services/locationStore';
import * as Location from 'expo-location';

export default function TopScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme as keyof typeof Colors] || Colors.dark;
  const { halalEnabled } = useSettings();

  const [loading, setLoading] = useState(true);
  const [hiddenGems, setHiddenGems] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('top');
  const prevCategoryRef = useRef<string>('top');
  const [locationName, setLocationName] = useState('Current Location');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [rankingsData, setRankingsData] = useState<Record<string, any[]>>({});
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const { user } = useAuth();
  const [followedPlaceIds, setFollowedPlaceIds] = useState<string[]>([]);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [lastSearchedLabel, setLastSearchedLabel] = useState('');
  const [searchResults, setSearchResults] = useState<{ establishments: any[], users: UserProfile[] }>({
    establishments: [],
    users: []
  });
  const searchTimeoutRef = useRef<any>(null);
  const blurTimeoutRef = useRef<any>(null);

  const SUGGESTIONS = [
    { label: '🍕 Pizza near me', query: 'pizza' },
    { label: '🥙 Kebab', query: 'kebab' },
    { label: '🍔 Burger', query: 'hamburger' },
    { label: '🏨 Hotels', query: 'hotel' },
    { label: '🚗 Car Rental', query: 'car rental' },
    { label: '🛍️ Clothing', query: 'clothing store' },
    { label: '☕ Coffee Shop', query: 'coffee shop' },
    { label: '🍣 Sushi', query: 'japanese restaurant' },
    { label: '💇 Hair Salon', query: 'hair salon' },
    { label: '🏋️ Gym', query: 'gym' },
    { label: '🚘 Car Dealer', query: 'car dealership' },
    { label: '⛽ Gas Station', query: 'gas station' },
  ];

  // Location selection states
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationPredictions, setLocationPredictions] = useState<any[]>([]);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  // 1. Initial location detection
  const initLocation = React.useCallback(async (forceUpdate: boolean = false) => {
    try {
      // 1. Show saved location immediately for speed
      const savedLocation = locationStore.getLocation();
      if (savedLocation && !forceUpdate) {
        setLocationName(savedLocation.name);
        setUserLocation({ lat: savedLocation.lat, lng: savedLocation.lng });
      }

      // 2. Request fresh location to ensure accuracy
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!savedLocation) {
          setLocationName('Permission Denied');
          setUserLocation({ lat: 40.4168, lng: -3.7038 });
        }
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      if (location) {
        const lat = location.coords.latitude;
        const lng = location.coords.longitude;

        // Only update everything if it's significantly different or we forced it
        if (forceUpdate || !savedLocation || Math.abs(savedLocation.lat - lat) > 0.005) {
          const address = await getCityCountryFromCoordinates(lat, lng);
          const name = address || 'Current Location';
          setLocationName(name);
          const newLoc = { lat, lng };
          setUserLocation(newLoc);
          locationStore.setLocation({ lat, lng, name });
        }
      } else if (!savedLocation) {
        setLocationName('Location Disabled');
        setUserLocation({ lat: 40.4168, lng: -3.7038 });
      }
    } catch (error) {
      console.error('Error initializing location:', error);
      if (!locationStore.getLocation()) {
        setLocationName('Error getting location');
        setUserLocation({ lat: 40.4168, lng: -3.7038 });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFollows = async () => {
    if (!user) {
      setFollowedPlaceIds([]);
      return;
    }
    const followedIds = await establishmentFollowService.getFollowedPlaceIds(user.id);
    setFollowedPlaceIds(followedIds);
  };

  useEffect(() => {
    fetchFollows();
  }, [user]);

  const handleFollowToggle = async (item: any) => {
    if (!user) {
      Alert.alert(
        'Log In',
        'You must log in to follow establishments and see their latest news.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => router.push('/login') }
        ]
      );
      return;
    }

    const isFollowing = followedPlaceIds.includes(item.id);
    const newFollows = isFollowing 
      ? followedPlaceIds.filter(id => id !== item.id)
      : [...followedPlaceIds, item.id];
    
    setFollowedPlaceIds(newFollows);

    if (isFollowing) {
      await establishmentFollowService.unfollowEstablishment(user.id, item.id);
    } else {
      await establishmentFollowService.followEstablishment(user.id, item.id, item.name);
    }
  };

  // 2. Data Loading logic
  const loadData = async () => {
    if (!userLocation) return;
    setLoading(true);
    try {
      const results = await searchNearbyPlaces(userLocation.lat, userLocation.lng);

      const gems = [];
      for (const item of results) {
        const rating = item.rating || 0;
        const reviewCount = item.user_ratings_total || 0;
        const isGem = rating >= 4.0 && reviewCount < 300;

        if (isGem) {
          // Halal Filter for Hidden Gems
          if (halalEnabled) {
            const types = item.types || [];
            const haramTypes = ['night_club', 'bar', 'liquor_store', 'distillery', 'winery'];
            const hasHaramType = types.some((t: string) => haramTypes.includes(t));
            const sName = item.name.toLowerCase();
            const hasHaramName = sName.includes('nightclub') || sName.includes('disco') || sName.includes('club') || sName.includes('bar') || sName.includes('drinks') || sName.includes('pub') || sName.includes('cocktail');
            if (hasHaramType || hasHaramName) continue;
          }

          let photos = item.photos?.length
            ? item.photos.slice(0, 5).map((p: any) => ({ uri: getPhotoUrl(p.photo_reference, 400), type: 'image' as const }))
            : [{ uri: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', type: 'image' as const }];

          try {
            const details = await getGooglePlaceDetails(item.place_id);
            if (details && details.photos && details.photos.length > 1) {
              photos = details.photos.slice(0, 5).map((p: any) => ({ uri: getPhotoUrl(p.photo_reference, 400), type: 'image' as const }));
            }
          } catch (e) { }

          gems.push({
            id: item.place_id,
            name: item.name,
            category: getCategoryFromTypes(item.types, item.name),
            score: rating,
            reviewCount,
            media: photos,
            isGem: true,
            address: item.vicinity,
            distance: 'Near you',
            rating: rating
          });
        }
      }
      setHiddenGems(gems);
    } catch (err) {
      console.error('Error loading gems:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Search logic
  const performSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults({ establishments: [], users: [] });
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    setShowSearchResults(true);

    // Build a smart query: if the user didn't mention a location keyword,
    // append the current location name so Google can bias results geographically.
    const locationKeywords = ['in ', 'at ', 'near ', 'in the'];
    const hasLocation = locationKeywords.some(kw => trimmed.toLowerCase().includes(kw));
    const enrichedQuery = (!hasLocation && locationName && locationName !== 'Current Location' && locationName !== 'Error getting location')
      ? `${trimmed} in ${locationName}`
      : trimmed;

    // Further enrich with Halal keyword if enabled
    const finalQuery = (halalEnabled && !enrichedQuery.toLowerCase().includes('halal'))
      ? `${enrichedQuery} halal`
      : enrichedQuery;

    setLastSearchedLabel(finalQuery);

    try {
      if (trimmed.startsWith('@')) {
        const users = await searchUsers(trimmed, halalEnabled);
        setSearchResults({ establishments: [], users });
      } else {
        const [places, users] = await Promise.all([
          searchPlaces(finalQuery, userLocation?.lat, userLocation?.lng),
          searchUsers(trimmed, halalEnabled)
        ]);

        const formatted = places
          .filter((item: any) => {
            if (!halalEnabled) return true;
            const types = item.types || [];
            const haramTypes = ['night_club', 'bar', 'liquor_store', 'distillery', 'winery'];
            const hasHaramType = types.some((t: string) => haramTypes.includes(t));
            const sName = item.name.toLowerCase();
            const hasHaramName = sName.includes('nightclub') || sName.includes('disco') || sName.includes('club') || sName.includes('bar') || sName.includes('drinks') || sName.includes('pub') || sName.includes('cocktail');
            return !(hasHaramType || hasHaramName);
          })
          .map((item: any) => ({
            id: item.place_id,
            name: item.name,
            category: getCategoryFromTypes(item.types, item.name),
            score: item.rating || 0,
            reviewCount: item.user_ratings_total || 0,
            address: item.formatted_address || item.vicinity,
            photo: item.photos?.[0]?.photo_reference ? getPhotoUrl(item.photos[0].photo_reference, 200) : null,
            priceLevel: item.price_level,
            rawTypes: item.types || [],
          }));
        setSearchResults({ establishments: formatted, users });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Re-fetches fresh profile data for the found users directly from the profiles
   * table (no syncUserStats — that would corrupt other users' data via RLS).
   * The profiles table is kept up-to-date by safeIncrementFollowers/safeDecrementFollowers
   * on every follow/unfollow action.
   */
  const refreshUserResults = async (initialUsers: UserProfile[]) => {
    try {
      const usersToRefresh = initialUsers.slice(0, 5);

      // Just re-read the current profiles — no sync, no RLS corruption risk
      const freshProfiles = await Promise.all(
        usersToRefresh.map(u => getUserProfile(u.uid))
      );

      const updated = freshProfiles.filter(Boolean) as UserProfile[];
      if (updated.length === 0) return;

      setSearchResults(prev => {
        const updatedMap = new Map(updated.map(u => [u.uid, u]));
        return {
          ...prev,
          users: prev.users.map(u => updatedMap.get(u.uid) ?? u),
        };
      });
    } catch (e) {
      console.warn('[Search] Background user refresh failed:', e);
    }
  };

  // 4. Interaction Handlers
  const handleSearchInputChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (text.trim().length > 2) {
      searchTimeoutRef.current = setTimeout(() => performSearch(text), 600);
    } else if (text.trim().length === 0) {
      setShowSearchResults(false);
      setLastSearchedLabel('');
    }
  };

  const handleSuggestionPress = (query: string) => {
    // Cancel the pending blur so isSearchFocused stays true long enough
    // for the chip's onPress to fire before we hide the chips
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setSearchQuery(query);
    setShowSearchResults(true);
    performSearch(query);
    // Now we can safely let focus go
    setIsSearchFocused(false);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim().length > 0) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      performSearch(searchQuery);
    }
  };

  const closeSearch = () => {
    setShowSearchResults(false);
    setIsSearchFocused(false);
    setLastSearchedLabel('');
    setSearchQuery('');
    setSearchResults({ establishments: [], users: [] });
  };

  const handleLocationSearch = async (text: string) => {
    setLocationSearchQuery(text);
    if (!text.trim()) {
      setLocationPredictions([]);
      return;
    }
    setIsSearchingLocation(true);
    try {
      const resp = await searchLocations(text);
      setLocationPredictions(resp);
    } catch (e) { } finally {
      setIsSearchingLocation(false);
    }
  };

  const selectLocation = async (prediction: any) => {
    try {
      setLoading(true);
      setShowLocationPicker(false);
      const coords = await getPlaceGeometry(prediction.place_id);
      if (coords) {
        const name = prediction.description.split(',').slice(0, 2).join(', ');
        setLocationName(name);
        setIsManualLocation(true);
        const newLoc = { lat: coords.lat, lng: coords.lng };
        setUserLocation(newLoc);
        locationStore.setLocation({ ...newLoc, name });
      }
    } catch (e) { } finally {
      setLoading(false);
    }
  };

  const useCurrentLocation = () => {
    setIsManualLocation(false);
    setShowLocationPicker(false);
    setLoading(true);
    initLocation(true);
  };

  const [lastFetchedLocation, setLastFetchedLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Helper to calculate distance between two points in meters
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchAllRankings = async () => {
    if (!userLocation) return;

    // OPTIMIZATION: Check if we moved enough to justify new API calls
    const categoryChanged = prevCategoryRef.current !== activeCategory;
    
    if (lastFetchedLocation && !categoryChanged) {
      const distanceMoved = getDistance(
        lastFetchedLocation.lat,
        lastFetchedLocation.lng,
        userLocation.lat,
        userLocation.lng
      );
      // If moved less than 500 meters, don't re-fetch unless forced
      if (distanceMoved < 500) {
        console.log('Skipping API fetch: User moved only', Math.round(distanceMoved), 'm');
        setRankingsLoading(false);
        return;
      }
    }
    
    prevCategoryRef.current = activeCategory;

    const activeCat = CATEGORY_DEFINITIONS.find(c => c.id === activeCategory);
    if (!activeCat) return;

    const minLoadingPromise = new Promise(resolve => setTimeout(resolve, 600));

    try {
      const subcategories = activeCat.subcategories.filter(sub => {
        if (!halalEnabled) return true;
        const sId = sub.id.toLowerCase();
        const sQ = (sub.query || '').toLowerCase();
        const sT = sub.title.toLowerCase();
        return !(sId.includes('club') || sId.includes('nightlife') || sId.includes('bar') || sId.includes('pub') || sId.includes('cocktail') || sId.includes('karaoke') ||
          sQ.includes('nightclub') || sQ.includes('disco') || sQ.includes('bar') || sQ.includes('pub') ||
          sT.includes('clubs') || sT.includes('night') || sT.includes('bars') || sT.includes('drinks'));
      });

      const usedIdsSet = new Set<string>();
      const resultsMap: Record<string, any[]> = {};
      const isWorldMode = activeCat.id === 'global_top';

      // OPTIMIZATION: Run subcategory queries in batches or parallel to speed up UX
      // We process them in chunks of 3 to avoid hitting browser/native connection limits
      const subChunks = [];
      for (let i = 0; i < subcategories.length; i += 3) {
        subChunks.push(subcategories.slice(i, i + 3));
      }

      for (const chunk of subChunks) {
        await Promise.all(chunk.map(async (sub) => {
          let rawResults = [];
          const isWorld = (sub as any).isWorld === true || isWorldMode;

          if (sub.type && !sub.query) {
            rawResults = await searchNearbyPlaces(
              isWorld ? 0 : userLocation.lat,
              isWorld ? 0 : userLocation.lng,
              sub.type
            );
          } else if (sub.query) {
            let q = isWorld ? sub.query : `${sub.query} in ${locationName}`;
            const isFoodRelated = activeCategory === 'food' ||
              sub.title.toLowerCase().includes('food') ||
              sub.title.toLowerCase().includes('gastro') ||
              sub.query.toLowerCase().includes('restaurant') ||
              sub.query.toLowerCase().includes('cafe');

            if (halalEnabled && isFoodRelated) {
              q = `${q} halal`;
            }

            rawResults = await searchPlaces(
              q,
              isWorld ? undefined : userLocation.lat,
              isWorld ? undefined : userLocation.lng,
              sub.type
            );
          }

          // Strict Filter Logic
          const filtered = rawResults.filter((item: any) => {
            // Category-specific filters
            const detectedCategory = getCategoryFromTypes(item.types, item.name);
            if (!isCompatibleWithRanking(detectedCategory, sub.title, sub.id)) return false;

            const nameLower = item.name.toLowerCase();
            if (sub.id.includes('nightclub') || sub.id.includes('disco') || sub.id.includes('bar') || sub.type === 'night_club') {
              const isLikelyRestaurant = nameLower.includes('restaurant') || nameLower.includes('kitchen') || nameLower.includes('grill') || nameLower.includes('steakhouse');
              if (isLikelyRestaurant && !(nameLower.includes('disco') || nameLower.includes('club'))) return false;
            }

            if (halalEnabled) {
              const types = item.types || [];
              const haramTypes = ['night_club', 'bar', 'liquor_store', 'distillery', 'winery'];
              if (types.some((t: string) => haramTypes.includes(t))) return false;
              if (nameLower.includes('nightclub') || nameLower.includes('disco') || nameLower.includes('club') || nameLower.includes('bar') || nameLower.includes('drinks') || nameLower.includes('pub')) return false;
            }

            return true;
          });

          const formatted = formatPlaces(filtered);

          // deduplicate across rankings in the same category
          const uniqueFormatted = formatted.filter(item => {
            if (usedIdsSet.has(item.id)) return false;
            return true;
          });

          // threshold lowered to 1 based on previous improvements
          if (uniqueFormatted.length < 1) {
            resultsMap[sub.id] = [];
            return;
          }

          const sorted = uniqueFormatted.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (b.reviewCount || 0) - (a.reviewCount || 0);
          }).slice(0, 3);

          sorted.forEach(item => usedIdsSet.add(item.id));
          resultsMap[sub.id] = sorted;
        }));
      }

      setLastFetchedLocation({ ...userLocation });
      await minLoadingPromise;
      setRankingsData(prev => ({ ...prev, ...resultsMap }));
    } catch (error) {
      console.error('Error fetching rankings:', error);
    } finally {
      setRankingsLoading(false);
    }
  };

  // 5. Effects
  useEffect(() => {
    if (!isManualLocation) initLocation();
  }, [initLocation, isManualLocation]);

  useEffect(() => {
    if (userLocation) {
      loadData();
    }
  }, [userLocation]);

  // Fetch rankings for the active category
  useEffect(() => {
    // Force a stable loading state to prevent flickering between categories
    setRankingsLoading(true);

    // Use a small timeout to let the previous layout clear before fetching/showing new
    const timer = setTimeout(() => {
      fetchAllRankings();
    }, 100);

    return () => clearTimeout(timer);
  }, [activeCategory, userLocation, halalEnabled]);

  // Add focus effect to refresh follows
  useFocusEffect(
    React.useCallback(() => {
      fetchFollows();
    }, [user])
  );

  // 7. Renderings
  const renderGem = ({ item }: { item: Establishment }) => {
    return (
      <View key={item.id} style={styles.gemCard}>
        <GemCarousel
          media={item.media || [{ uri: item.image || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=80', type: 'image' as const }]}
          width={220}
          height={280}
          onPress={() => router.push(`/establishment/${item.id}`)}
          autoPlay={true}
          autoPlayInterval={3000}
        />
        <View style={styles.gemOverlay}>
          <View style={[styles.ratingBadge, { backgroundColor: theme.ranking1 }]}>
            <Text style={styles.ratingText}>{item.rating || item.score}</Text>
          </View>
        </View>
        <View style={styles.gemInfo}>
          <BounceMarqueeText
            text={item.name}
            style={[styles.gemName, { color: '#fff' }]}
            containerStyle={{ width: '100%' }}
          />
          <Text style={[styles.gemSub, { color: 'rgba(255,255,255,0.7)' }]}>{item.category} • {item.distance || 'Near you'}</Text>
        </View>
      </View>
    );
  };


  const renderSearchResultItem = (item: any, type: 'establishment' | 'user') => {
    if (type === 'user') {
      return (
        <TouchableOpacity
          key={item.uid}
          style={[styles.searchResultItem, { backgroundColor: theme.card }]}
          onPress={() => {
            setShowSearchResults(false);
            router.push(`/user/${item.uid}`);
          }}
        >
          <Image
            source={{ uri: item.photoURL || getDefaultAvatarUrl(item.displayName || item.username || 'User') }}
            style={styles.searchUserThumb}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.searchResultName, { color: theme.text }]}>{item.displayName}</Text>
            <Text style={[styles.searchResultSub, { color: theme.textSecondary }]}>@{item.username}</Text>
          </View>
          <View style={[styles.pointsBadge, { backgroundColor: theme.primary + '20' }]}>
            <Star size={10} color={theme.primary} fill={theme.primary} />
            <Text style={[styles.pointsText, { color: theme.primary }]}>{item.points}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    const priceInfo = getPriceInfo(item.priceLevel, item.rawTypes);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.searchResultItem, { backgroundColor: theme.card }]}
        onPress={() => {
          setShowSearchResults(false);
          router.push(`/establishment/${item.id}`);
        }}
      >
        <Image
          source={{ uri: item.photo || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=100&q=80' }}
          style={styles.searchResultThumb}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.searchResultName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.searchResultSub, { color: theme.textSecondary }]} numberOfLines={1}>{item.category} • {item.address}</Text>
          {priceInfo && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceSymbol, { color: theme.primary }]}>{priceInfo.symbol}</Text>
              {priceInfo.range ? (
                <Text style={[styles.priceRange, { color: theme.textSecondary }]}>{priceInfo.range}</Text>
              ) : null}
            </View>
          )}
        </View>
        <View style={[styles.searchScorePill, { backgroundColor: theme.ranking1 }]}>
          <Text style={styles.searchScoreText}>{item.score}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ marginTop: 20, color: theme.textSecondary, fontSize: 16, fontWeight: '500' }}>
          Discovering the best near you...
        </Text>
      </View>
    );
  }

  const filteredCategories = CATEGORY_DEFINITIONS.filter(cat => {
    if (halalEnabled && (cat.id === 'nightlife' || cat.id === 'world_clubs' || cat.id === 'world_rooftops')) return false;
    return true;
  }).map(cat => {
    if (halalEnabled) {
      return {
        ...cat,
        subcategories: cat.subcategories.filter(sub => {
          const haramIds = ['world_clubs', 'world_rooftops', 'top_nightlife', 'bars', 'pubs', 'nightclubs', 'karaoke', 'cocktails', 'terraces', 'lounges'];
          return !haramIds.includes(sub.id);
        })
      };
    }
    return cat;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.locationContainer}
            onPress={() => setShowLocationPicker(true)}
            activeOpacity={0.7}
          >
            <MapPin size={16} color={theme.primary} />
            <Text style={[styles.locationText, { color: theme.text }]} numberOfLines={1}>
              {locationName}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={[styles.notificationBtn, { backgroundColor: theme.card }]}
          >
            <Bell size={20} color={theme.text} />
            <View style={[styles.notificationDot, { backgroundColor: theme.error, borderColor: theme.card }]} />
          </TouchableOpacity>
        </View>

        {/* Search Bar - Sticky */}
        <View style={[styles.searchContainer, { backgroundColor: theme.background, paddingTop: 10 }]}>
          <View style={[styles.searchBar, { backgroundColor: theme.card, borderWidth: isSearchFocused ? 1.5 : 0, borderColor: isSearchFocused ? theme.primary + '60' : 'transparent' }]}>
            <Search size={18} color={isSearchFocused ? theme.primary : theme.textSecondary} style={styles.searchIcon} />
            <TextInput
              placeholder="Search"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={handleSearchInputChange}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              onFocus={() => {
                if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                setIsSearchFocused(true);
              }}
              onBlur={() => {
                blurTimeoutRef.current = setTimeout(() => setIsSearchFocused(false), 100);
              }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults({ establishments: [], users: [] }); setIsSearching(false); setShowSearchResults(false); }}>
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          {isSearchFocused && searchQuery.length === 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.suggestionsScroll}
              contentContainerStyle={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
            >
              {SUGGESTIONS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.suggestionChip, { backgroundColor: theme.card, borderColor: theme.primary + '30' }]}
                  onPress={() => handleSuggestionPress(s.query)}
                >
                  <Text style={[styles.suggestionChipText, { color: theme.text }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {showSearchResults ? (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={[styles.searchResultsWrapper, { backgroundColor: theme.background }]}
          >
            {isSearching ? (
              <View style={styles.searchCenter}>
                <ActivityIndicator color={theme.primary} />
                <Text style={{ color: theme.textSecondary, marginTop: 10, fontSize: 13 }}>Searching for "{searchQuery}"...</Text>
              </View>
            ) : (
              <View style={{ padding: 20 }}>
                {/* Result header */}
                {lastSearchedLabel.length > 0 && (
                  <View style={[styles.searchResultHeader, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                    <Search size={13} color={theme.primary} />
                    <Text style={[styles.searchResultHeaderText, { color: theme.primary }]} numberOfLines={1}>
                      {searchResults.establishments.length + searchResults.users.length} results for "{lastSearchedLabel}"
                    </Text>
                  </View>
                )}

                {searchResults.users.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={[styles.searchSectionTitle, { color: theme.textSecondary }]}>USERS</Text>
                    {searchResults.users.map(user => renderSearchResultItem(user, 'user'))}
                  </View>
                )}

                {searchResults.establishments.length > 0 && (
                  <View>
                    <Text style={[styles.searchSectionTitle, { color: theme.textSecondary }]}>ESTABLISHMENTS</Text>
                    {searchResults.establishments.map(est => renderSearchResultItem(est, 'establishment'))}
                  </View>
                )}

                {searchResults.users.length === 0 && searchResults.establishments.length === 0 && (
                  <View style={styles.searchCenter}>
                    <Text style={{ fontSize: 32, marginBottom: 10 }}>🔍</Text>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 6 }}>No results</Text>
                    <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 13 }}>Try searching for "{searchQuery}" in another city or change the terms.</Text>
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        ) : (
          <>
            {/* Categories */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
            >
              {filteredCategories.map(cat => {
                const isActive = activeCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryBtn, { backgroundColor: isActive ? theme.primary : theme.backgroundSecondary }]}
                    onPress={() => setActiveCategory(cat.id)}
                  >
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <Text style={[styles.categoryName, { color: isActive ? '#1C1F26' : theme.text }]}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Hidden Gems Carousel - ONLY show in Food Category */}
            {activeCategory === 'food' && hiddenGems.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Hidden Gems Nearby</Text>
                  <TouchableOpacity onPress={() => router.push('/gems')}>
                    <Text style={[styles.seeAll, { color: theme.primary }]}>See all</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={hiddenGems}
                  renderItem={renderGem}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.gemsList}
                  keyExtractor={item => item.id}
                />
              </>
            )}

            {/* Top Rankings Section */}
            <View style={{ marginTop: 20, minHeight: 600 }}>
              {(() => {
                const activeCatData = filteredCategories.find(c => c.id === activeCategory);
                const subIds = activeCatData?.subcategories.map(s => s.id) || [];
                const hasData = subIds.some(id => rankingsData[id] && rankingsData[id].length > 0);

                // We ONLY show loading if: 
                // 1. It's actually loading AND
                // 2. We don't have ANY data to show for this specific category yet
                const shouldShowLoading = rankingsLoading && !hasData;

                if (shouldShowLoading) {
                  return (
                    <Animated.View
                      key="discovery-loading"
                      entering={FadeIn.duration(400)}
                      exiting={FadeOut.duration(200)}
                      style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}
                    >
                      <ActivityIndicator size="large" color={theme.primary} />
                      <Text style={{
                        marginTop: 20,
                        color: theme.textSecondary,
                        fontWeight: '600',
                        fontSize: 16
                      }}>
                        Loading {activeCatData?.name}...
                      </Text>
                    </Animated.View>
                  );
                }

                return (
                  <Animated.View
                    key={`rankings-container-${activeCategory}`}
                    entering={FadeIn.duration(600)}
                    style={{ flex: 1 }}
                  >
                    {activeCatData?.subcategories.map((sub, idx) => {
                      const blockData = rankingsData[sub.id] || [];
                      if (blockData.length === 0) return null;

                      return (
                        <Animated.View
                          key={`${activeCategory}-${sub.id}`}
                          entering={FadeIn.duration(500).delay(idx * 70)}
                        >
                          <RankingBlock
                            subcategory={sub}
                            userLocation={userLocation}
                            locationName={locationName}
                            data={blockData}
                            loading={false}
                            followedPlaceIds={followedPlaceIds}
                            onFollowToggle={handleFollowToggle}
                          />
                        </Animated.View>
                      );
                    })}

                    {!rankingsLoading && !hasData && (
                      <Animated.View
                        entering={FadeIn.duration(500)}
                        style={{ padding: 80, alignItems: 'center' }}
                      >
                        <MapPin size={32} color={theme.textSecondary} style={{ marginBottom: 20 }} />
                        <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18, marginBottom: 8 }}>No rankings</Text>
                        <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
                          There are not enough places in this area.
                        </Text>
                      </Animated.View>
                    )}
                  </Animated.View>
                );
              })()}
            </View>
          </>
        )}
      </ScrollView>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Change Location</Text>
              <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.locationSearchBox, { backgroundColor: theme.card }]}>
              <Search size={20} color={theme.textSecondary} />
              <TextInput
                placeholder="Search"
                placeholderTextColor={theme.textSecondary}
                style={[styles.locationInput, { color: theme.text }]}
                value={locationSearchQuery}
                onChangeText={handleLocationSearch}
              />
            </View>

            <TouchableOpacity
              style={styles.currentLocationRow}
              onPress={useCurrentLocation}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
                <MapPin size={20} color={theme.primary} />
              </View>
              <Text style={[styles.currentLocationText, { color: theme.text }]}>
                Use my current location
              </Text>
            </TouchableOpacity>

            <ScrollView style={styles.predictionsList} keyboardShouldPersistTaps="handled">
              {isSearchingLocation ? (
                <ActivityIndicator style={{ marginTop: 20 }} color={theme.primary} />
              ) : (
                locationPredictions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={[styles.predictionItem, { borderBottomColor: theme.card }]}
                    onPress={() => selectLocation(item)}
                  >
                    <MapPin size={16} color={theme.textSecondary} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.predictionText, { color: theme.text }]}>{item.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 15,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'transparent', // Will be set by theme color if needed
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  suggestionsScroll: {
    marginTop: 10,
  },
  suggestionsList: {
    paddingRight: 10,
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestionChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  searchResultHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  categoriesList: {
    paddingHorizontal: 20,
    paddingBottom: 25,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 10,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  gemsList: {
    paddingLeft: 20,
    paddingBottom: 30,
  },
  gemCard: {
    width: 220,
    height: 280,
    borderRadius: 20,
    marginRight: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  gemImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gemOverlay: {
    padding: 12,
  },
  ratingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  ratingText: {
    color: '#1C1F26',
    fontWeight: '800',
    fontSize: 14,
  },
  gemInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: 'rgba(28, 31, 38, 0.7)',
  },
  gemName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  gemSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 10,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1F26',
  },
  rankingList: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
  },
  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankBadgeContainer: {
    width: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  movementDots: {
    marginTop: -2,
  },
  rankNumber: {
    fontWeight: '900',
    fontFamily: 'Outfit_Bold',
  },
  rankingThumb: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 12,
  },
  rankingDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(128,128,128,0.4)',
    marginHorizontal: 6,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  itemSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  rankingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 40,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '900',
  },
  // Search Overlay
  searchResultsWrapper: {
    flex: 1,
    minHeight: 400,
  },
  searchCenter: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 5,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
  },
  searchResultThumb: {
    width: 45,
    height: 45,
    borderRadius: 10,
    marginRight: 12,
  },
  searchUserThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  searchResultSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  searchScorePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 10,
  },
  searchScoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C1F26',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  pointsText: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '85%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 45 : 30, // Improved bottom padding for safe areas
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  locationSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderRadius: 16,
    marginBottom: 16,
  },
  locationInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '700',
  },
  predictionsList: {
    flex: 1,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  predictionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  priceSymbol: {
    fontSize: 12,
    fontWeight: '800',
  },
  priceRange: {
    fontSize: 11,
    fontWeight: '600',
  },
  priceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  priceBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
