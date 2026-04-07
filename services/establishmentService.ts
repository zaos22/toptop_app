import { supabase } from '@/config/supabase';
import { awardBadge } from './userProfileService';

export interface Establishment {
    id: string;
    name: string;
    category: string;
    score: number;
    rating?: number; // for gems
    distance?: string; // for gems
    price: string;
    isGem: boolean;
    status?: 'up' | 'down' | 'neutral';
    image?: string;
    media?: Array<{ uri: string; type: 'image' | 'video' }>;
    description?: string;
    address?: string;
    website?: string;
    phone?: string;
    subScores?: {
        quality: number;
        value: number;
        reliability: number;
    };
}

const MOCK_DATA: Establishment[] = [
    {
        id: '1',
        name: 'The Secret Table',
        category: 'Fine Dining',
        score: 9.8,
        rating: 9.8,
        distance: '0.4 km',
        price: '$$$$',
        isGem: true,
        image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80',
        description: 'A hidden sanctuary in the heart of the city offering an unparalleled gastronomic experience.',
        address: 'Calle de Serrano, 45, Madrid',
        website: 'https://example.com',
        phone: '+34 912 345 678',
        subScores: { quality: 9.8, value: 9.2, reliability: 9.7 }
    },
    {
        id: '2',
        name: 'Vintage Vault',
        category: 'Fashion',
        score: 9.6,
        rating: 9.6,
        distance: '1.2 km',
        price: '$$',
        isGem: true,
        image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=800&q=80',
        description: 'Specializing in rare finds and timeless classics from the 70s and 80s.',
        address: 'Calle de Fuencarral, 12, Madrid',
        website: 'https://vintagevault.com',
        phone: '+34 912 000 111',
        subScores: { quality: 9.6, value: 9.8, reliability: 9.4 }
    },
    {
        id: '3',
        name: 'Lumina Restaurant',
        category: 'Food',
        score: 9.9,
        status: 'up',
        price: '$$$',
        isGem: false,
        image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80',
        description: 'Modern fusion cuisine with a focus on light and color.',
        address: 'Plaza Mayor, 1, Madrid',
        subScores: { quality: 9.9, value: 9.5, reliability: 9.9 }
    },
    {
        id: '4',
        name: 'Nordic Stay',
        category: 'Hotels',
        score: 9.7,
        status: 'neutral',
        price: '$$$$',
        isGem: true,
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
        description: 'Minimalist luxury hotel with a focus on hygge and comfort.',
        address: 'Paseo de la Castellana, 200, Madrid',
        subScores: { quality: 9.7, value: 9.0, reliability: 9.8 }
    },
    {
        id: '5',
        name: 'SkyHigh Airways',
        category: 'Airlines',
        score: 9.4,
        status: 'up',
        price: '$$$',
        isGem: false,
        image: 'https://images.unsplash.com/photo-1436491865332-7a61a109c0f2?auto=format&fit=crop&w=800&q=80',
        description: 'Consistently top-rated for punctuality and customer service.',
        website: 'https://skyhigh.com',
        subScores: { quality: 9.5, value: 8.9, reliability: 9.9 }
    },
    {
        id: '6',
        name: 'EcoThread Online',
        category: 'Fashion',
        score: 9.2,
        status: 'neutral',
        price: '$$',
        isGem: false,
        image: 'https://images.unsplash.com/photo-1521335629791-ce4aec67dd15?auto=format&fit=crop&w=800&q=80',
        description: 'Sustainable fashion delivered to your door with zero waste.',
        website: 'https://ecothread.com',
        subScores: { quality: 9.4, value: 9.5, reliability: 8.7 }
    },
    {
        id: '7',
        name: 'TechFlow SaaS',
        category: 'Software',
        score: 9.5,
        status: 'up',
        price: '$$$',
        isGem: true,
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
        description: 'The most reliable workflow software for creative professionals.',
        website: 'https://techflow.io',
        subScores: { quality: 9.6, value: 9.2, reliability: 9.7 }
    },
    {
        id: '8',
        name: 'Oceanic Travel',
        category: 'Travel',
        score: 8.9,
        status: 'down',
        price: '$$$',
        isGem: false,
        image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80',
        description: 'Find the best travel deals across the globe with transparent pricing.',
        website: 'https://oceanictravel.com',
        subScores: { quality: 8.5, value: 9.4, reliability: 8.8 }
    },
];

export interface Review {
    id?: string;
    userId: string;
    user_name: string;
    user_avatar?: string;
    establishment_name?: string;
    establishment_id?: string;
    rating_quality: number;
    rating_price: number;
    rating_service: number;
    rating_flavor: number;
    comment: string;
    images?: string[];
    video?: string;
    likes?: number;
    archived_at?: string | null;
    created_at: string;
    isTopTop?: boolean;
}

