import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Save, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const emptyMethod = {
  id: null as string | null, kind: 'crypto', name: '', network: '', currency: 'USDT', address: '',
  qr_path: null as string | null, instructions: '', min_amount: 10, is_active: true, sort_order: 0,
};

const PAYTR_FIELDS: [string, string][] = [
  ['merchant_id', 'Mağaza No (merchant_id)'],
  ['merchant_key', 'Mağaza Parolası (merchant_key)'],
  ['merchant_salt', 'Mağaza Gizli Anahtarı (merchant_salt)'],
  ['usd_try_rate', 'USD → TL kuru (örn. 41.50)'],
  ['test_mode', 'Test modu (1 = test, 0 = canlı)'],
];

const PAYMOS_FIELDS: [string, string][] = [
  ['api_key', 'API Key (pk_...)'],
  ['api_secret', 'API Secret (sk_...)'],
  ['project_id', 'Project ID (prj_...)'],
  ['webhook_secret', 'Webhook Secret (whsec_...)'],
];
const INTEGRATED = ['paytr', 'paymos'];
const FIELDS: Record<string, [string, string][]> = { paytr: PAYTR_FIELDS, paymos: PAYMOS_FIELDS };

const input = 'w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border-default text-sm text-text-primary focus:outline-none focus:border-brand-500';

