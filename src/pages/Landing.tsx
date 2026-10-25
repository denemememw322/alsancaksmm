import { Link } from 'react-router-dom';
import {
  Rocket, ShieldCheck, Headphones, Zap, TrendingUp, Users, Star, ArrowRight,
  Camera, Video, ThumbsUp, MessageCircle, Music2, Send, BarChart3, CheckCircle2,
} from 'lucide-react';

const platforms = [
  { icon: Camera, name: 'Instagram', color: 'text-pink-400' },
  { icon: Video, name: 'YouTube', color: 'text-red-400' },
  { icon: ThumbsUp, name: 'Facebook', color: 'text-blue-400' },
  { icon: MessageCircle, name: 'Twitter/X', color: 'text-sky-400' },
  { icon: Music2, name: 'TikTok', color: 'text-teal-400' },
  { icon: Send, name: 'Telegram', color: 'text-cyan-400' },
];

const features = [
  { icon: Rocket, title: 'Premium Quality', desc: 'High quality services for all your social media accounts at the cheapest prices on the market.' },
  { icon: ShieldCheck, title: '100% Safe & Guaranteed', desc: 'Refunds available, guaranteed satisfaction or your money back. Real results, secure future.' },
  { icon: Headphones, title: '24/7 Support', desc: 'Robust support system available via email, WhatsApp, and tickets for every customer.' },
  { icon: Zap, title: 'Fast Delivery', desc: 'Every order completed quickly, ensuring a seamless, worry-free experience every time.' },
];

const steps = [
  { num: '1', title: 'Sign Up / Log In', desc: 'Create your account and log in to get started in seconds.' },
  { num: '2', title: 'Deposit Funds', desc: 'Add funds using your preferred payment method securely.' },
  { num: '3', title: 'Place an Order', desc: 'Select the service you need and enter your link.' },
  { num: '4', title: 'Enjoy Results', desc: 'Watch your social media grow with excellent results.' },
];

const testimonials = [
  { name: 'Nicole Withers', text: "I've been using this service for a while now. Never had a problem. Great variety of services for different platforms, always great options to choose from." },
  { name: 'Giuly Kim', text: "So happy I discovered this! It was a struggle to help my business get noticed online. With SMM services I don't have to worry about that anymore, it's amazing!" },
  { name: 'Sophia Harris', text: "If you're wondering how to get more attention fast, this is it! No need to wait long because services are delivered super quickly. So cheap too." },
  { name: 'Luca Puri', text: 'Good quality services! Great to be able to earn with the affiliate system. I have saved a lot of money. Excellent panel.' },
  { name: 'Benjamin Koc', text: "I help businesses get more exposure by managing their social media. These SMM services help me save so much extra money. Couldn't recommend more." },
  { name: 'Aisha Patel', text: 'The dashboard is so easy to use and orders start almost instantly. Customer support actually responds. Best panel I have used.' },
];

