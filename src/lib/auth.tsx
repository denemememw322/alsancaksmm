import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from './supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  perms: string[];
  can: (perm: string) => boolean;
  isStaff: boolean;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (!error && data) {
      setProfile(data as Profile);
      const { data: p } = await supabase.rpc('my_permissions');
      setPerms(Array.isArray(p) ? (p as string[]) : []);
    }
    else if (error) {
      // profile may not exist yet if trigger hasn't fired; retry once
      await new Promise((r) => setTimeout(r, 600));
      const { data: retry } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
      if (retry) setProfile(retry as Profile);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
          setPerms([]);
        }
        setLoading(false);
      })();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted && user) fetchProfile(user.id); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  // E-posta ile giriş mevcut yöntemle aynen sürer. Kullanıcı adıyla girişte ad -> e-posta çözümlemesi SUNUCUDA yapılır
  // (e-posta tarayıcıya dönmez); şifre doğrulamasını Supabase Auth yapar, hata mesajı hesap var/yok bilgisi sızdırmaz.
  const signIn = async (identifier: string, password: string) => {
    const id = identifier.trim();
    if (id.includes('@')) {
      const { error } = await supabase.auth.signInWithPassword({ email: id, password });
      return { error: error?.message ?? null };
    }
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login-with-username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ identifier: id, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.access_token) return { error: j.error || 'Giriş yapılamadı' };
      const { error } = await supabase.auth.setSession({ access_token: j.access_token, refresh_token: j.refresh_token });
      return { error: error?.message ?? null };
    } catch {
      return { error: 'Bağlantı hatası, tekrar dene' };
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    const name = username.trim();
    const { data: chk } = await supabase.rpc('username_available', { p_username: name });
    if (chk && chk.available === false) return { error: chk.reason || 'Bu kullanıcı adı kullanılamaz' };
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { username: name } } });
    if (error) {
      // yarış durumunda (aynı anda aynı ad) veritabanı benzersizlik kuralı devreye girer
      if (/database error saving new user/i.test(error.message)) return { error: 'Hesap oluşturulamadı: kullanıcı adı az önce başkası tarafından alınmış olabilir. Başka bir ad dene.' };
      return { error: error.message };
    }
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPerms([]);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{ session, user, profile, perms, can: (perm: string) => perms.includes(perm), isStaff: perms.length > 0, loading, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
