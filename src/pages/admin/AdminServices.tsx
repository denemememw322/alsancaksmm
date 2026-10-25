import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';

const emptyForm = {
    name: '',
    category: '',
    rate_per_1000: '',
    min_order: '10',
    max_order: '100000',
    type: 'Default',
    avg_time: 'Hızlı',
    description: '',
};

function CategoryPicker({
    value,
    categories,
    onChange,
    onCancel,
}: {
    value: string;
    categories: string[];
    onChange: (cat: string) => void;
    onCancel?: () => void;
}) {
    const [addingNew, setAddingNew] = useState(false);
    const [newCat, setNewCat] = useState('');

    if (addingNew) {
        return (
            <div className="flex items-center gap-1.5">
                <input
                    type="text"
                    autoFocus
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    placeholder="Yeni kategori adı"
                    className="px-2 py-1.5 rounded-lg bg-bg-elevated border border-border-default text-text-primary text-sm w-40"
                />
                <button
                    onClick={() => {
                        if (newCat.trim()) {
                            onChange(newCat.trim());
                            setAddingNew(false);
                            setNewCat('');
                        }
                    }}
                    className="p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white"
                >
                    <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { setAddingNew(false); setNewCat(''); }} className="p-1.5 text-text-muted hover:text-text-primary">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5">
            <select
                value={value}
                onChange={(e) => {
                    if (e.target.value === '__new__') setAddingNew(true);
                    else onChange(e.target.value);
                }}
                className="px-2 py-1.5 rounded-lg bg-bg-elevated border border-border-default text-text-primary text-sm max-w-[220px]"
            >
                {!value && <option value="">Kategori seç...</option>}
                {value && !categories.includes(value) && <option value={value}>{value}</option>}
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ Yeni kategori...</option>
            </select>
            {onCancel && (
                <button onClick={onCancel} className="p-1.5 text-text-muted hover:text-text-primary">
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}

export default function AdminServices() {
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
    const [priceValue, setPriceValue] = useState('');

    const [form, setForm] = useState({ ...emptyForm });

    useEffect(() => {
        loadServices();
    }, []);

    const loadServices = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('services')
            .select('*')
            .order('category', { ascending: true });
        setServices(data || []);
        setLoading(false);
    };

    // Kendi tanımladığın (ya da sağlayıcıdan gelen) tüm benzersiz kategoriler -
    // seçim listesi buradan büyüyor, sabit/hardcoded bir liste değil.
    const categories = useMemo(
        () => Array.from(new Set(services.map((s) => s.category).filter(Boolean))).sort(),
        [services]
    );

    const addService = async () => {
        setError('');
        if (!form.name.trim() || !form.category.trim()) {
            setError('Hizmet adı ve kategori zorunlu.');
            return;
        }
        const rate = parseFloat(form.rate_per_1000);
        if (isNaN(rate) || rate <= 0) {
            setError('Geçerli bir fiyat gir (0\'dan büyük).');
            return;
        }
        const min = parseInt(form.min_order) || 10;
        const max = parseInt(form.max_order) || 100000;
        if (max < min) {
            setError('Max sipariş, Min sipariş\'ten küçük olamaz.');
            return;
        }

        setSaving(true);

        // Date.now() ile üretilen milisaniyelik zaman damgası integer sınırını
        // aşıyordu ("out of range" hatası). Onun yerine diğer servislerdeki gibi
        // (#17, #4366...) küçük, sıralı bir sayı üretiyoruz.
        const maxId = services.reduce((max, s) => Math.max(max, Number(s.service_id) || 0), 0);
        const nextId = maxId + 1;

        const { error: dbError } = await supabase.from('services').insert({
            service_id: nextId,
            name: form.name.trim(),
            category: form.category.trim(),
            platform: form.category.trim(),
            price: rate,
            min_order: min,
            max_order: max,
            rate_per_1000: rate,
            type: form.type.trim() || 'Default',
            description: form.description.trim() || null,
            is_active: true,
            avg_time: form.avg_time.trim() || 'Hızlı',
        });
        setSaving(false);

        if (dbError) {
            setError(dbError.message);
            return;
        }
        setForm({ ...emptyForm });
        loadServices();
    };

    const deleteService = async (id: string) => {
        if (confirm('Silmek istediğine emin misin?')) {
            await supabase.from('services').delete().eq('id', id);
            loadServices();
        }
    };

    const toggleActive = async (id: string, current: boolean) => {
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, is_active: !current } : s)));
        await supabase.from('services').update({ is_active: !current }).eq('id', id);
    };

    const updateCategory = async (id: string, category: string) => {
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, category } : s)));
        setEditingCategoryId(null);
        await supabase.from('services').update({ category, platform: category }).eq('id', id);
    };

    const startEditPrice = (s: any) => {
        setEditingPriceId(s.id);
        setPriceValue(String(s.rate_per_1000));
    };

    const savePrice = async (id: string) => {
        const rate = parseFloat(priceValue);
        if (isNaN(rate) || rate <= 0) {
            window.alert('Geçerli bir fiyat gir (0\'dan büyük).');
            return;
        }
        setServices((prev) => prev.map((s) => (s.id === id ? { ...s, rate_per_1000: rate, price: rate } : s)));
        setEditingPriceId(null);
        // rate_per_1000 fiili ücretlendirmede kullanılan alan (place_order RPC'si buradan
        // okuyor), price ise aynı değeri yansıtan ikinci bir kolon - ikisini de güncelliyoruz
        // ki hangi alanı okuyan bir ekran olursa olsun tutarlı kalsın.
        await supabase.from('services').update({ rate_per_1000: rate, price: rate }).eq('id', id);
    };

    const field = (key: keyof typeof form) => ({
        value: form[key],
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-text-primary">📦 Hizmetler</h2>
                <span className="text-sm text-text-secondary">{services.length} hizmet</span>
            </div>

            {/* Yeni Hizmet Ekle */}
            <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle">
                <h3 className="font-semibold text-text-primary mb-4">➕ Yeni Hizmet Ekle</h3>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-error-500/10 border border-error-500/20 text-error-400 text-sm">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Hizmet Adı *</label>
                        <input type="text" placeholder="örn. Instagram Takipçi | Türk | Instant" {...field('name')}
                            className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted/60" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Kategori *</label>
                        <CategoryPicker
                            value={form.category}
                            categories={categories}
                            onChange={(cat) => setForm({ ...form, category: cat })}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Fiyat / 1000 (USD) *</label>
                        <input type="number" step="0.01" min="0" placeholder="örn. 0.90" {...field('rate_per_1000')}
                            className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted/60" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Min Sipariş</label>
                        <input type="number" min="1" placeholder="örn. 50" {...field('min_order')}
                            className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted/60" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Max Sipariş</label>
                        <input type="number" min="1" placeholder="örn. 100000" {...field('max_order')}
                            className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted/60" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Ortalama Teslimat Süresi</label>
                        <input type="text" placeholder="örn. Hızlı, 1-2 saat, 24 saat" {...field('avg_time')}
                            className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted/60" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Açıklama (opsiyonel)</label>
                        <input type="text" placeholder="Müşteriye görünecek kısa not" {...field('description')}
                            className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted/60" />
                    </div>
                </div>

                <button
                    onClick={addService}
                    disabled={saving}
                    className="w-full sm:w-auto mt-5 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium transition-colors disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" /> {saving ? 'Ekleniyor...' : 'Hizmeti Ekle'}
                </button>
            </div>

            {/* Hizmet Listesi */}
            <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="border-b border-border-subtle">
                            <tr className="text-text-muted text-xs uppercase">
                                <th className="px-4 py-3 text-left">ID</th>
                                <th className="px-4 py-3 text-left">Hizmet</th>
                                <th className="px-4 py-3 text-left">Kategori</th>
                                <th className="px-4 py-3 text-left">Fiyat/1K</th>
                                <th className="px-4 py-3 text-left">Min/Max</th>
                                <th className="px-4 py-3 text-left">Durum</th>
                                <th className="px-4 py-3 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Yükleniyor...</td></tr>
                            ) : services.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Henüz hizmet yok</td></tr>
                            ) : (
                                services.map((s) => (
                                    <tr key={s.id} className="border-b border-border-subtle hover:bg-bg-elevated/50">
                                        <td className="px-4 py-3 text-text-muted">#{s.service_id}</td>
                                        <td className="px-4 py-3 text-text-primary max-w-[260px] truncate">{s.name}</td>
                                        <td className="px-4 py-3 text-text-secondary">
                                            {editingCategoryId === s.id ? (
                                                <CategoryPicker
                                                    value={s.category}
                                                    categories={categories}
                                                    onChange={(cat) => updateCategory(s.id, cat)}
                                                    onCancel={() => setEditingCategoryId(null)}
                                                />
                                            ) : (
                                                <button
                                                    onClick={() => setEditingCategoryId(s.id)}
                                                    title="Kategoriyi değiştir"
                                                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-elevated text-xs hover:border hover:border-brand-500/40 group"
                                                >
                                                    <span className="max-w-[180px] truncate">{s.category}</span>
                                                    <Pencil className="w-3 h-3 text-text-muted group-hover:text-brand-400 shrink-0" />
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {editingPriceId === s.id ? (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-text-muted text-xs">$</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        autoFocus
                                                        value={priceValue}
                                                        onChange={(e) => setPriceValue(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && savePrice(s.id)}
                                                        className="w-20 px-2 py-1.5 rounded-lg bg-bg-elevated border border-border-default text-text-primary text-sm"
                                                    />
                                                    <button onClick={() => savePrice(s.id)} className="p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white">
                                                        <Check className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => setEditingPriceId(null)} className="p-1.5 text-text-muted hover:text-text-primary">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => startEditPrice(s)}
                                                    title="Fiyatı değiştir"
                                                    className="flex items-center gap-1.5 text-brand-400 font-semibold hover:text-brand-300 group"
                                                >
                                                    ${s.rate_per_1000}
                                                    <Pencil className="w-3 h-3 text-text-muted group-hover:text-brand-400" />
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-text-muted text-xs">{s.min_order} / {s.max_order}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => toggleActive(s.id, s.is_active)}
                                                title={s.is_active ? 'Pasif yap (müşteriye görünmez olur)' : 'Aktif yap (müşteriye görünür olur)'}
                                                className="flex items-center gap-2 group"
                                            >
                                                <span className={`relative w-9 h-5 rounded-full transition-colors ${s.is_active ? 'bg-success-500' : 'bg-bg-hover border border-border-default'}`}>
                                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${s.is_active ? 'left-4' : 'left-0.5'}`} />
                                                </span>
                                                <span className={`text-xs font-medium ${s.is_active ? 'text-success-400' : 'text-text-muted'}`}>
                                                    {s.is_active ? 'Aktif' : 'Pasif'}
                                                </span>
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => deleteService(s.id)}
                                                title="Sil"
                                                className="text-error-400 hover:text-error-300 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
