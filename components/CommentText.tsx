import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/config/supabase';
import Colors from '@/constants/Colors';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text } from 'react-native';

interface CommentTextProps {
    text: string;
    style?: any;
    onMentionPress?: (userId: string) => void;
    numberOfLines?: number;
    ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
}

export const CommentText: React.FC<CommentTextProps> = ({
    text,
    style,
    onMentionPress,
    numberOfLines,
    ellipsizeMode
}) => {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme || 'light'];

    if (!text) return null;

    // Split text by mentions (keeping the mentions in the result)
    const mentionRegex = /(@[\w.]+)/g;
    const parts = text.split(mentionRegex);

    const handleMentionPress = async (mention: string) => {
        // Remove trailing punctuation like ?? or !! that might be part of the sentence but not the mention
        // Regex /(@[\w.]+)/ matches @ zaos.name but not @zaos??
        // Wait, the split might include ?? in the part if the regex is too broad or too narrow.
        // My split regex is /(@[\w.]+)/g.
        // If text is "hello @zaos??", parts = ["hello ", "@zaos", "??"]
        // Wait, NO. If mentionRegex = /(@[\w.]+)/g:
        // "@zaos??".split(/(@[\w.]+)/g) => ["", "@zaos", "??"]
        // So @zaos is one part, it matches.

        const cleanName = mention.substring(1); // Remove @

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id')
                .or(`display_name.ilike.${cleanName},username.ilike.${cleanName}`)
                .maybeSingle();

            if (data?.id) {
                if (onMentionPress) {
                    onMentionPress(data.id);
                } else {
                    router.push({ pathname: "/user/[id]", params: { id: data.id } });
                }
            }
        } catch (error) {
            console.error('Error finding user for mention:', error);
        }
    };

    return (
        <Text style={style} numberOfLines={numberOfLines} ellipsizeMode={ellipsizeMode}>
            {parts.map((part, index) => {
                if (part.startsWith('@')) {
                    // It's a potential mention. Match against the same regex to confirm
                    const isMention = part.match(mentionRegex);
                    if (isMention) {
                        return (
                            <Text
                                key={index}
                                style={[styles.mention, { color: theme.primary }]}
                                onPress={() => handleMentionPress(part)}
                            >
                                {part}
                            </Text>
                        );
                    }
                }
                return <Text key={index}>{part}</Text>;
            })}
        </Text>
    );
};

const styles = StyleSheet.create({
    mention: {
        fontWeight: 'bold',
    },
});
