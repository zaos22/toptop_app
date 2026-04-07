import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocationData = {
    lat: number;
    lng: number;
    name: string;
};

type Listener = (location: LocationData) => void;

class LocationStore {
    private currentLocation: LocationData | null = null;
    private listeners: Set<Listener> = new Set();
    private currentUserId: string | null = null;

    constructor() {
        this.loadSavedLocation();
    }

    private getStorageKey() {
        return this.currentUserId ? `@toptop_selected_location_${this.currentUserId}` : '@toptop_selected_location_guest';
    }

    async setUserId(userId: string | null) {
        if (this.currentUserId !== userId) {
            this.currentUserId = userId;
            await this.loadSavedLocation();
        }
    }

    private async loadSavedLocation() {
        try {
            const saved = await AsyncStorage.getItem(this.getStorageKey());
            if (saved) {
                this.currentLocation = JSON.parse(saved);
            } else {
                this.currentLocation = null;
            }
            this.notify();
        } catch (error) {
            console.error('Error loading saved location:', error);
        }
    }

    async setLocation(location: LocationData) {
        this.currentLocation = location;
        try {
            await AsyncStorage.setItem(this.getStorageKey(), JSON.stringify(location));
        } catch (error) {
            console.error('Error saving location:', error);
        }
        this.notify();
    }

    async clearLocation() {
        this.currentLocation = null;
        try {
            await AsyncStorage.removeItem(this.getStorageKey());
        } catch (error) {
            console.error('Error clearing location:', error);
        }
    }

    getLocation() {
        return this.currentLocation;
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        if (this.currentLocation) {
            listener(this.currentLocation);
        }
        return () => this.listeners.delete(listener);
    }

    private notify() {
        if (this.currentLocation) {
            this.listeners.forEach(listener => listener(this.currentLocation!));
        }
    }
}

export const locationStore = new LocationStore();
