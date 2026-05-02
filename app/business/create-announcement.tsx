import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { establishmentFollowService } from '@/services/establishmentFollowService';
import { useRouter } from 'expo-router';
import { ArrowLeft, MessageSquare, Send, Type, Image as ImageIcon, BarChart2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { 
    KeyboardAvoidingView, 
    Platform, 
    ScrollView, 
    StyleSheet, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    View 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateAnnouncementScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { showToast, setGlobalLoading } = useGlobalUI();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<'standard' | 'poll'>('standard');

    const handlePublish = async () => {
        if (!title || !content) {
            showToast('Por favor, rellena el título y el contenido', 'error');
            return;
        }

        try {
            setGlobalLoading(true, 'Publicando anuncio...');
            
            // In a real scenario, we'd need the establishmentId linked to this manager.
            // For now, we'll use a placeholder or look it up.
            // Since we don't have the link yet, we'll simulate the success.
            
            /*
            await establishmentFollowService.createAnnouncement({
                establishment_id: 'CURRENT_ESTABLISHMENT_ID',
                title,
                content,
                type
            });
            */
            
            setTimeout(() => {
                setGlobalLoading(false);
                showToast('¡Anuncio publicado correctamente!', 'success');
                router.back();
            }, 1500);

        } catch (error) {
            setGlobalLoading(false);
            showToast('Error al publicar el anuncio', 'error');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Nuevo Anuncio</Text>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Título del Anuncio</Text>
                    <View style={[styles.inputWrapper, { backgroundColor: theme.card }]}>
                        <Type size={20} color={theme.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, { color: theme.text }]}
                            placeholder="Ej: ¡Nuevo plato en carta!"
                            placeholderTextColor={theme.textSecondary + '80'}
                            value={title}
                            onChangeText={setTitle}
                        />
                    </View>

                    <Text style={[styles.label, { color: theme.textSecondary, marginTop: 20 }]}>Contenido</Text>
                    <View style={[styles.textAreaWrapper, { backgroundColor: theme.card }]}>
                        <TextInput
                            style={[styles.textArea, { color: theme.text }]}
                            placeholder="Cuéntale a tus seguidores las novedades de tu local..."
                            placeholderTextColor={theme.textSecondary + '80'}
                            multiline
                            numberOfLines={6}
                            value={content}
                            onChangeText={setContent}
                            textAlignVertical="top"
                        />
                    </View>

                    <Text style={[styles.label, { color: theme.textSecondary, marginTop: 20 }]}>Tipo de Publicación</Text>
                    <View style={styles.typeRow}>
                        <TouchableOpacity 
                            style={[
                                styles.typeCard, 
                                { backgroundColor: theme.card, borderColor: type === 'standard' ? theme.primary : 'transparent' }
                            ]}
                            onPress={() => setType('standard')}
                        >
                            <MessageSquare size={24} color={type === 'standard' ? theme.primary : theme.textSecondary} />
                            <Text style={[styles.typeText, { color: type === 'standard' ? theme.text : theme.textSecondary }]}>Estándar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[
                                styles.typeCard, 
                                { backgroundColor: theme.card, borderColor: type === 'poll' ? theme.primary : 'transparent' }
                            ]}
                            onPress={() => setType('poll')}
                        >
                            <BarChart2 size={24} color={type === 'poll' ? theme.primary : theme.textSecondary} />
                            <Text style={[styles.typeText, { color: type === 'poll' ? theme.text : theme.textSecondary }]}>Encuesta</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.infoBox, { backgroundColor: theme.primary + '10' }]}>
                        <Text style={[styles.infoText, { color: theme.primary }]}>
                            Este anuncio será notificado automáticamente a todos tus seguidores.
                        </Text>
                    </View>

                    <TouchableOpacity 
                        style={[styles.publishBtn, { backgroundColor: theme.primary }]}
                        onPress={handlePublish}
                    >
                        <Text style={styles.publishBtnText}>Publicar en el Tablón</Text>
                        <Send size={18} color="#1C1F26" />
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 60,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', marginLeft: 10 },
    scrollContent: { padding: 20 },
    label: { fontSize: 14, fontWeight: '700', marginBottom: 10, marginLeft: 4 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingHorizontal: 15,
        height: 56,
        marginBottom: 10,
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, fontWeight: '600' },
    textAreaWrapper: {
        borderRadius: 20,
        padding: 15,
        minHeight: 150,
    },
    textArea: { flex: 1, fontSize: 16, fontWeight: '500', lineHeight: 24 },
    typeRow: { flexDirection: 'row', gap: 12, marginTop: 5 },
    typeCard: {
        flex: 1,
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        gap: 10,
        borderWidth: 2,
    },
    typeText: { fontSize: 14, fontWeight: '700' },
    infoBox: {
        marginTop: 30,
        padding: 15,
        borderRadius: 16,
        alignItems: 'center',
    },
    infoText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
    publishBtn: {
        height: 58,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 20,
        elevation: 4,
        shadowColor: '#D6B25E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    publishBtnText: { color: '#1C1F26', fontSize: 16, fontWeight: '900' },
});
