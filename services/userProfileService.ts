import { supabase } from '@/config/supabase';

export interface UserProfile {
    uid: string;
    displayName: string;
    username: string | null;
    email: string;
    photoURL: string | null;
    bio: string | null;
    points: number;
    profileViews: number;
    visitedCount: number;
    reviewsCount: number;
    followersCount: number;
    followingCount: number;
    badges: string[];
    isHalal: boolean;
    role: 'user' | 'business';
    createdAt: string;
    updatedAt: string;
}

/**
 * Creates a new user profile in Supabase
 */
export const createUserProfile = async (
    uid: string,
    email: string,
    displayName: string,
    photoURL: string | null = null,
    username: string | null = null,
    role: 'user' | 'business' = 'user'
): Promise<void> => {
    try {
        const { error } = await supabase.from('profiles').insert({
            id: uid,
            display_name: displayName,
            username: username,
            email: email,
            photo_url: photoURL,
            bio: null,
            points: 0,
            is_halal: false,
            role: role,
        });

        if (error) throw error;
    } catch (error) {
        console.error('Error creating user profile:', error);
        throw error;
    }
};

/**
 * Gets a user profile from Supabase
 */
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    console.log('[UserProfileService] Getting profile for:', uid);
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('[UserProfileService] Profile not found');
                return null; // Not found
            }
            throw error;
        }

        console.log('[UserProfileService] Profile fetched successfully');
        return {
            uid: data.id,
            displayName: data.display_name,
            username: data.username,
            email: data.email,
            photoURL: data.photo_url,
            bio: data.bio,
            points: data.points || 0,
            profileViews: data.profile_views || 0,
            visitedCount: data.visited_count || 0,
            reviewsCount: data.reviews_count || 0,
            followersCount: data.followers_count || 0,
            followingCount: data.following_count || 0,
            badges: data.badges || [],
            isHalal: data.is_halal || false,
            role: data.role || 'user',
            createdAt: data.created_at,
            updatedAt: data.updated_at,
        };
    } catch (error) {
        console.error('[UserProfileService] Error getting user profile:', error);
        return null;
    }
};

/**
 * Updates user profile information
 */
