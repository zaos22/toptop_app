import { decode } from 'base64-arraybuffer';
import { supabase } from '../config/supabase';

/**
 * Uploads a profile photo to Supabase Storage and returns the public URL
 */
export const uploadProfilePhoto = async (
    userId: string,
    imageUri: string
): Promise<string> => {
    try {
        console.log('Starting Supabase upload for user:', userId, 'URI:', imageUri);

        // Convert image URI to base64
        const base64: any = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = function () {
                const reader = new FileReader();
                reader.onloadend = function () {
                    resolve(reader.result?.toString().split(',')[1]);
                }
                reader.readAsDataURL(xhr.response);
            };
            xhr.onerror = function (e) {
                console.error('XHR Error:', e);
                reject(new TypeError("Network request failed"));
            };
            xhr.responseType = "blob";
            xhr.open("GET", imageUri, true);
            xhr.send(null);
        });

        const fileName = `${userId}/${Date.now()}.jpg`;
        const filePath = `profile_photos/${fileName}`;

        // Upload to Supabase Storage
        // NOTE: Make sure you have a bucket named 'toptop' or similar
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, decode(base64), {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) {
            console.error('Supabase Storage Error:', error);
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error: any) {
        console.error('Error detail in uploadProfilePhoto (Supabase):', error);
        throw new Error('No se pudo subir la imagen a Supabase Storage. Asegúrate de tener un bucket llamado "avatars" con acceso público.');
    }
};

/**
 * Deletes a profile photo from Supabase Storage
 */
export const deleteProfilePhoto = async (photoPath: string): Promise<void> => {
    try {
        const { error } = await supabase.storage
            .from('avatars')
            .remove([photoPath]);

        if (error) {
            throw error;
        }
    } catch (error) {
        console.error('Error deleting profile photo from Supabase:', error);
    }
};