const stats = [
  { icon: BarChart3, label: 'Active Services', value: '2,500+' },
  { icon: CheckCircle2, label: 'Orders Completed', value: '8.4M+' },
  { icon: Users, label: 'Happy Customers', value: '120K+' },
  { icon: Star, label: 'Avg. Rating', value: '4.9/5' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg-base overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold text-text-primary">ALSANCAK SMM</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-text-secondary">
            <a href="#services" className="hover:text-text-primary transition-colors">Services</a>
            <a href="#how" className="hover:text-text-primary transition-colors">How it works</a>
            <a href="#reviews" className="hover:text-text-primary transition-colors">Reviews</a>
            <a href="#faq" className="hover:text-text-primary transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/signin" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-2">
              Sign in
            </Link>
            <Link
              to="/signup"
              className="text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 bg-grid">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-base/80 to-bg-base pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/20 rounded-full blur-[120px] animate-pulse-glow pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm font-medium mb-6 animate-slide-up">
            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
            Trusted direct provider since 2015
          </div>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight animate-slide-up" style={{ animationDelay: '0.05s' }}>
            The world's #1 <span className="text-gradient">SMM Panel</span><br />
            for next-level growth
          </h1>
          <p className="mt-6 text-lg text-text-secondary max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Boost your engagement with followers, likes, comments, and views across every major platform.
            High-quality services, instant delivery, and the cheapest prices on the market.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-6 py-3.5 rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-600/30"
            >
              Start growing now
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#services"
              className="inline-flex items-center gap-2 bg-bg-elevated hover:bg-bg-hover text-text-primary font-semibold px-6 py-3.5 rounded-xl border border-border-default transition-colors"
            >
              Browse services
            </a>
          </div>

          {/* Platform pills */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            {platforms.map((p) => (
              <div
                key={p.name}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-bg-elevated border border-border-subtle"
              >
                <p.icon className={`w-4 h-4 ${p.color}`} />
                <span className="text-sm font-medium text-text-secondary">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative py-12 border-y border-border-subtle bg-bg-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <s.icon className="w-6 h-6 text-brand-400 mx-auto mb-2" />
              <div className="font-display text-3xl font-bold text-text-primary">{s.value}</div>
              <div className="text-sm text-text-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold">The only growth services you'll need</h2>
            <p className="mt-3 text-text-secondary max-w-2xl mx-auto">
              Buy Instagram followers, TikTok likes, YouTube views, Facebook followers, X engagement,
              Threads, Telegram, Spotify, and more — all in one place.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group p-6 rounded-2xl bg-bg-surface border border-border-subtle hover:border-brand-500/40 transition-all hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center mb-4 group-hover:bg-brand-500/20 transition-colors">
                  <f.icon className="w-6 h-6 text-brand-400" />
                </div>
                <h3 className="font-semibold text-lg text-text-primary mb-2">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 bg-bg-surface/50 border-y border-border-subtle">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold">How to use our panel</h2>
            <p className="mt-3 text-text-secondary">Get started in four simple steps</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.num} className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-accent-600 flex items-center justify-center text-white font-display text-xl font-bold mb-4">
                  {s.num}
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-7 left-[60%] w-full h-px bg-gradient-to-r from-border-default to-transparent" />
                )}
                <h3 className="font-semibold text-text-primary mb-1">{s.title}</h3>
                <p className="text-sm text-text-secondary">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services preview */}
      <section id="services" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold">All our services</h2>
            <p className="mt-3 text-text-secondary">A wide range of high-quality services for every platform</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { name: 'Instagram Followers', price: '$1.20', unit: 'per 1000', icon: Camera, color: 'from-pink-500 to-rose-500' },
              { name: 'TikTok Views', price: '$0.05', unit: 'per 1000', icon: Music2, color: 'from-teal-500 to-cyan-500' },
              { name: 'YouTube Views', price: '$0.80', unit: 'per 1000', icon: Video, color: 'from-red-500 to-orange-500' },
              { name: 'Facebook Page Likes', price: '$1.10', unit: 'per 1000', icon: ThumbsUp, color: 'from-blue-500 to-indigo-500' },
              { name: 'Twitter/X Followers', price: '$1.40', unit: 'per 1000', icon: MessageCircle, color: 'from-sky-500 to-blue-500' },
              { name: 'Telegram Members', price: '$0.85', unit: 'per 1000', icon: Send, color: 'from-cyan-500 to-sky-500' },
            ].map((s) => (
              <div key={s.name} className="group p-5 rounded-2xl bg-bg-surface border border-border-subtle hover:border-brand-500/40 transition-all">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-4`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-text-primary">{s.name}</h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold text-brand-400">{s.price}</span>
                  <span className="text-sm text-text-muted">{s.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              View all services
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="reviews" className="py-20 bg-bg-surface/50 border-y border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="font-display text-3xl sm:text-4xl font-bold">Satisfied customers</h2>
            <div className="mt-3 flex items-center justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-warning-400 text-warning-400" />
              ))}
              <span className="ml-2 text-text-secondary">4.9 out of 5</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="p-6 rounded-2xl bg-bg-elevated border border-border-subtle">
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-warning-400 text-warning-400" />
                  ))}
                </div>
                <p className="text-sm text-text-secondary leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-semibold text-sm">
                    {t.name.charAt(0)}
                  </div>
                  <div className="font-medium text-text-primary">{t.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-4">
            {[
              { q: 'What is an SMM panel?', a: 'An SMM panel is a platform where you can buy social media engagement services like followers, likes, views, and comments for various platforms at wholesale prices.' },
              { q: 'How fast are orders delivered?', a: 'Most orders start within minutes. Delivery time depends on the service — some are instant, others may take a few hours. Each service lists its average delivery time.' },
              { q: 'Is it safe to use?', a: 'Yes. We use secure payment methods and never ask for your social media passwords. You only provide the public link to your profile or post.' },
              { q: 'What payment methods are available?', a: 'We support multiple payment methods including cards, PayPal, and cryptocurrencies. Add funds instantly from your dashboard.' },
              { q: 'Do you offer refunds?', a: 'Yes, we offer refunds for orders that are not delivered or fail to meet the stated quality. Your satisfaction is guaranteed.' },
            ].map((item) => (
              <details key={item.q} className="group p-5 rounded-2xl bg-bg-surface border border-border-subtle">
                <summary className="flex items-center justify-between cursor-pointer list-none font-semibold text-text-primary">
                  {item.q}
                  <span className="text-brand-400 group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <p className="mt-3 text-sm text-text-secondary leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-accent-700 p-10 sm:p-16 text-center">
            <div className="absolute inset-0 bg-grid opacity-20" />
            <div className="relative">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">Ready to grow your social media?</h2>
              <p className="mt-3 text-white/80 max-w-xl mx-auto">Join over 120,000 customers boosting their online presence with the fastest, cheapest SMM panel.</p>
              <Link
                to="/signup"
                className="mt-8 inline-flex items-center gap-2 bg-white text-brand-700 font-semibold px-6 py-3.5 rounded-xl hover:bg-brand-50 transition-colors"
              >
                Create free account
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-text-primary">ALSANCAK SMM Panel</span>
            </div>
            <p className="text-sm text-text-muted">© 2026 ALSANCAK SMM Panel. All rights reserved. Trusted direct provider since 2015.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