export const getInternalReviews = async (placeId: string, halalFilter?: boolean): Promise<Review[]> => {
    try {
        let query = supabase
            .from('reviews')
            .select('*, profiles!user_id!inner(is_halal)')
            .eq('establishment_id', placeId)
            .is('archived_at', null);

        if (halalFilter !== undefined) {
            query = query.eq('profiles.is_halal', halalFilter);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        return data.map(item => ({
            id: item.id,
            userId: item.user_id,
            user_name: item.user_name,
            user_avatar: item.user_avatar,
            establishment_id: item.establishment_id,
            establishment_name: item.establishment_name,
            rating_quality: item.rating_quality,
            rating_price: item.rating_price || item.rating_value, // Fallback for old data
            rating_service: item.rating_service || item.rating_reliability,
            rating_flavor: item.rating_flavor || item.rating_quality,
            comment: item.comment,
            images: item.images,
            video: item.video,
            likes: item.likes || 0,
            created_at: item.created_at,
        }));
    } catch (error) {
        console.error('Error getting internal reviews:', error);
        return [];
    }
};

export const getUserReviews = async (userId: string, filterMedia: boolean = false): Promise<Review[]> => {
    console.log('[ReviewsService] Getting reviews for:', userId);
    try {
        let query = supabase
            .from('reviews')
            .select('*')
            .eq('user_id', userId)
            .is('archived_at', null);

        if (filterMedia) {
            query = query.or('images.not.is.null,video.not.is.null');
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        console.log(`[ReviewsService] Fetched ${data?.length || 0} reviews`);

        // Find reviews missing establishment_name
        const reviewsMissingName = data.filter(item => !item.establishment_name && item.establishment_id);
        if (reviewsMissingName.length > 0) {
            console.log(`[ReviewsService] Backfilling names for ${reviewsMissingName.length} reviews`);
            const missingIds = [...new Set(reviewsMissingName.map(r => r.establishment_id))];
            const { data: visitsData } = await supabase
                .from('visits')
                .select('establishment_id, establishment_name')
                .in('establishment_id', missingIds)
                .eq('user_id', userId);

            if (visitsData && visitsData.length > 0) {
                const nameMap: Record<string, string> = {};
                visitsData.forEach(v => {
                    if (v.establishment_name) nameMap[v.establishment_id] = v.establishment_name;
                });

                reviewsMissingName.forEach(rev => {
                    const name = nameMap[rev.establishment_id];
                    if (name) {
                        rev.establishment_name = name;
                        void Promise.resolve(
                            supabase
                                .from('reviews')
                                .update({ establishment_name: name })
                                .eq('id', rev.id)
                        ).catch(() => { });
                    }
                });
            }
        }

        return data.map(item => ({
            id: item.id,
            userId: item.user_id,
            user_name: item.user_name || item.profiles?.display_name || 'User',
            user_avatar: item.user_avatar || item.profiles?.photo_url,
            establishment_id: item.establishment_id,
            establishment_name: item.establishment_name,
            rating_quality: item.rating_quality || 0,
            rating_price: item.rating_price || item.rating_value || 0,
            rating_service: item.rating_service || item.rating_reliability || 0,
            rating_flavor: item.rating_flavor || item.rating_quality || 0,
            comment: item.comment || '',
            images: item.images || [],
            video: item.video,
            likes: item.likes || 0,
            created_at: item.created_at,
        }));
    } catch (error) {
        console.error('[ReviewsService] Error:', error);
        return [];
    }
};



export const getReviewById = async (reviewId: string): Promise<Review | null> => {
    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('*, profiles(username, photo_url, display_name)')
            .eq('id', reviewId)
            .single();

        if (error) throw error;

        return {
            id: data.id,
            userId: data.user_id,
            user_name: data.user_name || data.profiles?.display_name || 'User',
            user_avatar: data.user_avatar || data.profiles?.photo_url,
            establishment_id: data.establishment_id,
            establishment_name: data.establishment_name,
            rating_quality: data.rating_quality || 0,
            rating_price: data.rating_price || data.rating_value || 0,
            rating_service: data.rating_service || data.rating_reliability || 0,
            rating_flavor: data.rating_flavor || data.rating_quality || 0,
            comment: data.comment || '',
            images: data.images || [],
            video: data.video,
            likes: data.likes || 0,
            created_at: data.created_at,
        };
    } catch (error) {
        console.error('Error getting review by id:', error);
        return null;
    }
};

export const getEstablishments = async (): Promise<Establishment[]> => {
    // Simulate API delay
    return new Promise((resolve) => {
        setTimeout(() => resolve(MOCK_DATA), 500);
    });
};

export const getEstablishmentById = async (id: string): Promise<Establishment | undefined> => {
    return new Promise((resolve) => {
        setTimeout(() => resolve(MOCK_DATA.find(e => e.id === id)), 300);
    });
};

/**
 * Saves a review to Supabase
 */
export const saveReview = async (
    userId: string,
    establishmentId: string,
    review: Omit<Review, 'id' | 'created_at' | 'userId'> & {
        images?: string[];
        video?: string;
    }
): Promise<{ id: string } | undefined> => {
    try {
        const { data, error } = await supabase.from('reviews').insert({
            user_id: userId,
            establishment_id: establishmentId,
            establishment_name: review.establishment_name,
            user_name: review.user_name,
            user_avatar: review.user_avatar,
            rating_quality: review.rating_quality,
            rating_price: review.rating_price,
            rating_service: review.rating_service,
            rating_flavor: review.rating_flavor,
            comment: review.comment,
            images: review.images,
            video: review.video,
        }).select('id').single();

        if (error) throw error;

        // After saving review, check for badges
        await checkReviewAchievements(userId);

        // Process mentions asynchronously (not blocking review save)
        void handleMentionsInComment(review.comment, userId, establishmentId, data.id);

        return { id: data.id };
    } catch (error) {
        console.error('Error saving review:', error);
        throw error;
    }
};

/**
 * Parses mentions in a comment and sends notifications
 */
async function handleMentionsInComment(comment: string, fromUserId: string, establishmentId: string, reviewId: string) {
    try {
        // Regex to match @username. We allow letters, numbers, dots and underscores.
        const mentionRegex = /@([\w.]+)/g;
        const matches = comment.matchAll(mentionRegex);
        const usernames = new Set<string>();
        for (const match of matches) {
            // Remove trailing dots that might be part of a sentence
            let username = match[1];
            if (username.endsWith('.')) username = username.slice(0, -1);
            usernames.add(username);
        }

        if (usernames.size === 0) return;

        // Find user profiles for these usernames (checking both username and display_name)
        // We use query with OR to find users that match either field
        const query = Array.from(usernames).map(u => `username.ilike.${u},display_name.ilike.${u}`).join(',');

        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, username, display_name')
            .or(query);

        if (error || !profiles || profiles.length === 0) return;

        // Fetch sender's username for the notification
        const { data: sender } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', fromUserId)
            .single();

        // Send a notification to each user
        for (const targetUser of profiles) {
            // Don't notify self
            if (targetUser.id === fromUserId) continue;

            const title = 'New mention 🏷️';
            const body = `@${sender?.username || 'Someone'} mentioned you in their review.`;
            const data = {
                type: 'MENTION',
                establishmentId,
                reviewId,
                fromUserId
            };

            // In a real multi-user app, we would insert this into a 'notifications' table
            // and have a background trigger or RealTime listener send the push.
            // For now, we'll try to insert into a notifications table if it exists.
            try {
                await supabase.from('notifications').insert({
                    user_id: targetUser.id,
                    sender_id: fromUserId,
                    type: 'mention',
                    title,
                    body,
                    data,
                    is_read: false
                });
            } catch (e) {
                console.log('Notifications table not ready or error:', e);
            }
        }
    } catch (error) {
        console.error('Error processing mentions:', error);
    }
}

export const updateReview = async (
    reviewId: string,
    updates: Partial<Review>
): Promise<void> => {
    try {
        const payload: any = {
            rating_price: updates.rating_price,
            rating_service: updates.rating_service,
            rating_flavor: updates.rating_flavor,
            comment: updates.comment,
            images: updates.images,
            video: updates.video,
        };

        // If your table uses 'rating_quality' for the primary score
        if (updates.rating_quality !== undefined) {
            payload.rating_quality = updates.rating_quality;
        }

        const { error } = await supabase
            .from('reviews')
            .update(payload)
            .eq('id', reviewId);

        if (error) throw error;

        // Process mentions if comment was updated
        if (updates.comment) {
            // Need user_id and establishment_id to send notifications
            const { data: revData } = await supabase
                .from('reviews')
                .select('user_id, establishment_id')
                .eq('id', reviewId)
                .single();

            if (revData) {
                void handleMentionsInComment(updates.comment, revData.user_id, revData.establishment_id, reviewId);
            }
        }
    } catch (error) {
        console.error('Error updating review:', error);
        throw error;
    }
};

export const deleteReview = async (reviewId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('reviews')
            .delete()
            .eq('id', reviewId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting review:', error);
        throw error;
    }
};

export const archiveReview = async (reviewId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('reviews')
            .update({ archived_at: new Date().toISOString() })
            .eq('id', reviewId);

        if (error) throw error;
    } catch (error) {
        console.error('Error archiving review:', error);
        throw error;
    }
};

