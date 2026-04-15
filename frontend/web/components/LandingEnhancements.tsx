import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, TrendingUp, TrendingDown, PieChart, Download, Calendar, Bell, X, Check, ArrowRight, Play, MessageCircle, Star, Shield, Zap, Users } from 'lucide-react';

// 1. ANIMATED STATS COUNTER
interface AnimatedCounterProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ end, duration = 2000, prefix = '', suffix = '' }) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      setCount(Math.floor(progress * end));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
};

// 2. INTERACTIVE DASHBOARD PREVIEW
const InteractiveDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [hoverCard, setHoverCard] = useState<number | null>(null);

  const transactions = [
    { id: 1, name: 'Grocery Store', amount: -85.50, category: 'Food', date: '2024-12-15' },
    { id: 2, name: 'Salary Deposit', amount: 4500, category: 'Income', date: '2024-12-14' },
    { id: 3, name: 'Electric Bill', amount: -120, category: 'Utilities', date: '2024-12-13' },
    { id: 4, name: 'Restaurant', amount: -65, category: 'Food', date: '2024-12-12' },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-700">
      <div className="flex gap-4 mb-6">
        {['overview', 'transactions', 'analytics'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Balance', value: '$12,450', change: '+12.5%', icon: DollarSign, iconCls: 'text-emerald-400', changeCls: 'text-emerald-400' },
              { label: 'Income',  value: '$4,500',  change: '+8.3%',  icon: TrendingUp,  iconCls: 'text-blue-400',   changeCls: 'text-blue-400' },
              { label: 'Expenses',value: '$2,390',  change: '-3.2%',  icon: TrendingDown,iconCls: 'text-red-400',    changeCls: 'text-red-400' },
            ].map((item, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setHoverCard(idx)}
                onMouseLeave={() => setHoverCard(null)}
                className={`bg-slate-800 rounded-xl p-4 transition-all duration-300 cursor-pointer ${
                  hoverCard === idx ? 'transform scale-105 shadow-lg' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-sm">{item.label}</span>
                  <item.icon className={`w-5 h-5 ${item.iconCls}`} />
                </div>
                <div className="text-2xl font-bold text-white">{item.value}</div>
                <div className={`text-sm mt-1 ${item.changeCls}`}>{item.change}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Spending by Category</h3>
            <div className="space-y-3">
              {[
                { name: 'Food & Dining', amount: 680, percent: 35, color: 'bg-emerald-500' },
                { name: 'Transportation', amount: 420, percent: 22, color: 'bg-blue-500' },
                { name: 'Entertainment', amount: 280, percent: 14, color: 'bg-purple-500' },
                { name: 'Utilities', amount: 560, percent: 29, color: 'bg-orange-500' },
              ].map((cat, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{cat.name}</span>
                    <span className="text-white font-medium">${cat.amount}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`${cat.color} h-full rounded-full transition-all duration-1000`}
                      style={{ width: hoverCard !== null ? `${cat.percent}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-slate-800 rounded-lg p-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  tx.amount > 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'
                }`}>
                  {tx.amount > 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div>
                  <div className="text-white font-medium">{tx.name}</div>
                  <div className="text-slate-400 text-sm">{tx.category}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                </div>
                <div className="text-slate-500 text-xs">{tx.date}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="text-center py-12">
          <PieChart className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h3 className="text-white text-xl font-semibold mb-2">Advanced Analytics</h3>
          <p className="text-slate-400">Unlock detailed insights with Pro plan</p>
          <button className="mt-4 bg-emerald-500 text-white px-6 py-2 rounded-lg hover:bg-emerald-600 transition-colors">
            Upgrade Now
          </button>
        </div>
      )}
    </div>
  );
};

// 3. SAVINGS CALCULATOR
const SavingsCalculator: React.FC = () => {
  const [monthly, setMonthly] = useState(200);
  const [months, setMonths] = useState(12);

  const saved = monthly * months;
  const withInterest = saved * 1.05;

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-8">
      <h3 className="text-2xl font-bold text-slate-900 mb-6">Calculate Your Savings</h3>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Monthly Savings: ${monthly}
          </label>
          <input
            type="range"
            min="50"
            max="1000"
            step="50"
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))}
            className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Time Period: {months} months
          </label>
          <input
            type="range"
            min="3"
            max="36"
            step="3"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-slate-600 text-sm">Total Saved</div>
              <div className="text-3xl font-bold text-emerald-600">${saved.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-slate-600 text-sm">With 5% Interest</div>
              <div className="text-3xl font-bold text-blue-600">${withInterest.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 4. EXIT INTENT POPUP
const ExitIntentPopup: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !show) {
        setShow(true);
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-scale-in">
        <button
          onClick={() => setShow(false)}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Wait! Don't Leave Yet</h3>
          <p className="text-slate-600 mb-6">
            Get 20% off your first month with code <span className="font-bold text-emerald-600">SAVE20</span>
          </p>

          <div className="space-y-3 mb-6">
            {['Unlimited transactions', 'Advanced analytics', '14-day free trial'].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-left">
                <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span className="text-slate-700">{item}</span>
              </div>
            ))}
          </div>

          <button className="w-full bg-emerald-500 text-white py-3 rounded-lg font-semibold hover:bg-emerald-600 transition-colors">
            Claim My Discount
          </button>
          <button
            onClick={() => setShow(false)}
            className="w-full text-slate-500 text-sm mt-3 hover:text-slate-700"
          >
            No thanks, I'll pay full price
          </button>
        </div>
      </div>
    </div>
  );
};

// 5. TRUST BADGES
const TrustBadges: React.FC = () => {
  const badges = [
    { icon: Shield, label: 'SSL Secured', color: 'emerald' },
    { icon: Star,  label: '4.9/5 Rating', cls: 'text-yellow-500' },
    { icon: Users, label: '2,500+ Users', cls: 'text-blue-500' },
    { icon: Zap,   label: 'Fast Setup',   cls: 'text-purple-500' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {badges.map((badge, idx) => (
        <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center hover:shadow-md transition-shadow">
          <badge.icon className={`w-8 h-8 mx-auto mb-2 ${badge.cls}`} />
          <div className="text-sm font-medium text-slate-700">{badge.label}</div>
        </div>
      ))}
    </div>
  );
};

// 6. VIDEO DEMO SECTION
const VideoDemoSection: React.FC = () => {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl group cursor-pointer">
      <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        {!playing ? (
          <>
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
            <button
              onClick={() => setPlaying(true)}
              className="relative z-10 w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center hover:bg-emerald-600 transition-all transform group-hover:scale-110"
            >
              <Play className="w-8 h-8 text-white ml-1" />
            </button>
            <div className="absolute bottom-6 left-6 text-white">
              <div className="text-2xl font-bold mb-1">See FinTrack in Action</div>
              <div className="text-slate-300">2 minutes overview</div>
            </div>
          </>
        ) : (
          <div className="text-white text-center">
            <div className="text-xl mb-2">Demo Video</div>
            <div className="text-sm text-slate-400">Video would play here</div>
          </div>
        )}
      </div>
    </div>
  );
};

// 7. LIVE CHAT WIDGET
interface Message {
  type: 'bot' | 'user';
  text: string;
}

const LiveChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { type: 'bot', text: 'Hi! How can I help you today?' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages([...messages, 
      { type: 'user', text: input },
      { type: 'bot', text: 'Thanks for your message! Our team will respond shortly.' }
    ]);
    setInput('');
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 rounded-full shadow-lg flex items-center justify-center hover:bg-emerald-600 transition-all hover:scale-110 z-40"
      >
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 w-80 bg-white rounded-2xl shadow-2xl z-40 overflow-hidden">
          <div className="bg-emerald-500 p-4 text-white">
            <div className="font-semibold">FinTrack Support</div>
            <div className="text-sm text-emerald-100">We reply in minutes</div>
          </div>

          <div className="h-64 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] p-3 rounded-lg ${
                  msg.type === 'user' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-100 text-slate-800'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-slate-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleSend}
                className="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// MAIN DEMO COMPONENT
export default function FinTrackEnhancements() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 space-y-12">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">FinTrack Enhancements</h1>
        <p className="text-slate-600 mb-12">Copy these components into your landing page</p>

        {/* Animated Stats */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Animated Counter Stats</h2>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 text-center shadow-sm">
              <div className="text-4xl font-bold text-emerald-600">
                <AnimatedCounter end={2500} suffix="+" />
              </div>
              <div className="text-slate-600 mt-2">Active Users</div>
            </div>
            <div className="bg-white rounded-xl p-6 text-center shadow-sm">
              <div className="text-4xl font-bold text-blue-600">
                <AnimatedCounter end={450} prefix="$" suffix="K+" />
              </div>
              <div className="text-slate-600 mt-2">Money Saved</div>
            </div>
            <div className="bg-white rounded-xl p-6 text-center shadow-sm">
              <div className="text-4xl font-bold text-purple-600">
                <AnimatedCounter end={49} suffix="/5 ⭐" />
              </div>
              <div className="text-slate-600 mt-2">User Rating</div>
            </div>
          </div>
        </section>

        {/* Interactive Dashboard */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Interactive Dashboard Preview</h2>
          <InteractiveDashboard />
        </section>

        {/* Savings Calculator */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Savings Calculator</h2>
          <SavingsCalculator />
        </section>

        {/* Trust Badges */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Trust Badges</h2>
          <TrustBadges />
        </section>

        {/* Video Demo */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Video Demo Section</h2>
          <VideoDemoSection />
        </section>

        {/* Exit Intent & Live Chat are floating */}
        <ExitIntentPopup />
        <LiveChatWidget />
      </div>
    </div>
  );
}