import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Badge, NoticeBar, Pager, inputCls, type Notice } from '@/components/ui';

const ROLES = [['user', 'Kullanıcı'], ['support', 'Destek'], ['manager', 'Yönetici'], ['admin', 'Admin']];
const PAGE = 20;

export default function AdminRoles() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [catalog, setCatalog] = useState<{ key: string; description: string }[]>([]);
  const [rp, setRp] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Notice>(null);

  const loadUsers = useCallback(async () => {
    let query = supabase.from('profiles').select('user_id,email,username,role,banned', { count: 'exact' });
    if (q.trim()) query = query.or(`email.ilike.%${q.trim().replace(/[%,()]/g, ' ')}%,username.ilike.%${q.trim().replace(/[%,()]/g, ' ')}%`);
    const { data, count } = await query.order('role').order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    setUsers(data || []); setTotal(count || 0);
  }, [q, page]);
  const loadPerms = useCallback(async () => {
    const [{ data: c }, { data: r }] = await Promise.all([supabase.from('permissions_catalog').select('*').order('key'), supabase.from('role_permissions').select('*')]);
    setCatalog(c || []); setRp(new Set((r || []).map((x: any) => `${x.role}:${x.permission}`)));
  }, []);
  useEffect(() => { const t = setTimeout(loadUsers, 250); return () => clearTimeout(t); }, [loadUsers]);
  useEffect(() => { loadPerms(); }, [loadPerms]);
  useEffect(() => setPage(0), [q]);

  const setRole = async (u: any, role: string) => {
    if (!window.confirm(`${u.email || u.username} kullanıcısının rolü "${role}" yapılsın mı?`)) return loadUsers();
    const { data, error } = await supabase.rpc('admin_set_role', { p_user: u.user_id, p_role: role });
    if (error || data?.success === false) setNotice({ ok: false, text: error?.message || data?.error });
    else setNotice({ ok: true, text: `Rol güncellendi: ${data.old} → ${data.new}. Kullanıcı yeniden giriş yapınca/sayfayı yenileyince geçerli olur.` });
    loadUsers();
  };
  const togglePerm = async (role: string, perm: string) => {
    const has = rp.has(`${role}:${perm}`);
    const { error } = has ? await supabase.from('role_permissions').delete().eq('role', role).eq('permission', perm) : await supabase.from('role_permissions').insert({ role, permission: perm });
    if (error) return setNotice({ ok: false, text: error.message });
    loadPerms();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-2xl font-bold text-text-primary">Roller ve İzinler</h2>
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />
      <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle space-y-3">
        <h3 className="font-semibold text-text-primary">İzin matrisi</h3>
        <p className="text-xs text-text-muted">Admin her izne sahiptir. İzinler yalnızca menüyü değil, veritabanı kurallarını (RLS) ve sunucu uçlarını da kısıtlar.</p>
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[480px]"><thead><tr className="text-text-muted text-xs"><th className="text-left py-2">İzin</th><th className="px-3">Destek</th><th className="px-3">Yönetici</th></tr></thead>
          <tbody>{catalog.map((c) => (<tr key={c.key} className="border-t border-border-subtle"><td className="py-2 pr-3"><div className="text-text-primary">{c.description}</div><div className="text-[11px] text-text-muted font-mono">{c.key}</div></td>
            {['support', 'manager'].map((role) => (<td key={role} className="px-3 text-center"><input type="checkbox" checked={rp.has(`${role}:${c.key}`)} onChange={() => togglePerm(role, c.key)} /></td>))}</tr>))}</tbody></table></div>
      </div>
      <div className="space-y-3">
        <div className="relative max-w-sm"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" /><input className={`${inputCls} pl-9`} placeholder="E-posta veya kullanıcı adı" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="rounded-2xl bg-bg-surface border border-border-subtle divide-y divide-border-subtle">
          {users.map((u) => (<div key={u.user_id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0"><div className="text-sm text-text-primary truncate">{u.email || u.username}</div>{u.banned && <Badge tone="bad">Banlı</Badge>}</div>
            <select className={`${inputCls} max-w-[160px]`} value={u.role} disabled={u.user_id === user?.id} onChange={(e) => setRole(u, e.target.value)} title={u.user_id === user?.id ? 'Kendi rolünü değiştiremezsin' : ''}>
              {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>))}
        </div>
        <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
      </div>
    </div>
  );
}
