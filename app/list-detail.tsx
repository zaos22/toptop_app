import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useGlobalUI } from '@/context/GlobalUIContext';
import { deleteList, getListById, getListItems, ListItem, removeFromList, updateList } from '@/services/listService';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Edit3, MapPin, Lock as PrivateIcon, Globe as PublicIcon, ShieldCheck, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ListDetailScreen() {
    const { id, initialName } = useLocalSearchParams<{ id: string, initialName: string }>();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'dark'];
    const { user } = useAuth();
    const { showToast, showAlert, setGlobalLoading } = useGlobalUI();

    const [items, setItems] = useState<ListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [listName, setListName] = useState(initialName || 'Loading...');
    const [isPublic, setIsPublic] = useState(false);
    const [isOwner, setIsOwner] = useState(false);

    // Edit Modal State
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editName, setEditName] = useState('');
    const [editPublic, setEditPublic] = useState(false);

    useEffect(() => {
        loadListData();
    }, [id]);

    const loadListData = async () => {
        if (!id) return;
        setLoading(true);
        const startTime = Date.now();

        try {
            const [listData, listItems] = await Promise.all([
                getListById(id),
                getListItems(id),
            ]);

            setItems(listItems);

            if (listData) {
                setListName(listData.name);
                setIsPublic(listData.isPublic);
                setIsOwner(user?.id === listData.userId);
            }
        } catch (error) {
            console.error('Error loading list data:', error);
            showToast('Could not load list', 'error');
        } finally {
            // Ensure minimum 1 second loading for animation feel
            const elapsed = Date.now() - startTime;
            if (elapsed < 1000) {
                await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
            }
            setLoading(false);
        }
    };

    const handleUpdateList = async () => {
        setGlobalLoading(true, 'Saving changes...');
        try {
            await updateList(id, { name: editName, is_public: editPublic });
            setListName(editName);
            setIsPublic(editPublic);
            setIsEditModalVisible(false);
            showToast('List updated', 'success');
        } catch (error) {
            console.error(error);
            showToast('Error updating', 'error');
        } finally {
            setGlobalLoading(false);
        }
    };

    const handleRemoveItem = (itemId: string, establishmentId: string, name: string) => {
        showAlert({
            title: 'Remove place',
            message: `Do you want to remove "${name}" from this list?`,
            options: [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                    text: 'Remove',
                    style: 'destructive',
                    icon: Trash2,
                    onPress: async () => {
                        try {
                            setGlobalLoading(true, 'Removing place...');
                            await removeFromList(id, establishmentId);
                            setItems(items.filter(item => item.id !== itemId));
                            showToast('Place removed', 'success');
                        } catch (error) {
                            console.error(error);
                            showToast('Error removing place', 'error');
                        } finally {
                            setGlobalLoading(false);
                        }
                    }
                }
            ]
        });
    };

    const handleDeleteList = () => {
        showAlert({
            title: 'Delete list',
            message: 'Are you sure? This action cannot be undone and will delete all saved places here.',
            options: [
                { text: 'Cancel', style: 'cancel', onPress: () => { } },
                {
                    text: 'Delete All',
                    style: 'destructive',
                    icon: Trash2,
                    onPress: async () => {
                        try {
                            setGlobalLoading(true, 'Deleting list...');
                            await deleteList(id);
                            showToast('List deleted', 'success');
                            router.back();
                        } catch (error) {
                            console.error(error);
                            showToast('Error deleting', 'error');
                        } finally {
                            setGlobalLoading(false);
                        }
                    }
                }
            ]
        });
    };

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: theme.background }]}>
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{ marginTop: 20, color: theme.textSecondary, fontSize: 16, fontWeight: '500' }}>
                    Exploring the list...
                </Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <Stack.Screen options={{ headerShown: false }} />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={28} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{listName}</Text>
                    <View style={styles.privacyIndicator}>
                        {isPublic ? (
                            <PublicIcon size={14} color={theme.primary} />
                        ) : (
                            <PrivateIcon size={14} color={theme.textSecondary} />
                        )}
                        <Text style={[styles.privacyText, { color: isPublic ? theme.primary : theme.textSecondary }]}>
                            {isPublic ? 'Public' : 'Private'}
                        </Text>
                    </View>
                </View>
                {isOwner && (
                    <TouchableOpacity
                        onPress={() => {
                            setEditName(listName);
                            setEditPublic(isPublic);
                            setIsEditModalVisible(true);
                        }}
                        style={styles.editBtn}
                    >
                        <Edit3 size={22} color={theme.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* List Items */}
            <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.itemCard, { backgroundColor: theme.card }]}
                        onPress={() => router.push(`/establishment/${item.establishmentId}`)}
                    >
                        <Image
                            source={{ uri: item.establishmentImage || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400' }}
                            style={styles.itemImage}
                        />
                        <View style={styles.itemInfo}>
                            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>{item.establishmentName}</Text>
                            <View style={styles.itemMeta}>
                                <MapPin size={12} color={theme.textSecondary} />
                                <Text style={[styles.itemDistance, { color: theme.textSecondary }]}>Saved visit</Text>
                            </View>
                        </View>
                        {isOwner && (
                            <TouchableOpacity
                                onPress={() => handleRemoveItem(item.id, item.establishmentId, item.establishmentName)}
                                style={styles.removeBtn}
                            >
                                <Trash2 size={20} color={theme.error} opacity={0.7} />
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <ShieldCheck size={48} color={theme.textSecondary} opacity={0.3} />
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>This list is empty.</Text>
                        <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>Search for places and add them to see them here.</Text>
                    </View>
                }
            />

            {/* Edit Modal */}
            <Modal
                visible={isEditModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit List</Text>
                            <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                                <X size={24} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.label, { color: theme.textSecondary }]}>List name</Text>
                        <TextInput
                            style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                            value={editName}
                            onChangeText={setEditName}
                            placeholder="Write the name..."
                            placeholderTextColor={theme.textSecondary}
                        />

                        <View style={styles.switchRow}>
                            <View>
                                <Text style={[styles.switchLabel, { color: theme.text }]}>Public List</Text>
                                <Text style={[styles.switchDesc, { color: theme.textSecondary }]}>Allow other users to see your selection.</Text>
                            </View>
                            <Switch
                                value={editPublic}
                                onValueChange={setEditPublic}
                                trackColor={{ false: '#333', true: theme.primary + '50' }}
                                thumbColor={editPublic ? theme.primary : '#f4f3f4'}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.dangerBtn, { borderColor: theme.error }]}
                                onPress={handleDeleteList}
                            >
                                <Trash2 size={18} color={theme.error} />
                                <Text style={[styles.dangerBtnText, { color: theme.error }]}>Delete</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                                onPress={handleUpdateList}
                            >
                                <Text style={styles.saveBtnText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        gap: 15,
    },
    backBtn: { padding: 5 },
    headerTitleContainer: { flex: 1 },
    headerTitle: { fontSize: 22, fontWeight: '900' },
    privacyIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    privacyText: { fontSize: 12, fontWeight: '600' },
    editBtn: { padding: 10, borderRadius: 12, backgroundColor: 'rgba(214, 178, 94, 0.1)' },

    listContent: { padding: 20, paddingBottom: 100 },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 20,
        marginBottom: 15,
        elevation: 2,
    },
    itemImage: { width: 60, height: 60, borderRadius: 15 },
    itemInfo: { flex: 1, marginLeft: 15 },
    itemName: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
    itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    itemDistance: { fontSize: 12, fontWeight: '500' },
    removeBtn: { padding: 10 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { fontSize: 18, fontWeight: '800', marginTop: 20 },
    emptySubtext: { fontSize: 14, fontWeight: '500', marginTop: 8, textAlign: 'center', paddingHorizontal: 50 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 25 },
    modalContent: { borderRadius: 30, padding: 25 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { fontSize: 20, fontWeight: '900' },
    label: { fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
    input: { height: 55, borderRadius: 16, paddingHorizontal: 20, fontSize: 16, fontWeight: '600', marginBottom: 25 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    switchLabel: { fontSize: 16, fontWeight: '800' },
    switchDesc: { fontSize: 13, fontWeight: '500', marginTop: 2 },
    modalActions: { flexDirection: 'row', gap: 12 },
    dangerBtn: { flex: 1, height: 55, borderRadius: 18, borderStyle: 'solid', borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    dangerBtnText: { fontSize: 16, fontWeight: '800' },
    saveBtn: { flex: 2, height: 55, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { color: '#1C1F26', fontSize: 16, fontWeight: '900' },
});
