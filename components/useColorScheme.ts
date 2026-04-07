import { useSettings } from '@/context/SettingsContext';

export function useColorScheme() {
    const { theme, halalEnabled } = useSettings();
    if (halalEnabled) {
        return theme === 'dark' ? 'halalDark' : 'halalLight';
    }
    return theme;
}
