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
    const [ps, setPs] = useState({ enabled: false, interval: 60, threshold: 1, disableMissing: false, syncMeta: false, lastRun: null as string | null, lastStatus: null as string | null, requested: null as string | null, lockUntil: null as string | null });
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
        setTimeout(() => { loadSettings(); loadRuns(); }, 3000);
    };
    const running = !!ps.lockUntil && new Date(ps.lockUntil).getTime() > Date.now();
    const waiting = !!ps.requested && (!ps.lastRun || new Date(ps.requested) > new Date(ps.lastRun));
    // çalışırken/istek beklerken 4 sn'de, aksi halde 30 sn'de bir durumu yenile (sayfa kapalıyken de zamanlayıcı sunucuda çalışır)
    useEffect(() => {
        const t = setInterval(() => { loadSettings(); loadRuns(); }, running || waiting ? 4000 : 30000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, waiting]);
    const failedLast = (ps.lastStatus || '').startsWith('partial') || (ps.lastStatus || '').startsWith('failed');
    const nextRun = ps.enabled && ps.lastRun ? new Date(new Date(ps.lastRun).getTime() + (failedLast ? Math.min(ps.interval, 5) : ps.interval) * 60000) : null;
    const last = runs[0];

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
                    disableMissing: !!data.price_sync_disable_missing, syncMeta: !!data.price_sync_sync_meta, lastRun: data.price_sync_last_run, lastStatus: data.price_sync_last_status, requested: data.price_sync_requested_at, lockUntil: data.price_sync_lock_until });
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
            price_sync_threshold_pct: 0,
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

            <div className="p-4 sm:p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-text-primary">🔄 Otomatik Fiyat ve Limit Güncelleme</h3>
                    <button onClick={runNow} disabled={running || waiting} className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm inline-flex items-center gap-1.5 disabled:opacity-60">
                        {running || waiting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {running ? 'Çalışıyor…' : waiting ? 'Başlatılıyor…' : 'Şimdi çalıştır'}
                    </button>
                </div>
                <p className="text-xs text-text-muted">Sunucu zamanlayıcısı, sağlayıcıya bağlı <b>tüm</b> hizmetleri (özel hizmetler ve kullanıcıya özel fiyatlar dahil) belirlediğin aralıkta kontrol eder. Sayfa kapalıyken de çalışır. Aynı anda yalnızca bir çalışma yürür. Bir sağlayıcı yanıt vermezse diğerleri kontrol edilmeye devam eder; başarısız çalışma 5 dakika sonra yeniden denenir.</p>
                <label className="flex items-center gap-2 text-sm text-text-primary"><input type="checkbox" checked={ps.enabled} onChange={(e) => setPs({ ...ps, enabled: e.target.checked })} /> Otomatik güncelleme açık <span className="text-xs text-text-muted">(değişiklik "Kaydet" ile geçerli olur)</span></label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className="block text-sm text-text-secondary mb-1">Kontrol aralığı (dakika, en az 5)</label><input type="number" min={5} className={input} value={ps.interval} onChange={(e) => setPs({ ...ps, interval: parseInt(e.target.value) || 60 })} /></div>
                    <label className="flex items-start gap-2 text-sm text-text-secondary sm:col-span-1"><input type="checkbox" className="mt-1" checked={ps.syncMeta} onChange={(e) => setPs({ ...ps, syncMeta: e.target.checked })} /><span><b className="text-text-primary">Min/max değişimini uygula</b><br /><span className="text-xs text-text-muted">Sağlayıcıda değişen minimum/maksimum miktarlar panele yansır. Geçmiş siparişler değişmez; geçersiz/eksik limit mevcut değerin üzerine yazılmaz.</span></span></label>
                    <label className="flex items-start gap-2 text-sm text-text-secondary sm:col-span-1"><input type="checkbox" className="mt-1" checked={ps.disableMissing} onChange={(e) => setPs({ ...ps, disableMissing: e.target.checked })} /><span><b className="text-text-primary">Sağlayıcıda kaldırıldığı doğrulanan hizmetleri otomatik pasife al</b><br /><span className="text-xs text-text-muted">Yalnızca art arda 2 başarılı ve eksiksiz kontrolde sağlayıcıda bulunamayan hizmetler kapatılır. Geçici hata veya boş yanıt hizmeti kapatmaz; manuel hizmetler etkilenmez. Sağlayıcıya geri dönerse otomatik açılır.</span></span></label>
                </div>
                <div className="text-sm text-text-secondary grid sm:grid-cols-3 gap-2">
                    <div>Son çalışma: <b className="text-text-primary">{fmtDate(ps.lastRun)}</b></div>
                    <div>Sonraki çalışma: <b className="text-text-primary">{running ? 'şu an çalışıyor' : ps.enabled ? fmtDate(nextRun?.toISOString() ?? null) : 'otomatik güncelleme kapalı'}</b></div>
                    <div>Durum: <b className={failedLast ? 'text-warning-400' : 'text-text-primary'}>{running ? 'Çalışıyor' : ps.lastStatus || '-'}</b></div>
                </div>
                {last && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {[['Kontrol edilen', last.checked], ['Maliyeti değişen', last.cost_changed], ['Satış fiyatı güncellenen', last.price_updated], ['Min/max güncellenen', last.limits_updated], ['Pasife alınan', last.deactivated], ['Hata / kontrol edilemeyen', (last.errors_count || 0) + (last.invalid || 0)]].map(([l, v]) => (
                            <div key={String(l)} className="p-2.5 rounded-xl bg-bg-elevated"><div className="text-[11px] text-text-muted">{l}</div><div className="text-lg font-bold text-text-primary">{v}</div></div>))}
                    </div>)}
                {last?.details && (last.details as any[]).some((d) => !d.ok || (d.service_errors || []).length) && (
                    <div className="text-xs text-warning-400 space-y-1">{(last.details as any[]).filter((d) => !d.ok || (d.service_errors || []).length).map((d, i) => (
                        <div key={i}>⚠️ {d.provider}: {d.ok ? `${(d.service_errors || []).length} hizmet güncellenemedi` : d.error}</div>))}</div>)}
                {runs.length > 0 && (
                    <div className="overflow-x-auto"><table className="w-full text-xs min-w-[640px]"><thead><tr className="text-text-muted"><th className="text-left py-1">Başlangıç</th><th className="text-left">Bitiş</th><th className="text-left">Tetik</th><th className="text-left">Durum</th><th className="text-right">Kontrol</th><th className="text-right">Maliyet</th><th className="text-right">Fiyat</th><th className="text-right">Limit</th><th className="text-right">Pasif</th><th className="text-right">Hata</th></tr></thead>
                        <tbody>{runs.map((r) => (<tr key={r.id} className="border-t border-border-subtle text-text-secondary"><td className="py-1.5 whitespace-nowrap">{fmtDate(r.started_at)}</td><td className="whitespace-nowrap">{r.finished_at ? fmtDate(r.finished_at) : 'çalışıyor…'}</td><td>{r.trigger}</td><td>{r.status}</td><td className="text-right">{r.checked}</td><td className="text-right">{r.cost_changed}</td><td className="text-right">{r.price_updated}</td><td className="text-right">{r.limits_updated}</td><td className="text-right">{r.deactivated}</td><td className="text-right">{(r.errors_count || 0) + (r.invalid || 0)}</td></tr>))}</tbody></table></div>)}
                {hist.length > 0 && (
                    <div><div className="text-sm font-medium text-text-primary mb-1">Son fiyat/limit değişiklikleri</div>
                        <div className="space-y-1 max-h-56 overflow-y-auto">{hist.map((h) => (<div key={h.id} className="text-xs text-text-secondary flex flex-wrap gap-x-3"><span>{fmtDate(h.created_at)}</span><span>#{h.panel_service_id}</span>{h.user_id && <span className="text-brand-400">özel fiyat</span>}<span>maliyet {h.old_cost ?? '-'} → {h.new_cost ?? '-'}</span><span>satış {h.old_price ?? '-'} → {h.new_price ?? '-'}</span><span className="text-text-muted">{h.source === 'manual' ? 'manuel' : 'otomatik'} · {h.reason}{h.result !== 'ok' ? ` · ${h.result}` : ''}{h.note ? ` · ${h.note}` : ''}</span></div>))}</div></div>)}
            </div>

            <button onClick={save} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-lg disabled:opacity-50">
                {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Kaydet
            </button>
        </div>
    );
}
