import * as VideoThumbnails from 'expo-video-thumbnails';
import { Film } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

interface VideoThumbnailProps {
    videoUrl: string;
    style?: any;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({ videoUrl, style }) => {
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        generateThumbnail();
    }, [videoUrl]);

    const generateThumbnail = async () => {
        try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(
                videoUrl,
                {
                    time: 2000, // Capture at 2 seconds
                }
            );
            setThumbnail(uri);
        } catch (e) {
            console.warn('Error generating thumbnail:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, style, { backgroundColor: '#333' }]}>
                <ActivityIndicator size="small" color="#FFF" />
            </View>
        );
    }

    if (!thumbnail) {
        return (
            <View style={[styles.container, style, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                <Film size={24} color="#FFF" />
            </View>
        );
    }

    return (
        <Image
            source={{ uri: thumbnail }}
            style={[styles.container, style]}
            resizeMode="cover"
        />
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
    },
});
