// Sipariş anındaki anlık görüntüye (refill_allowed, cancel_allowed, guarantee_days) göre buton uygunluğu.
// Sunucu (order_cancel_check / order_refill_check) aynı kuralı zorunlu kılar; burası yalnızca butonu gösterir/gizler.
type O = { id: string; status: string; provider_order_id?: string | null; cancel_allowed?: boolean; refill_allowed?: boolean; guarantee_days?: number; completed_at?: string | null; updated_at?: string };

export function cancelState(o: O, pendingCancel: Set<string>) {
  if (!o.cancel_allowed || !o.provider_order_id) return { allowed: false, pending: false };
  if (pendingCancel.has(o.id)) return { allowed: false, pending: true };
  return { allowed: ['Pending', 'Processing'].includes(o.status), pending: false };
}

export function refillState(o: O, pendingRefill: Set<string>, now = Date.now()) {
  if (!o.refill_allowed || !o.provider_order_id) return { allowed: false, pending: false };
  if (pendingRefill.has(o.id)) return { allowed: false, pending: true };
  if (!['Completed', 'Partial'].includes(o.status)) return { allowed: false, pending: false };
  const days = o.guarantee_days ?? 0;
  if (days > 0) {
    const start = new Date(o.completed_at || o.updated_at || 0).getTime();
    const end = start + days * 86400000;
    return { allowed: now <= end, pending: false, expiresAt: end };
  }
  return { allowed: true, pending: false, lifetime: true };
}
