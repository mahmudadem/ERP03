/**
 * LandingPage.tsx
 * 
 * Purpose: Login/Signup page for user onboarding.
 * Integrates with the IAuthProvider abstraction for authentication.
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ArrowRight, CheckCircle2, ShieldCheck, Globe } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { onboardingApi } from '../api/onboardingApi';
import { authApi } from '../../../api/auth';
import { cn } from '../../../lib/utils';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  
  const [authMode, setAuthMode] = useState<'login' | 'signup'>(
    searchParams.get('mode') === 'login' ? 'login' : 'signup'
  );
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      if (authMode === 'signup') {
        // Step 1: Create account via backend (creates Firebase Auth + User record)
        await onboardingApi.signup({
          email,
          password,
          firstName,
          lastName,
        });
        
        // Step 2: Log in with the new credentials
        await login({ email, password });
        
        // Step 3: Redirect to plan selection (new users need to select plan)
        navigate('/onboarding/plan');
      } else {
        // Login flow
        await login({ email, password });
        
        // Check if user is a super admin first
        try {
          const permissions = await authApi.getMyPermissions();
          
          if (permissions.isSuperAdmin) {
            // Super Admin: redirect to admin dashboard
            navigate('/super-admin/overview');
            return;
          }
        } catch (permErr) {
          console.error('Failed to check super admin status:', permErr);
        }
        
        // Regular user: Check onboarding status to determine where to go
        try {
          const status = await onboardingApi.getOnboardingStatus();
          
          switch (status.nextStep) {
            case 'PLAN_SELECTION':
              navigate('/onboarding/plan');
              break;
            case 'COMPANY_SELECT':
              navigate('/company-selector');
              break;
            case 'DASHBOARD':
              navigate('/');
              break;
          }
        } catch {
          // If status check fails, go to company selector
          navigate('/company-selector');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-sans selection:bg-primary-500/20 transition-colors">
      
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-[rgba(var(--color-bg-primary-rgb),0.8)] backdrop-blur-md z-50 border-b border-[var(--color-border)] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary-500 p-1.5 rounded-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="font-extrabold text-xl text-[var(--color-text-primary)] tracking-tight">ERP<span className="text-primary-600">03</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-[var(--color-text-secondary)]">
            <a href="#" className="hover:text-primary-500 transition-colors">Features</a>
            <a href="#" className="hover:text-primary-500 transition-colors">Solutions</a>
            <a href="#" className="hover:text-primary-500 transition-colors">Pricing</a>
            <a href="#" className="hover:text-primary-500 transition-colors">Enterprise</a>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setAuthMode('login')}
              className="text-sm font-semibold text-[var(--color-text-secondary)] hover:text-primary-500 hidden md:block transition-colors"
            >
              Log in
            </button>
            <button 
              onClick={() => setAuthMode('signup')}
              className="text-sm font-bold bg-primary-600 text-white px-6 py-2.5 rounded-full hover:bg-primary-700 shadow-lg shadow-primary-500/20 transition-all active:scale-[0.98]"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-24 pb-16 md:pt-32 md:pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none overflow-hidden">
           <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-primary-400/10 blur-[120px] opacity-40"></div>
           <div className="absolute bottom-[10%] left-[-10%] w-[700px] h-[700px] rounded-full bg-indigo-400/10 blur-[120px] opacity-40"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-6 text-center lg:text-left mb-12 lg:mb-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-widest mb-6">
                <span className="flex h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
                New ERP System v3.0
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[var(--color-text-primary)] tracking-tight mb-6 leading-[1.1]">
                Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-indigo-500">manage</span> your business.
              </h1>
              <p className="text-lg md:text-xl text-[var(--color-text-secondary)] mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                The all-in-one platform built for modern enterprises. 
                Seamlessly integrated accounting, operations, and HR tools.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
                 <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] font-medium">
                    <CheckCircle2 className="h-4 w-4 text-success-500" />
                    <span>Free Trial</span>
                 </div>
                 <div className="hidden sm:block h-4 w-px bg-[var(--color-border)]"></div>
                 <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] font-medium">
                    <CheckCircle2 className="h-4 w-4 text-success-500" />
                    <span>No credit card required</span>
                 </div>
              </div>

              <div className="flex items-center justify-center lg:justify-start gap-8 opacity-40 hover:opacity-100 transition-opacity duration-300">
                 {/* Mock Logos */}
                 <div className="h-6 w-20 bg-[var(--color-bg-tertiary)] rounded-full border border-[var(--color-border)]"></div>
                 <div className="h-6 w-24 bg-[var(--color-bg-tertiary)] rounded-full border border-[var(--color-border)]"></div>
                 <div className="h-6 w-20 bg-[var(--color-bg-tertiary)] rounded-full border border-[var(--color-border)]"></div>
              </div>
            </div>

            {/* Right Auth Card */}
            <div className="lg:col-span-5 lg:col-start-8">
              <div className="relative">
                {/* Decorator behind card */}
                <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-indigo-600 rounded-2xl blur opacity-20"></div>
                
                <div className="relative bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl border border-[var(--color-border)] p-6 md:p-8 overflow-hidden transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                  
                  {/* Auth Tabs */}
                  <div className="flex p-1.5 bg-[var(--color-bg-secondary)] rounded-xl mb-8 border border-[var(--color-border)]">
                    <button
                      onClick={() => setAuthMode('signup')}
                      className={cn(
                        "flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-300",
                        authMode === 'signup' 
                          ? "bg-[var(--color-bg-primary)] text-primary-600 shadow-sm border border-[var(--color-border)]" 
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      CREATE ACCOUNT
                    </button>
                    <button
                      onClick={() => setAuthMode('login')}
                      className={cn(
                        "flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-300",
                        authMode === 'login' 
                          ? "bg-[var(--color-bg-primary)] text-primary-600 shadow-sm border border-[var(--color-border)]" 
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      SIGN IN
                    </button>
                  </div>

                  <div className="mb-6 text-center">
                    <h2 className="text-2xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
                      {authMode === 'signup' ? 'Join ERP03' : 'Welcome back'}
                    </h2>
                    <p className="text-sm font-medium text-[var(--color-text-muted)] mt-2">
                      {authMode === 'signup' ? 'Start your journey with us today.' : 'Please enter your credentials to continue.'}
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {authMode === 'signup' && (
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">First Name</label>
                            <input 
                              type="text" 
                              required 
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className="w-full px-4 py-2.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-[var(--color-text-muted)]"
                              placeholder="First"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Last Name</label>
                            <input 
                              type="text" 
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className="w-full px-4 py-2.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-[var(--color-text-muted)]"
                              placeholder="Last"
                            />
                          </div>
                       </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Email Address</label>
                      <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-[var(--color-text-muted)]"
                        placeholder="email@company.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Password</label>
                      <input 
                        type="password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-[var(--color-text-muted)]"
                        placeholder="••••••••"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex items-center justify-center py-3.5 px-6 border border-transparent rounded-xl shadow-lg shadow-primary-500/25 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all active:scale-[0.98] disabled:opacity-70 disabled:grayscale disabled:cursor-not-allowed mt-4 uppercase tracking-widest"
                    >
                      {isLoading ? (
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          {authMode === 'signup' ? 'Create Account' : 'Sign In'}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>
                  
                  {/* Admin Login Link */}
                  <div className="mt-6 text-center">
                    <a 
                      href="/#/admin/login" 
                      className="text-xs font-bold text-[var(--color-text-muted)] hover:text-primary-500 transition-colors uppercase tracking-widest"
                    >
                      System Admin? <span className="underline decoration-primary-500/30">Portal Access</span>
                    </a>
                  </div>
                  
                  <p className="mt-8 text-center text-[10px] leading-relaxed font-bold text-[var(--color-text-muted)] uppercase tracking-tighter">
                    By continuing, you agree to our <a href="#" className="underline hover:text-[var(--color-text-primary)]">Terms</a> & <a href="#" className="underline hover:text-[var(--color-text-primary)]">Privacy</a>.
                  </p>
                </div>
              </div>
            </div>
            {/* End Right Auth Card */}

          </div>
        </div>
      </div>

      {/* Feature Strip */}
      <div className="bg-[var(--color-bg-secondary)] border-y border-[var(--color-border)] py-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
                <div className="group">
                   <h4 className="text-4xl font-extrabold text-[var(--color-text-primary)] group-hover:text-primary-500 transition-colors">20+</h4>
                   <p className="text-xs font-bold text-[var(--color-text-muted)] mt-2 uppercase tracking-widest">Industry Bundles</p>
                </div>
                <div className="group">
                   <h4 className="text-4xl font-extrabold text-[var(--color-text-primary)] group-hover:text-primary-500 transition-colors">10k+</h4>
                   <p className="text-xs font-bold text-[var(--color-text-muted)] mt-2 uppercase tracking-widest">Active Orgs</p>
                </div>
                <div className="group">
                   <h4 className="text-4xl font-extrabold text-[var(--color-text-primary)] group-hover:text-primary-500 transition-colors">99.9%</h4>
                   <p className="text-xs font-bold text-[var(--color-text-muted)] mt-2 uppercase tracking-widest">Uptime SLA</p>
                </div>
                <div className="group">
                   <h4 className="text-4xl font-extrabold text-[var(--color-text-primary)] group-hover:text-primary-500 transition-colors">24/7</h4>
                   <p className="text-xs font-bold text-[var(--color-text-muted)] mt-2 uppercase tracking-widest">Global Support</p>
                </div>
            </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-24 bg-[var(--color-bg-primary)] transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
               <h2 className="text-4xl font-extrabold text-[var(--color-text-primary)] tracking-tight">Everything you need to <span className="text-primary-600">scale</span></h2>
               <p className="text-lg font-medium text-[var(--color-text-secondary)] mt-4">Modular, scalable, and easy to use. Choose the apps you need and add more as you grow.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {[
                  { title: "Financials", desc: "Automate accounting, invoicing, and expenses.", icon: ShieldCheck },
                  { title: "Human Capital", desc: "Manage payroll, attendance, and recruitment.", icon: Building2 },
                  { title: "Global Ops", desc: "Multi-currency, multi-language, and multi-company.", icon: Globe },
                ].map((feature, idx) => (
                  <div key={idx} className="p-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 hover:bg-[var(--color-bg-tertiary)]/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                     <div className="h-14 w-14 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] flex items-center justify-center mb-6 text-primary-500 shadow-sm group-hover:scale-110 group-hover:bg-primary-500 group-hover:text-white transition-all duration-300">
                        <feature.icon className="h-7 w-7" />
                     </div>
                     <h3 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-3">{feature.title}</h3>
                     <p className="text-[var(--color-text-secondary)] font-medium leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
