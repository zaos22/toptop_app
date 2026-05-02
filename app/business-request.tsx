import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { BusinessService } from '@/services/businessService';
import { useRouter } from 'expo-router';
import { ArrowLeft, Building2, Mail, MapPin, Phone, Send, CheckCircle2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { 
    KeyboardAvoidingView, 
    Platform, 
    ScrollView, 
    StyleSheet, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    View,
    Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BusinessRequestScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { showToast, setGlobalLoading } = useGlobalUI();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];

    const [form, setForm] = useState({
        business_name: '',
        category: '',
        address: '',
        contact_email: user?.email || '',
        phone: ''
    });

    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (!user) {
            showToast('Debes iniciar sesión para solicitar acceso', 'error');
            router.push('/login');
            return;
        }

        if (!form.business_name || !form.category || !form.address || !form.contact_email) {
            showToast('Por favor, rellena los campos obligatorios', 'error');
            return;
        }

        try {
            setGlobalLoading(true, 'Enviando solicitud...');
            await BusinessService.submitRequest({
                user_id: user.id,
                ...form
            });
            setSubmitted(true);
        } catch (error: any) {
            console.error('Error submitting business request:', error);
            showToast('Error al enviar la solicitud. Inténtalo de nuevo.', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    if (submitted) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={styles.successContainer}>
                    <View style={[styles.successIcon, { backgroundColor: theme.primary + '20' }]}>
                        <CheckCircle2 size={60} color={theme.primary} />
                    </View>
                    <Text style={[styles.successTitle, { color: theme.text }]}>¡Solicitud Recibida!</Text>
                    <Text style={[styles.successDesc, { color: theme.textSecondary }]}>
                        Nuestro equipo revisará los detalles de "{form.business_name}" y se pondrá en contacto contigo a través de {form.contact_email} en las próximas 24-48 horas.
                    </Text>
                    <TouchableOpacity 
                        style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                        onPress={() => router.replace('/(tabs)')}
                    >
                        <Text style={styles.primaryBtnText}>Volver al Inicio</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

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
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Solicitar Acceso Manager</Text>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Datos del Establecimiento</Text>
                    <Text style={[styles.sectionDesc, { color: theme.textSecondary }]}>
                        Completa la información para que podamos verificar tu negocio.
                    </Text>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Nombre del Negocio *</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.card }]}>
                                <Building2 size={20} color={theme.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    placeholder="Ej: La Terraza del Sol"
                                    placeholderTextColor={theme.textSecondary + '80'}
                                    value={form.business_name}
                                    onChangeText={(t) => setForm({...form, business_name: t})}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Categoría *</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.card }]}>
                                <MapPin size={20} color={theme.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    placeholder="Ej: Restaurante, Bar, Café..."
                                    placeholderTextColor={theme.textSecondary + '80'}
                                    value={form.category}
                                    onChangeText={(t) => setForm({...form, category: t})}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Dirección Completa *</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.card }]}>
                                <MapPin size={20} color={theme.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    placeholder="Calle, Número, Ciudad..."
                                    placeholderTextColor={theme.textSecondary + '80'}
                                    value={form.address}
                                    onChangeText={(t) => setForm({...form, address: t})}
                                />
                            </View>
                        </View>

                        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>Contacto</Text>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Email de contacto *</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.card }]}>
                                <Mail size={20} color={theme.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    placeholder="negocio@email.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    placeholderTextColor={theme.textSecondary + '80'}
                                    value={form.contact_email}
                                    onChangeText={(t) => setForm({...form, contact_email: t})}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>Teléfono</Text>
                            <View style={[styles.inputWrapper, { backgroundColor: theme.card }]}>
                                <Phone size={20} color={theme.textSecondary} style={styles.inputIcon} />
                                <TextInput
                                    style={[styles.input, { color: theme.text }]}
                                    placeholder="+34 600 000 000"
                                    keyboardType="phone-pad"
                                    placeholderTextColor={theme.textSecondary + '80'}
                                    value={form.phone}
                                    onChangeText={(t) => setForm({...form, phone: t})}
                                />
                            </View>
                        </View>

                        {!user ? (
                            <TouchableOpacity 
                                style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 30 }]}
                                onPress={() => router.push('/login')}
                            >
                                <Text style={styles.primaryBtnText}>Iniciar Sesión para Enviar</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity 
                                style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 30 }]}
                                onPress={handleSubmit}
                            >
                                <Text style={styles.primaryBtnText}>Enviar Solicitud</Text>
                                <Send size={18} color="#1C1F26" />
                            </TouchableOpacity>
                        )}

                        <Text style={[styles.disclaimer, { color: theme.textSecondary }]}>
                            Al enviar esta solicitud, aceptas que TopTop verifique la propiedad del establecimiento.
                        </Text>
                    </View>
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
    scrollContent: { padding: 20, paddingBottom: 40 },
    sectionTitle: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
    sectionDesc: { fontSize: 14, fontWeight: '500', marginBottom: 25, lineHeight: 20 },
    form: { gap: 15 },
    inputGroup: { gap: 8 },
    label: { fontSize: 13, fontWeight: '700', marginLeft: 4 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingHorizontal: 15,
        height: 56,
    },
    inputIcon: { marginRight: 12 },
    input: { flex: 1, fontSize: 16, fontWeight: '600' },
    primaryBtn: {
        height: 58,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        elevation: 4,
        shadowColor: '#D6B25E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    primaryBtnText: { color: '#1C1F26', fontSize: 16, fontWeight: '900' },
    disclaimer: {
        fontSize: 12,
        textAlign: 'center',
        marginTop: 20,
        lineHeight: 18,
        paddingHorizontal: 20,
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    successIcon: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    successTitle: {
        fontSize: 28,
        fontWeight: '900',
        marginBottom: 15,
        textAlign: 'center',
    },
    successDesc: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
        fontWeight: '500',
    },
});
