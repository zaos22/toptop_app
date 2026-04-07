/**
 * Generates a default avatar URL based on the user's name
 * uses ui-avatars.com to generate an initial-based image with a random color background
 */
export const getDefaultAvatarUrl = (name: string): string => {
    const cleanName = name?.trim() || 'User';
    // background=random creates a random background color
    // color=fff ensures the text is white
    // bold=true makes the initial more prominent
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=random&color=fff&bold=true&size=512`;
};
