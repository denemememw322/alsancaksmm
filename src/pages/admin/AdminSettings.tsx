import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Save, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

const input = 'w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary';

export default function AdminSettings() {
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [settings, setSettings] = useState({ siteName: 'BoostPanel', currency: 'USD', minDeposit: 10, defaultMarkup: 2 });

    useEffect(() => {
        (async () => {
            const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
            if (error) return setMessage({ type: 'error', text: `Ayarlar yüklenemedi: ${error.message}` });
            if (data) {
                setSettings({
                    siteName: data.site_name || 'BoostPanel',
                    currency: data.currency || 'USD',
                    minDeposit: Number(data.min_deposit) || 10,
                    defaultMarkup: Number(data.default_markup) || 2,
                });
            }
        })();
    }, []);

    const save = async () => {
        if (settings.defaultMarkup < 1) return setMessage({ type: 'error', text: 'Kâr çarpanı en az 1 olmalı (maliyetin altında satış yapılamaz).' });
        setSaving(true);
        setMessage(null);
        const { error } = await supabase.from('settings').upsert({
            id: 1,
            site_name: settings.siteName,
            currency: settings.currency,
            min_deposit: settings.minDeposit,
            default_markup: settings.defaultMarkup,
            updated_at: new Date().toISOString(),
        });
        setSaving(false);
        setMessage(error ? { type: 'error', text: `Kaydedilemedi: ${error.message}` } : { type: 'success', text: 'Ayarlar kaydedildi.' });
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <h2 className="text-2xl font-bold text-text-primary">⚙️ Ayarlar</h2>

            {message && (
                <div className={`p-4 rounded-xl border text-sm ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 inline mr-2" /> : <AlertCircle className="w-5 h-5 inline mr-2" />}
                    {message.text}
                </div>
            )}

            <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle text-sm text-text-secondary">
                API sağlayıcı ekleme, test etme ve hizmet çekme artık <Link to="/admin/providers" className="text-brand-400 underline">API Sağlayıcılar</Link> sayfasında.
            </div>

            <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle">
                <h3 className="font-semibold text-text-primary mb-4">🌐 Genel Ayarlar</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><label className="block text-sm text-text-secondary mb-1">Site Adı</label>
                        <input className={input} value={settings.siteName} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} /></div>
                    <div><label className="block text-sm text-text-secondary mb-1">Para Birimi</label>
                        <input className={input} value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} /></div>
                    <div><label className="block text-sm text-text-secondary mb-1">Min Yükleme</label>
                        <input type="number" className={input} value={settings.minDeposit} onChange={(e) => setSettings({ ...settings, minDeposit: parseFloat(e.target.value) || 0 })} /></div>
                    <div><label className="block text-sm text-text-secondary mb-1">Varsayılan kâr çarpanı</label>
                        <input type="number" step="0.1" min="1" className={input} value={settings.defaultMarkup} onChange={(e) => setSettings({ ...settings, defaultMarkup: parseFloat(e.target.value) || 1 })} />
                        <p className="text-xs text-text-muted mt-1">API'den aktarılan yeni hizmetlerde satış = maliyet × çarpan</p></div>
                </div>
            </div>

            <button onClick={save} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-lg disabled:opacity-50">
                {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Kaydet
            </button>
        </div>
    );
}
