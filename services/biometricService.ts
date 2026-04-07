import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'settings_biometric';
const USER_CREDENTIALS_KEY = 'toptop_user_credentials';

export const BiometricService = {
    /**
     * Checks if the device is compatible with biometrics and has enrolled ones.
     */
    async isCompatible(): Promise<boolean> {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        return hasHardware && isEnrolled;
    },

    /**
     * Enrolls the user for biometric login. Stores encrypted credentials.
     */
    async enroll(email: string, password: string): Promise<boolean> {
        try {
            const results = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Enable biometric security',
                fallbackLabel: 'Enter password',
            });

            if (results.success) {
                // Store credentials securely
                await SecureStore.setItemAsync(USER_CREDENTIALS_KEY, JSON.stringify({ email, password }));
                // Store preference
                await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Biometric enrollment error:', error);
            return false;
        }
    },

    /**
     * Disables biometric login.
     */
    async disable(): Promise<void> {
        await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
        await SecureStore.deleteItemAsync(USER_CREDENTIALS_KEY);
    },

    /**
     * Checks if biometric login is enabled by the user.
     */
    async isEnabled(): Promise<boolean> {
        const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
        return enabled === 'true';
    },

    /**
     * Just verify biometrics without returning credentials
     */
    async verifyIdentity(promptMessage: string = 'Confirma tu identidad'): Promise<boolean> {
        try {
            const isAvailable = await this.isCompatible();
            if (!isAvailable) return false;

            const results = await LocalAuthentication.authenticateAsync({
                promptMessage: promptMessage,
                disableDeviceFallback: false,
            });

            return results.success;
        } catch (error) {
            console.error('Biometric verify error:', error);
            return false;
        }
    },

    /**
     * Authenticates via biometrics and returns stored credentials.
     */
    async authenticate(): Promise<{ email: string; password: string } | null> {
        try {
            const isAvailable = await this.isCompatible();
            if (!isAvailable) return null;

            const results = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Log in with Biometrics',
                disableDeviceFallback: false,
            });

            if (results.success) {
                const credentialsJson = await SecureStore.getItemAsync(USER_CREDENTIALS_KEY);
                if (credentialsJson) {
                    return JSON.parse(credentialsJson);
                }
            }
            return null;
        } catch (error) {
            console.error('Biometric auth error:', error);
            return null;
        }
    },

};
