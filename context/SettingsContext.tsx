import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, ColorSchemeName, useColorScheme as useNativeColorScheme } from 'react-native';
import { useAuth } from './AuthContext';

interface SettingsContextType {
    theme: ColorSchemeName;
    userThemePreference: ColorSchemeName | 'system';
    setTheme: (theme: ColorSchemeName | 'system') => void;
    notificationsEnabled: boolean;
    setNotificationsEnabled: (enabled: boolean) => void;
    biometricEnabled: boolean;
    setBiometricEnabled: (enabled: boolean) => void;
    language: 'en' | 'es';
    setLanguage: (lang: 'en' | 'es') => void;
    halalEnabled: boolean;
    setHalalEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType>({
    theme: Appearance.getColorScheme(),
    userThemePreference: 'system',
    setTheme: () => { },
    notificationsEnabled: true,
    setNotificationsEnabled: () => { },
    biometricEnabled: false,
    setBiometricEnabled: () => { },
    language: 'en',
    setLanguage: () => { },
    halalEnabled: false,
    setHalalEnabled: () => { },
});

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const userId = user?.id || 'guest';
    const systemColorScheme = useNativeColorScheme();

    // What the user manually picked (null/'system' means follow device)
    const [userThemePreference, setUserThemePreference] = useState<ColorSchemeName | 'system'>('system');
    
    // The actual theme being applied (computed)
    const theme = userThemePreference === 'system' ? systemColorScheme : userThemePreference as ColorSchemeName;

    const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
    const [biometricEnabled, setBiometricEnabledState] = useState(false);
    const [language, setLanguageState] = useState<'en' | 'es'>('en');
    const [halalEnabled, setHalalEnabledState] = useState(false);

    useEffect(() => {
        loadSettings();
    }, [userId]);

    const loadSettings = async () => {
        try {
            const storedTheme = await AsyncStorage.getItem(`${userId}_settings_theme`);
            if (storedTheme) {
                setUserThemePreference(storedTheme as ColorSchemeName | 'system');
            } else {
                setUserThemePreference('system');
            }

            const storedNotifs = await AsyncStorage.getItem(`${userId}_settings_notifications`);
            if (storedNotifs) setNotificationsEnabledState(storedNotifs === 'true');
            else setNotificationsEnabledState(true);

            const storedBio = await AsyncStorage.getItem(`${userId}_settings_biometric`);
            if (storedBio) setBiometricEnabledState(storedBio === 'true');
            else setBiometricEnabledState(false);

            const storedLang = await AsyncStorage.getItem(`${userId}_settings_language`);
            if (storedLang) setLanguageState(storedLang as 'en' | 'es');
            else setLanguageState('en');

            const storedHalal = await AsyncStorage.getItem(`${userId}_settings_halal`);
            if (storedHalal) setHalalEnabledState(storedHalal === 'true');
            else setHalalEnabledState(false);
        } catch (error) {
            console.error('Failed to load settings', error);
        }
    };

    const setTheme = async (newTheme: ColorSchemeName | 'system') => {
        setUserThemePreference(newTheme);
        await AsyncStorage.setItem(`${userId}_settings_theme`, newTheme || 'system');
    };

    const setNotificationsEnabled = async (enabled: boolean) => {
        setNotificationsEnabledState(enabled);
        await AsyncStorage.setItem(`${userId}_settings_notifications`, String(enabled));
    };

    const setBiometricEnabled = async (enabled: boolean) => {
        setBiometricEnabledState(enabled);
        await AsyncStorage.setItem(`${userId}_settings_biometric`, String(enabled));
    };

    const setLanguage = async (lang: 'en' | 'es') => {
        setLanguageState(lang);
        await AsyncStorage.setItem(`${userId}_settings_language`, lang);
    };

    const setHalalEnabled = async (enabled: boolean) => {
        setHalalEnabledState(enabled);
        await AsyncStorage.setItem(`${userId}_settings_halal`, String(enabled));
    };

    return (
        <SettingsContext.Provider value={{
            theme: theme || 'dark', // Fallback to dark
            userThemePreference,
            setTheme,
            notificationsEnabled,
            setNotificationsEnabled,
            biometricEnabled,
            setBiometricEnabled,
            language,
            setLanguage,
            halalEnabled,
            setHalalEnabled
        }}>
            {children}
        </SettingsContext.Provider>
    );
};


export const useSettings = () => useContext(SettingsContext);