export const updateUserProfile = async (
    uid: string,
    updates: Partial<UserProfile>
): Promise<void> => {
    try {
        const supabaseUpdates: any = {};
        if (updates.displayName !== undefined) supabaseUpdates.display_name = updates.displayName;
        if (updates.photoURL !== undefined) supabaseUpdates.photo_url = updates.photoURL;
        if (updates.username !== undefined) supabaseUpdates.username = updates.username;
        if (updates.bio !== undefined) supabaseUpdates.bio = updates.bio;
        if (updates.points !== undefined) supabaseUpdates.points = updates.points;
        if (updates.badges !== undefined) supabaseUpdates.badges = updates.badges;
        if (updates.isHalal !== undefined) supabaseUpdates.is_halal = updates.isHalal;
        if (updates.role !== undefined) supabaseUpdates.role = updates.role;

        const { error } = await supabase
            .from('profiles')
            .update({
                ...supabaseUpdates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', uid);

        if (error) throw error;
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
};

/**
 * Adds points to a user based on action
 */
export const addPoints = async (uid: string, pointsToAdd: number): Promise<void> => {
    try {
        // We do a direct increment in the database
        const { error } = await supabase.rpc('increment_points', {
            row_id: uid,
            points_to_add: pointsToAdd
        });

        // Fallback if RPC not defined
        if (error) {
            const profile = await getUserProfile(uid);
            if (profile) {
                await updateUserProfile(uid, { points: (profile.points || 0) + pointsToAdd });
            }
        }
    } catch (error) {
        console.error('Error adding points:', error);
    }
};

/**
 * Increments a specific stat counter
 */
export const incrementUserStat = async (
    uid: string,
    statType: 'profileViews' | 'reviewsCount' | 'followersCount' | 'followingCount' | 'visitedCount'
): Promise<void> => {
    try {
        const columnMap: Record<string, string> = {
            profileViews: 'profile_views',
            visitedCount: 'visited_count',
            reviewsCount: 'reviews_count',
            followersCount: 'followers_count',
            followingCount: 'following_count'
        };

        const columnName = columnMap[statType];

        // Try RPC first for atomicity
        const { error: rpcError } = await supabase.rpc('increment_stat', {
            row_id: uid,
            column_name: columnName
        });

        if (rpcError) {
            console.warn(`RPC increment_stat failed for ${statType}, falling back to fetch-and-update.`, rpcError);
            // Fallback: Fetch latest count and increment
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select(columnName)
                .eq('id', uid)
                .single();

            if (!fetchError && data) {
                const currentValue = (data as any)[columnName] || 0;
                await supabase
                    .from('profiles')
                    .update({ [columnName]: currentValue + 1 })
                    .eq('id', uid);
            }
        }
    } catch (error) {
        console.error('Error incrementing user stat:', error);
    }
};

/**
 * Decrements a specific stat counter
 */
export const decrementUserStat = async (
    uid: string,
    statType: 'profileViews' | 'reviewsCount' | 'followersCount' | 'followingCount' | 'visitedCount'
): Promise<void> => {
    try {
        const columnMap: Record<string, string> = {
            profileViews: 'profile_views',
            visitedCount: 'visited_count',
            reviewsCount: 'reviews_count',
            followersCount: 'followers_count',
            followingCount: 'following_count'
        };

        const columnName = columnMap[statType];

        // Try RPC first for atomicity (mirroring increment pattern)
        const { error: rpcError } = await supabase.rpc('decrement_stat', {
            row_id: uid,
            column_name: columnName
        });

        if (rpcError) {
            console.warn(`RPC decrement_stat failed or missing for ${statType}, falling back to fetch-and-update.`, rpcError);
            const { data, error: fetchError } = await supabase
                .from('profiles')
                .select(columnName)
                .eq('id', uid)
                .single();

            if (!fetchError && data) {
                const currentValue = (data as any)[columnName] || 0;
                if (currentValue > 0) {
                    await supabase
                        .from('profiles')
                        .update({ [columnName]: currentValue - 1 })
                        .eq('id', uid);
                }
            }
        }
    } catch (error) {
        console.error('Error decrementing user stat:', error);
    }
};

/**
 * Syncs user stats by recalculating them from source tables
 */
export const syncUserStats = async (uid: string): Promise<void> => {
    console.log('[SyncStats] Starting sync for:', uid);
    const startTime = Date.now();
    try {
        const [
            reviewsRes,
            visitsRes,
            followersRes,
            followingRes,
            likesRes
        ] = await Promise.all([
            supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', uid).is('archived_at', null),
            supabase.from('visits').select('*', { count: 'exact', head: true }).eq('user_id', uid),
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('target_id', uid),
            supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', uid),
            supabase.from('reviews').select('likes').eq('user_id', uid).is('archived_at', null)
        ]);
        
        console.log(`[SyncStats] Queries finished in ${Date.now() - startTime}ms`);

        // SAFETY: Only update a field if the query actually returned a valid count.
        // If count is null it means the query was blocked (e.g. RLS policy) or errored.
        // Writing 0 in that case would corrupt the user's existing data.
        const updates: Record<string, any> = {};

        if (reviewsRes.count !== null) {
            updates.reviews_count = reviewsRes.count;
        }
        if (followersRes.count !== null) {
            updates.followers_count = followersRes.count;
        }
        if (followingRes.count !== null) {
            updates.following_count = followingRes.count;
        }

        // Points: only recalculate if we have valid data for all inputs
        if (reviewsRes.count !== null && visitsRes.count !== null && likesRes.data !== null) {
            const totalLikes = likesRes.data?.reduce((acc: number, curr: any) => acc + (curr.likes || 0), 0) || 0;
            updates.points = (reviewsRes.count || 0) * 50 + (visitsRes.count || 0) * 20 + (totalLikes * 5);
        }

        if (Object.keys(updates).length === 0) {
            console.warn('[SyncStats] No valid data to update \u2014 all queries may have been blocked by RLS. Skipping.');
            return;
        }

        await supabase
            .from('profiles')
            .update(updates)
            .eq('id', uid);
            
        console.log('[SyncStats] Completed successfully, updated fields:', Object.keys(updates).join(', '));
    } catch (error) {
        console.error('[SyncStats] Error during sync:', error);
    }
};


/**
 * Follows a user
 */
export const followUser = async (followerUid: string, targetUid: string): Promise<void> => {
    try {
        const { error } = await supabase.from('follows').insert({
            follower_id: followerUid,
            target_id: targetUid,
        });

        if (error) throw error;

        // Sync the CURRENT user's own stats in the background to keep UI fresh
        void syncUserStats(followerUid);

        // Trigger follow notification asynchronously
        void handleFollowNotification(followerUid, targetUid);
    } catch (error) {
        console.error('Error following user:', error);
        throw error;
    }
};




/**
 * Sends a notification when a user follows another
 */
async function handleFollowNotification(followerUid: string, targetUid: string) {
    try {
        // --- ANTI-SPAM: Check if a follow notification was sent in last 24h ---
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', targetUid)
            .eq('sender_id', followerUid)
            .eq('type', 'follow')
            .gt('created_at', yesterday)
            .maybeSingle();

        if (existingNotif) return; // Skip if already notified in last 24h
        // ----------------------------------------------------------------------

        // Fetch follower's username
        const { data: follower, error } = await supabase
            .from('profiles')
            .select('username, photo_url')
            .eq('id', followerUid)
            .single();

        if (error || !follower) return;

        const title = 'New follower! 👤';
        const body = `@${follower.username || 'someone'} started following you.`;
        const data = {
            type: 'FOLLOW',
            followerId: followerUid,
        };

        await supabase.from('notifications').insert({
            user_id: targetUid,
            sender_id: followerUid,
            type: 'follow',
            title,
            body,
            data,
            is_read: false
        });
    } catch (error) {
        console.error('Error processing follow notification:', error);
    }
}

/**
 * Unfollows a user
 */
export const unfollowUser = async (followerUid: string, targetUid: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('follows')
            .delete()
            .eq('follower_id', followerUid)
            .eq('target_id', targetUid);

        if (error) throw error;

        // Sync the CURRENT user's own stats in the background to keep UI fresh
        void syncUserStats(followerUid);
    } catch (error) {
        console.error('Error unfollowing user:', error);
        throw error;
    }
};


/**
 * Checks if a user is following another
 */
export const isFollowing = async (followerUid: string, targetUid: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', followerUid)
            .eq('target_id', targetUid)
            .maybeSingle();

        if (error) throw error;
        return !!data;
    } catch (error) {
        console.error('Error checking follow status:', error);
        return false;
    }
};
/**
 * Fetches all reviews created by a specific user
 */
export const getUserReviews = async (userId: string): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('*, profiles(username, photo_url, display_name)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting user reviews:', error);
        return [];
    }
};