/**
 * Checks if a user has already liked a specific review.
 */
export const hasUserLikedReview = async (reviewId: string, userId: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('review_likes')
            .select('id')
            .eq('review_id', reviewId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;
        return !!data;
    } catch (error) {
        console.error('Error checking like status:', error);
        return false;
    }
};

/**
 * Toggles like/unlike on a review. Returns the new liked state and the updated count from the DB.
 */
export const toggleLikeReview = async (reviewId: string, userId: string): Promise<{ liked: boolean; newCount: number }> => {
    try {
        // 1. Check if already liked
        const alreadyLiked = await hasUserLikedReview(reviewId, userId);

        if (alreadyLiked) {
            // UNLIKE: just delete the record. Trigger will decrement likes and points.
            await supabase.from('review_likes').delete().eq('review_id', reviewId).eq('user_id', userId);
        } else {
            // LIKE: just insert the record. Trigger will increment likes and points.
            await supabase.from('review_likes').insert({ review_id: reviewId, user_id: userId });

            // Process like notification asynchronously
            void handleLikeNotification(reviewId, userId);
        }

        // 2. Fetch the REAL updated count from the DB (populated by the trigger)
        const { data: reviewUpdate, error: fetchError } = await supabase
            .from('reviews')
            .select('likes')
            .eq('id', reviewId)
            .single();

        if (fetchError) throw fetchError;

        return {
            liked: !alreadyLiked,
            newCount: reviewUpdate?.likes || 0
        };
    } catch (error) {
        console.error('Error toggling like:', error);
        throw error;
    }
};

