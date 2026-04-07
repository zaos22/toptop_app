import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { LucideIcon, X } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message?: string;
    onClose: () => void;
    options?: {
        text: string;
        onPress: () => void | Promise<void>;
        style?: 'default' | 'cancel' | 'destructive' | 'primary';
        icon?: LucideIcon;
    }[];
}

export const CustomAlert = ({ visible, title, message, onClose, options }: CustomAlertProps) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme?.includes('dark');
    const theme = Colors[colorScheme ?? 'dark'];

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(200)}
                    style={StyleSheet.absoluteFill}
                >
                    <Pressable style={styles.backdrop} onPress={onClose} />
                </Animated.View>

                <Animated.View
                    entering={ZoomIn.duration(300)}
                    exiting={ZoomOut.duration(200)}
                    style={[
                        styles.alertCard,
                        {
                            backgroundColor: theme.backgroundSecondary,
                            borderColor: theme.card
                        }
                    ]}
                >
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={20} color={theme.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {message && (
                        <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
                    )}

                    <View style={styles.optionsContainer}>
                        {options?.map((option, index) => {
                            const isDestructive = option.style === 'destructive';
                            const isPrimary = option.style === 'primary';
                            const Icon = option.icon;

                            let btnBg = theme.card;
                            if (isPrimary) btnBg = theme.primary;
                            if (isDestructive) btnBg = isDark ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255, 59, 48, 0.1)';

                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.optionBtn,
                                        { backgroundColor: btnBg }
                                    ]}
                                    onPress={() => {
                                        onClose();
                                        if (option.onPress) {
                                            setTimeout(() => {
                                                option.onPress!();
                                            }, 150);
                                        }
                                    }}
                                >
                                    {Icon && (
                                        <Icon
                                            size={18}
                                            color={isPrimary ? '#1C1F26' : (isDestructive ? theme.error : theme.text)}
                                            style={styles.optionIcon}
                                        />
                                    )}
                                    <Text style={[
                                        styles.optionText,
                                        { color: isPrimary ? '#1C1F26' : theme.text },
                                        isDestructive && { color: theme.error }
                                    ]}>
                                        {option.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    alertCard: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
    },
    closeBtn: {
        padding: 4,
    },
    message: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
        marginBottom: 24,
    },
    optionsContainer: {
        gap: 10,
    },
    optionBtn: {
        height: 52,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    optionIcon: {
        marginRight: 10,
    },
    optionText: {
        fontSize: 15,
        fontWeight: '700',
    },
});
