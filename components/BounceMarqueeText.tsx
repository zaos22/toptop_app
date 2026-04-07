import React, { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

interface BounceMarqueeTextProps {
    text: string;
    style?: StyleProp<TextStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    speed?: number; // pixels per second
    delay?: number; // ms to wait at each end
}

export const BounceMarqueeText: React.FC<BounceMarqueeTextProps> = ({
    text,
    style,
    containerStyle,
    speed = 30, // Slower for Discovery feed as requested
    delay = 1500,
}) => {
    const [containerWidth, setContainerWidth] = useState(0);
    const [textWidth, setTextWidth] = useState(0);
    const translateX = useSharedValue(0);

    const shouldAnimate = textWidth > containerWidth && containerWidth > 0;

    useEffect(() => {
        if (shouldAnimate) {
            translateX.value = 0;
            // The distance to travel is the difference between text width and container width
            // plus a small extra space to ensure the last character is fully clear
            const travelDistance = textWidth - containerWidth + 20;
            const duration = (travelDistance / speed) * 1000;

            translateX.value = withRepeat(
                withSequence(
                    // Wait at the start
                    withDelay(delay, withTiming(-travelDistance, {
                        duration: duration,
                        easing: Easing.inOut(Easing.quad),
                    })),
                    // Wait at the end
                    withDelay(delay, withTiming(0, {
                        duration: duration,
                        easing: Easing.inOut(Easing.quad),
                    }))
                ),
                -1, // Infinite repeat
                false
            );
        } else {
            cancelAnimation(translateX);
            translateX.value = 0;
        }
    }, [shouldAnimate, textWidth, containerWidth, speed, delay]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }],
        };
    });

    return (
        <View
            style={[styles.container, containerStyle]}
            onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0) setContainerWidth(w);
            }}
        >
            {/* Hidden measurement */}
            <View style={styles.measureContainer} pointerEvents="none">
                <View style={{ flexDirection: 'row', width: 5000 }}>
                    <Text
                        style={[style]}
                        onLayout={(e) => {
                            const w = e.nativeEvent.layout.width;
                            if (w > 0 && w < 5000) setTextWidth(w);
                        }}
                        numberOfLines={1}
                    >
                        {text}
                    </Text>
                </View>
            </View>

            <View style={styles.content}>
                <Animated.View style={[styles.textWrapper, animatedStyle, { width: shouldAnimate ? textWidth : '100%' }]}>
                    <Text
                        style={[style, { width: shouldAnimate ? textWidth : undefined }]}
                        numberOfLines={1}
                    >
                        {text}
                    </Text>
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        maxWidth: '100%',
    },
    measureContainer: {
        position: 'absolute',
        opacity: 0,
        top: -1000,
        left: -1000,
    },
    content: {
        flexDirection: 'row',
    },
    textWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
