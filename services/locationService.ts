import * as Location from 'expo-location';

export interface UserLocation {
    latitude: number;
    longitude: number;
}

export const getCurrentLocation = async (): Promise<UserLocation | null> => {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.warn('Location permission not granted');
            return null;
        }

        // Try to get last known position first (it's faster)
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown) {
            return {
                latitude: lastKnown.coords.latitude,
                longitude: lastKnown.coords.longitude,
            };
        }

        // If no last known, request current position with balanced accuracy
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        };
    } catch (error) {
        console.error('Error getting location:', error);
        return null;
    }
};



export const getAddressFromCoordinates = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (address) {
            // Prioritize specific location details
            const street = address.street;
            const streetNumber = address.streetNumber;
            const name = address.name;
            const city = address.city || address.subregion || address.region;

            if (street) {
                return `${street}${streetNumber ? ' ' + streetNumber : ''}, ${city || ''}`;
            } else if (name && name !== city) {
                return `${name}, ${city || ''}`;
            }

            return `${city || address.region || ''}, ${address.isoCountryCode || address.country || ''}`;
        }
        return null;
    } catch (error) {
        console.error('Reverse geocoding failed', error);
        return null;
    }
};

export const getCityCountryFromCoordinates = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (address) {
            const city = address.city || address.subregion || address.region || 'Unknown City';
            const country = address.country || address.isoCountryCode || '';
            return `${city}${country ? ', ' + country : ''}`;
        }
        return null;
    } catch (error) {
        console.error('Reverse geocoding failed', error);
        return null;
    }
};

export const watchLocation = async (callback: (location: UserLocation) => void) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    return await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000,
            distanceInterval: 100,
        },
        (location) => {
            callback({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
        }
    );
};
