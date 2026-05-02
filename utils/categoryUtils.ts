/**
 * Maps Google Maps types to more descriptive Spanish category names.
 * This helps prioritize more specific types over generic ones like 'establishment'.
 */

const typeMapping: Record<string, string> = {
    // Food & Drink
    restaurant: 'Restaurant',
    bar: 'Bar',
    cafe: 'Cafeteria',
    bakery: 'Bakery',
    meal_takeaway: 'Takeaway',
    night_club: 'Nightclub',
    liquor_store: 'Liquor Store',

    // Accommodation
    lodging: 'Hotel/Lodging',
    hotel: 'Hotel',
    campground: 'Camping',

    // Sightseeing & Culture
    tourist_attraction: 'Tourist Attraction',
    museum: 'Museum',
    art_gallery: 'Art Gallery',
    church: 'Church',
    place_of_worship: 'Place of Worship',
    park: 'Park',
    natural_feature: 'Viewpoint/Nature',
    monument: 'Monument',
    city_hall: 'City Hall',
    library: 'Library',
    aquarium: 'Aquarium',
    zoo: 'Zoo',

    // Transport & Services
    gas_station: 'Gas Station',
    car_rental: 'Car Rental',
    car_repair: 'Mechanic',
    parking: 'Parking',
    transit_station: 'Station',
    airport: 'Airport',

    // Shopping
    convenience_store: 'Store',
    supermarket: 'Supermarket',
    shopping_mall: 'Shopping Mall',
    clothing_store: 'Clothing Store',
    shoe_store: 'Shoe Store',
    department_store: 'Department Store',
    electronics_store: 'Electronics Store',
    jewelry_store: 'Jewelry',
    grocery_or_supermarket: 'Supermarket',

    // Health & Beauty
    beauty_salon: 'Beauty Salon',
    hair_care: 'Hair Salon',
    spa: 'Spa',
    gym: 'Gym',
    health: 'Health', // Generic, should be low priority
    pharmacy: 'Pharmacy',
    hospital: 'Hospital',
    doctor: 'Doctor',
    drugstore: 'Perfumery/Drugstore',
    cosmetics_store: 'Perfumery/Beauty',

    // Others
    bank: 'Bank',
    atm: 'ATM',
    post_office: 'Post Office',
    movie_theater: 'Cinema',
    stadium: 'Stadium',
    amusement_park: 'Amusement Park',
    casino: 'Casino',
    bowling_alley: 'Bowling',
    school: 'School',
    university: 'University',
    local_government_office: 'Public Office',
    real_estate_agency: 'Real Estate',
    factory: 'Factory',
    industrial_estate: 'Industrial Estate',
};


// Types to definitely ignore because they are too generic
const genericTypes = [
    'establishment',
    'point_of_interest',
    'food',
    'store',
    'premise',
    'natural_feature', // already handled if specific, but mapping is better
];

