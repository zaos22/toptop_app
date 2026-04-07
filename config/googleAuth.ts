import { GoogleSignin } from '@react-native-google-signin/google-signin';

export const configureGoogleAuth = () => {
    GoogleSignin.configure({
        webClientId: '34451604947-di63uoh0il1o4c4gte1dms4fpbnf7nsd.apps.googleusercontent.com',
        offlineAccess: false,
    });
};
