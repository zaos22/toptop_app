import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD6-9YIJwYqdA9eLuDWmuRSG4HPxFqtetI",
    authDomain: "toptop-3cb57.firebaseapp.com",
    projectId: "toptop-3cb57",
    storageBucket: "toptop-3cb57.firebasestorage.app",
    messagingSenderId: "34451604947",
    appId: "1:34451604947:web:25a353b4c43624d75bdb26",
    measurementId: "G-NZHP8RP67R"
};

// Inicializar Firebase (evitando errores de inicialización múltiple)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Inicializar Auth con persistencia para React Native
// Usamos getAuth si ya existe una instancia para evitar errores de duplicidad
let auth: Auth;
const existingAuth = getAuth(app);
if (existingAuth) {
    auth = existingAuth;
} else {
    try {
        auth = initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage)
        });
    } catch (e) {
        auth = getAuth(app);
    }
}

// Inicializar Firestore y Storage
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };

