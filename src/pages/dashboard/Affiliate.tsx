import { useState } from 'react';
import { Gift, Copy, Check, Users, DollarSign, TrendingUp, Share2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function Affiliate() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);

  const refCode = profile?.affiliate_code ?? 'REFXXXX';
  const refLink = `${window.location.origin}/signup?ref=${refCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = [
    { label: 'Total Referrals', value: profile?.affiliate_referrals ?? 0, icon: Users, color: 'text-brand-400', bg: 'bg-brand-500/10' },
    { label: 'Total Earnings', value: `$${(profile?.affiliate_earnings ?? 0).toFixed(2)}`, icon: DollarSign, color: 'text-success-400', bg: 'bg-success-500/10' },
    { label: 'Commission Rate', value: '10%', icon: TrendingUp, color: 'text-accent-400', bg: 'bg-accent-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">Affiliate Program</h1>
        <p className="text-text-secondary text-sm mt-1">Earn 10% commission on every referral's spend</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="p-5 rounded-2xl bg-bg-surface border border-border-subtle">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="font-display text-2xl font-bold text-text-primary">{s.value}</div>
            <div className="text-sm text-text-muted mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Referral link */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-600/20 to-accent-600/10 border border-brand-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5 text-brand-400" />
          <h2 className="font-semibold text-text-primary">Your Referral Link</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 px-4 py-3 rounded-xl bg-bg-base border border-border-default text-text-primary text-sm font-mono truncate">
            {refLink}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-5 py-3 rounded-xl transition-colors whitespace-nowrap"
          >
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Link</>}
          </button>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
          <Share2 className="w-4 h-4" />
          Your referral code: <span className="font-mono font-semibold text-brand-400">{refCode}</span>
        </div>
      </div>

      {/* How it works */}
      <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle">
        <h2 className="font-semibold text-text-primary mb-4">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { num: '1', title: 'Share your link', desc: 'Send your unique referral link to friends, clients, or your audience.' },
            { num: '2', title: 'They sign up', desc: 'When someone creates an account using your link, they become your referral.' },
            { num: '3', title: 'You earn 10%', desc: 'Get 10% of every order your referrals place — automatically credited to your balance.' },
          ].map((s) => (
            <div key={s.num}>
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400 font-display font-bold mb-3">{s.num}</div>
              <h3 className="font-medium text-text-primary mb-1">{s.title}</h3>
              <p className="text-sm text-text-secondary">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
