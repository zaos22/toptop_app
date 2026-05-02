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
            let displayName = user.user_metadata?.full_name || user.user_metadata?.name || existingAccount?.displayName || 'User';
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

            // 8s timeout to avoid blocks if network fails or token is invalid
            const sessionPromise = supabase.auth.setSession({
                access_token: account.session.access_token,
                refresh_token: account.session.refresh_token,
            });

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TIMEOUT_SESSION')), 8000)
            );

            const { error }: any = await Promise.race([sessionPromise, timeoutPromise]);

            if (error) {
                console.warn('[AccountService] Error or Expired session:', error.message);
                return { success: false, requiresAuth: true, email: account.email };
            }

            // Silently update the last activity timestamp
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
        console.log('[AccountService] TOTAL WIPEOUT IN PROGRESS FOR:', userId);
        
        const checkError = (res: { error: any }, step: string, isCritical = false) => {
            if (res.error) {
                console.error(`[AccountService] Error in step: ${step}`, res.error);
                if (isCritical) {
                    throw new Error(`Error in ${step}: ${res.error.message || JSON.stringify(res.error)}`);
                }
            }
        };

        try {
            // 0. Get review IDs to delete dependencies (likes/comments from others)
            const { data: userReviews } = await supabase.from('reviews').select('id').eq('user_id', userId);
            const reviewIds = userReviews?.map(r => r.id) || [];

            if (reviewIds.length > 0) {
                console.log(`[AccountService] Deleting dependencies for ${reviewIds.length} reviews...`);
                checkError(await supabase.from('review_likes').delete().in('review_id', reviewIds), 'likes on user reviews');
                checkError(await supabase.from('review_comments').delete().in('review_id', reviewIds), 'comments on user reviews');
            }

            // 1. Delete data where the user is the SUBJECT
            const tables = [
                { name: 'notifications', userCol: 'user_id' },
                { name: 'notifications', userCol: 'sender_id' }, // Notifications he sent
                { name: 'follows', userCol: 'follower_id' },
                { name: 'follows', userCol: 'target_id' },     // Delete those following him
                { name: 'review_likes', userCol: 'user_id' },
                { name: 'comment_likes', userCol: 'user_id' },
                { name: 'review_comments', userCol: 'user_id' },
                { name: 'visits', userCol: 'user_id' },
                { name: 'reviews', userCol: 'user_id' }
            ];

            for (const t of tables) {
                console.log(`[AccountService] Deleting ${t.name} (col: ${t.userCol})...`);
                checkError(await supabase.from(t.name).delete().eq(t.userCol, userId), `table ${t.name}`);
            }

            // 2. Clean lists
            const { data: lists } = await supabase.from('user_lists').select('id').eq('user_id', userId);
            if (lists && lists.length > 0) {
                const listIds = lists.map(l => l.id);
                checkError(await supabase.from('list_items').delete().in('list_id', listIds), 'list items');
                checkError(await supabase.from('user_lists').delete().eq('user_id', userId), 'lists');
            }

            // 3. KEY STEP: Delete public profile (CRITICAL)
            console.log('[AccountService] Deleting profile...');
            const profRes = await supabase.from('profiles').delete().eq('id', userId);
            checkError(profRes, 'profile deletion', true); // TRUE = Will throw if fails

            // 4. Try to delete the user from Supabase auth (Requires RPC)
            console.log('[AccountService] Attempting to delete full identity from auth.users...');
            const { error: rpcError } = await supabase.rpc('delete_user');
            if (rpcError) {
                console.warn('[AccountService] RPC delete_user not available or failed (it needs to be configured in Supabase). Fallback to cleaning metadata.', rpcError);
                // If RPC fails, fallback to cleaning current identity metadata
                await supabase.auth.updateUser({
                    data: { 
                        username: null, 
                        user_name: null, 
                        display_name: null,
                        full_name: 'Deleted Account',
                        avatar_url: null,
                        onboarded: false 
                    }
                });
            } else {
                console.log('[AccountService] User deleted from auth.users successfully.');
            }

            // 5. Local cleanup and mandatory logout
            await this.removeAccount(userId);
            
            // TOTAL cleanup of tokens and states to force clean re-auth
            const keys = await AsyncStorage.getAllKeys();
            const toRemove = keys.filter(k => k.includes('supabase.auth') || k.includes('sb-'));
            for (const k of toRemove) await AsyncStorage.removeItem(k);

            console.log('[AccountService] Wipeout finished.');
            return true;
        } catch (error: any) {
            console.error('[AccountService] CRITICAL ERROR IN WIPEOUT:', error);
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
