import { useState } from 'react';
import { User, Mail, Save, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function Account() {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.username || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    const v = name.trim();
    if (!profile || v === profile.username) return;
    setBusy(true); setMsg(null);
    const { data: chk } = await supabase.rpc('username_available', { p_username: v });
    if (chk && chk.available === false) { setBusy(false); return setMsg({ ok: false, text: chk.reason }); }
    const { error } = await supabase.from('profiles').update({ username: v }).eq('user_id', profile.user_id);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message.replace(/^.*?: /, '') });
    await refreshProfile();
    setMsg({ ok: true, text: 'Kullanıcı adın güncellendi.' });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div><h1 className="font-display text-2xl font-bold text-text-primary">Account</h1><p className="text-text-secondary text-sm mt-1">Hesap bilgilerin</p></div>
      <div className="p-5 rounded-2xl bg-bg-surface border border-border-subtle space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Kullanıcı adı</label>
          <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-xl bg-bg-elevated border border-border-default text-text-primary focus:outline-none focus:border-brand-500" /></div>
          <p className="text-xs text-text-muted mt-1">E-posta yerine kullanıcı adınla da giriş yapabilirsin. 3-20 karakter: harf, rakam ve _. Benzersiz olmalı.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">E-posta</label>
          <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input readOnly value={profile?.email || ''} className="w-full pl-10 pr-4 py-3 rounded-xl bg-bg-elevated border border-border-default text-text-secondary" /></div>
        </div>
        {msg && <div className={`text-sm ${msg.ok ? 'text-success-400' : 'text-error-400'}`}>{msg.text}</div>}
        <button onClick={save} disabled={busy || !name.trim() || name.trim() === profile?.username} className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium inline-flex items-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet</button>
      </div>
      <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle text-sm text-text-secondary flex gap-3"><ShieldCheck className="w-5 h-5 text-brand-400 shrink-0" />
        <span>Hesap ID: <span className="font-mono text-text-primary">{profile?.user_id?.slice(0, 8)}</span> · Güvenliğin için kullanıcı adıyla girişte de aynı şifre ve oturum güvenliği geçerlidir.</span></div>
    </div>
  );
}
