type Row = { service: number; link: string; quantity: number; comments?: string };
type Parsed = { line: number; raw: string; row?: Row; error?: string };

// Biçim: hizmet_id | link | miktar     (Custom Comments için: hizmet_id | link | yorum1\nyorum2... yerine ; ile ayrılmış yorumlar)
export function parseBulk(text: string): Parsed[] {
  return text.split(/\r?\n/).map((raw, i) => ({ raw: raw.trim(), line: i + 1 })).filter((l) => l.raw)
    .map(({ raw, line }) => {
      const parts = raw.split('|').map((p) => p.trim());
      if (parts.length < 3) return { line, raw, error: 'Biçim: hizmet_id | link | miktar' };
      const service = parseInt(parts[0], 10);
      if (!/^\d+$/.test(parts[0]) || !service) return { line, raw, error: 'Hizmet ID sayı olmalı' };
      if (!/^https?:\/\/\S+$/i.test(parts[1])) return { line, raw, error: 'Geçerli bir link gir (https://...)' };
      const hasComments = parts.length >= 4 && parts[3];
      const quantity = parseInt(parts[2], 10);
      if (!hasComments && (!/^\d+$/.test(parts[2]) || quantity <= 0)) return { line, raw, error: 'Miktar pozitif bir sayı olmalı' };
      const row: Row = { service, link: parts[1], quantity: Number.isFinite(quantity) ? quantity : 0 };
      if (hasComments) row.comments = parts[3].split(';').map((c) => c.trim()).filter(Boolean).join('\n');
      return { line, raw, row };
    });
}