/**
 * Sends a notification to the review author when someone likes it
 */
async function handleLikeNotification(reviewId: string, fromUserId: string) {
    try {
        // 1. Get review details to find the author
        const { data: reviewDetails, error: reviewError } = await supabase
            .from('reviews')
            .select('user_id, establishment_id')
            .eq('id', reviewId)
            .single();

        if (reviewError || !reviewDetails) return;

        // Don't notify if liking own review
        if (reviewDetails.user_id === fromUserId) return;

        // --- ANTI-SPAM: Check if a similar notification was sent in last 24h ---
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', reviewDetails.user_id)
            .eq('sender_id', fromUserId)
            .eq('type', 'like')
            .filter('data->>reviewId', 'eq', reviewId)
            .gt('created_at', yesterday)
            .maybeSingle();

        if (existingNotif) return; // Skip if already notified in last 24h
        // -----------------------------------------------------------------------

        // 2. Get sender (the one who liked) username
        const { data: sender, error: senderError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', fromUserId)
            .single();

        if (senderError || !sender) return;

        // 3. Insert notification
        const title = 'New like! ❤️';
        const body = `@${sender.username || 'someone'} liked your review.`;
        const notificationData = {
            type: 'LIKE',
            reviewId,
            establishmentId: reviewDetails.establishment_id,
            fromUserId
        };

        await supabase.from('notifications').insert({
            user_id: reviewDetails.user_id,
            sender_id: fromUserId,
            type: 'like',
            title,
            body,
            data: notificationData,
            is_read: false
        });
    } catch (error) {
        console.error('Error processing like notification:', error);
    }
}

/**
 * Records a visit to an establishment
 */
export const addVisit = async (userId: string, establishmentId: string, establishmentName: string): Promise<void> => {
    try {
        const { error } = await supabase.from('visits').insert({
            user_id: userId,
            establishment_id: establishmentId,
            establishment_name: establishmentName,
        });

        if (error) throw error;

        // Check for visit achievements
        await checkVisitAchievements(userId);
    } catch (error) {
        console.error('Error adding visit:', error);
    }
};

/**
 * Fetches recent visits for a user
 */
export const getVisits = async (userId: string): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('visits')
            .select('*')
            .eq('user_id', userId)
            .order('visited_at', { ascending: false });

        if (error) throw error;

        return data.map(item => ({
            id: item.id,
            userId: item.user_id,
            establishmentId: item.establishment_id,
            establishmentName: item.establishment_name,
            visitedAt: item.visited_at,
        }));
    } catch (error) {
        console.error('Error getting visits:', error);
        return [];
    }
};

/**
 * Basic achievement logic
 */
const checkReviewAchievements = async (userId: string) => {
    // This would typically fetch the current count and award badges
    await awardBadge(userId, 'first_review');
};

const checkVisitAchievements = async (userId: string) => {
    await awardBadge(userId, 'explorer');
};
