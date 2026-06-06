'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

type Mode = 'login'|'signup';

export default function LoginPage() {
  const router   = useRouter();
  const supabase = createClient();
  const [mode,     setMode]     = useState<Mode>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/dashboard` } });
      if (error) setError(error.message);
      else { setSuccess('Account created! Log in below.'); setMode('login'); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else { router.push('/dashboard'); router.refresh(); }
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ position:'fixed', top:18, right:18, zIndex:10 }}><ThemeToggle /></div>

      <div style={{ width:'100%', maxWidth:390 }} className="page-enter">
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:34 }}>
          <div className="pop" style={{ width:78, height:78, borderRadius:26, background:'var(--accent-grad)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:38, margin:'0 auto 18px', boxShadow:'0 14px 40px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.4)' }}>📒</div>
          <h1 style={{ fontSize:30, fontWeight:800, letterSpacing:-.8, color:'var(--text)' }}>Dukan Khata</h1>
          <p style={{ fontSize:13.5, color:'var(--text-dim)', marginTop:7, fontWeight:600 }}>Smart Ledger · Glassy &amp; Alive</p>
        </div>

        <div className="glass-strong glass-pad rise" style={{ padding:24 }}>
          {/* Mode toggle */}
          <div className="segmented" style={{ marginBottom:24 }}>
            {(['login','signup'] as Mode[]).map(m => (
              <button key={m} className={mode===m?'active':''} onClick={()=>{setMode(m);setError('');setSuccess('');}}>
                {m==='login' ? '🔑 Log In' : '✨ Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <label className="field-label">Email Address</label>
              <input type="email" required autoFocus className="field" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-label">Password</label>
              <input type="password" required className="field" placeholder={mode==='signup' ? 'Min 6 characters' : 'Your password'} value={password} onChange={e=>setPassword(e.target.value)} />
            </div>

            {error && (
              <div className="glass" style={{ padding:'11px 14px', fontSize:13, color:'var(--red)', marginBottom:16, fontWeight:600, border:'1px solid color-mix(in srgb,var(--red) 30%,transparent)' }}>⚠ {error}</div>
            )}
            {success && (
              <div className="glass" style={{ padding:'11px 14px', fontSize:13, color:'var(--green)', marginBottom:16, fontWeight:600, border:'1px solid color-mix(in srgb,var(--green) 35%,transparent)' }}>✓ {success}</div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width:'100%', fontSize:15.5 }} disabled={loading}>
              {loading ? <><span className="spin">⟳</span>&nbsp;Please wait…</> : mode==='login' ? '🔑 Log In' : '✨ Create Account'}
            </button>
          </form>

          <p style={{ textAlign:'center', fontSize:12.5, color:'var(--text-muted)', marginTop:18, fontWeight:600 }}>
            {mode==='login'
              ? <>No account? <button onClick={()=>setMode('signup')} style={{ background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:12.5,fontFamily:'var(--font)',fontWeight:800 }}>Sign up free</button></>
              : <>Have an account? <button onClick={()=>setMode('login')} style={{ background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:12.5,fontFamily:'var(--font)',fontWeight:800 }}>Log in</button></>
            }
          </p>
        </div>
      </div>
    </div>
  );
}
