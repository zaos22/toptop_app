import { supabase } from '@/config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { GoogleSignin } from '@react-native-google-signin/google-signin';

const ACCOUNTS_STORAGE_KEY = 'toptop_active_sessions';

export interface SavedAccount {
    id: string;
    email: string;
    displayName: string;
    photoURL?: string;
    provider?: string;
    session: any;
    lastActive: string;
}

export const AccountService = {
    /**
     * Saves the current session to the list of available accounts
     */
    async saveCurrentAccount(user: any, session: any) {
        if (!user || !session?.access_token) return;

        try {
            const accounts = await this.getSavedAccounts();
            const existingAccount = accounts.find(a => a.id === user.id);

            // Use metadata directly, or keep existing account values if metadata is empty
            let displayName = user.user_metadata?.full_name || user.user_metadata?.name || existingAccount?.displayName || 'Usuario';
            let photoURL = user.user_metadata?.avatar_url || user.user_metadata?.picture || existingAccount?.photoURL;

            const newAccount: SavedAccount = {
                id: user.id,
                email: user.email || '',
                displayName: displayName,
                photoURL: photoURL,
                provider: user.app_metadata?.provider || (user.identities && user.identities[0]?.provider) || 'email',
                session: {
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                },
                lastActive: new Date().toISOString(),
            };

            const index = accounts.findIndex(a => a.id === user.id);
            if (index !== -1) {
                accounts[index] = newAccount;
            } else {
                accounts.push(newAccount);
            }

            await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
        } catch (error) {
            console.error('[AccountService] Error saving account:', error);
        }
    },

    /**
     * Retrieves all saved accounts
     */
    async getSavedAccounts(): Promise<SavedAccount[]> {
        try {
            const data = await AsyncStorage.getItem(ACCOUNTS_STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error getting accounts:', error);
            return [];
        }
    },

    /**
     * Switches to a specific saved account
     * Returns { success: boolean, requiresAuth?: boolean, email?: string }
     */
    async switchAccount(accountId: string): Promise<{ success: boolean; requiresAuth?: boolean; email?: string }> {
        try {
            const accounts = await this.getSavedAccounts();
            const account = accounts.find(a => a.id === accountId);

            if (!account || !account.session?.access_token) {
                await this.removeAccount(accountId);
                return { success: false, requiresAuth: true };
            }

            // Timeout de 8 segundos para evitar bloqueos si la red falla o el token es inválido
            const sessionPromise = supabase.auth.setSession({
                access_token: account.session.access_token,
                refresh_token: account.session.refresh_token,
            });

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TIMEOUT_SESSION')), 8000)
            );

            const { error }: any = await Promise.race([sessionPromise, timeoutPromise]);

            if (error) {
                console.warn('[AccountService] Error o Expired session:', error.message);
                return { success: false, requiresAuth: true, email: account.email };
            }

            // Actualizar discretamente el timestamp de última actividad
            this.getSavedAccounts().then(accounts => {
                const updated = accounts.map(a =>
                    a.id === accountId ? { ...a, lastActive: new Date().toISOString() } : a
                );
                AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(updated));
            }).catch(() => {});

            return { success: true };
        } catch (error) {
            console.error('[AccountService] Fatal error switching account:', error);
            return { success: false };
        }
    },

    async clearAllAccounts() {
        await AsyncStorage.removeItem(ACCOUNTS_STORAGE_KEY);
    },

    /**
     * Removes an account from the saved list
     */
    async removeAccount(accountId: string) {
        try {
            let accounts = await this.getSavedAccounts();
            accounts = accounts.filter(a => a.id !== accountId);
            await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
        } catch (error) {
            console.error('Error removing account:', error);
        }
    },

    /**
     * Completely deletes user record and associated data (profiles, etc)
     */    async deleteUserAccount(userId: string) {
        console.log('[AccountService] EXTERMINIO TOTAL EN CURSO PARA:', userId);
        
        const checkError = (res: { error: any }, step: string, isCritical = false) => {
            if (res.error) {
                console.error(`[AccountService] Error en paso: ${step}`, res.error);
                if (isCritical) {
                    throw new Error(`Error en ${step}: ${res.error.message || JSON.stringify(res.error)}`);
                }
            }
        };

        try {
            // 0. Obtener IDs de sus reseñas para borrar dependencias (likes/comentarios de otros)
            const { data: userReviews } = await supabase.from('reviews').select('id').eq('user_id', userId);
            const reviewIds = userReviews?.map(r => r.id) || [];

            if (reviewIds.length > 0) {
                console.log(`[AccountService] Borrando dependencias de ${reviewIds.length} reseñas...`);
                checkError(await supabase.from('review_likes').delete().in('review_id', reviewIds), 'likes en reseñas del usuario');
                checkError(await supabase.from('review_comments').delete().in('review_id', reviewIds), 'comentarios en reseñas del usuario');
            }

            // 1. Borrar datos donde el usuario es el SUJETO
            const tables = [
                { name: 'notifications', userCol: 'user_id' },
                { name: 'notifications', userCol: 'sender_id' }, // Notificaciones que él envió
                { name: 'follows', userCol: 'follower_id' },
                { name: 'follows', userCol: 'target_id' },     // Borrar a quien le seguía
                { name: 'review_likes', userCol: 'user_id' },
                { name: 'comment_likes', userCol: 'user_id' },
                { name: 'review_comments', userCol: 'user_id' },
                { name: 'visits', userCol: 'user_id' },
                { name: 'reviews', userCol: 'user_id' }
            ];

            for (const t of tables) {
                console.log(`[AccountService] Borrando ${t.name} (col: ${t.userCol})...`);
                checkError(await supabase.from(t.name).delete().eq(t.userCol, userId), `tabla ${t.name}`);
            }

            // 2. Limpiar listas
            const { data: lists } = await supabase.from('user_lists').select('id').eq('user_id', userId);
            if (lists && lists.length > 0) {
                const listIds = lists.map(l => l.id);
                checkError(await supabase.from('list_items').delete().in('list_id', listIds), 'items de listas');
                checkError(await supabase.from('user_lists').delete().eq('user_id', userId), 'listas');
            }

            // 3. PASO CLAVE: Borrar el perfil público (CRITICO)
            console.log('[AccountService] Borrando perfil...');
            const profRes = await supabase.from('profiles').delete().eq('id', userId);
            checkError(profRes, 'borrado de perfil', true); // TRUE = Lanzará error si falla

            // 4. Intentar borrar el usuario de la autenticación de Supabase (Requires RPC)
            console.log('[AccountService] Intentando borrar identidad completa de auth.users...');
            const { error: rpcError } = await supabase.rpc('delete_user');
            if (rpcError) {
                console.warn('[AccountService] RPC delete_user no disponible o falló (es necesario configurarlo en Supabase). Fallback a limpiar metadatos.', rpcError);
                // Si el RPC falla, hacemos fallback a limpiar metadatos de identidad actuales
                await supabase.auth.updateUser({
                    data: { 
                        username: null, 
                        user_name: null, 
                        display_name: null,
                        full_name: 'Cuenta Eliminada',
                        avatar_url: null,
                        onboarded: false 
                    }
                });
            } else {
                console.log('[AccountService] Usuario borrado de auth.users con éxito.');
            }

            // 5. Limpieza local y Logout obligatorio
            await this.removeAccount(userId);
            
            // Limpia TOTAL de tokens y estados para forzar re-auth limpia
            const keys = await AsyncStorage.getAllKeys();
            const toRemove = keys.filter(k => k.includes('supabase.auth') || k.includes('sb-'));
            for (const k of toRemove) await AsyncStorage.removeItem(k);

            console.log('[AccountService] Exterminio finalizado.');
            return true;
        } catch (error: any) {
            console.error('[AccountService] ERROR CRITICO EN EXTERMINIO:', error);
            throw error;
        }
    },

    /**
     * Performs a sign out from Supabase and Google
     */
    async logout(localOnly = false) {
        try {
            // 1. Sign out from Supabase
            // If localOnly = true, it just clears local storage and keeps the refresh token alive on the server
            const { error } = await supabase.auth.signOut(localOnly ? { scope: 'local' } : undefined);
            if (error) throw error;

            // 2. Clear Google state so the prompt shows up again to pick a new account
            try {
                await GoogleSignin.signOut();
            } catch (googleError) {
                // This might happen if Google configuration isn't initialized yet
                console.warn('[AccountService] Google SignOut error:', googleError);
            }

            return { success: true };
        } catch (error) {
            console.error('[AccountService] Logout error:', error);
            return { success: false, error };
        }
    }
};
