import { useEffect, useState } from 'react';
import { LifeBuoy, Plus, MessageSquare, Send, Loader2 } from 'lucide-react';
import { supabase, type Ticket, type TicketReply } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const categories = ['General', 'Order Issue', 'Payment', 'Technical', 'Other'];

export default function Support() {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // new ticket form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [message, setMessage] = useState('');

  const fetchTickets = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', profile.user_id)
      .order('updated_at', { ascending: false });
    setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [profile]);

  const fetchReplies = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_replies')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setReplies((data as TicketReply[]) ?? []);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !subject || !message) return;
    setSubmitting(true);
    const { data: ticket } = await supabase
      .from('tickets')
      .insert({ user_id: profile.user_id, subject, category, status: 'Open' })
      .select()
      .single();
    if (ticket) {
      await supabase.from('ticket_replies').insert({
        ticket_id: ticket.id,
        user_id: profile.user_id,
        message,
        is_staff: false,
      });
      setShowNew(false);
      setSubject('');
      setCategory('General');
      setMessage('');
      fetchTickets();
      setSelected(ticket as Ticket);
      fetchReplies(ticket.id);
    }
    setSubmitting(false);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !profile || !replyText) return;
    setSubmitting(true);
    await supabase.from('ticket_replies').insert({
      ticket_id: selected.id,
      user_id: profile.user_id,
      message: replyText,
      is_staff: false,
    });
    await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', selected.id);
    setReplyText('');
    fetchReplies(selected.id);
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Support</h1>
          <p className="text-text-secondary text-sm mt-1">Get help with your orders and account</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowNew(false)}>
          <div className="w-full max-w-lg p-6 rounded-2xl bg-bg-surface border border-border-default" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold text-text-primary mb-4">New Support Ticket</h2>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  required
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 transition-colors resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 py-2.5 rounded-xl bg-bg-elevated border border-border-subtle text-text-secondary font-medium hover:text-text-primary transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold transition-colors">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Ticket list */}
        <div className="space-y-2">
          {loading ? (
            [...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-bg-surface animate-pulse" />)
          ) : tickets.length === 0 ? (
            <div className="text-center py-10 text-text-muted">
              <LifeBuoy className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tickets yet</p>
            </div>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelected(t); fetchReplies(t.id); }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selected?.id === t.id ? 'bg-brand-500/10 border-brand-500/40' : 'bg-bg-surface border-border-subtle hover:border-border-default'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-text-primary text-sm truncate">{t.subject}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    t.status === 'Open' ? 'bg-success-500/10 text-success-400' : 'bg-bg-hover text-text-muted'
                  }`}>{t.status}</span>
                </div>
                <div className="text-xs text-text-muted">{t.category} · {new Date(t.created_at).toLocaleDateString()}</div>
              </button>
            ))
          )}
        </div>

        {/* Conversation */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center py-20 text-text-muted">
              <MessageSquare className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">Select a ticket to view the conversation</p>
            </div>
          ) : (
            <div className="flex flex-col h-[600px] rounded-2xl bg-bg-surface border border-border-subtle">
              <div className="p-4 border-b border-border-subtle">
                <h2 className="font-semibold text-text-primary">{selected.subject}</h2>
                <div className="text-xs text-text-muted mt-0.5">{selected.category} · Opened {new Date(selected.created_at).toLocaleDateString()}</div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
                {replies.length === 0 ? (
                  <div className="text-center py-10 text-text-muted text-sm">No messages yet</div>
                ) : (
                  replies.map((r) => (
                    <div key={r.id} className={`flex ${r.is_staff ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] p-3 rounded-2xl ${
                        r.is_staff ? 'bg-bg-elevated text-text-primary' : 'bg-brand-600 text-white'
                      }`}>
                        <div className="text-xs opacity-70 mb-1">{r.is_staff ? 'Support Team' : 'You'}</div>
                        <div className="text-sm whitespace-pre-wrap">{r.message}</div>
                        <div className="text-xs opacity-50 mt-1">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleReply} className="p-4 border-t border-border-subtle flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1 px-3 py-2.5 rounded-xl bg-bg-elevated border border-border-default text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 transition-colors"
                />
                <button type="submit" disabled={submitting || !replyText} className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white transition-colors">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
