"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Shield, Zap, TrendingUp, TrendingDown, Upload, Bell,
  Target, RefreshCw, ChevronDown, ArrowRight, Check, X, Menu,
  Lock, FileText, Brain, DollarSign, PieChart, CreditCard,
  AlertTriangle, Sparkles, Activity, CalendarDays, Minus, Loader2,
} from "lucide-react";
import { authAPI } from "@/lib/api";

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function handleDemoLogin() {
    setDemoLoading(true);
    setDemoError(null);
    try {
      await authAPI.demoLogin();
      router.push("/dashboard");
    } catch (err: any) {
      setDemoError("Demo unavailable — try again in a moment.");
      setDemoLoading(false);
    }
  }

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  if (!mounted) return null;

  const faqs = [
    { q: "Is my financial data secure?", a: "All data is encrypted in transit with TLS and at rest. JWT tokens are HS256-signed, refresh tokens are SHA-256 hashed and single-use — replaying a stolen token immediately revokes all sessions. We never store bank credentials." },
    { q: "Which file formats do you support?", a: "CSV exports from any bank. As long as your export has Date, Amount, and Description columns, FinTrack can import it. Most banks (Chase, BofA, Wells Fargo, Citi, and 100+ others) support this." },
    { q: "Does the AI require an external API?", a: "No. All four AI models run entirely in the browser using your transaction data. There are no API calls to OpenAI or any third-party model — which means zero latency, zero cost, and your data never leaves your device." },
    { q: "Can I import historical transactions?", a: "Yes — import as many months of history as your bank provides. The AI models improve with more data: anomaly detection needs ≥3 transactions per category, and next-month prediction uses a 3-month rolling window." },
    { q: "Is there a mobile app?", a: "The web app is fully responsive and works great on mobile. The sidebar collapses to a drawer and all charts reflow for small screens." },
  ];

  const features = [
    { icon: BarChart3,  title: "Real-Time Dashboard",     desc: "Income, expenses, savings, and net worth — live charts that update the moment you add a transaction.",                                           color: "#6366f1" },
    { icon: Upload,     title: "Smart CSV Import",         desc: "Import transactions from any bank in seconds. ML auto-tagging categorises every row — no manual work needed.",                              color: "#10b981" },
    { icon: FileText,   title: "6-Tab Report Suite",       desc: "Spending trends, budget comparison, category breakdown, 6-month forecast, budget history, and custom date ranges.",                         color: "#f59e0b" },
    { icon: Shield,     title: "Bank-Level Security",      desc: "JWT HS256 + BCrypt + refresh token rotation with replay detection + IP rate limiting. No Redis required.",                                  color: "#3b82f6" },
    { icon: Bell,       title: "Smart Alerts",             desc: "8 rule types: large transactions, spending spikes, category concentration, budget thresholds, income tracking — each with severity badges.", color: "#ec4899" },
    { icon: Target,     title: "Budgets & Goals",          desc: "Monthly budgets auto-synced from transactions. Savings goals with visual progress. \"At risk\" warnings before you overspend.",            color: "#8b5cf6" },
    { icon: RefreshCw,  title: "Recurring Detection",      desc: "Levenshtein similarity matching identifies subscriptions and recurring payments. Flags forgotten charges automatically.",                    color: "#06b6d4" },
    { icon: CreditCard, title: "Receipt Scanner",          desc: "Camera or file upload → Tesseract.js OCR extracts merchant, amount, and date. No manual typing.",                                          color: "#f97316" },
  ];

  const aiModels = [
    {
      icon: AlertTriangle,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
      label: "Anomaly Detection",
      algo: "Mean + 2σ per category",
      example: `"Valentine Dinner ($120) is 261% above your $33 avg for Food & Dining. Consider meal prepping to reduce dining-out frequency."`,
      badge: "HIGH",
      badgeColor: "#ef4444",
    },
    {
      icon: Sparkles,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.1)",
      label: "Next-Month Prediction",
      algo: "3-month weighted rolling average (3-2-1 weights)",
      example: `Forecast for May 2026 — Income: $5,640 · Expenses: $2,317 · Savings: $3,323 (59% rate) — High confidence`,
      badge: "NEW",
      badgeColor: "#8b5cf6",
    },
    {
      icon: CalendarDays,
      color: "#06b6d4",
      bg: "rgba(6,182,212,0.1)",
      label: "Month-End Forecast",
      algo: "Daily burn rate × days remaining",
      example: `"Projected $3,855 vs $3,150 budget — $705 over. Housing (200%), Bills (197%) at risk. Spend ≤ $21/day to match last month."`,
      badge: "LIVE",
      badgeColor: "#10b981",
    },
    {
      icon: RefreshCw,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
      label: "Recurring Detection",
      algo: "Levenshtein similarity matching",
      example: `Detected: Netflix $15.99 · Spotify $9.99 · AWS $47.20 — Total recurring: $73.18/month. 1 forgotten charge flagged.`,
      badge: "AUTO",
      badgeColor: "#06b6d4",
    },
  ];

  const stats = [
    { value: "52",     label: "Backend tests, 0 failures" },
    { value: "4",      label: "Client-side AI models" },
    { value: "0",      label: "External AI API calls" },
    { value: "HS256",  label: "JWT + refresh rotation" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#0a0f1e", color: "#e2e8f0", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,300;0,700;0,900;1,300&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .hero-glow{background:radial-gradient(ellipse 80% 50% at 50% -20%,rgba(99,102,241,0.28) 0%,transparent 60%);}
        .grid-lines{background-image:linear-gradient(rgba(99,102,241,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.05) 1px,transparent 1px);background-size:60px 60px;}
        .card-hover{transition:transform 0.2s ease,box-shadow 0.2s ease;}
        .card-hover:hover{transform:translateY(-4px);box-shadow:0 20px 40px rgba(0,0,0,0.35);}
        .ai-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:24px;transition:transform 0.2s,border-color 0.2s,box-shadow 0.2s;}
        .ai-card:hover{transform:translateY(-3px);border-color:rgba(99,102,241,0.3);box-shadow:0 16px 40px rgba(0,0,0,0.3);}
        .btn-primary{background:linear-gradient(135deg,#6366f1,#4f46e5);color:white;border:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s ease;display:inline-flex;align-items:center;gap:8px;font-family:inherit;text-decoration:none;}
        .btn-primary:hover{background:linear-gradient(135deg,#818cf8,#6366f1);transform:translateY(-1px);box-shadow:0 8px 25px rgba(99,102,241,0.4);}
        .btn-primary:active{transform:scale(0.97);}
        .btn-ghost{background:transparent;color:#94a3b8;border:1px solid rgba(148,163,184,0.2);padding:13px 24px;border-radius:10px;font-size:15px;font-weight:500;cursor:pointer;transition:all 0.2s ease;font-family:inherit;}
        .btn-ghost:hover{color:#e2e8f0;border-color:rgba(148,163,184,0.4);background:rgba(255,255,255,0.05);}
        .btn-ghost:active{transform:scale(0.97);}
        .nav-link{color:#94a3b8;text-decoration:none;font-size:14px;font-weight:500;transition:color 0.15s;cursor:pointer;}
        .nav-link:hover{color:#e2e8f0;}
        .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;padding:5px 12px;border-radius:100px;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;}
        .stat-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:28px;}
        .feature-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:28px;}
        .pricing-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:36px;}
        .pricing-card.featured{background:rgba(99,102,241,0.08);border-color:rgba(99,102,241,0.3);}
        .step-number{width:40px;height:40px;border-radius:50%;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .faq-item{border-bottom:1px solid rgba(255,255,255,0.06);overflow:hidden;}
        .faq-btn{width:100%;background:none;border:none;color:#e2e8f0;font-size:16px;font-weight:500;padding:22px 0;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;font-family:inherit;}
        .faq-answer{color:#94a3b8;font-size:15px;line-height:1.7;padding-bottom:20px;max-width:680px;}
        .example-quote{background:rgba(255,255,255,0.04);border-left:3px solid;border-radius:0 8px 8px 0;padding:10px 14px;font-size:12.5px;color:#94a3b8;line-height:1.6;margin-top:12px;font-style:italic;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        .fade-up{animation:fadeUp 0.6s ease both;}
        @media(max-width:768px){
          .hero-title{font-size:40px!important;}
          .hide-mobile{display:none!important;}
          .grid-2{grid-template-columns:1fr!important;}
          .grid-3{grid-template-columns:1fr!important;}
          .grid-4{grid-template-columns:1fr 1fr!important;}
          .grid-ai{grid-template-columns:1fr!important;}
          .stats-grid{grid-template-columns:1fr 1fr!important;}
        }
        .mobile-menu-btn{display:none;}
        @media(max-width:768px){.mobile-menu-btn{display:flex;}}
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:100,
        background:scrolled?"rgba(10,15,30,0.92)":"transparent",
        backdropFilter:scrolled?"blur(12px)":"none",
        borderBottom:scrolled?"1px solid rgba(255,255,255,0.05)":"none",
        transition:"all 0.3s ease",padding:"0 24px",
      }}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,background:"linear-gradient(135deg,#6366f1,#4f46e5)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <DollarSign size={18} color="white" />
            </div>
            <span style={{fontFamily:"Fraunces,serif",fontSize:20,fontWeight:700,color:"#f1f5f9"}}>FinTrack</span>
          </div>

          <div className="hide-mobile" style={{display:"flex",alignItems:"center",gap:32}}>
            {[["#features","Features"],["#ai","AI Models"],["#how-it-works","How it works"],["#pricing","Pricing"]].map(([href,label])=>(
              <a key={href} className="nav-link" href={href}>{label}</a>
            ))}
          </div>

          <div className="hide-mobile" style={{display:"flex",alignItems:"center",gap:12}}>
            <button className="btn-ghost" style={{padding:"9px 18px",fontSize:14}} onClick={()=>router.push("/login?mode=signin")}>Log in</button>
            <button
              className="btn-ghost"
              style={{padding:"9px 18px",fontSize:14,display:"inline-flex",alignItems:"center",gap:6,
                      border:"1px solid rgba(139,92,246,0.4)",color:"#c4b5fd",background:"rgba(139,92,246,0.1)"}}
              onClick={handleDemoLogin}
              disabled={demoLoading}
            >
              {demoLoading ? <Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/> : <Sparkles size={13}/>}
              Try Demo
            </button>
            <button className="btn-primary" style={{padding:"9px 18px",fontSize:14}} onClick={()=>router.push("/login?mode=signup")}>Get started free</button>
          </div>

          <button className="mobile-menu-btn" style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer"}} onClick={()=>setMenuOpen(!menuOpen)}>
            <Menu size={24}/>
          </button>
        </div>

        {menuOpen&&(
          <div style={{background:"rgba(10,15,30,0.98)",borderTop:"1px solid rgba(255,255,255,0.06)",padding:"16px 24px 24px"}}>
            {[["#features","Features"],["#ai","AI Models"],["#how-it-works","How it works"],["#pricing","Pricing"]].map(([href,label])=>(
              <a key={href} href={href} className="nav-link" style={{display:"block",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",fontSize:16}} onClick={()=>setMenuOpen(false)}>{label}</a>
            ))}
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:16}}>
              <button className="btn-ghost" style={{width:"100%"}} onClick={()=>router.push("/login?mode=signin")}>Log in</button>
              <button
                className="btn-ghost"
                style={{width:"100%",justifyContent:"center",display:"flex",alignItems:"center",gap:8,
                        border:"1px solid rgba(139,92,246,0.4)",color:"#c4b5fd",background:"rgba(139,92,246,0.1)"}}
                onClick={handleDemoLogin}
                disabled={demoLoading}
              >
                {demoLoading ? <Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/> : <Sparkles size={14}/>}
                Try Demo — no signup
              </button>
              <button className="btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={()=>router.push("/login?mode=signup")}>Get started free</button>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="hero-glow grid-lines" style={{minHeight:"100vh",display:"flex",alignItems:"center",padding:"120px 24px 80px"}}>
        <div style={{maxWidth:1200,margin:"0 auto",width:"100%",textAlign:"center"}}>

          <div className="badge fade-up" style={{marginBottom:28,display:"inline-flex",animationDelay:"0s"}}>
            <Brain size={12}/>
            AI-Powered Finance · Production-Grade Stack
          </div>

          <h1 className="hero-title fade-up" style={{
            fontFamily:"Fraunces,serif",fontSize:72,fontWeight:900,
            lineHeight:1.05,letterSpacing:"-0.02em",color:"#f1f5f9",
            maxWidth:840,margin:"0 auto 24px",animationDelay:"0.1s",
          }}>
            Finally understand{" "}
            <em style={{color:"#818cf8",fontStyle:"italic"}}>where your money goes</em>
          </h1>

          <p className="fade-up" style={{fontSize:19,color:"#94a3b8",lineHeight:1.65,maxWidth:560,margin:"0 auto 12px",fontWeight:400,animationDelay:"0.2s"}}>
            Import bank transactions, track spending, set budgets — powered by <strong style={{color:"#c7d2fe"}}>4 client-side AI models</strong> that run with zero API cost and zero latency.
          </p>

          <p className="fade-up" style={{fontSize:14,color:"#64748b",marginBottom:36,animationDelay:"0.25s"}}>
            Spring Boot 3.2 · Next.js 14 · PostgreSQL · 52 tests · JWT + rate limiting
          </p>

          <div className="fade-up" style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:12,animationDelay:"0.3s"}}>
            <button className="btn-primary" style={{fontSize:16,padding:"15px 32px"}} onClick={()=>router.push("/login?mode=signup")}>
              Get started free <ArrowRight size={16}/>
            </button>
            {/* Demo CTA — instant access, no signup required */}
            <button
              className="btn-ghost"
              style={{fontSize:16,padding:"15px 32px",display:"inline-flex",alignItems:"center",gap:8,
                      border:"1px solid rgba(139,92,246,0.4)",color:"#c4b5fd",
                      background:"rgba(139,92,246,0.08)"}}
              onClick={handleDemoLogin}
              disabled={demoLoading}
            >
              {demoLoading
                ? <><Loader2 size={16} style={{animation:"spin 1s linear infinite"}}/> Loading demo…</>
                : <><Sparkles size={16}/> Try Demo — no signup</>}
            </button>
            <button className="btn-ghost" style={{fontSize:16,padding:"15px 32px"}} onClick={()=>router.push("/login?mode=signin")}>
              Sign in
            </button>
          </div>
          {demoError && (
            <p style={{fontSize:13,color:"#f87171",marginBottom:8,textAlign:"center"}}>{demoError}</p>
          )}
          <p className="fade-up" style={{fontSize:13,color:"#475569",marginBottom:40,animationDelay:"0.35s"}}>No credit card · Import from any bank · Free forever on basic plan</p>

          {/* ── Financial benefit ticker — what users actually discover ── */}
          <div className="fade-up" style={{maxWidth:760,margin:"0 auto 40px",display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center",animationDelay:"0.38s"}}>
            {[
              {emoji:"💰", text:"Identified $73/mo in forgotten subscriptions"},
              {emoji:"⚠️", text:"Dining spend 261% above normal — flagged instantly"},
              {emoji:"🔮", text:"Predicted May expenses at $2,317 — 3 weeks in advance"},
              {emoji:"📊", text:"Housing budget on track to exceed by $705 this month"},
            ].map((item,i)=>(
              <div key={i} style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:100,padding:"7px 14px",fontSize:13,color:"#94a3b8"}}>
                <span>{item.emoji}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          {/* ── Stats bar ── */}
          <div className="stats-grid fade-up" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,maxWidth:800,margin:"0 auto 64px",animationDelay:"0.4s"}}>
            {stats.map((s)=>(
              <div key={s.label} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:14,padding:"20px 12px",textAlign:"center"}}>
                <p style={{fontFamily:"Fraunces,serif",fontSize:30,fontWeight:900,color:"#818cf8",lineHeight:1}}>{s.value}</p>
                <p style={{fontSize:12,color:"#475569",marginTop:6,lineHeight:1.4}}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── Mock dashboard ── */}
          <div style={{
            background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
            borderRadius:20,padding:2,maxWidth:920,margin:"0 auto",
            boxShadow:"0 40px 100px rgba(0,0,0,0.5),0 0 0 1px rgba(99,102,241,0.1)",
          }}>
            <div style={{background:"rgba(15,23,42,0.9)",borderRadius:18,padding:"24px"}}>
              {/* Browser chrome dots */}
              <div style={{display:"flex",gap:6,marginBottom:20}}>
                {["#ef4444","#f59e0b","#10b981"].map(c=>(
                  <div key={c} style={{width:10,height:10,borderRadius:"50%",background:c}}/>
                ))}
                <div style={{flex:1,height:10,background:"rgba(255,255,255,0.04)",borderRadius:6,marginLeft:8,display:"flex",alignItems:"center",paddingLeft:10}}>
                  <span style={{fontSize:10,color:"#334155"}}>fintrack-liart.vercel.app/dashboard</span>
                </div>
              </div>
              {/* Stat cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
                {[
                  {label:"Total Income",  value:"$22,400", change:"+8.3%",  up:true},
                  {label:"Total Expenses",value:"$6,810",  change:"+12.1%", up:false},
                  {label:"Net Savings",   value:"$15,590", change:"+18%",   up:true},
                  {label:"Net Worth",     value:"$16,089", change:"on track",up:true},
                ].map((s,i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"14px 12px"}}>
                    <p style={{fontSize:10,color:"#64748b",marginBottom:5,fontWeight:500}}>{s.label}</p>
                    <p style={{fontSize:18,fontWeight:700,color:"#f1f5f9",fontFamily:"Fraunces,serif"}}>{s.value}</p>
                    <p style={{fontSize:10,color:s.up?"#10b981":"#f59e0b",marginTop:3,fontWeight:500}}>{s.change}</p>
                  </div>
                ))}
              </div>
              {/* AI banner in mock */}
              <div style={{background:"linear-gradient(135deg,#4f46e5,#9333ea)",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <Brain size={14} color="white"/>
                <span style={{fontSize:12,fontWeight:700,color:"white"}}>AI INSIGHTS</span>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>Real-time analysis of your spending patterns · 4 models active</span>
              </div>
              {/* AI cards preview */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
                <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:14}}>
                  <p style={{fontSize:10,color:"#f59e0b",fontWeight:700,marginBottom:4}}>⚡ SPENDING ANOMALY · HIGH</p>
                  <p style={{fontSize:12,color:"#e2e8f0",fontWeight:600}}>Valentine Dinner (120.00)</p>
                  <p style={{fontSize:11,color:"#64748b",marginTop:2}}>261% above your $33 avg for Food & Dining</p>
                </div>
                <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:14}}>
                  <p style={{fontSize:10,color:"#8b5cf6",fontWeight:700,marginBottom:4}}>✦ NEXT-MONTH PREDICTION</p>
                  <p style={{fontSize:12,color:"#e2e8f0",fontWeight:600}}>May 2026 Forecast</p>
                  <p style={{fontSize:11,color:"#64748b",marginTop:2}}>Income $5,640 · Expenses $2,317 · Savings 59%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI SHOWCASE ─────────────────────────────────────────────────── */}
      <section id="ai" style={{padding:"100px 24px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:56}}>
            <div className="badge" style={{marginBottom:16,display:"inline-flex"}}><Brain size={12}/> Core technology</div>
            <h2 style={{fontFamily:"Fraunces,serif",fontSize:48,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.02em",marginBottom:16}}>
              Four AI models,{" "}<em style={{color:"#818cf8",fontStyle:"italic"}}>zero API cost</em>
            </h2>
            <p style={{fontSize:17,color:"#64748b",maxWidth:560,margin:"0 auto"}}>
              Every insight runs entirely in the browser — no external model, no latency, no data leaving your device.
            </p>
          </div>

          <div className="grid-ai" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:20,marginBottom:32}}>
            {aiModels.map((m)=>(
              <div key={m.label} className="ai-card">
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:42,height:42,borderRadius:12,background:m.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <m.icon size={20} color={m.color}/>
                    </div>
                    <div>
                      <p style={{fontSize:16,fontWeight:700,color:"#f1f5f9"}}>{m.label}</p>
                      <p style={{fontSize:12,color:"#64748b",marginTop:2}}>{m.algo}</p>
                    </div>
                  </div>
                  <span style={{fontSize:10,fontWeight:800,color:"white",background:m.badgeColor,padding:"3px 8px",borderRadius:6,letterSpacing:"0.05em",flexShrink:0}}>{m.badge}</span>
                </div>
                <div className="example-quote" style={{borderLeftColor:m.color}}>
                  {m.example}
                </div>
              </div>
            ))}
          </div>

          {/* Technical callout */}
          <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:16,padding:"24px 32px",display:"flex",alignItems:"center",gap:32,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200}}>
              <p style={{fontSize:15,fontWeight:700,color:"#c7d2fe",marginBottom:6}}>How it works technically</p>
              <p style={{fontSize:14,color:"#64748b",lineHeight:1.65}}>
                Anomaly detection uses <code style={{color:"#a5b4fc",background:"rgba(165,180,252,0.1)",padding:"1px 5px",borderRadius:4}}>mean + 2σ</code> per spending category. Prediction uses a <code style={{color:"#a5b4fc",background:"rgba(165,180,252,0.1)",padding:"1px 5px",borderRadius:4}}>3-2-1 weighted average</code> across the last 3 months with trend momentum. All computed in <code style={{color:"#a5b4fc",background:"rgba(165,180,252,0.1)",padding:"1px 5px",borderRadius:4}}>aiInsights.ts</code> and <code style={{color:"#a5b4fc",background:"rgba(165,180,252,0.1)",padding:"1px 5px",borderRadius:4}}>budgetForecast.ts</code> — no backend round-trip.
              </p>
            </div>
            <a href="https://github.com/GanasalaChandana/fintrack" target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{whiteSpace:"nowrap",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:8}}>
              View source <ArrowRight size={14}/>
            </a>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{padding:"100px 24px",borderTop:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.01)"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:64}}>
            <div className="badge" style={{marginBottom:16,display:"inline-flex"}}>Get started in minutes</div>
            <h2 style={{fontFamily:"Fraunces,serif",fontSize:44,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.02em"}}>Up and running in 3 steps</h2>
          </div>
          <div className="grid-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:32}}>
            {[
              {n:"1",icon:Lock,   title:"Create your account",      desc:"Sign up in 30 seconds. Email + password. No credit card required.",                                                                      color:"#6366f1"},
              {n:"2",icon:Upload, title:"Import your transactions",  desc:"Export a CSV from your bank and upload it. ML auto-categorisation handles the rest — no manual tagging.",                               color:"#10b981"},
              {n:"3",icon:Brain,  title:"Let AI surface patterns",   desc:"View spending by category, get anomaly alerts, see month-end forecasts, and next-month predictions — all updating live.",               color:"#f59e0b"},
            ].map((step)=>(
              <div key={step.n} className="feature-card card-hover" style={{display:"flex",flexDirection:"column",gap:20}}>
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <div className="step-number">{step.n}</div>
                  <div style={{width:40,height:40,borderRadius:10,background:`${step.color}20`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <step.icon size={20} color={step.color}/>
                  </div>
                </div>
                <h3 style={{fontSize:19,fontWeight:600,color:"#f1f5f9"}}>{step.title}</h3>
                <p style={{fontSize:15,color:"#64748b",lineHeight:1.65}}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────── */}
      <section id="features" style={{padding:"100px 24px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:64}}>
            <div className="badge" style={{marginBottom:16,display:"inline-flex"}}>Everything you need</div>
            <h2 style={{fontFamily:"Fraunces,serif",fontSize:44,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.02em",marginBottom:16}}>
              Built for real financial clarity
            </h2>
            <p style={{fontSize:17,color:"#64748b",maxWidth:480,margin:"0 auto"}}>Every feature designed to save you time and help you make better money decisions.</p>
          </div>
          <div className="grid-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20}}>
            {features.map((f)=>(
              <div key={f.title} className="feature-card card-hover">
                <div style={{width:44,height:44,borderRadius:12,background:`${f.color}15`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
                  <f.icon size={22} color={f.color}/>
                </div>
                <h3 style={{fontSize:16,fontWeight:600,color:"#e2e8f0",marginBottom:8}}>{f.title}</h3>
                <p style={{fontSize:14,color:"#64748b",lineHeight:1.6}}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY ────────────────────────────────────────────────────── */}
      <section style={{padding:"100px 24px",background:"rgba(255,255,255,0.01)",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div className="grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"center"}}>
            <div>
              <div className="badge" style={{marginBottom:20,display:"inline-flex"}}><Shield size={12}/> Security first</div>
              <h2 style={{fontFamily:"Fraunces,serif",fontSize:42,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.02em",marginBottom:20,lineHeight:1.1}}>
                Your data stays <em style={{color:"#818cf8",fontStyle:"italic"}}>yours</em>
              </h2>
              <p style={{fontSize:16,color:"#64748b",lineHeight:1.7,marginBottom:32}}>
                JWT HS256 authentication, BCrypt password hashing, refresh token rotation with SHA-256 hashing and replay attack detection, and IP-based rate limiting — all without needing Redis.
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {[
                  "JWT HS256 + BCrypt password hashing",
                  "Refresh token rotation — replay detected → all sessions revoked",
                  "IP sliding window rate limiting (5 req/15 min, no Redis)",
                  "52 backend tests — 0 failures",
                ].map((item)=>(
                  <div key={item} style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <div style={{width:20,height:20,borderRadius:"50%",background:"rgba(16,185,129,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                      <Check size={12} color="#10b981"/>
                    </div>
                    <span style={{fontSize:15,color:"#94a3b8"}}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {[
                {icon:Shield,   label:"JWT + BCrypt",         sub:"HS256 signed, BCrypt hashed",      color:"#6366f1"},
                {icon:Lock,     label:"Token Rotation",        sub:"SHA-256 + replay detection",        color:"#10b981"},
                {icon:Activity, label:"Rate Limiting",         sub:"5 req/15 min · no Redis",           color:"#f59e0b"},
                {icon:FileText, label:"52 Tests",              sub:"JUnit 5 + Mockito + @WebMvcTest",   color:"#3b82f6"},
              ].map((s)=>(
                <div key={s.label} className="stat-card card-hover" style={{textAlign:"left"}}>
                  <div style={{width:40,height:40,borderRadius:10,background:`${s.color}15`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>
                    <s.icon size={20} color={s.color}/>
                  </div>
                  <p style={{fontSize:15,fontWeight:600,color:"#e2e8f0",marginBottom:4}}>{s.label}</p>
                  <p style={{fontSize:13,color:"#64748b"}}>{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARISON ──────────────────────────────────────────────────── */}
      <section style={{padding:"100px 24px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:800,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:48}}>
            <h2 style={{fontFamily:"Fraunces,serif",fontSize:44,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.02em",marginBottom:12}}>Better than a spreadsheet</h2>
            <p style={{color:"#64748b",fontSize:17}}>See what you get with FinTrack vs managing it manually</p>
          </div>
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",background:"rgba(255,255,255,0.04)",padding:"14px 24px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              <span style={{fontSize:13,color:"#64748b",fontWeight:600}}>FEATURE</span>
              <span style={{fontSize:13,color:"#64748b",fontWeight:600,textAlign:"center"}}>Spreadsheet</span>
              <span style={{fontSize:13,color:"#a5b4fc",fontWeight:600,textAlign:"center"}}>FinTrack</span>
            </div>
            {[
              ["Automatic categorisation", false, true],
              ["AI anomaly detection",     false, true],
              ["Next-month prediction",    false, true],
              ["Budget alerts",            false, true],
              ["Import from any bank CSV", false, true],
              ["Time to set up",          "Hours","2 mins"],
            ].map(([feature,sheet,ft],i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",padding:"16px 24px",borderBottom:i<5?"1px solid rgba(255,255,255,0.04)":"none",alignItems:"center"}}>
                <span style={{fontSize:15,color:"#94a3b8"}}>{feature}</span>
                <div style={{textAlign:"center"}}>
                  {typeof sheet==="boolean"
                    ?<X size={18} color="#475569" style={{margin:"0 auto"}}/>
                    :<span style={{fontSize:14,color:"#64748b"}}>{sheet as string}</span>}
                </div>
                <div style={{textAlign:"center"}}>
                  {typeof ft==="boolean"
                    ?<Check size={18} color="#10b981" style={{margin:"0 auto"}}/>
                    :<span style={{fontSize:14,color:"#a5b4fc",fontWeight:600}}>{ft as string}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────────────── */}
      <section id="pricing" style={{padding:"100px 24px",background:"rgba(255,255,255,0.01)",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div className="badge" style={{marginBottom:16,display:"inline-flex"}}>Simple pricing</div>
            <h2 style={{fontFamily:"Fraunces,serif",fontSize:44,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.02em",marginBottom:12}}>Start free, upgrade when ready</h2>
            <p style={{fontSize:17,color:"#64748b"}}>Pro and Business plans are <span style={{color:"#a5b4fc",fontWeight:600}}>coming soon</span>. Everything is free while we're in beta.</p>
          </div>

          <div className="grid-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:24,marginTop:48}}>
            <div className="pricing-card">
              <p style={{fontSize:13,color:"#64748b",fontWeight:600,marginBottom:8,letterSpacing:"0.05em"}}>FREE</p>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:8}}>
                <span style={{fontSize:48,fontWeight:800,color:"#f1f5f9",fontFamily:"Fraunces,serif"}}>$0</span>
                <span style={{color:"#64748b"}}>/month</span>
              </div>
              <p style={{fontSize:14,color:"#64748b",marginBottom:28,lineHeight:1.5}}>Everything you need to get started.</p>
              <button className="btn-primary" style={{width:"100%",justifyContent:"center",marginBottom:28}} onClick={()=>router.push("/login?mode=signup")}>Get started free</button>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {["Up to 500 transactions/month","Dashboard & all 4 AI models","CSV import from any bank","Budget tracking & alerts","Email support"].map(item=>(
                  <div key={item} style={{display:"flex",gap:10,alignItems:"center"}}><Check size={15} color="#10b981"/><span style={{fontSize:14,color:"#94a3b8"}}>{item}</span></div>
                ))}
              </div>
            </div>

            <div className="pricing-card featured" style={{position:"relative"}}>
              <div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#6366f1,#4f46e5)",color:"white",padding:"4px 16px",borderRadius:100,fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>Coming Soon</div>
              <p style={{fontSize:13,color:"#a5b4fc",fontWeight:600,marginBottom:8,letterSpacing:"0.05em"}}>PRO</p>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:8}}>
                <span style={{fontSize:48,fontWeight:800,color:"#f1f5f9",fontFamily:"Fraunces,serif"}}>$9</span>
                <span style={{color:"#64748b"}}>/month</span>
              </div>
              <p style={{fontSize:14,color:"#64748b",marginBottom:28,lineHeight:1.5}}>Advanced features for serious financial planning.</p>
              <button className="btn-ghost" style={{width:"100%",textAlign:"center",marginBottom:28,opacity:0.6,cursor:"not-allowed"}} disabled>Notify me when available</button>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {["Everything in Free","Unlimited transactions","Advanced reports & PDF export","Multiple accounts","Priority support"].map(item=>(
                  <div key={item} style={{display:"flex",gap:10,alignItems:"center"}}><Check size={15} color="#6366f1"/><span style={{fontSize:14,color:"#94a3b8"}}>{item}</span></div>
                ))}
              </div>
            </div>

            <div className="pricing-card">
              <div style={{display:"inline-block",background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.2)",color:"#a5b4fc",padding:"3px 10px",borderRadius:100,fontSize:11,fontWeight:700,marginBottom:8}}>Coming Soon</div>
              <p style={{fontSize:13,color:"#64748b",fontWeight:600,marginBottom:8,letterSpacing:"0.05em"}}>BUSINESS</p>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:8}}>
                <span style={{fontSize:48,fontWeight:800,color:"#f1f5f9",fontFamily:"Fraunces,serif"}}>$29</span>
                <span style={{color:"#64748b"}}>/month</span>
              </div>
              <p style={{fontSize:14,color:"#64748b",marginBottom:28,lineHeight:1.5}}>Team features for small businesses and advisors.</p>
              <button className="btn-ghost" style={{width:"100%",textAlign:"center",marginBottom:28,opacity:0.6,cursor:"not-allowed"}} disabled>Contact us</button>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {["Everything in Pro","Up to 5 team members","API access","Custom integrations","Dedicated support"].map(item=>(
                  <div key={item} style={{display:"flex",gap:10,alignItems:"center"}}><Check size={15} color="#10b981"/><span style={{fontSize:14,color:"#94a3b8"}}>{item}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" style={{padding:"100px 24px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:760,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:56}}>
            <h2 style={{fontFamily:"Fraunces,serif",fontSize:44,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.02em"}}>Common questions</h2>
          </div>
          {faqs.map((faq,i)=>(
            <div key={i} className="faq-item">
              <button className="faq-btn" onClick={()=>setOpenFaq(openFaq===i?null:i)}>
                <span>{faq.q}</span>
                <ChevronDown size={18} color="#64748b" style={{transform:openFaq===i?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0}}/>
              </button>
              {openFaq===i&&<div className="faq-answer">{faq.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section style={{padding:"100px 24px",background:"rgba(255,255,255,0.01)",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:700,margin:"0 auto",textAlign:"center"}}>
          <h2 style={{fontFamily:"Fraunces,serif",fontSize:52,fontWeight:900,color:"#f1f5f9",letterSpacing:"-0.02em",marginBottom:20,lineHeight:1.05}}>
            Ready to take control of your{" "}<em style={{color:"#818cf8",fontStyle:"italic"}}>finances?</em>
          </h2>
          <p style={{fontSize:18,color:"#64748b",marginBottom:40}}>Import your first transactions in under 2 minutes. AI insights activate immediately.</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn-primary" style={{fontSize:17,padding:"16px 36px"}} onClick={()=>router.push("/login?mode=signup")}>
              Get started for free <ArrowRight size={18}/>
            </button>
            <button
              className="btn-ghost"
              style={{fontSize:17,padding:"16px 36px",display:"inline-flex",alignItems:"center",gap:8,
                      border:"1px solid rgba(139,92,246,0.4)",color:"#c4b5fd",background:"rgba(139,92,246,0.08)"}}
              onClick={handleDemoLogin}
              disabled={demoLoading}
            >
              {demoLoading ? <Loader2 size={16} style={{animation:"spin 1s linear infinite"}}/> : <Sparkles size={16}/>}
              Try Demo instead
            </button>
          </div>
          <p style={{marginTop:16,fontSize:13,color:"#475569"}}>No credit card · Free forever on the basic plan</p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{padding:"48px 24px",borderTop:"1px solid rgba(255,255,255,0.05)",background:"rgba(0,0,0,0.2)"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div className="grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:40,alignItems:"start",marginBottom:40}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <div style={{width:28,height:28,background:"linear-gradient(135deg,#6366f1,#4f46e5)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <DollarSign size={16} color="white"/>
                </div>
                <span style={{fontFamily:"Fraunces,serif",fontSize:18,fontWeight:700,color:"#f1f5f9"}}>FinTrack</span>
              </div>
              <p style={{fontSize:14,color:"#475569",lineHeight:1.6,maxWidth:300}}>AI-powered personal finance. Track spending, set budgets, and understand your money — built to production standards.</p>
              <a href="https://github.com/GanasalaChandana/fintrack" target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:16,fontSize:13,color:"#6366f1",textDecoration:"none"}}>
                View on GitHub <ArrowRight size={12}/>
              </a>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:32}}>
              <div>
                <p style={{fontSize:12,fontWeight:700,color:"#64748b",letterSpacing:"0.08em",marginBottom:14,textTransform:"uppercase"}}>Product</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[["#features","Features"],["#ai","AI Models"],["#how-it-works","How it works"],["#pricing","Pricing"]].map(([href,label])=>(
                    <a key={label} href={href} style={{fontSize:14,color:"#475569",textDecoration:"none"}}>{label}</a>
                  ))}
                </div>
              </div>
              <div>
                <p style={{fontSize:12,fontWeight:700,color:"#64748b",letterSpacing:"0.08em",marginBottom:14,textTransform:"uppercase"}}>Links</p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    {label:"Live Demo",href:"https://fintrack-liart.vercel.app/login"},
                    {label:"GitHub",href:"https://github.com/GanasalaChandana/fintrack"},
                    {label:"v1.0.0 Release",href:"https://github.com/GanasalaChandana/fintrack/releases/tag/v1.0.0"},
                  ].map(l=>(
                    <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{fontSize:14,color:"#475569",textDecoration:"none"}}>{l.label}</a>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:24,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <p style={{fontSize:13,color:"#334155"}}>© 2026 FinTrack. All rights reserved.</p>
            <p style={{fontSize:13,color:"#334155"}}>Spring Boot 3.2 · Next.js 14 · PostgreSQL · 52 tests</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
