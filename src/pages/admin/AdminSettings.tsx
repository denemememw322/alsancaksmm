import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, RefreshCw, AlertCircle, CheckCircle2, Globe, Check, Plus, Pencil, Trash2, X } from 'lucide-react';

const emptyProvider = { id: null, name: '', url: '', api_key: '', enabled: true };

export default function AdminSettings() {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [providers, setProviders] = useState<any[]>([]);
    const [editingProvider, setEditingProvider] = useState<any | null>(null);
    const [activeProviderId, setActiveProviderId] = useState<string | null>(null);

    const [fetchedServices, setFetchedServices] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [settings, setSettings] = useState({
        siteName: 'BoostPanel',
        currency: 'USD',
        minDeposit: 10,
    });

    useEffect(() => {
        loadSettings();
        loadProviders();
    }, []);

    const loadSettings = async () => {
        try {
            const { data } = await supabase.from('settings').select('*').single();
            if (data) {
                setSettings({
                    siteName: data.site_name || 'BoostPanel',
                    currency: data.currency || 'USD',
                    minDeposit: data.min_deposit || 10,
                });
            }
        } catch (e) { console.error('Settings error:', e); }
    };

    const loadProviders = async () => {
        const { data } = await supabase.from('api_providers').select('*').order('name');
        setProviders(data || []);
    };

    const saveSettings = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await supabase.from('settings').upsert({
                site_name: settings.siteName,
                currency: settings.currency,
                min_deposit: settings.minDeposit,
                updated_at: new Date().toISOString(),
            });
            setMessage({ type: 'success', text: '✅ Kaydedildi!' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Kaydetme hatası' });
        }
        setSaving(false);
    };

    const saveProvider = async () => {
        if (!editingProvider) return;
        setSaving(true);
        setMessage(null);
        try {
            const payload: any = {
                name: editingProvider.name,
                url: editingProvider.url,
                api_key: editingProvider.api_key,
                enabled: editingProvider.enabled,
                updated_at: new Date().toISOString(),
            };
            // id belirtmezsek DB otomatik benzersiz bir id üretir (yeni sağlayıcı).
            // Düzenlenen mevcut bir sağlayıcıysa id'sini gönderip o satırı güncelliyoruz.
            if (editingProvider.id) payload.id = editingProvider.id;

            const { error } = await supabase.from('api_providers').upsert(payload);
            if (error) throw error;

            setMessage({ type: 'success', text: '✅ Sağlayıcı kaydedildi!' });
            setEditingProvider(null);
            await loadProviders();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Kaydetme hatası' });
        }
        setSaving(false);
    };

    const deleteProvider = async (id: string) => {
        if (!window.confirm('Bu sağlayıcıyı silmek istediğine emin misin? Ona bağlı senkronize servisler silinmez, sadece yerel servise dönüşür.')) return;
        const { error } = await supabase.from('api_providers').delete().eq('id', id);
        if (error) {
            setMessage({ type: 'error', text: error.message });
            return;
        }
        if (activeProviderId === id) {
            setActiveProviderId(null);
            setFetchedServices([]);
        }
        await loadProviders();
    };

    // ✅ PROXY İLE API'DEN ÇEK (artık hangi sağlayıcı olduğunu parametre olarak alıyor)
    const fetchServices = async (provider: any) => {
        setLoading(true);
        setMessage(null);
        setActiveProviderId(provider.id);
        setFetchedServices([]);
        setSelectedIds(new Set());

        try {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(provider.url)}`;

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    key: provider.api_key,
                    action: 'services'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            let services = [];

            if (data.service && Array.isArray(data.service)) {
                services = data.service;
            } else if (data.services && Array.isArray(data.services)) {
                services = data.services;
            } else if (Array.isArray(data)) {
                services = data;
            } else if (data.data && Array.isArray(data.data)) {
                services = data.data;
            } else if (data.result && Array.isArray(data.result)) {
                services = data.result;
            } else if (data.response && Array.isArray(data.response)) {
                services = data.response;
            } else if (data.id || data.name) {
                services = [data];
            } else {
                for (const key of Object.keys(data)) {
                    if (Array.isArray(data[key]) && data[key].length > 0) {
                        services = data[key];
                        break;
                    }
                }
            }

            if (services.length === 0) {
                setMessage({ type: 'error', text: '⚠️ Servis bulunamadı!' });
                setLoading(false);
                return;
            }

            const formatted = services.map((s: any, index: number) => ({
                id: String(s.service ?? s.id ?? s.service_id ?? `local-${index}`),
                name: s.name || s.service_name || 'Bilinmiyor',
                category: s.category || 'Genel',
                price: Number(s.rate ?? s.price ?? 0),
                min: Number(s.min ?? s.min_order ?? 10),
                max: Number(s.max ?? s.max_order ?? 100000),
                rate: Number(s.rate ?? s.price ?? s.rate_per_1000 ?? 0),
                description: s.description || '',
                avg_time: s.avg_time || 'Hızlı',
            }));

            setFetchedServices(formatted);
            setSelectedIds(new Set(formatted.map((s: any) => s.id)));

            setMessage({
                type: 'success',
                text: `✅ ${formatted.length} servis çekildi! (${provider.name})`
            });

        } catch (error: any) {
            console.error('❌ API Hatası:', error);
            setMessage({
                type: 'error',
                text: error.message || 'Bağlantı hatası! Proxy çalışmıyor olabilir.'
            });
        }
        setLoading(false);
    };

    const toggleService = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleAll = () => {
        if (selectedIds.size === fetchedServices.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(fetchedServices.map((s: any) => s.id)));
        }
    };

    const syncServices = async () => {
        const activeProvider = providers.find((p) => p.id === activeProviderId);
        if (!activeProvider) {
            setMessage({ type: 'error', text: 'Önce bir sağlayıcıdan servis çekin!' });
            return;
        }
        if (fetchedServices.length === 0) {
            setMessage({ type: 'error', text: 'Önce servis çekin!' });
            return;
        }

        if (selectedIds.size === 0) {
            setMessage({ type: 'error', text: 'En az 1 servis seçin!' });
            return;
        }

        const toSync = fetchedServices.filter((s: any) => selectedIds.has(s.id));
        setSaving(true);

        let synced = 0;
        let lastError = '';
        for (const service of toSync) {
            const { error } = await supabase.from('services').upsert({
                service_id: Number(service.id) || Date.now(),
                name: service.name,
                category: service.category || 'API',
                platform: service.category || 'API',
                price: service.price || 0,
                min_order: service.min || 10,
                max_order: service.max || 100000,
                rate_per_1000: service.rate || service.price || 0,
                type: 'API',
                description: service.description || `API: ${activeProvider.name}`,
                is_active: true,
                avg_time: service.avg_time || 'Hızlı',
                provider_id: activeProvider.id,
                original_id: service.id,
            }, { onConflict: 'provider_id,original_id' });

            if (!error) {
                synced++;
            } else {
                console.error('Sync hatası:', error);
                lastError = error.message;
            }
        }

        if (synced === toSync.length) {
            setMessage({ type: 'success', text: `✅ ${synced} servis eklendi!` });
        } else if (synced > 0) {
            setMessage({ type: 'error', text: `⚠️ ${synced}/${toSync.length} servis eklendi. Son hata: ${lastError}` });
        } else {
            setMessage({ type: 'error', text: `❌ Hiçbir servis eklenemedi. Hata: ${lastError}` });
        }
        setSaving(false);
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <h2 className="text-2xl font-bold text-text-primary">⚙️ Ayarlar</h2>

            {message && (
                <div className={`p-4 rounded-xl border text-sm ${message.type === 'success'
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 inline mr-2" /> : <AlertCircle className="w-5 h-5 inline mr-2" />}
                    {message.text}
                </div>
            )}

            <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-text-primary">🔌 API Sağlayıcılar</h3>
                    <button
                        onClick={() => setEditingProvider({ ...emptyProvider })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium"
                    >
                        <Plus className="w-3.5 h-3.5" /> Yeni Sağlayıcı
                    </button>
                </div>

                {providers.length === 0 && !editingProvider && (
                    <p className="text-sm text-text-muted">Henüz sağlayıcı eklenmedi.</p>
                )}

                <div className="space-y-3">
                    {providers.map((p) => (
                        <div key={p.id} className="border border-border-subtle rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-text-primary truncate">{p.name}</span>
                                        {!p.enabled && <span className="text-xs px-1.5 py-0.5 rounded bg-error-500/10 text-error-400">Pasif</span>}
                                    </div>
                                    <p className="text-xs text-text-muted truncate mt-0.5">{p.url}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button onClick={() => setEditingProvider({ ...p })} title="Düzenle" className="p-1.5 rounded-lg text-text-muted hover:text-brand-400 hover:bg-brand-500/10 transition-colors">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => deleteProvider(p.id)} title="Sil" className="p-1.5 rounded-lg text-text-muted hover:text-error-400 hover:bg-error-500/10 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3 mt-3">
                                <button
                                    onClick={() => fetchServices(p)}
                                    disabled={loading}
                                    className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {loading && activeProviderId === p.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                                    Servisleri Çek
                                </button>
                                {activeProviderId === p.id && fetchedServices.length > 0 && (
                                    <button
                                        onClick={syncServices}
                                        disabled={saving}
                                        className="px-3 py-1.5 rounded-lg bg-success-600 hover:bg-success-500 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null} Seçilenleri Ekle
                                    </button>
                                )}
                            </div>

                            {activeProviderId === p.id && fetchedServices.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-border-subtle">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-sm text-text-secondary">
                                            📦 <span className="text-brand-400 font-semibold">{fetchedServices.length}</span> servis
                                            <span className="ml-2 text-xs text-text-muted">({selectedIds.size} seçili)</span>
                                        </p>
                                        <button onClick={toggleAll} className="text-xs text-brand-400 hover:text-brand-300">
                                            {selectedIds.size === fetchedServices.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                                        </button>
                                    </div>

                                    <div className="max-h-64 overflow-y-auto space-y-1">
                                        {fetchedServices.map((s: any) => {
                                            const checked = selectedIds.has(s.id);
                                            return (
                                                <div
                                                    key={s.id}
                                                    onClick={() => toggleService(s.id)}
                                                    className={`flex items-center justify-between py-2 px-3 rounded-lg border cursor-pointer transition-all ${checked
                                                        ? 'bg-brand-500/10 border-brand-500/30'
                                                        : 'border-border-subtle hover:border-border-default'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked
                                                            ? 'bg-brand-500 border-brand-500'
                                                            : 'border-border-default'
                                                        }`}>
                                                            {checked && <Check className="w-3 h-3 text-white" />}
                                                        </div>
                                                        <span className="text-sm text-text-primary truncate">{s.name}</span>
                                                    </div>
                                                    <span className="text-xs text-text-muted shrink-0 ml-2">${s.rate || s.price || 0}/1K</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {editingProvider && (
                    <div className="mt-4 pt-4 border-t border-border-subtle">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-text-primary">{editingProvider.id ? 'Sağlayıcıyı Düzenle' : 'Yeni Sağlayıcı'}</h4>
                            <button onClick={() => setEditingProvider(null)} className="p-1 rounded text-text-muted hover:text-text-primary">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm text-text-secondary mb-1">Sağlayıcı Adı</label>
                                <input
                                    type="text"
                                    value={editingProvider.name}
                                    onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-1">API URL</label>
                                <input
                                    type="text"
                                    value={editingProvider.url}
                                    onChange={(e) => setEditingProvider({ ...editingProvider, url: e.target.value })}
                                    placeholder="https://saglayici.com/api-endpoint.php"
                                    className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary mb-1">API Key</label>
                                <input
                                    type="password"
                                    value={editingProvider.api_key}
                                    onChange={(e) => setEditingProvider({ ...editingProvider, api_key: e.target.value })}
                                    placeholder="api-key"
                                    className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-4">
                            <label className="flex items-center gap-2 text-sm text-text-secondary">
                                <input
                                    type="checkbox"
                                    checked={editingProvider.enabled}
                                    onChange={(e) => setEditingProvider({ ...editingProvider, enabled: e.target.checked })}
                                    className="w-4 h-4 accent-brand-500"
                                />
                                Aktif
                            </label>
                            <button
                                onClick={saveProvider}
                                disabled={saving || !editingProvider.name || !editingProvider.url}
                                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                                Sağlayıcıyı Kaydet
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle">
                <h3 className="font-semibold text-text-primary mb-4">🌐 Genel Ayarlar</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Site Adı</label>
                        <input
                            type="text"
                            value={settings.siteName}
                            onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Para Birimi</label>
                        <input
                            type="text"
                            value={settings.currency}
                            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Min Yükleme</label>
                        <input
                            type="number"
                            value={settings.minDeposit}
                            onChange={(e) => setSettings({ ...settings, minDeposit: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary"
                        />
                    </div>
                </div>
            </div>

            <button
                onClick={saveSettings}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-lg transition-colors disabled:opacity-50"
            >
                {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                💾 Genel Ayarları Kaydet
            </button>
        </div>
    );
}
