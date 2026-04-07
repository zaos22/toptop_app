import { supabase } from '@/config/supabase';

export interface ReviewComment {
    id: string;
    review_id: string;
    user_id: string;
    user_name: string;
    user_avatar: string | null;
    content: string;
    parent_id: string | null;
    created_at: string;
    likes: number;
    author_super_like: boolean;
    has_liked?: boolean;
    replies?: ReviewComment[];
}

/**
 * Fetches all comments for a specific review
 */
export const getReviewComments = async (reviewId: string, currentUserId?: string): Promise<ReviewComment[]> => {
    try {
        const { data, error } = await supabase
            .from('review_comments')
            .select(`
                *,
                profiles:user_id (
                    display_name,
                    photo_url
                )
            `)
            .eq('review_id', reviewId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Fetch likes only for the comments in this specific review
        const commentIds = (data || []).map(c => c.id);
        const { data: allLikes } = await supabase
            .from('comment_likes')
            .select('comment_id, user_id')
            .in('comment_id', commentIds);


        // Create mapping for counts and current user check
        const likeCountsMap = new Map<string, number>();
        const userHasLikedSet = new Set<string>();

        if (allLikes) {
            allLikes.forEach(like => {
                // Count total likes per comment
                likeCountsMap.set(like.comment_id, (likeCountsMap.get(like.comment_id) || 0) + 1);
                
                // Track if current user liked this specific comment
                if (currentUserId && like.user_id === currentUserId) {
                    userHasLikedSet.add(like.comment_id);
                }
            });
        }

        const flattenedComments: ReviewComment[] = (data || []).map(c => ({
            id: c.id,
            review_id: c.review_id,
            user_id: c.user_id,
            user_name: c.profiles?.display_name || 'Usuario',
            user_avatar: c.profiles?.photo_url,
            content: c.content,
            parent_id: c.parent_id,
            created_at: c.created_at,
            likes: likeCountsMap.get(c.id) || 0,
            author_super_like: c.author_super_like || false,
            has_liked: userHasLikedSet.has(c.id)
        }));

        // Organize into threads
        const commentMap = new Map<string, ReviewComment>();
        const rootComments: ReviewComment[] = [];

        flattenedComments.forEach(c => {
            c.replies = [];
            commentMap.set(c.id, c);
        });

        flattenedComments.forEach(c => {
            if (c.parent_id && commentMap.has(c.parent_id)) {
                commentMap.get(c.parent_id)!.replies!.push(c);
            } else {
                rootComments.push(c);
            }
        });

        return rootComments;
    } catch (error) {
        console.error('Error fetching review comments:', error);
        return [];
    }
};

/**
 * Adds a new comment to a review
 */
export const addReviewComment = async (
    reviewId: string,
    userId: string,
    content: string,
    parentId: string | null = null
): Promise<ReviewComment | null> => {
    try {
        const { data, error } = await supabase
            .from('review_comments')
            .insert({
                review_id: reviewId,
                user_id: userId,
                content: content,
                parent_id: parentId
            })
            .select(`
                *,
                profiles:user_id (
                    display_name,
                    photo_url
                )
            `)
            .single();

        if (error) throw error;

        // Trigger notification logic asynchronously
        void handleCommentNotification(reviewId, userId, content, parentId, data.id);

        return {
            id: data.id,
            review_id: data.review_id,
            user_id: data.user_id,
            user_name: data.profiles?.display_name || 'Usuario',
            user_avatar: data.profiles?.photo_url,
            content: data.content,
            parent_id: data.parent_id,
            created_at: data.created_at,
            likes: 0,
            author_super_like: false,
            has_liked: false,
            replies: []
        };
    } catch (error) {
        console.error('Error adding comment:', error);
        return null;
    }
};

/**
 * Toggles a like on a comment
 */
export const toggleCommentLike = async (commentId: string, userId: string): Promise<boolean> => {
    try {
        const { data: existing } = await supabase
            .from('comment_likes')
            .select('*')
            .eq('user_id', userId)
            .eq('comment_id', commentId)
            .maybeSingle();

        if (existing) {
            // Remove the like record
            await supabase.from('comment_likes').delete().eq('user_id', userId).eq('comment_id', commentId);
            return false;
        } else {
            // Add the like record
            await supabase.from('comment_likes').insert({ user_id: userId, comment_id: commentId });
            
            // Notification for comment like
            void handleCommentLikeNotification(commentId, userId);
            return true;
        }
    } catch (error) {
        console.error('Error toggling comment like:', error);
        return false;
    }
};



/**
 * INTERNAL: Handles notifications for comment likes
 */
async function handleCommentLikeNotification(commentId: string, fromUserId: string) {
    try {
        const { data: comment } = await supabase
            .from('review_comments')
            .select('user_id, review_id')
            .eq('id', commentId)
            .single();

        if (!comment || comment.user_id === fromUserId) return;

        // --- ANTI-SPAM: Check if already liked in last 24h ---
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', comment.user_id)
            .eq('sender_id', fromUserId)
            .eq('type', 'like')
            .filter('data->>commentId', 'eq', commentId)
            .gt('created_at', yesterday)
            .maybeSingle();

        if (existingNotif) return;
        // ----------------------------------------------------

        const { data: sender } = await supabase.from('profiles').select('display_name').eq('id', fromUserId).single();

        await supabase.from('notifications').insert({
            user_id: comment.user_id,
            sender_id: fromUserId,
            type: 'like',
            title: '¡Le gusta tu comentario! ❤️',
            body: `@${sender?.display_name || 'Alguien'} le ha dado like a tu comentario.`,
            data: { type: 'COMMENT_LIKE', reviewId: comment.review_id, commentId },
            is_read: false
        });
    } catch (error) {
        console.error('Error in handleCommentLikeNotification:', error);
    }
}

/**
 * Toggles the author's super like on a comment
 * Only the review author should be able to call this (enforced by logic or RLS)
 */
export const toggleSuperLike = async (commentId: string): Promise<boolean> => {
    try {
        const { data: comment, error: fetchError } = await supabase
            .from('review_comments')
            .select('author_super_like')
            .eq('id', commentId)
            .single();
        
        if (fetchError) throw fetchError;
        
        const newValue = !comment?.author_super_like;

        const { data, error } = await supabase
            .from('review_comments')
            .update({ author_super_like: newValue })
            .eq('id', commentId)
            .select('author_super_like')
            .single();

        if (error) throw error;
        if (!data) throw new Error('No column updated - Check RLS policies');

        if (newValue) {
            void handleSuperLikeNotification(commentId);
        }

        return data.author_super_like;
    } catch (error) {
        console.error('Error toggling super like:', error);
        throw error;
    }
};

/**
 * INTERNAL: Handles notifications for super likes
 */
async function handleSuperLikeNotification(commentId: string) {
    try {
        const { data: comment } = await supabase
            .from('review_comments')
            .select(`
                user_id, 
                review_id,
                reviews (user_id)
            `)
            .eq('id', commentId)
            .single();

        // @ts-ignore - reviews is joined
        const reviewAuthorId = comment?.reviews?.user_id;
        if (!comment || comment.user_id === reviewAuthorId) return;

        // --- ANTI-SPAM: Check if already super-liked in last 24h ---
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', comment.user_id)
            .eq('sender_id', reviewAuthorId)
            .eq('type', 'like')
            .filter('data->>type', 'eq', 'SUPER_LIKE')
            .filter('data->>commentId', 'eq', commentId)
            .gt('created_at', yesterday)
            .maybeSingle();

        if (existingNotif) return;
        // -----------------------------------------------------------

        // Fetch author (sender) name
        const { data: author } = await supabase.from('profiles').select('display_name').eq('id', reviewAuthorId).single();

        await supabase.from('notifications').insert({
            user_id: comment.user_id,
            sender_id: reviewAuthorId,
            type: 'like',
            title: '¡Top del autor! 👑',
            body: `@${author?.display_name || 'El autor'} le ha dado un Super Like a tu comentario.`,
            data: { type: 'SUPER_LIKE', reviewId: comment.review_id, commentId },
            is_read: false
        });
    } catch (error) {
        console.error('Error in handleSuperLikeNotification:', error);
    }
}

/**
 * Deletes a comment
 */
export const deleteReviewComment = async (commentId: string): Promise<void> => {
    try {
        const { error } = await supabase
            .from('review_comments')
            .delete()
            .eq('id', commentId);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting comment:', error);
        throw error;
    }
};

/**
 * INTERNAL: Handles notifications for new comments/replies
 */
async function handleCommentNotification(reviewId: string, fromUserId: string, content: string, parentId: string | null, commentId: string) {
    try {
        // 1. If it's a reply, notify the parent comment's author
        if (parentId) {
            const { data: parentComment } = await supabase
                .from('review_comments')
                .select('user_id')
                .eq('id', parentId)
                .single();

            if (parentComment && parentComment.user_id !== fromUserId) {
                // Fetch sender name
                const { data: sender } = await supabase.from('profiles').select('display_name').eq('id', fromUserId).single();

                await supabase.from('notifications').insert({
                    user_id: parentComment.user_id,
                    sender_id: fromUserId,
                    type: 'comment',
                    title: 'Nueva respuesta 💬',
                    body: `@${sender?.display_name || 'Alguien'} ha respondido a tu comentario.`,
                    data: { type: 'COMMENT', reviewId, commentId },
                    is_read: false
                });
            }
        } else {
            // 2. If it's a root comment, notify the review author
            const { data: review } = await supabase
                .from('reviews')
                .select('user_id, establishment_id')
                .eq('id', reviewId)
                .single();

            if (review && review.user_id !== fromUserId) {
                const { data: sender } = await supabase.from('profiles').select('display_name').eq('id', fromUserId).single();

                await supabase.from('notifications').insert({
                    user_id: review.user_id,
                    sender_id: fromUserId,
                    type: 'comment',
                    title: 'Nuevo comentario 💬',
                    body: `@${sender?.display_name || 'Alguien'} ha comentado en tu reseña.`,
                    data: { type: 'COMMENT', reviewId, establishmentId: review.establishment_id, commentId },
                    is_read: false
                });
            }
        }
    } catch (error) {
        console.error('Error in handleCommentNotification:', error);
    }
}
