import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

interface MediaItem {
    uri: string;
    type: 'image' | 'video';
}

interface GemCarouselProps {
    media: MediaItem[];
    width: number;
    height: number;
    onPress?: () => void;
    autoPlay?: boolean;
    autoPlayInterval?: number;
}

export default function GemCarousel({
    media,
    width,
    height,
    onPress,
    autoPlay = true,
    autoPlayInterval = 3000
}: GemCarouselProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);

    // Auto-play functionality
    useEffect(() => {
        if (!autoPlay || media.length <= 1) {
            console.log('Auto-play disabled or single image:', { autoPlay, mediaLength: media.length });
            return;
        }

        console.log('Starting auto-play with', media.length, 'images');

        const interval = setInterval(() => {
            setActiveIndex(current => {
                const nextIndex = (current + 1) % media.length;
                console.log('Auto-advancing from', current, 'to', nextIndex);

                // Scroll to the next image
                scrollViewRef.current?.scrollTo({
                    x: nextIndex * width,
                    animated: true,
                });

                return nextIndex;
            });
        }, autoPlayInterval);

        return () => {
            console.log('Cleaning up auto-play interval');
            clearInterval(interval);
        };
    }, [autoPlay, autoPlayInterval, media.length, width]);

    const handleScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / width);
        if (index !== activeIndex && index >= 0 && index < media.length) {
            setActiveIndex(index);
        }
    };

    if (!media || media.length === 0) return null;

    return (
        <View style={{ width, height, borderRadius: 20, overflow: 'hidden' }}>
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={{ width, height }}
                contentContainerStyle={{ width: width * media.length }}
            >
                {media.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        activeOpacity={0.9}
                        onPress={onPress}
                        style={{ width, height }}
                    >
                        <Image
                            source={{ uri: item.uri }}
                            style={{ width, height }}
                            resizeMode="cover"
                        />
                        {item.type === 'video' && (
                            <View style={styles.videoOverlay}>
                                <View style={styles.playButton}>
                                    <View style={styles.playIcon} />
                                </View>
                            </View>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Pagination Dots */}
            {media.length > 1 && (
                <View style={styles.pagination}>
                    {media.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: index === activeIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                                    width: index === activeIndex ? 12 : 6
                                },
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    pagination: {
        position: 'absolute',
        bottom: 85,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        pointerEvents: 'none',
    },
    dot: {
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 3,
        elevation: 5,
    },
    videoOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    playButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    playIcon: {
        width: 0,
        height: 0,
        marginLeft: 4,
        borderLeftWidth: 20,
        borderTopWidth: 12,
        borderBottomWidth: 12,
        borderLeftColor: '#000',
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
    },
});
