import { supabase } from '@/config/supabase';
import { AccountService } from '@/services/accountService';
import { locationStore } from '@/services/locationStore';
import { getDefaultAvatarUrl } from '@/utils/userUtils';
import { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

// Vital para que el navegador sepa que debe volver a la app
WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    needsUsername: boolean;
    setNeedsUsername: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    needsUsername: false,
    setNeedsUsername: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [needsUsername, setNeedsUsername] = useState(false);
    const lastCheckedUserId = useRef<string | null>(null);

    // 1. Manejo de URLs (Deep Links)
    useEffect(() => {
        const handleUrl = async (url: string | null) => {
            if (!url) return;
            console.log('[AuthContext] URL interceptada:', url);

            const queryString = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
            if (!queryString) return;

            const params: any = {};
            queryString.split('&').forEach(pair => {
                const [key, value] = pair.split('=');
                if (key && value) params[key] = decodeURIComponent(value);
            });

            if (params.access_token && params.refresh_token) {
                console.log('[AuthContext] Tokens detected via URL. Updating session...');
                const { error } = await supabase.auth.setSession({
                    access_token: params.access_token,
                    refresh_token: params.refresh_token,
                });
                if (!error) {
                    WebBrowser.dismissBrowser();
                }
            }
        };

        const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));
        Linking.getInitialURL().then(url => handleUrl(url));

        return () => sub.remove();
    }, []);

    // 2. Suscripción a cambios de Auth y Verificación de Perfil
    useEffect(() => {
        // Importante: No hacer el callback async directo para evitar que Supabase bloquee el flujo paralelo
        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, s) => {
            console.log(`[AuthContext] EVENTO AUTH: ${event} (${s?.user?.email ?? 'NULO'})`);
            
            // 1. Actualización inmediata de estado
            setSession(s);
            setUser(s?.user ?? null);

            // 2. Si no hay usuario, apagamos carga y reseteamos identidades
            if (!s?.user) {
                setNeedsUsername(false);
                setLoading(false);
                lastCheckedUserId.current = null;
                return;
            }

            // 3. Keep the AccountService storage up to date on EVERY token refresh
            if (s && s.user) {
                AccountService.saveCurrentAccount(s.user, s).catch(() => {});
            }

            // 4. Ejecutar verificación de perfil si es un cambio de ID o primer arranque
            if (lastCheckedUserId.current !== s.user.id) {
                setLoading(true);
                handleProfileCheck(s.user, s);
            } else {
                setLoading(false);
            }
        });

        const handleProfileCheck = async (u: User, s: Session) => {
            try {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('id, username')
                    .eq('id', u.id)
                    .maybeSingle();

                if (error) throw error;

                if (!profile) {
                    console.log('[AuthContext] Profile not found. Initializing from metadata...');
                    const meta = u.user_metadata || {};
                    const metaUsername = meta.username || meta.user_name || null;
                    const displayName = meta.full_name || meta.name || 'Usuario';
                    
                    await supabase.from('profiles').insert({
                        id: u.id,
                        email: u.email,
                        display_name: displayName,
                        photo_url: meta.avatar_url || meta.picture || getDefaultAvatarUrl(displayName),
                        username: metaUsername,
                        points: 0, 
                        visited_count: 0, 
                        reviews_count: 0
                    });

                    setNeedsUsername(!metaUsername); 
                } else if (!profile.username) {
                    // Profile exists but has no username (e.g. created by trigger without metadata sync)
                    console.log('[AuthContext] Profile exists with null username. Attempting metadata sync...');
                    const meta = u.user_metadata || {};
                    const metaUsername = meta.username || meta.user_name || null;
                    
                    if (metaUsername) {
                        // Update the existing profile with the metadata username
                        await supabase.from('profiles')
                            .update({ username: metaUsername })
                            .eq('id', u.id);
                        setNeedsUsername(false);
                    } else {
                        setNeedsUsername(true);
                    }
                } else {
                    setNeedsUsername(false);
                }

                lastCheckedUserId.current = u.id;
            } catch (err) {
                console.error('[AuthContext] Error en verificación:', err);
            } finally {
                setLoading(false);
            }
        };

        return () => authSub.unsubscribe();
    }, []);

    useEffect(() => {
        if (user?.id) {
            locationStore.setUserId(user.id);
        }
    }, [user?.id]);

    return (
        <AuthContext.Provider value={{ user, session, loading, needsUsername, setNeedsUsername }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
