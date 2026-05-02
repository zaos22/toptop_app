import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';

import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/components/useColorScheme';
import { configureGoogleAuth } from '@/config/googleAuth';
import { supabase } from '@/config/supabase';
import Colors from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { GlobalUIProvider, useGlobalUI } from '@/context/GlobalUIContext';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import { useProximityNotifications } from '@/hooks/useProximityNotifications';
import * as Notifications from 'expo-notifications';
import { AccountService } from '@/services/accountService';
import { registerForPushNotificationsAsync, savePushTokenToProfile, sendLocalNotification, deleteRemoteNotification } from '@/services/notificationService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    configureGoogleAuth();
  }, []);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <SettingsProvider>
            <GlobalUIProvider>
              <RootLayoutNav />
            </GlobalUIProvider>
          </SettingsProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading, needsUsername, role, appMode } = useAuth();
  const { notificationsEnabled } = useSettings();
  const { isLoading: isGlobalLoading, showToast, setGlobalLoading } = useGlobalUI();
  const segments = useSegments();
  const router = useRouter();

  // Enable proximity notifications
  useProximityNotifications();

  // Push Notification Click Handling and Account Switching
  const lastNotificationResponse = Notifications.useLastNotificationResponse();
  const [pendingRoute, setPendingRoute] = useState<{ pathname: string; params?: any } | string | null>(null);

  useEffect(() => {
    if (
      lastNotificationResponse &&
      lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
    ) {
      const data = lastNotificationResponse.notification.request.content.data;
      if (data) {
        handleNotificationTap(data);
      }
    }
  }, [lastNotificationResponse]);

  const handleNotificationTap = async (data: any) => {
    let targetRoute: any = null;

    if (data?.notification_id) {
        // 1. Borrar notificación de la base de datos automáticamente al interactuar
        deleteRemoteNotification(data.notification_id).catch(() => {});
    }

    if (data?.reviewId) {
        targetRoute = { pathname: `/review/${data.reviewId}`, params: { commentId: data.commentId } };
    } else if (data?.establishmentId) {
        targetRoute = `/establishment/${data.establishmentId}`;
    } else if (data?.type === 'FOLLOW' && data?.followerId) {
        targetRoute = `/user/${data.followerId}`;
    }
    
    if (!targetRoute) return;

    if (data.recipient_id && user && data.recipient_id !== user.id) {
        setGlobalLoading(true, 'Ingresando a la otra cuenta...');
        const { success, requiresAuth } = await AccountService.switchAccount(data.recipient_id);
        setGlobalLoading(false);

        if (success) {
            setPendingRoute(targetRoute);
        } else if (requiresAuth) {
            showToast('La sesión de la cuenta destino expiró', 'error');
            router.replace('/login');
        }
    } else {
        // 2. Navegar sobre la vista "Profile" para que al dar "Atrás" vuelva allá
        router.push('/(tabs)/profile');
        setTimeout(() => router.push(targetRoute as any), 150);
    }
  };

  // Consume pending route once auth has settled
  useEffect(() => {
    if (user && !loading && !isGlobalLoading && pendingRoute) {
        setTimeout(() => {
            // Navegar sobre la vista "Profile"
            router.push('/(tabs)/profile');
            setTimeout(() => {
                router.push(pendingRoute as any);
                setPendingRoute(null);
            }, 150);
        }, 600);
    }
  }, [user, loading, isGlobalLoading, pendingRoute]);

  // Push Notification Token Sync
  useEffect(() => {
    if (user && notificationsEnabled && !loading) {
      (async () => {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await savePushTokenToProfile(user.id, token);
        }
      })();
    }
  }, [user, notificationsEnabled, loading]);

  // Cross-user Notification Listener (Realtime)
  useEffect(() => {
    if (!user || !notificationsEnabled) return;

    // Listen for new notifications in Supabase
    const channel = supabase
      .channel('realtime_mentions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const { title, body, data } = payload.new;
          // Trigger a local notification so the user sees it immediately
          sendLocalNotification(title, body, data);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, notificationsEnabled]);

  useEffect(() => {
    if (loading || isGlobalLoading) return;

    const inAuthGroup = segments[0] === '(tabs)' || 
                        segments[0] === 'establishment' || 
                        segments[0] === 'review' || 
                        segments[0] === 'settings' || 
                        segments[0] === 'edit-profile' || 
                        segments[0] === 'notifications' ||
                        segments[0] === 'social-list' ||
                        segments[0] === 'business';

    if (!user && inAuthGroup) {
      // Redirect to login if NOT authenticated and trying to access app
      router.replace('/login');
    } else if (user && needsUsername && segments[0] !== 'edit-profile') {
      // SI TIENE SESIÓN PERO NECESITA USERNAME (Google signup)
      router.replace('/edit-profile');
    } else if (user && !needsUsername && (segments[0] === 'login' || segments[0] === 'signup' || segments[0] === undefined)) {
      // Redirect to appropriate home based on appMode
      if (appMode === 'business') {
        router.replace('/business/dashboard');
      } else {
        router.replace('/(tabs)');
      }
    } else if (user && !needsUsername) {
      // ENFORCE MODE
      if (appMode === 'business' && segments[0] === '(tabs)') {
        router.replace('/business/dashboard');
      } else if (appMode === 'user' && segments[0] === 'business') {
        router.replace('/(tabs)');
      }
    }
  }, [user, loading, segments, needsUsername, role, appMode]);

  const customTheme = {
    ...(colorScheme?.includes('dark') ? DarkTheme : DefaultTheme),
    colors: {
        ...(colorScheme?.includes('dark') ? DarkTheme.colors : DefaultTheme.colors),
        background: Colors[colorScheme as keyof typeof Colors].background,
        card: Colors[colorScheme as keyof typeof Colors].backgroundSecondary,
        text: Colors[colorScheme as keyof typeof Colors].text,
        primary: Colors[colorScheme as keyof typeof Colors].primary,
    },
  };

  return (
    <ThemeProvider value={customTheme}>
      <StatusBar style={colorScheme?.includes('dark') ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="signup" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="business-landing" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="business-request" options={{ headerShown: false }} />
        <Stack.Screen name="business" options={{ headerShown: false }} />
        <Stack.Screen name="establishment/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="review/add" options={{ headerShown: false, presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
