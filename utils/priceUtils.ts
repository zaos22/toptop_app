/**
 * Returns a human-readable price symbol and an approximate price range
 * based on Google Places price_level (0-4) and the establishment types.
 *
 * Google price_level:
 *  0 → Free / Gratis
 *  1 → Inexpensive   €
 *  2 → Moderate      €€
 *  3 → Expensive     €€€
 *  4 → Very Expensive €€€€
 */

export interface PriceInfo {
    /** Short symbol: €, €€, €€€, €€€€ or "Gratis" */
    symbol: string;
    /** Contextual range: "~10-25€/pers", "~50-150€/noche", etc. */
    range: string;
    /** Combined label ready to display: "€€ · ~10-25€/pers" */
    full: string;
}

export function getPriceInfo(
    priceLevel: number | undefined | null,
    types: string[] | undefined
): PriceInfo | null {
    if (priceLevel === undefined || priceLevel === null) return null;

    const typeStr = (types || []).join(' ').toLowerCase();

    const isHotel = /lodging|hotel/.test(typeStr);
    const isRestaurant = /restaurant|food|cafe|bakery|bar|meal_delivery|meal_takeaway|coffee/.test(typeStr);
    const isCarRental = /car_rental/.test(typeStr);
    const isShopping = /clothing_store|shopping_mall|department_store|store|shop/.test(typeStr);
    const isGym = /gym|health|fitness/.test(typeStr);
    const isSpa = /spa|beauty|hair_care/.test(typeStr);

    const symbols = ['Gratis', '€', '€€', '€€€', '€€€€'];
    const symbol = symbols[priceLevel] ?? '€€';

    if (priceLevel === 0) return { symbol: 'Gratis', range: '', full: 'Gratis' };

    let range = '';

    if (isHotel) {
        const ranges = ['', '<50€', '50-150€', '150-300€', '300€+'];
        const suffix = '/noche';
        range = (ranges[priceLevel] ?? '') + suffix;
    } else if (isRestaurant) {
        const ranges = ['', '<10€', '10-25€', '25-50€', '50€+'];
        const suffix = '/pers';
        range = (ranges[priceLevel] ?? '') + suffix;
    } else if (isCarRental) {
        const ranges = ['', '<20€', '20-50€', '50-100€', '100€+'];
        const suffix = '/día';
        range = (ranges[priceLevel] ?? '') + suffix;
    } else if (isShopping) {
        const ranges = ['', 'Low cost', 'Precio medio', 'Premium', 'Lujo'];
        range = ranges[priceLevel] ?? '';
    } else if (isGym) {
        const ranges = ['', '<20€', '20-40€', '40-80€', '80€+'];
        const suffix = '/mes';
        range = (ranges[priceLevel] ?? '') + suffix;
    } else if (isSpa) {
        const ranges = ['', '<30€', '30-80€', '80-150€', '150€+'];
        const suffix = '/sesión';
        range = (ranges[priceLevel] ?? '') + suffix;
    } else {
        // Generic fallback
        const ranges = ['', 'Económico', 'Precio medio', 'Premium', 'Lujo'];
        range = ranges[priceLevel] ?? '';
    }

    const full = range ? `${symbol} · ${range}` : symbol;
    return { symbol, range, full };
}