export default function AdminPayments() {
  const [methods, setMethods] = useState<any[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newGw, setNewGw] = useState({ provider: '', display_name: '' });
  const [events, setEvents] = useState<any[]>([]);

  const load = async () => {
    const [{ data: m }, { data: g }] = await Promise.all([
      supabase.from('payment_methods').select('*').order('sort_order'),
      supabase.from('payment_gateway_settings').select('*').order('provider'),
    ]);
    setMethods(m || []);
    setGateways(g || []);
    const { data: ev } = await supabase.from('provider_events').select('*').order('created_at', { ascending: false }).limit(30);
    setEvents(ev || []);
  };
  useEffect(() => { load(); }, []);

  const qrUrl = (p: string | null) => (p ? supabase.storage.from('payment-qr').getPublicUrl(p).data.publicUrl : null);

  const saveMethod = async () => {
    if (!editing?.name) return;
    setSaving(true);
    setMsg(null);
    try {
      let qr_path = editing.qr_path as string | null;
      if (qrFile) {
        const ext = qrFile.name.split('.').pop() || 'png';
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('payment-qr').upload(path, qrFile, { upsert: false });
        if (upErr) throw upErr;
        qr_path = path;
      }
      const payload: any = {
        kind: editing.kind, name: editing.name, network: editing.network || null, currency: editing.currency || 'USD',
        address: editing.address || null, qr_path, instructions: editing.instructions || null,
        min_amount: Number(editing.min_amount) || 0, is_active: !!editing.is_active, sort_order: Number(editing.sort_order) || 0,
      };
      if (editing.id) payload.id = editing.id;
      const { error } = await supabase.from('payment_methods').upsert(payload);
      if (error) throw error;
      setEditing(null);
      setQrFile(null);
      setMsg({ ok: true, text: 'Kaydedildi' });
      load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Kaydedilemedi' });
    }
    setSaving(false);
  };

  const deleteMethod = async (id: string) => {
    if (!window.confirm('Bu ödeme yöntemi silinsin mi? (Geçmiş talepler korunur)')) return;
    const { error } = await supabase.from('payment_methods').delete().eq('id', id);
    if (error) setMsg({ ok: false, text: 'Silinemedi: bu yöntemle talepler var. Bunun yerine pasif yap.' });
    else load();
  };

  const saveGateway = async (g: any) => {
    setSaving(true);
    const { error } = await supabase.from('payment_gateway_settings').upsert({
      provider: g.provider, display_name: g.display_name, is_active: g.is_active, config: g.config, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: `${g.provider} kaydedildi` });
    load();
  };

  const setGw = (provider: string, patch: any) =>
    setGateways((prev) => prev.map((g) => (g.provider === provider ? { ...g, ...patch } : g)));

  const addGateway = async () => {
    const slug = newGw.provider.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!slug) return;
    await supabase.from('payment_gateway_settings').upsert({ provider: slug, display_name: newGw.display_name || slug, is_active: false, config: {} });
    setNewGw({ provider: '', display_name: '' });
    load();
  };

  const fnUrl = (n: string) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${n}`;

  return (
    <div className="space-y-10">
      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.ok ? 'bg-success-500/10 text-success-400' : 'bg-error-500/10 text-error-400'}`}>{msg.text}</div>
      )}

      {/* MANUEL ÖDEME YÖNTEMLERİ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-text-primary">Manuel Ödeme Yöntemleri (Kripto / Banka)</h2>
          <button onClick={() => { setEditing({ ...emptyMethod }); setQrFile(null); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm"><Plus className="w-4 h-4" /> Yeni yöntem</button>
        </div>

        {editing && (
          <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle mb-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="text-xs text-text-muted">Ad (örn. USDT TRC20)</label><input className={input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><label className="text-xs text-text-muted">Ağ (TRC20, BEP20, ERC20, Binance Pay...)</label><input className={input} value={editing.network ?? ''} onChange={(e) => setEditing({ ...editing, network: e.target.value })} /></div>
              <div><label className="text-xs text-text-muted">Para birimi</label><input className={input} value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} /></div>
              <div><label className="text-xs text-text-muted">Tür</label>
                <select className={input} value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>
                  <option value="crypto">Kripto</option><option value="bank">Banka / IBAN</option>
                </select></div>
              <div className="sm:col-span-2"><label className="text-xs text-text-muted">Cüzdan adresi / IBAN</label><input className={`${input} font-mono`} value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="text-xs text-text-muted">Kullanıcıya gösterilecek açıklama</label><textarea rows={3} className={input} value={editing.instructions ?? ''} onChange={(e) => setEditing({ ...editing, instructions: e.target.value })} /></div>
              <div><label className="text-xs text-text-muted">Minimum tutar</label><input type="number" className={input} value={editing.min_amount} onChange={(e) => setEditing({ ...editing, min_amount: e.target.value })} /></div>
              <div><label className="text-xs text-text-muted">Sıra</label><input type="number" className={input} value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} /></div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <Upload className="w-4 h-4" /> QR kod yükle (kalıcı)
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setQrFile(e.target.files?.[0] ?? null)} />
              </label>
              {qrFile && <span className="text-xs text-text-muted">{qrFile.name}</span>}
              {!qrFile && editing.qr_path && <img src={qrUrl(editing.qr_path)!} alt="QR" className="w-16 h-16 bg-white rounded p-1" />}
              <label className="flex items-center gap-2 text-sm text-text-secondary ml-auto">
                <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Aktif
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={saveMethod} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Kaydet</button>
              <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-bg-elevated text-text-secondary text-sm"><X className="w-4 h-4" /> Vazgeç</button>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {methods.length === 0 && <tr><td className="px-4 py-6 text-center text-text-muted">Henüz yöntem yok</td></tr>}
              {methods.map((m) => (
                <tr key={m.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-3">{m.qr_path && <img src={qrUrl(m.qr_path)!} alt="" className="w-10 h-10 bg-white rounded p-0.5" />}</td>
                  <td className="px-4 py-3 text-text-primary font-medium">{m.name}<div className="text-xs text-text-muted">{m.network}</div></td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary break-all max-w-xs">{m.address}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${m.is_active ? 'bg-success-500/10 text-success-400' : 'bg-bg-hover text-text-muted'}`}>{m.is_active ? 'Aktif' : 'Pasif'}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => { setEditing({ ...m }); setQrFile(null); }} className="p-2 rounded-lg bg-bg-elevated text-text-secondary"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deleteMethod(m.id)} className="p-2 rounded-lg bg-error-500/10 text-error-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SANAL POS / GATEWAY */}
      <section>
        <h2 className="font-semibold text-text-primary mb-1">Sanal POS / Kart Ödeme Entegrasyonları</h2>
        <p className="text-xs text-text-muted mb-4">Anahtarlar yalnızca admin tarafından okunabilir. Sohbete veya GitHub'a yazma, buraya gir.</p>

        <div className="space-y-4">
          {gateways.map((g) => (
            <div key={g.provider} className="p-4 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="font-semibold text-text-primary uppercase">{g.provider}</div>
                <input className={`${input} max-w-xs`} value={g.display_name ?? ''} onChange={(e) => setGw(g.provider, { display_name: e.target.value })} placeholder="Kullanıcıya görünen ad" />
                {INTEGRATED.includes(g.provider) ? (
                  <label className="flex items-center gap-2 text-sm text-text-secondary ml-auto">
                    <input type="checkbox" checked={g.is_active} onChange={(e) => setGw(g.provider, { is_active: e.target.checked })} /> Aktif
                  </label>
                ) : (
                  <span className="ml-auto px-2 py-1 rounded-full text-xs bg-warning-500/10 text-warning-400">Entegrasyon bekleniyor</span>
                )}
              </div>

              {FIELDS[g.provider] ? (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {FIELDS[g.provider].map(([k, label]) => (
                      <div key={k}><label className="text-xs text-text-muted">{label}</label>
                        <input className={input} type={k.includes('key') || k.includes('salt') ? 'password' : 'text'} value={g.config?.[k] ?? ''}
                          onChange={(e) => setGw(g.provider, { config: { ...g.config, [k]: e.target.value } })} /></div>
                    ))}
                  </div>
                  <div className="text-xs text-text-muted">
                    {g.provider === 'paytr' ? 'PayTR Mağaza Paneli → Ayarlar → Bildirim URL alanına şunu yaz:' : 'Paymos Dashboard → Developer → Webhooks bölümüne şu HTTPS adresini ekle (kategori: Invoice):'}
                    <div className="mt-1 font-mono text-text-secondary break-all select-all">{fnUrl(g.provider === 'paytr' ? 'paytr-callback' : 'paymos-webhook')}</div>
                    {g.provider === 'paymos' && <div className="mt-1">Paymos TEST (sandbox) ödemeleri bakiye yüklemez; yalnızca canlı ödemeler yükler.</div>}
                  </div>
                </>
              ) : (
                <div>
                  <label className="text-xs text-text-muted">Ayarlar (JSON). Bu sağlayıcının otomatik bağlantısı henüz yazılmadı; ayarlar yalnızca saklanır ve kullanıcıya gösterilmez.</label>
                  <textarea rows={4} className={`${input} font-mono`} defaultValue={JSON.stringify(g.config ?? {}, null, 2)}
                    onBlur={(e) => { try { setGw(g.provider, { config: JSON.parse(e.target.value || '{}') }); } catch { setMsg({ ok: false, text: 'JSON geçersiz' }); } }} />
                </div>
              )}
              <button onClick={() => saveGateway(g)} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50"><Save className="w-4 h-4" /> Kaydet</button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <input className={`${input} max-w-[180px]`} placeholder="kod (örn. iyzico)" value={newGw.provider} onChange={(e) => setNewGw({ ...newGw, provider: e.target.value })} />
          <input className={`${input} max-w-[220px]`} placeholder="Görünen ad" value={newGw.display_name} onChange={(e) => setNewGw({ ...newGw, display_name: e.target.value })} />
          <button onClick={addGateway} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bg-elevated text-text-secondary text-sm"><Plus className="w-4 h-4" /> Sağlayıcı ekle</button>
        </div>
      </section>

      {/* WEBHOOK / OLAY KAYITLARI */}
      <section>
        <h2 className="font-semibold text-text-primary mb-3">Son sağlayıcı bildirimleri</h2>
        <div className="rounded-2xl bg-bg-surface border border-border-subtle overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {events.length === 0 && <tr><td className="px-4 py-6 text-center text-text-muted">Henüz bildirim yok</td></tr>}
              {events.map((e) => (
                <tr key={e.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-2 uppercase text-text-secondary">{e.provider}</td>
                  <td className="px-4 py-2 font-mono text-xs text-text-primary">{e.public_id ?? '-'}</td>
                  <td className="px-4 py-2 text-text-secondary">{e.event_type}</td>
                  <td className="px-4 py-2"><span className={`px-2 py-1 rounded-full text-xs ${e.status === 'processed' ? 'bg-success-500/10 text-success-400' : e.status === 'error' ? 'bg-error-500/10 text-error-400' : 'bg-bg-hover text-text-muted'}`}>{e.status}</span>{e.error && <span className="ml-2 text-xs text-text-muted">{e.error}</span>}</td>
                  <td className="px-4 py-2 text-text-muted">{new Date(e.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
