import { CustomAlert } from '@/components/CustomAlert';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { AlertCircle, CheckCircle2, Info, LucideIcon } from 'lucide-react-native';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Modal, PanResponder, PanResponderGestureState, StyleSheet, Text, View } from 'react-native';

const { width } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface AlertConfig {
    title: string;
    message?: string;
    options?: {
        text: string;
        onPress: () => void | Promise<void>;
        style?: 'default' | 'cancel' | 'destructive' | 'primary';
        icon?: LucideIcon;
    }[];
}

interface GlobalUIContextType {
    showToast: (message: string, type?: ToastType) => void;
    showAlert: (config: AlertConfig) => void;
    setGlobalLoading: (loading: boolean, message?: string) => void;
    isLoading: boolean;
}

const GlobalUIContext = createContext<GlobalUIContextType | undefined>(undefined);

export const useGlobalUI = () => {
    const context = useContext(GlobalUIContext);
    if (!context) {
        throw new Error('useGlobalUI must be used within a GlobalUIProvider');
    }
    return context;
};

export const GlobalUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    const [toast, setToast] = useState<Toast | null>(null);
    const [alert, setAlert] = useState<AlertConfig | null>(null);
    const [alertVisible, setAlertVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string | undefined>();

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(7);
        // Setting a new toast will replace the old one (one at a time)
        setToast({ id, message, type });
    }, []);

    const hideToast = useCallback((id: string) => {
        setToast(current => current?.id === id ? null : current);
    }, []);

    const showAlert = useCallback((config: AlertConfig) => {
        const finalConfig = {
            ...config,
            options: config.options || [{ text: 'Continuar', onPress: () => { } }]
        };
        setAlert(finalConfig as any);
        setAlertVisible(true);
    }, []);

    const setGlobalLoading = useCallback((isLoading: boolean, message?: string) => {
        console.log(`[GlobalUI] setGlobalLoading: ${isLoading} (${message || 'no message'})`);
        setLoading(isLoading);
        setLoadingMessage(message);
    }, []);


    return (
        <GlobalUIContext.Provider value={{ showToast, showAlert, setGlobalLoading, isLoading: loading }}>
            {children}

            {/* Global Toasts */}
            <View style={styles.toastContainer} pointerEvents="box-none">
                {toast && (
                    <ToastItem 
                        key={toast.id} 
                        toast={toast} 
                        theme={theme} 
                        onDismiss={() => hideToast(toast.id)} 
                    />
                )}
            </View>

            {/* Global Alert */}
            {alert && (
                <CustomAlert
                    visible={alertVisible}
                    title={alert.title}
                    message={alert.message}
                    onClose={() => setAlertVisible(false)}
                    options={alert.options}
                />
            )}

            {/* Global Loading Overlay */}
            <Modal
                transparent
                visible={loading}
                animationType="fade"
                statusBarTranslucent
            >
                <View style={styles.loadingOverlay}>
                    <View style={[
                        styles.loadingCard,
                        {
                            backgroundColor: theme.backgroundSecondary,
                            borderColor: theme.card
                        }
                    ]}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={[styles.loadingText, { color: theme.text }]}>
                            {loadingMessage || 'Procesando...'}
                        </Text>
                    </View>
                </View>
            </Modal>
        </GlobalUIContext.Provider>
    );
};

const ToastItem = ({ toast, theme, onDismiss }: { toast: Toast, theme: any, onDismiss: () => void }) => {
    const colorScheme = useColorScheme();
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const panY = useRef(new Animated.Value(0)).current;
    const isDismissing = useRef(false);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState: PanResponderGestureState) => Math.abs(gestureState.dy) > 5,
            onPanResponderMove: (_, gestureState: PanResponderGestureState) => {
                // Only allow swiping up (negative dy)
                if (gestureState.dy < 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState: PanResponderGestureState) => {
                if (gestureState.dy < -40 || gestureState.vy < -0.5) {
                    dismiss();
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                        bounciness: 8,
                    }).start();
                }
            },
        })
    ).current;

    const dismiss = useCallback(() => {
        if (isDismissing.current) return;
        isDismissing.current = true;
        
        Animated.parallel([
            Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
        ]).start(() => onDismiss());
    }, [onDismiss]);

    React.useEffect(() => {
        // Entrance animation
        Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 8 }),
            Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();

        // Auto-dismiss after 3.5s
        const timer = setTimeout(() => {
            dismiss();
        }, 3500);

        return () => clearTimeout(timer);
    }, [toast.id]);

    const getIcon = () => {
        switch (toast.type) {
            case 'success': return <CheckCircle2 size={20} color={theme.primary} />;
            case 'error': return <AlertCircle size={20} color={theme.error} />;
            default: return <Info size={20} color={theme.text} />;
        }
    };

    return (
        <Animated.View 
            {...panResponder.panHandlers}
            style={[
                styles.toastItem,
                { 
                    opacity, 
                    transform: [
                        { translateY: Animated.add(translateY, panY) }
                    ] 
                },
                {
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.card
                }
            ]}
        >
            <View style={styles.toastIcon}>{getIcon()}</View>
            <Text style={[styles.toastText, { color: theme.text }]}>{toast.message}</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        zIndex: 9999,
        gap: 10,
    },
    toastItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    toastIcon: {
        marginRight: 12,
    },
    toastText: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    loadingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingCard: {
        padding: 30,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        width: 200,
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
});
