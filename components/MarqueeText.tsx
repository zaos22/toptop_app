import React, { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

interface MarqueeTextProps {
    text: string;
    style?: StyleProp<TextStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    speed?: number; // pixels per second
    spacing?: number;
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({
    text,
    style,
    containerStyle,
    speed = 50,
    spacing = 100,
}) => {
    const [containerWidth, setContainerWidth] = useState(0);
    const [textWidth, setTextWidth] = useState(0);
    const translateX = useSharedValue(0);

    const shouldAnimate = textWidth > containerWidth && containerWidth > 0;

    useEffect(() => {
        if (shouldAnimate) {
            translateX.value = 0;
            const totalDistance = textWidth + spacing;
            const duration = (totalDistance / speed) * 1000;

            translateX.value = withRepeat(
                withTiming(-totalDistance, {
                    duration: duration,
                    easing: Easing.linear,
                }),
                -1,
                false
            );
        } else {
            cancelAnimation(translateX);
            translateX.value = 0;
        }
    }, [shouldAnimate, textWidth, containerWidth, speed, spacing]);

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
            {/* Hidden measurement - forcing single line with massive width */}
            <View style={styles.measureContainer} pointerEvents="none">
                <View style={{ flexDirection: 'row', width: 10000 }}>
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
                <Animated.View style={[styles.textWrapper, animatedStyle, { width: shouldAnimate ? (textWidth * 2 + spacing * 2) : '100%' }]}>
                    <Text
                        style={[style, { width: shouldAnimate ? textWidth : undefined }]}
                        numberOfLines={1}
                    >
                        {text}
                    </Text>
                    {shouldAnimate && (
                        <Text
                            style={[style, { marginLeft: spacing, width: textWidth }]}
                            numberOfLines={1}
                        >
                            {text}
                        </Text>
                    )}
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