/**
 * Awards a badge to a user
 */
export const awardBadge = async (uid: string, badgeName: string): Promise<void> => {
    try {
        const profile = await getUserProfile(uid);
        if (profile && !profile.badges.includes(badgeName)) {
            const newBadges = [...profile.badges, badgeName];
            await updateUserProfile(uid, { badges: newBadges });
        }
    } catch (error) {
        console.error('Error awarding badge:', error);
    }
};

/**
 * Checks if a username is available (not taken by another user)
 */
export const isUsernameAvailable = async (username: string, currentUserId?: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .maybeSingle();

        if (error) throw error;
        
        // If no one has the username, it's available
        if (!data) return true;
        
        // If someone has it, check if it's the current user
        return data.id === currentUserId;
    } catch (error) {
        console.error('Error checking username availability:', error);
        return false;
    }
};

/**
 * Searches for users by display name or username, filtering by Halal mode if specified
 */
export const searchUsers = async (query: string, halalFilter?: boolean): Promise<UserProfile[]> => {
    try {
        const cleanQuery = query.startsWith('@') ? query.substring(1) : query;

        let supabaseQuery = supabase
            .from('profiles')
            .select('*')
            .or(`display_name.ilike.%${cleanQuery}%,username.ilike.%${cleanQuery}%`);

        if (halalFilter !== undefined) {
            supabaseQuery = supabaseQuery.eq('is_halal', halalFilter);
        }

        const { data, error } = await supabaseQuery.limit(20);

        if (error) throw error;

        return (data || []).map(profile => ({
            uid: profile.id,
            displayName: profile.display_name,
            username: profile.username,
            email: profile.email,
            photoURL: profile.photo_url,
            bio: profile.bio,
            points: profile.points || 0,
            profileViews: profile.profile_views || 0,
            visitedCount: profile.visited_count || 0,
            reviewsCount: profile.reviews_count || 0,
            followersCount: profile.followers_count || 0,
            followingCount: profile.following_count || 0,
            badges: profile.badges || [],
            isHalal: profile.is_halal || false,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
        }));
    } catch (error) {
        console.error('Error searching users:', error);
        return [];
    }
};

