import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Save, RefreshCw, AlertCircle, CheckCircle2, Play } from 'lucide-react';
import { fmtDate } from '@/components/ui';

const input = 'w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary';

export default function AdminSettings() {
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [settings, setSettings] = useState({ siteName: 'BoostPanel', currency: 'USD', minDeposit: 10, defaultMarkup: 2 });
    const [ps, setPs] = useState({ enabled: false, interval: 60, threshold: 1, disableMissing: false, syncMeta: false, lastRun: null as string | null, lastStatus: null as string | null, requested: null as string | null });
    const [runs, setRuns] = useState<any[]>([]);
    const [hist, setHist] = useState<any[]>([]);
    const loadRuns = async () => {
        const [{ data: r }, { data: h }] = await Promise.all([
            supabase.from('price_sync_runs').select('*').order('started_at', { ascending: false }).limit(8),
            supabase.from('price_history').select('*').order('created_at', { ascending: false }).limit(15),
        ]);
        setRuns(r || []); setHist(h || []);
    };
    const runNow = async () => {
        const { data, error } = await supabase.rpc('admin_request_price_sync');
        if (error || data?.success === false) return setMessage({ type: 'error', text: error?.message || data?.error });
        setMessage({ type: 'success', text: 'Fiyat güncelleme istendi. Zamanlayıcı en geç 1 dakika içinde çalıştırır; sonuç aşağıda görünür.' });
        setTimeout(() => { loadSettings(); loadRuns(); }, 70000);
    };

    const loadSettings = async () => {
            const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
            if (error) return setMessage({ type: 'error', text: `Ayarlar yüklenemedi: ${error.message}` });
            if (data) {
                setSettings({
                    siteName: data.site_name || 'BoostPanel',
                    currency: data.currency || 'USD',
                    minDeposit: Number(data.min_deposit) || 10,
                    defaultMarkup: Number(data.default_markup) || 2,
                });
                setPs({ enabled: !!data.price_sync_enabled, interval: Number(data.price_sync_interval_minutes) || 60, threshold: Number(data.price_sync_threshold_pct ?? 1),
                    disableMissing: !!data.price_sync_disable_missing, syncMeta: !!data.price_sync_sync_meta, lastRun: data.price_sync_last_run, lastStatus: data.price_sync_last_status, requested: data.price_sync_requested_at });
            }
    };
    useEffect(() => { loadSettings(); loadRuns(); }, []);

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
            price_sync_enabled: ps.enabled,
            price_sync_interval_minutes: Math.max(5, ps.interval),
            price_sync_threshold_pct: Math.max(0, ps.threshold),
            price_sync_disable_missing: ps.disableMissing,
            price_sync_sync_meta: ps.syncMeta,
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

            <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-text-primary">🔄 Otomatik Fiyat Güncelleme</h3>
                    <button onClick={runNow} className="px-3 py-2 rounded-lg bg-bg-elevated text-text-primary text-sm inline-flex items-center gap-1.5"><Play className="w-4 h-4" /> Şimdi çalıştır</button>
                </div>
                <p className="text-xs text-text-muted">Sunucu zamanlayıcısı sağlayıcı maliyetlerini periyodik çeker. Hizmetin yöntemi "Manuel" ise satış fiyatına dokunmaz (yalnızca maliyet satış fiyatını aşarsa zararına satışı önler). Aynı anda tek çalışma yürür.</p>
                <label className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" checked={ps.enabled} onChange={(e) => setPs({ ...ps, enabled: e.target.checked })} /> Otomatik güncelleme açık</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className="block text-sm text-text-secondary mb-1">Aralık (dakika, en az 5)</label><input type="number" min={5} className={input} value={ps.interval} onChange={(e) => setPs({ ...ps, interval: parseInt(e.target.value) || 60 })} /></div>
                    <div><label className="block text-sm text-text-secondary mb-1">Değişim eşiği (%)</label><input type="number" step="0.1" min={0} className={input} value={ps.threshold} onChange={(e) => setPs({ ...ps, threshold: parseFloat(e.target.value) || 0 })} /></div>
                    <div className="space-y-2 sm:pt-6">
                        <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={ps.disableMissing} onChange={(e) => setPs({ ...ps, disableMissing: e.target.checked })} /> Sağlayıcıdan kalkan hizmeti kapat</label>
                        <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={ps.syncMeta} onChange={(e) => setPs({ ...ps, syncMeta: e.target.checked })} /> Min/max değişimini uygula</label>
                    </div>
                </div>
                <div className="text-sm text-text-secondary">Son çalışma: <b className="text-text-primary">{fmtDate(ps.lastRun)}</b> · Sonuç: <b className="text-text-primary break-words">{ps.lastStatus || '-'}</b>{ps.requested && <span className="text-warning-400"> · istek bekliyor</span>}</div>
                {runs.length > 0 && (
                    <div className="overflow-x-auto"><table className="w-full text-xs min-w-[520px]"><thead><tr className="text-text-muted"><th className="text-left py-1">Başlangıç</th><th className="text-left">Tetik</th><th className="text-left">Durum</th><th className="text-right">Kontrol</th><th className="text-right">Değişen</th><th className="text-right">Kayıp</th><th className="text-left pl-3">Hata</th></tr></thead>
                        <tbody>{runs.map((r) => (<tr key={r.id} className="border-t border-border-subtle text-text-secondary"><td className="py-1.5 whitespace-nowrap">{fmtDate(r.started_at)}</td><td>{r.trigger}</td><td>{r.status}</td><td className="text-right">{r.checked}</td><td className="text-right">{r.changed}</td><td className="text-right">{r.missing}</td><td className="pl-3 break-words max-w-[220px]">{r.error || ''}</td></tr>))}</tbody></table></div>)}
                {hist.length > 0 && (
                    <div><div className="text-sm font-medium text-text-primary mb-1">Son fiyat değişiklikleri</div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">{hist.map((h) => (<div key={h.id} className="text-xs text-text-secondary flex flex-wrap gap-x-3"><span>#{h.panel_service_id}</span><span>maliyet {h.old_cost ?? '-'} → {h.new_cost}</span><span>satış {h.old_price} → {h.new_price}</span><span className="text-text-muted">{h.reason}</span></div>))}</div></div>)}
            </div>

            <button onClick={save} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-lg disabled:opacity-50">
                {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Kaydet
            </button>
        </div>
    );
}
