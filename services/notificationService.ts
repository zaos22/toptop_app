import { supabase } from '@/config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { PermissionsAndroid, Platform } from 'react-native';

const NOTIFICATIONS_STORAGE_KEY = 'toptop_notifications_history';

export interface NotificationItem {
    id: string;
    title: string;
    body: string;
    data: any;
    timestamp: string;
    read: boolean;
    isRemote?: boolean;
}

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
    let token;

    if (Platform.OS === 'android') {
        const isExpoGo = Constants.appOwnership === 'expo';
        if (!isExpoGo && Notifications.setNotificationChannelAsync) {
            try {
                await Notifications.setNotificationChannelAsync('toptop_default', {
                    name: 'TopTop Notifications',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#FF231F7C',
                    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
                    sound: 'default'
                });
            } catch (e) {
                console.log('Error setting notification channel:', e);
            }
        }

        if (Platform.Version >= 33) {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') return null;
        }
    } else {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') return null;
    }

    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId
        });
        token = tokenData.data;
        console.log('[Notifications] Push Token generado:', token);
    } catch (e) {
        console.error('[Notifications] Error al obtener push token:', e);
        return null;
    }

    return token;
}

/**
 * Guarda el token en la tabla profiles de Supabase
 */
export async function savePushTokenToProfile(userId: string, token: string) {
    try {
        console.log('[Notifications] Registrando token en base de datos para:', userId);
        const { error } = await supabase
            .from('profiles')
            .update({ push_token: token })
            .eq('id', userId);
        
        if (error) {
            if (error.code === '42703') {
                console.warn('[Notifications] La columna push_token no existe en profiles.');
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('[Notifications] Error guardando token:', error);
    }
}

export async function sendLocalNotification(title: string, body: string, data = {}) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data,
            sound: true,
        },
        trigger: null, // Send immediately
    });

    // Persist to history
    await saveNotificationToHistory(title, body, data);
}

async function saveNotificationToHistory(title: string, body: string, data: any) {
    try {
        const existingString = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        const history: NotificationItem[] = existingString ? JSON.parse(existingString) : [];

        const newEntry: NotificationItem = {
            id: Math.random().toString(36).substring(7),
            title,
            body,
            data,
            timestamp: new Date().toISOString(),
            read: false,
        };

        // Keep last 50 notifications
        const updatedHistory = [newEntry, ...history].slice(0, 50);
        await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
        console.error('Error saving notification to history:', error);
    }
}

export async function getNotificationsHistory(): Promise<NotificationItem[]> {
    try {
        const history = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
        return history ? JSON.parse(history) : [];
    } catch (error) {
        console.error('Error getting notification history:', error);
        return [];
    }
}

export async function deleteNotificationFromHistory(id: string) {
    try {
        const history = await getNotificationsHistory();
        const updatedHistory = history.filter(n => n.id !== id);
        await AsyncStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
        console.error('Error deleting single notification:', error);
    }
}

export async function clearNotificationsHistory() {
    try {
        await AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing notification history:', error);
    }
}

// Remote Notifications (Supabase)

export async function getRemoteNotifications(userId: string): Promise<NotificationItem[]> {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        return (data || []).map(n => ({
            id: n.id,
            title: n.title,
            body: n.body,
            data: n.data,
            timestamp: n.created_at,
            read: n.is_read,
            isRemote: true
        }));
    } catch (error) {
        console.error('Error fetching remote notifications:', error);
        return [];
    }
}

export async function deleteRemoteNotification(id: string): Promise<boolean> {
    try {
        console.log('[NotificationService] Intentando borrar notificación remota:', id);
        const { error, status } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('[NotificationService] Error Supabase al borrar:', error);
            throw error;
        }
        
        console.log('[NotificationService] Resultado de borrado:', status);
        return true;
    } catch (error) {
        console.error('Error deleting remote notification:', error);
        return false;
    }
}

export async function clearRemoteNotifications(userId: string): Promise<boolean> {
    try {
        console.log('[NotificationService] Limpiando todas las notificaciones para:', userId);
        const { error, status } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', userId);
        
        if (error) {
            console.error('[NotificationService] Error Supabase al limpiar todo:', error);
            throw error;
        }

        console.log('[NotificationService] Resultado de limpieza total:', status);
        return true;
    } catch (error) {
        console.error('Error clearing remote notifications:', error);
        return false;
    }
}

export async function markRemoteNotificationsAsRead(userId: string) {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);
        if (error) throw error;
    } catch (error) {
        console.error('Error marking remote notifications as read:', error);
    }
}
