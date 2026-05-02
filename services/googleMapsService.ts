import axios from 'axios';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBJ4dpsHNjF3HOLhV1xxixdR-w6gQkMc1Q';

// --- CACHE SYSTEM ---
interface CacheEntry {
    data: any;
    timestamp: number;
}

const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const apiCache: Record<string, CacheEntry> = {};

const getFromCache = (key: string) => {
    const entry = apiCache[key];
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.data;
    }
    return null;
};

const setToCache = (key: string, data: any) => {
    apiCache[key] = {
        data,
        timestamp: Date.now()
    };
};
// --------------------

export interface GooglePlaceDetails {
    place_id: string;
    name: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
    website?: string;
    url?: string;
    menu?: string;
    formatted_phone_number?: string;
    photos?: Array<{ photo_reference: string }>;
    reviews?: Array<{
        author_name: string;
        profile_photo_url: string;
        rating: number;
        relative_time_description: string;
        text: string;
        time: number;
    }>;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
    price_level?: number;
    types?: string[];
}

export const getGooglePlaceDetails = async (placeId: string): Promise<GooglePlaceDetails | null> => {
    const cacheKey = `details_${placeId}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}&language=es`
        );
        const result = response.data.result;
        if (result) setToCache(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error fetching Google Place details:', error);
        return null;
    }
};

export const searchNearbyPlaces = async (lat: number, lng: number, type: string = 'restaurant') => {
    // Round coordinates to ~100m to increase cache hit rate
    const cacheLat = Math.round(lat * 1000) / 1000;
    const cacheLng = Math.round(lng * 1000) / 1000;
    const cacheKey = `nearby_${cacheLat}_${cacheLng}_${type}`;
    
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=${type}&key=${GOOGLE_MAPS_API_KEY}&language=es`
        );
        const results = response.data.results || [];
        setToCache(cacheKey, results);
        return results;
    } catch (error) {
        console.error('Error searching nearby places:', error);
        return [];
    }
};

export const searchPlaces = async (query: string, lat?: number, lng?: number, type?: string) => {
    // Cache key based on query and location
    const cacheLat = lat ? Math.round(lat * 100) / 100 : 0;
    const cacheLng = lng ? Math.round(lng * 100) / 100 : 0;
    const cacheKey = `search_${query}_${cacheLat}_${cacheLng}_${type || ''}`;
    
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&language=es`;
        if (lat && lng) {
            url += `&location=${lat},${lng}&radius=10000`;
        }
        if (type) {
            url += `&type=${type}`;
        }
        const response = await axios.get(url);
        const results = response.data.results || [];
        setToCache(cacheKey, results);
        return results;
    } catch (error) {
        console.error('Error searching places:', error);
        return [];
    }
};

export const searchLocations = async (query: string) => {
    const cacheKey = `autocomplete_${query.toLowerCase().trim()}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(regions)&key=${GOOGLE_MAPS_API_KEY}&language=es`
        );
        const results = response.data.predictions || [];
        setToCache(cacheKey, results);
        return results;
    } catch (error) {
        console.error('Error searching locations:', error);
        return [];
    }
};

export const getPlaceGeometry = async (placeId: string) => {
    const cacheKey = `geometry_${placeId}`;
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`
        );
        const result = response.data.result?.geometry?.location;
        if (result) setToCache(cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error getting place geometry:', error);
        return null;
    }
};

export const getPhotoUrl = (photoReference: string, maxWidth: number = 800) => {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_MAPS_API_KEY}`;
};
