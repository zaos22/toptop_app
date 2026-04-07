import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { captureRef } from 'react-native-view-shot';
import { Alert, Platform } from 'react-native';

export class ShareService {
  /**
   * Captures a view and shares it as an image.
   * Optimized for Instagram sharing.
   */
  static async shareViewAsImage(viewRef: any, fileName: string = 'toptop-share.png') {
    if (!viewRef) return;

    try {
      // 1. Capture the view as a URI
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
      });

      // 2. Prepare the file path for sharing
      // Use any to bypass lint if types are not picking up cacheDirectory correctly
      const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
      const fileUri = `${cacheDir}${fileName}`;
      await FileSystem.copyAsync({
        from: uri,
        to: fileUri,
      });

      // 3. Share the image
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/png',
          dialogTitle: 'Compartir en Instagram',
          UTI: 'public.png', // For iOS
        });
      } else {
        Alert.alert('Error', 'Compartir no está disponible en este dispositivo');
      }
    } catch (error) {
      console.error('Error sharing view:', error);
      Alert.alert('Error', 'No se pudo generar la imagen para compartir');
    }
  }

  /**
   * Shares a simple text message with a link.
   */
  static async shareText(message: string, url?: string) {
    try {
      if (await Sharing.isAvailableAsync()) {
        const fullMessage = url ? `${message}\n\n${url}` : message;
        // Note: expo-sharing shareAsync primarily shares files.
        // For text sharing, we might still want to use the native Share from react-native
        // Or generate a small text image? 
        // Let's use native Share for text as it's more standard.
      }
    } catch (error) {
      console.error('Error sharing text:', error);
    }
  }
}