export const getCategoryFromTypes = (types?: string[], name?: string): string => {
    // Pre-check for keywords in the name if it's provided
    // This helps catch things Google doesn't classify specifically (like Murals)
    if (name) {
        const lowerName = name.toLowerCase();

        // 1. Strict Exclusions (to avoid things like "Druni" in Gyms)
        const perfumeKeywords = ['druni', 'primor', 'perfumery', 'perfume', 'rituals', 'kiko milano', 'douglas', 'claire'];
        if (perfumeKeywords.some(kw => lowerName.includes(kw)) ||
            types?.includes('cosmetics_store') ||
            types?.includes('drugstore')) {
            return 'Perfumery/Beauty';
        }

        if (lowerName.includes('pharmacy') || lowerName.includes('apothecary') || types?.includes('pharmacy')) {
            return 'Pharmacy';
        }


        // Factory keywords
        if (lowerName.includes('factory') || lowerName.includes('industrial')) {
            return 'Factory';
        }

        // Mural keywords
        if (lowerName.includes('mural') || lowerName.includes('graffiti') || lowerName.includes('street art')) {
            return 'Mural';
        }

        // Gym keywords (to ensure they are classified correctly even if Google says 'health')
        if (lowerName.includes('gym') || lowerName.includes('fitness') || lowerName.includes('crossfit')) {
            return 'Gym';
        }
    }


    if (!types || types.length === 0) return 'Establishment';

    // Filter out generic types first
    const filteredTypes = types.filter(t => !genericTypes.includes(t));

    // Look for the first type that we have a mapping for
    for (const type of filteredTypes) {
        if (typeMapping[type]) {
            return typeMapping[type];
        }
    }

    // If no mapping found but we have non-generic types, format the first one
    if (filteredTypes.length > 0) {
        return filteredTypes[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Final fallback to the first type if all else fails
    return types[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Establishment';
};

/**
 * Global Category Validator
 * Checks if an establishment's detected category is compatible with the ranking it's trying to join.
 */
export const isCompatibleWithRanking = (detectedCategory: string, subcategoryTitle: string, subcategoryId: string): boolean => {
    const title = (subcategoryTitle || '').toLowerCase();
    const id = (subcategoryId || '').toLowerCase();
    const cat = (detectedCategory || '').toLowerCase();

    // 1. GYM / HEALTH / SPORT
    if (title.includes('gym') || title.includes('sport') || id.includes('gym') || id.includes('health')) {
        const banned = ['restaurant', 'bar', 'cafeteria', 'perfumery', 'beauty', 'esthetics', 'hair salon', 'store', 'fashion', 'clothing', 'hotel', 'lodging'];
        if (banned.some(b => cat.includes(b))) return false;
        // Must be related to sports/health/wellness if it's a gym block
        const allowed = ['gym', 'yoga', 'crossfit', 'tennis club', 'padel', 'health', 'spa', 'pilates studio', 'wellness center'];
        return allowed.some(a => cat.includes(a));
    }

    // 2. FOOD / GASTRONOMY
    if (title.includes('restaurant') || title.includes('eat') || title.includes('gastronomy') || id.includes('restaurant') || id.includes('food')) {
        const banned = ['gym', 'store', 'fashion', 'clothing', 'motor', 'mechanic', 'hair salon', 'esthetics', 'real estate', 'furniture'];
        if (banned.some(b => cat.includes(b))) return false;
        return cat.includes('restaurant') || cat.includes('burger') || cat.includes('pizza') || cat.includes('tavern') || cat.includes('steakhouse') || cat.includes('food') || cat.includes('coffee') || cat.includes('bakery');
    }

    // 3. NIGHTLIFE
    if (title.includes('drinks') || title.includes('night') || title.includes('nightclub') || id.includes('night') || id.includes('bar')) {
        const banned = ['pharmacy', 'gym', 'school', 'mechanic', 'supermarket', 'clothing store', 'furniture'];
        if (banned.some(b => cat.includes(b))) return false;
    }

    // 4. FASHION
    if (title.includes('fashion') || title.includes('clothing') || title.includes('shoe') || id.includes('fashion') || id.includes('clothing')) {
        const banned = ['restaurant', 'food', 'bar', 'gym', 'mechanic', 'hardware'];
        if (banned.some(b => cat.includes(b))) return false;
        return cat.includes('fashion') || cat.includes('clothing') || cat.includes('shoes') || cat.includes('store') || cat.includes('jewelry') || cat.includes('boutique') || cat.includes('accessories');
    }

    // 5. BEAUTY
    if (title.includes('hair') || title.includes('beauty') || title.includes('esthetics') || id.includes('beauty') || id.includes('hair')) {
        const banned = ['restaurant', 'food', 'mechanic', 'gym', 'real estate'];
        if (banned.some(b => cat.includes(b))) return false;
    }

    // Default: Allow if no specific ban logic applies (like in "Top" or "Hidden Gems")
    return true;
};


