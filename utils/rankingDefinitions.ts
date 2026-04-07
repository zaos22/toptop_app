import { getPhotoUrl } from '@/services/googleMapsService';
import { getCategoryFromTypes } from '@/utils/categoryUtils';

export const CATEGORY_DEFINITIONS = [
    {
        id: 'global_top',
        name: 'Top',
        icon: '👑',
        subcategories: [
            { id: 'world_restaurants', title: 'Gastronomy', query: 'world best restaurants michelin star fine dining world class gastronomy', type: 'restaurant', isWorld: true },
            { id: 'world_clubs', title: 'Clubs', query: 'world best nightclubs top 100 clubs iconic party venues global', type: 'night_club', isWorld: true },
            { id: 'world_museums', title: 'Museums', query: 'most famous museums in the world best art galleries global landmarks', type: 'museum', isWorld: true },
            { id: 'world_hotels', title: 'Hotels', query: 'world best luxury hotels 7 star resorts iconic stays global', type: 'lodging', isWorld: true },
            { id: 'world_beaches', title: 'Beaches', query: 'best beaches in the world paradise exotic coastal wonders', type: 'tourist_attraction', isWorld: true },
            { id: 'world_monuments', title: 'Sites', query: 'world heritage sites famous landmarks iconic monuments global', type: 'tourist_attraction', isWorld: true },
            { id: 'world_rooftops', title: 'Rooftops', query: 'best rooftop bars in the world iconic views global nightlife', type: 'bar', isWorld: true },
            { id: 'world_shopping', title: 'Shopping', query: 'most luxury shopping malls in the world high end fashion districts global', type: 'shopping_mall', isWorld: true }
        ]
    },
    {
        id: 'top',
        name: 'For You',
        icon: '👤',
        subcategories: [
            { id: 'top_restaurants', title: 'Gastronomy', query: 'best restaurant premium gastronomy', type: 'restaurant' },
            { id: 'top_nightlife', title: 'Elite Nightlife', query: 'best nightclubs clubs premium drinks', type: 'night_club' },
            { id: 'top_plans', title: 'Experiences', query: 'best tours tourist activities experiences', type: 'tourist_attraction' },
            { id: 'top_romantic', title: 'Romantic Plan', query: 'romantic restaurant special dinner', type: 'restaurant' },
            { id: 'top_luxury', title: 'Luxury & Fashion', query: 'luxury stores boutiques exclusive brands', type: 'clothing_store' },
            { id: 'top_beauty', title: 'Personal Care', query: 'best beauty center spa premium hair salon', type: 'beauty_salon' },
            { id: 'top_tech', title: 'Latest in Tech', query: 'apple store electronics store premium gadgets', type: 'electronics_store' },
            { id: 'top_hidden', title: 'Hidden Gems', query: 'charming places special secret', type: 'establishment' }
        ]
    },
    {
        id: 'food',
        name: 'Gastronomy',
        icon: '🍽️',
        subcategories: [
            { id: 'restaurants', title: 'Restaurants', type: 'restaurant' },
            { id: 'romantic', title: 'Dates', query: 'romantic restaurant', type: 'restaurant' },
            { id: 'cheap_eats', title: 'Cheap Eats', query: 'eat cheap', type: 'restaurant' },
            { id: 'fast_food', title: 'Burgers', query: 'burger joint', type: 'restaurant' },
            { id: 'cafes', title: 'Coffee', type: 'cafe' },
            { id: 'supermarkets', title: 'Supermarket', type: 'supermarket' }
        ]
    },
    {
        id: 'nightlife',
        name: 'Nightlife',
        icon: '🍸',
        subcategories: [
            { id: 'bars', title: 'Drinks', query: 'cocktail bar', type: 'bar' },
            { id: 'pubs', title: 'Pubs', type: 'bar' },
            { id: 'nightclubs', title: 'Nightclubs', type: 'night_club' },
            { id: 'karaoke', title: 'Karaoke', query: 'karaoke bar', type: 'bar' },
            { id: 'cocktails', title: 'Cocktails', query: 'premium cocktail bar', type: 'bar' },
            { id: 'terraces', title: 'Terraces', query: 'terrace bar views', type: 'bar' },
            { id: 'lounges', title: 'Lounges', query: 'lounge club chill out', type: 'night_club' }
        ]
    },
    {
        id: 'fashion',
        name: 'Fashion',
        icon: '👕',
        subcategories: [
            { id: 'clothing', title: 'Clothing', type: 'clothing_store' },
            { id: 'sportswear', title: 'Sportswear', query: 'sportswear store clothing', type: 'clothing_store' },
            { id: 'shoes', title: 'Footwear', type: 'shoe_store' },
            { id: 'jewelry', title: 'Jewelry', type: 'jewelry_store' }
        ]
    },
    {
        id: 'beauty',
        name: 'Beauty',
        icon: '💇‍♀️',
        subcategories: [
            { id: 'hair_salon', title: 'Hair Salons', type: 'hair_care' },
            { id: 'barbershop', title: 'Barbershops', query: 'barbershop', type: 'hair_care' },
            { id: 'beauty_salon', title: 'Esthetics', type: 'beauty_salon' },
            { id: 'gyms', title: 'Gym', type: 'gym' },
            { id: 'spa', title: 'Spa', query: 'spa resort', type: 'spa' },
            { id: 'nails', title: 'Nails', query: 'nails manicure', type: 'beauty_salon' },
            { id: 'tattoo', title: 'Tattoos', query: 'tattoo studio', type: 'beauty_salon' }
        ]
    },
    {
        id: 'home',
        name: 'Home',
        icon: '🏠',
        subcategories: [
            { id: 'furniture', title: 'Furniture', type: 'furniture_store' },
            { id: 'real_estate', title: 'Real Estate', type: 'real_estate_agency' },
            { id: 'hardware', title: 'Hardware Stores', type: 'hardware_store' },
            { id: 'decoration', title: 'Decoration', query: 'home decor store', type: 'home_goods_store' },
            { id: 'garden', title: 'Garden', query: 'gardening plants', type: 'home_goods_store' },
            { id: 'lighting', title: 'Lighting', query: 'lamp store lighting', type: 'home_goods_store' },
            { id: 'appliances', title: 'Appliances', query: 'home appliances', type: 'electronics_store' },
            { id: 'kitchenware', title: 'Kitchenware', query: 'kitchen utensils', type: 'home_goods_store' },
            { id: 'bed_bath', title: 'Bed & Bath', query: 'bedding towels', type: 'home_goods_store' },
            { id: 'pet_supplies', title: 'Pets', query: 'pet store', type: 'pet_store' }
        ]
    },
    {
        id: 'travel',
        name: 'Travel',
        icon: '✈️',
        subcategories: [
            { id: 'travel_agencies', title: 'Agencies', type: 'travel_agency' },
            { id: 'travel_activities', title: 'Plans', query: 'tourist activities tours', type: 'tourist_attraction' },
            { id: 'travel_beaches', title: 'Beaches', query: 'beach', type: 'natural_feature' },
            { id: 'travel_historical', title: 'History', query: 'historical site', type: 'tourist_attraction' },
            { id: 'travel_attractions', title: 'Tourism', type: 'tourist_attraction' },
            { id: 'travel_hotels', title: 'Hotels', type: 'lodging' },
            { id: 'museums', title: 'Museums', type: 'museum' },
            { id: 'parks', title: 'Parks', type: 'park' }
        ]
    },
    {
        id: 'tech',
        name: 'Technology',
        icon: '💻',
        subcategories: [
            { id: 'tech_computers', title: 'Computing', query: 'computer store', type: 'electronics_store' },
            { id: 'tech_mobile', title: 'Mobile', query: 'mobile phone repair phone store', type: 'electronics_store' },
            { id: 'tech_gaming', title: 'Gaming', query: 'video game store gaming consoles', type: 'electronics_store' },
            { id: 'tech_photo', title: 'Photo & Video', query: 'photography store cameras', type: 'electronics_store' },
            { id: 'tech_audio', title: 'Audio', query: 'sound equipment hifi speakers', type: 'electronics_store' },
            { id: 'tech_repairs', title: 'Repairs', query: 'technical service electronics repair', type: 'electronics_store' },
            { id: 'electronics', title: 'Electronics', type: 'electronics_store' }
        ]
    }
];


export const formatPlaces = (places: any[]) => {
    return places.map((item: any) => {
        let cleanAddress = (item.formatted_address || item.vicinity || '')
            .replace(/, \d+[, ]/g, ', ')
            .replace(/\d{5}/g, '')
            .replace(/\s+/g, ' ')
            .replace(/ ,/g, ',')
            .replace(/,,+/g, ',')
            .replace(/^,|,$/g, '')
            .trim();

        return {
            id: item.place_id,
            name: item.name,
            category: getCategoryFromTypes(item.types, item.name),
            score: item.rating || 0,
            reviewCount: item.user_ratings_total || 0,
            address: cleanAddress,
            photo: item.photos?.[0]?.photo_reference ? getPhotoUrl(item.photos[0].photo_reference, 200) : null,
            priceLevel: item.price_level,
            rawTypes: item.types || [],
            latitude: item.geometry?.location?.lat,
            longitude: item.geometry?.location?.lng
        };
    });
};
