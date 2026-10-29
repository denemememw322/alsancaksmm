import { useState } from 'react';
import { Webhook, Copy, Check, Eye, EyeOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function Api() {
  const { profile, refreshProfile } = useAuth();
  const [copied, setCopied] = useState<'key' | 'url' | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const apiUrl = `${window.location.origin}/api/v2`;
  const apiKey = profile?.api_key ?? '';

  const copy = (text: string, which: 'key' | 'url') => {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRegenerate = async () => {
    if (!confirmRegen) {
      setConfirmRegen(true);
      return;
    }
    setRegenerating(true);
    const { error } = await supabase.rpc('regenerate_api_key');
    if (!error) await refreshProfile();
    setRegenerating(false);
    setConfirmRegen(false);
  };

  const maskedKey = apiKey ? apiKey.slice(0, 6) + '•'.repeat(Math.max(apiKey.length - 6, 0)) : '';

  const examples = [
    {
      title: 'Service List',
      body: { key: 'your-api-key', action: 'services' },
    },
    {
      title: 'Create Order',
      body: { key: 'your-api-key', action: 'add', service: 1, link: 'https://...', quantity: 100 },
    },
    {
      title: 'Order Status',
      body: { key: 'your-api-key', action: 'status', order: 1 },
    },
    {
      title: 'Check Balance',
      body: { key: 'your-api-key', action: 'balance' },
    },
    {
      title: 'Custom Comments Order',
      body: { key: 'your-api-key', action: 'add', service: 1, link: 'https://...', comments: 'comment 1\\ncomment 2' },
    },
    {
      title: 'Multiple Order Status',
      body: { key: 'your-api-key', action: 'status', orders: '1,2,3' },
    },
    {
      title: 'Cancel Orders',
      body: { key: 'your-api-key', action: 'cancel', orders: '1,2,3' },
    },
    {
      title: 'Create Refill',
      body: { key: 'your-api-key', action: 'refill', order: 1 },
    },
    {
      title: 'Refill Status',
      body: { key: 'your-api-key', action: 'refill_status', refill: 1 },
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary">API</h1>
        <p className="text-text-secondary text-sm mt-1">
          Integrate your own tools or resell our services using your personal API key
        </p>
      </div>

      {/* API URL */}
      <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle">
        <div className="flex items-center gap-2 mb-3">
          <Webhook className="w-5 h-5 text-brand-400" />
          <h2 className="font-semibold text-text-primary">API URL</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 px-4 py-3 rounded-xl bg-bg-base border border-border-default text-text-primary text-sm font-mono truncate">
            {apiUrl}
          </div>
          <button
            onClick={() => copy(apiUrl, 'url')}
            className="flex items-center justify-center gap-2 bg-bg-elevated hover:bg-bg-base border border-border-default text-text-primary font-medium px-5 py-3 rounded-xl transition-colors whitespace-nowrap"
          >
            {copied === 'url' ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
        </div>
      </div>

      {/* API Key */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-brand-600/20 to-accent-600/10 border border-brand-500/20">
        <h2 className="font-semibold text-text-primary mb-3">API Key</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 px-4 py-3 rounded-xl bg-bg-base border border-border-default text-text-primary text-sm font-mono truncate">
            {revealed ? apiKey : maskedKey}
          </div>
          <button
            onClick={() => setRevealed(!revealed)}
            className="flex items-center justify-center gap-2 bg-bg-elevated hover:bg-bg-base border border-border-default text-text-primary font-medium px-4 py-3 rounded-xl transition-colors"
          >
            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => copy(apiKey, 'key')}
            className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-5 py-3 rounded-xl transition-colors whitespace-nowrap"
          >
            {copied === 'key' ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
              confirmRegen ? 'bg-error-500/10 text-error-400 border border-error-500/30' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
            {confirmRegen ? 'Click again to confirm' : 'Regenerate key'}
          </button>
          {confirmRegen && (
            <span className="flex items-center gap-1.5 text-xs text-warning-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              Old key stops working immediately
            </span>
          )}
        </div>
      </div>

      {/* Docs */}
      <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle">
        <h2 className="font-semibold text-text-primary mb-1">API Documentation</h2>
        <p className="text-sm text-text-secondary mb-4">
          All requests must be made via <span className="font-mono text-text-primary">POST</span> using{' '}
          <span className="font-mono text-text-primary">application/json</span> format.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {examples.map((ex) => (
            <div key={ex.title}>
              <div className="text-sm font-medium text-text-primary mb-1.5">{ex.title}</div>
              <pre className="text-xs font-mono text-text-secondary bg-bg-base border border-border-subtle rounded-lg p-3 overflow-x-auto">
{JSON.stringify(ex.body, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
