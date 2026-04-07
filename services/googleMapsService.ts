import axios from 'axios';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCG8Hd_HrezAiNrccIT5UIGmvs5mIq7_1U';

export interface GooglePlaceDetails {
    place_id: string;
    name: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
    website?: string;
    url?: string; // Google Maps URL which often contains menu/info
    menu?: string; // Some places might have a direct menu field
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
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}&language=es`
        );
        return response.data.result;
    } catch (error) {
        console.error('Error fetching Google Place details:', error);
        return null;
    }
};

export const searchNearbyPlaces = async (lat: number, lng: number, type: string = 'restaurant') => {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=${type}&key=${GOOGLE_MAPS_API_KEY}&language=es`
        );
        return response.data.results;
    } catch (error) {
        console.error('Error searching nearby places:', error);
        return [];
    }
};

export const searchPlaces = async (query: string, lat?: number, lng?: number, type?: string) => {
    try {
        let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&language=es`;
        if (lat && lng) {
            url += `&location=${lat},${lng}&radius=10000`;
        }
        if (type) {
            url += `&type=${type}`;
        }
        const response = await axios.get(url);
        return response.data.results;
    } catch (error) {
        console.error('Error searching places:', error);
        return [];
    }
};

export const searchLocations = async (query: string) => {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=(regions)&key=${GOOGLE_MAPS_API_KEY}&language=es`
        );
        return response.data.predictions;
    } catch (error) {
        console.error('Error searching locations:', error);
        return [];
    }
};

export const getPlaceGeometry = async (placeId: string) => {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`
        );
        return response.data.result.geometry.location;
    } catch (error) {
        console.error('Error getting place geometry:', error);
        return null;
    }
};

export const getPhotoUrl = (photoReference: string, maxWidth: number = 800) => {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_MAPS_API_KEY}`;
};
