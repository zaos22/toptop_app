import { useSettings } from '@/context/SettingsContext';
import { searchNearbyPlaces } from '@/services/googleMapsService';
import { UserLocation, getCurrentLocation, watchLocation } from '@/services/locationService';
import { registerForPushNotificationsAsync, sendLocalNotification } from '@/services/notificationService';
import { getCategoryFromTypes } from '@/utils/categoryUtils';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

export function useProximityNotifications() {
    const { notificationsEnabled } = useSettings();
    const router = useRouter();
    const [nearbySpots, setNearbySpots] = useState<any[]>([]);
    const lastFetchLocation = useRef<UserLocation | null>(null);
    const processing = useRef(false);
    const lastNotificationTime = useRef<number>(0);
    const notifiedPlaceIds = useRef<Set<string>>(new Set());

    // Initialize and initial fetch
    useEffect(() => {
        const init = async () => {
            if (notificationsEnabled) {
                await registerForPushNotificationsAsync();
            }

            const userLoc = await getCurrentLocation();
            if (userLoc) {
                fetchNearbyRealSpots(userLoc);
            }
        };
        init();
    }, [notificationsEnabled]);

    const fetchNearbyRealSpots = async (loc: UserLocation) => {
        try {
            // Fetch multiple categories for a wider "TopTop" experience
            const categories = ['restaurant', 'cafe', 'bar', 'lodging', 'tourist_attraction', 'museum', 'shopping_mall'];
            const allResults = await Promise.all(
                categories.map(cat => searchNearbyPlaces(loc.latitude, loc.longitude, cat))
            );

            // Flatten and filter for "Real" spots that fit the TopTop profile (high rating)
            const combined = allResults.flat();
            const uniqueSpots = Array.from(new Map(combined.map(item => [item.place_id, item])).values());

            const relevantSpots = uniqueSpots
                .filter((p: any) => p.rating && p.rating >= 4.5 && p.user_ratings_total > 50)
                .map((p: any) => ({
                    id: p.place_id,
                    name: p.name,
                    category: getCategoryFromTypes(p.types, p.name),
                    score: p.rating,
                    latitude: p.geometry.location.lat,
                    longitude: p.geometry.location.lng,
                }));

            setNearbySpots(relevantSpots);
            lastFetchLocation.current = loc;
        } catch (error) {
            console.error('Error fetching real spots for notifications:', error);
        }
    };

    // Handle notification tap (even if app was closed)
    useEffect(() => {
        // 1. Handle background/foreground taps
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            if (data?.establishmentId) {
                let route = `/establishment/${data.establishmentId}` as any;
                if (data.reviewId) {
                    route = {
                        pathname: `/establishment/${data.establishmentId}`,
                        params: { reviewId: data.reviewId }
                    };
                }
                router.push(route);
            } else if (data?.type === 'FOLLOW' && data?.followerId) {
                router.push(`/user/${data.followerId}`);
            }
        });

        // 2. Handle initial notification (app start)
        const checkInitial = async () => {
            const lastResponse = await Notifications.getLastNotificationResponseAsync();
            if (lastResponse) {
                const data = lastResponse.notification.request.content.data;
                if (data?.establishmentId) {
                    let route = `/establishment/${data.establishmentId}` as any;
                    if (data.reviewId) {
                        route = {
                            pathname: `/establishment/${data.establishmentId}`,
                            params: { reviewId: data.reviewId }
                        };
                    }
                    router.push(route);
                } else if (data?.type === 'FOLLOW' && data?.followerId) {
                    router.push(`/user/${data.followerId}`);
                }
            }
        };
        checkInitial();

        return () => subscription.remove();
    }, []);

    // Watch location
    useEffect(() => {
        if (!notificationsEnabled) return;

        let sub: any;
        const start = async () => {
            sub = await watchLocation((loc) => {
                // If user moved more than 500m, refresh the nearby spots list
                if (lastFetchLocation.current) {
                    const distMoved = getDistance(
                        loc.latitude, loc.longitude,
                        lastFetchLocation.current.latitude, lastFetchLocation.current.longitude
                    );
                    if (distMoved > 500) {
                        fetchNearbyRealSpots(loc);
                    }
                }
                checkProximity(loc);
            });
        };
        start();

        return () => {
            if (sub && sub.remove) sub.remove();
        };
    }, [notificationsEnabled, nearbySpots]);

    const checkProximity = (userLoc: UserLocation) => {
        if (processing.current || nearbySpots.length === 0) return;

        // Cooldown: 2 minutes between any notification to avoid spam
        if (Date.now() - lastNotificationTime.current < 2 * 60 * 1000) return;

        processing.current = true;

        for (const spot of nearbySpots) {
            // Check if we already notified about THIS place in this session
            if (notifiedPlaceIds.current.has(spot.id)) continue;

            const dist = getDistance(userLoc.latitude, userLoc.longitude, spot.latitude, spot.longitude);
            if (dist < 50) { // 50 meters trigger
                let title = '¡Local TopTop muy cerca! 💎';
                const lowerCat = spot.category?.toLowerCase() || '';

                if (lowerCat.includes('restaurante') || lowerCat.includes('comida')) {
                    title = '¿Hambre? Tienes un Top al lado 🍔';
                } else if (lowerCat.includes('hotel')) {
                    title = 'Descanso de lujo muy cerca 🏨';
                } else if (lowerCat.includes('mural')) {
                    title = '¡Arte urbano increíble aquí! 🎨';
                }

                const body = `Estás a unos pasos de ${spot.name} (${spot.score}). ¡Aprovecha que estás aquí!`;

                sendLocalNotification(title, body, { establishmentId: spot.id });

                notifiedPlaceIds.current.add(spot.id);
                lastNotificationTime.current = Date.now();
                break; // Notify only one at a time
            }
        }
        processing.current = false;
    };

    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };
}
