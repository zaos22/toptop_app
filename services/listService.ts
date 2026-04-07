import { supabase } from '@/config/supabase';

export interface UserList {
    id: string;
    userId: string;
    name: string;
    itemCount: number;
    isPublic: boolean;
    isHalalOwner?: boolean;
    createdAt: string;
}

export interface ListItem {
    id: string;
    listId: string;
    establishmentId: string;
    establishmentName: string;
    establishmentImage?: string;
    createdAt: string;
}

/**
 * Fetches all items in a specific list
 */
export const getListItems = async (listId: string): Promise<ListItem[]> => {
    try {
        const { data, error } = await supabase
            .from('list_items')
            .select('*')
            .eq('list_id', listId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map(item => ({
            id: item.id,
            listId: item.list_id,
            establishmentId: item.establishment_id,
            establishmentName: item.establishment_name,
            establishmentImage: item.establishment_image,
            createdAt: item.created_at,
        }));
    } catch (error) {
        console.error('Error fetching list items:', error);
        return [];
    }
};

/**
 * Fetches a specific list's details
 */
export const getListById = async (listId: string): Promise<UserList | null> => {
    try {
        const { data, error } = await supabase
            .from('user_lists')
            .select('*, profiles!user_id(is_halal)')
            .eq('id', listId)
            .single();

        if (error) throw error;

        return {
            id: data.id,
            userId: data.user_id,
            name: data.name,
            itemCount: 0, 
            isPublic: data.is_public ?? false,
            isHalalOwner: data.profiles?.is_halal ?? false, // Added join field
            createdAt: data.created_at,
        };
    } catch (error) {
        console.error('Error fetching list details:', error);
        return null;
    }
};

/**
 * Updates list details (name, privacy)
 */
export const updateList = async (listId: string, updates: { name?: string; is_public?: boolean }): Promise<void> => {
    try {
        const { error } = await supabase
            .from('user_lists')
            .update(updates)
            .eq('id', listId);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating list:', error);
        throw error;
    }
};

/**
 * Deletes an entire list
 */
export const deleteList = async (listId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('user_lists')
            .delete()
            .eq('id', listId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting list:', error);
        throw error;
    }
};

/**
 * Fetches all lists for a user
 */
export const getUserLists = async (userId: string): Promise<UserList[]> => {
    console.log('[ListService] Getting lists for:', userId);
    try {
        const { data, error } = await supabase
            .from('user_lists')
            .select('*, list_items(count)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            if (error.code !== 'PGRST205') {
                console.error('[ListService] Error fetching lists:', error);
            }
            return [{ id: 'default', userId, name: 'Mis Favoritos', itemCount: 0, isPublic: false, createdAt: new Date().toISOString() }];
        }
        
        console.log(`[ListService] Fetched ${data?.length || 0} lists`);

        return data.map(item => ({
            id: item.id,
            userId: item.user_id,
            name: item.name,
            itemCount: item.list_items?.[0]?.count || 0,
            isPublic: item.is_public ?? false,
            createdAt: item.created_at,
        }));
    } catch (error) {
        console.error('[ListService] Exception getting lists:', error);
        return [{ id: 'default', userId, name: 'Mis Favoritos', itemCount: 0, isPublic: false, createdAt: new Date().toISOString() }];
    }
};

/**
 * Creates a new list for a user
 */
export const createList = async (userId: string, name: string, isPublic: boolean = false): Promise<UserList | null> => {
    try {
        const { data, error } = await supabase
            .from('user_lists')
            .insert({
                user_id: userId,
                name: name,
                is_public: isPublic,
            })
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            userId: data.user_id,
            name: data.name,
            itemCount: 0,
            isPublic: data.is_public ?? false,
            createdAt: data.created_at,
        };
    } catch (error) {
        console.error('Error creating list:', error);
        return null;
    }
};

/**
 * Adds an establishment to a list
 */
export const addToList = async (
    listId: string,
    establishmentId: string,
    establishmentName: string,
    establishmentImage?: string
): Promise<void> => {
    try {
        // Check if already in list to avoid duplicates
        const { data: existing } = await supabase
            .from('list_items')
            .select('id')
            .eq('list_id', listId)
            .eq('establishment_id', establishmentId)
            .maybeSingle();

        if (existing) return;

        const { error } = await supabase.from('list_items').insert({
            list_id: listId,
            establishment_id: establishmentId,
            establishment_name: establishmentName,
            establishment_image: establishmentImage,
        });

        if (error) throw error;
    } catch (error) {
        console.error('Error adding to list:', error);
        throw error;
    }
};

/**
 * Removes an establishment from a list
 */
export const removeFromList = async (listId: string, establishmentId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('list_items')
            .delete()
            .eq('list_id', listId)
            .eq('establishment_id', establishmentId);

        if (error) throw error;
    } catch (error) {
        console.error('Error removing from list:', error);
        throw error;
    }
};

/**
 * Checks if an establishment is in any of the user's lists
 */
export const isEstablishmentFavorited = async (userId: string, establishmentId: string): Promise<boolean> => {
    try {
        // First get user list IDs
        const { data: lists } = await supabase
            .from('user_lists')
            .select('id')
            .eq('user_id', userId);

        if (!lists || lists.length === 0) return false;

        const listIds = lists.map(l => l.id);

        const { count, error } = await supabase
            .from('list_items')
            .select('*', { count: 'exact', head: true })
            .in('list_id', listIds)
            .eq('establishment_id', establishmentId);

        if (error) throw error;
        return (count || 0) > 0;
    } catch (error: any) {
        if (error?.code !== 'PGRST205') {
            console.error('Error checking favorite status:', error);
        }
        return false;
    }
};
