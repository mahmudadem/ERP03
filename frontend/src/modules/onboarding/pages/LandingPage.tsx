/**
 * LandingPage.tsx
 * 
 * Purpose: Login/Signup page for user onboarding.
 * Integrates with the IAuthProvider abstraction for authentication.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, ArrowRight, CheckCircle2, ShieldCheck, Globe, Calculator, TrendingUp, ShoppingBag, Boxes, Store, Users, FileBarChart, HeartHandshake, Briefcase, MessageSquare, Factory, Kanban, Bot, Sparkles } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { onboardingApi } from '../api/onboardingApi';
import { authApi } from '../../../api/auth';
import { cn } from '../../../lib/utils';
import { Spinner } from '../../../components/ui/Spinner';

const LandingPage: React.FC = () => {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  
  
  const availableModules = [
    { key: 'accounting', icon: Calculator },
    { key: 'sales', icon: TrendingUp },
    { key: 'purchases', icon: ShoppingBag },
    { key: 'inventory', icon: Boxes },
    { key: 'pos', icon: Store },
    { key: 'users', icon: Users },
    { key: 'reports', icon: FileBarChart },
    { key: 'ai', icon: Bot },
  ];

  const comingSoonModules = [
    { key: 'crm', icon: HeartHandshake },
    { key: 'hr', icon: Briefcase },
    { key: 'messaging', icon: MessageSquare },
    { key: 'manufacturing', icon: Factory },
    { key: 'projects', icon: Kanban },
  ];

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
      let errorMessage = err.response?.data?.message || err.message;
      
      if (err.code) {
        switch (err.code) {
          case 'auth/user-not-found':
          case 'auth/invalid-credential':
            errorMessage = t('onboarding.landing.errors.invalidCredential', { defaultValue: 'Invalid email or password.' });
            break;
          case 'auth/wrong-password':
            errorMessage = t('onboarding.landing.errors.wrongPassword', { defaultValue: 'Incorrect password.' });
            break;
          case 'auth/email-already-in-use':
            errorMessage = t('onboarding.landing.errors.emailInUse', { defaultValue: 'Email is already registered.' });
            break;
          case 'auth/weak-password':
            errorMessage = t('onboarding.landing.errors.weakPassword', { defaultValue: 'Password is too weak.' });
            break;
          case 'auth/network-request-failed':
            errorMessage = t('onboarding.landing.errors.networkError', { defaultValue: 'Network error. Please check your connection.' });
            break;
        }
      }
      
      setError(errorMessage || t('onboarding.landing.authFailed', { defaultValue: 'Authentication failed' }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-sans selection:bg-primary-500/20 transition-colors">
      
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
            <a href="#" className="hover:text-primary-500 transition-colors">{t('onboarding.landing.nav.features', { defaultValue: 'Features' })}</a>
            <a href="#" className="hover:text-primary-500 transition-colors">{t('onboarding.landing.nav.solutions', { defaultValue: 'Solutions' })}</a>
            <a href="#" className="hover:text-primary-500 transition-colors">{t('onboarding.landing.nav.pricing', { defaultValue: 'Pricing' })}</a>
            <a href="#" className="hover:text-primary-500 transition-colors">{t('onboarding.landing.nav.enterprise', { defaultValue: 'Enterprise' })}</a>
          </div>
          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <div className="flex items-center gap-2 me-2 border-e border-[var(--color-border)] pe-4">
              <button 
                onClick={() => i18n.changeLanguage('en')}
                className={cn("text-xs font-bold transition-colors", i18n.language === 'en' ? "text-primary-600" : "text-[var(--color-text-secondary)] hover:text-primary-500")}
              >
                EN
              </button>
              <button 
                onClick={() => i18n.changeLanguage('ar')}
                className={cn("text-xs font-bold transition-colors", i18n.language === 'ar' ? "text-primary-600" : "text-[var(--color-text-secondary)] hover:text-primary-500")}
              >
                AR
              </button>
              <button 
                onClick={() => i18n.changeLanguage('tr')}
                className={cn("text-xs font-bold transition-colors", i18n.language === 'tr' ? "text-primary-600" : "text-[var(--color-text-secondary)] hover:text-primary-500")}
              >
                TR
              </button>
            </div>
            
            <button 
              onClick={() => setAuthMode('login')}
              className="text-sm font-semibold text-[var(--color-text-secondary)] hover:text-primary-500 hidden md:block transition-colors"
            >
              {t('onboarding.landing.nav.login', { defaultValue: 'Log in' })}
            </button>
            <button 
              onClick={() => setAuthMode('signup')}
              className="text-sm font-bold bg-primary-600 text-white px-6 py-2.5 rounded-full hover:bg-primary-700 shadow-lg shadow-primary-500/20 transition-all active:scale-[0.98]"
            >
              {t('onboarding.landing.nav.getStarted', { defaultValue: 'Get Started' })}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-24 pb-16 md:pt-32 md:pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        
        {/* Background Gradients */}
        <div className="absolute top-0 start-1/2 ltr:-translate-x-1/2 rtl:translate-x-1/2 w-full h-full z-0 pointer-events-none overflow-hidden">
           <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-primary-400/10 blur-[120px] opacity-40"></div>
           <div className="absolute bottom-[10%] left-[-10%] w-[700px] h-[700px] rounded-full bg-indigo-400/10 blur-[120px] opacity-40"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-6 text-center lg:text-start mb-12 lg:mb-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-widest mb-6">
                <span className="flex h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
                {t('onboarding.landing.badge', { defaultValue: 'New ERP System v3.0' })}
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[var(--color-text-primary)] tracking-tight mb-6 leading-[1.1]">
                {t('onboarding.landing.hero.titlePrefix', { defaultValue: 'Everything you need to' })} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-indigo-500">{t('onboarding.landing.hero.titleHighlight', { defaultValue: 'manage' })}</span> {t('onboarding.landing.hero.titleSuffix', { defaultValue: 'your business.' })}
              </h1>
              <p className="text-lg md:text-xl text-[var(--color-text-secondary)] mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-medium">
                {t('onboarding.landing.hero.subtitle', { defaultValue: 'The all-in-one platform built for modern enterprises. Seamlessly integrated accounting, operations, and HR tools.' })}
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
                 <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] font-medium">
                    <CheckCircle2 className="h-4 w-4 text-success-500" />
                    <span>{t('onboarding.landing.hero.freeTrial', { defaultValue: 'Free Trial' })}</span>
                 </div>
                 <div className="hidden sm:block h-4 w-px bg-[var(--color-border)]"></div>
                 <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] font-medium">
                    <CheckCircle2 className="h-4 w-4 text-success-500" />
                    <span>{t('onboarding.landing.hero.noCard', { defaultValue: 'No credit card required' })}</span>
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
                  <div className="absolute top-0 end-0 w-32 h-32 bg-primary-500/5 rounded-full -me-16 -mt-16 blur-3xl"></div>
                  
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
                      {t('onboarding.landing.authTabs.createAccount', { defaultValue: 'CREATE ACCOUNT' })}
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
                      {t('onboarding.landing.authTabs.signIn', { defaultValue: 'SIGN IN' })}
                    </button>
                  </div>

                  <div className="mb-6 text-center">
                    <h2 className="text-2xl font-extrabold text-[var(--color-text-primary)] tracking-tight">
                      {authMode === 'signup' ? t('onboarding.landing.auth.joinTitle', { defaultValue: 'Join ERP03' }) : t('onboarding.landing.auth.welcomeTitle', { defaultValue: 'Welcome back' })}
                    </h2>
                    <p className="text-sm font-medium text-[var(--color-text-muted)] mt-2">
                      {authMode === 'signup' ? t('onboarding.landing.auth.joinSubtitle', { defaultValue: 'Start your journey with us today.' }) : t('onboarding.landing.auth.welcomeSubtitle', { defaultValue: 'Please enter your credentials to continue.' })}
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
                            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ms-1">{t('onboarding.landing.form.firstName', { defaultValue: 'First Name' })}</label>
                            <input 
                              type="text" 
                              required 
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className="w-full px-4 py-2.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-[var(--color-text-muted)]"
                              placeholder={t('onboarding.landing.form.firstPlaceholder', { defaultValue: 'First' })}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ms-1">{t('onboarding.landing.form.lastName', { defaultValue: 'Last Name' })}</label>
                            <input 
                              type="text" 
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className="w-full px-4 py-2.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-[var(--color-text-muted)]"
                              placeholder={t('onboarding.landing.form.lastPlaceholder', { defaultValue: 'Last' })}
                            />
                          </div>
                       </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ms-1">{t('onboarding.landing.form.email', { defaultValue: 'Email Address' })}</label>
                      <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-[var(--color-text-muted)]"
                        placeholder={t('onboarding.landing.form.emailPlaceholder', { defaultValue: 'email@company.com' })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider ms-1">{t('onboarding.landing.form.password', { defaultValue: 'Password' })}</label>
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
                        <Spinner size="md" variant="white" />
                        ) : (
                        <>
                          {authMode === 'signup' ? t('onboarding.landing.form.submitCreate', { defaultValue: 'Create Account' }) : t('onboarding.landing.form.submitSignIn', { defaultValue: 'Sign In' })}
                          <ArrowRight className="rtl:-scale-x-100 ml-2 h-4 w-4" />
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
                      {t('onboarding.landing.admin.prefix', { defaultValue: 'System Admin?' })} <span className="underline decoration-primary-500/30">{t('onboarding.landing.admin.portal', { defaultValue: 'Portal Access' })}</span>
                    </a>
                  </div>
                  
                  <p className="mt-8 text-center text-[10px] leading-relaxed font-bold text-[var(--color-text-muted)] uppercase tracking-tighter">
                    {t('onboarding.landing.legal.prefix', { defaultValue: 'By continuing, you agree to our' })} <a href="#" className="underline hover:text-[var(--color-text-primary)]">{t('onboarding.landing.legal.terms', { defaultValue: 'Terms' })}</a> & <a href="#" className="underline hover:text-[var(--color-text-primary)]">{t('onboarding.landing.legal.privacy', { defaultValue: 'Privacy' })}</a>.
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
                   <p className="text-xs font-bold text-[var(--color-text-muted)] mt-2 uppercase tracking-widest">{t('onboarding.landing.stats.industryBundles', { defaultValue: 'Industry Bundles' })}</p>
                </div>
                <div className="group">
                   <h4 className="text-4xl font-extrabold text-[var(--color-text-primary)] group-hover:text-primary-500 transition-colors">10k+</h4>
                   <p className="text-xs font-bold text-[var(--color-text-muted)] mt-2 uppercase tracking-widest">{t('onboarding.landing.stats.activeOrgs', { defaultValue: 'Active Orgs' })}</p>
                </div>
                <div className="group">
                   <h4 className="text-4xl font-extrabold text-[var(--color-text-primary)] group-hover:text-primary-500 transition-colors">99.9%</h4>
                   <p className="text-xs font-bold text-[var(--color-text-muted)] mt-2 uppercase tracking-widest">{t('onboarding.landing.stats.uptimeSla', { defaultValue: 'Uptime SLA' })}</p>
                </div>
                <div className="group">
                   <h4 className="text-4xl font-extrabold text-[var(--color-text-primary)] group-hover:text-primary-500 transition-colors">24/7</h4>
                   <p className="text-xs font-bold text-[var(--color-text-muted)] mt-2 uppercase tracking-widest">{t('onboarding.landing.stats.globalSupport', { defaultValue: 'Global Support' })}</p>
                </div>
            </div>
        </div>
      </div>

      {/* Modules Section */}
      <div className="py-24 bg-[var(--color-bg-primary)] transition-colors border-t border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto mb-24">
               <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-widest mb-6">
                 {t('landing.allInOne.title', { defaultValue: 'All in one place' })}
               </div>
               <h2 className="text-4xl md:text-5xl font-extrabold text-[var(--color-text-primary)] tracking-tight leading-tight">
                 {t('landing.allInOne.title', { defaultValue: 'All in one place' })}
               </h2>
               <p className="text-lg md:text-xl font-medium text-[var(--color-text-secondary)] mt-6 max-w-2xl mx-auto leading-relaxed">
                 {t('landing.allInOne.desc', { defaultValue: 'Seamlessly integrated to eliminate data silos and double entry.' })}
               </p>
            </div>

            {/* Available Now - Detailed Sections */}
            <div className="mb-32 space-y-32">
               {availableModules.map((mod, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <div key={idx} className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-12 lg:gap-20 items-center`}>
                       <div className="flex-1 space-y-6 w-full">
                          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-2xl mb-2">
                             <mod.icon className="h-8 w-8" />
                          </div>
                          <h3 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text-primary)] tracking-tight">{t(`landing.modules.${mod.key}.title`)}</h3>
                          <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed font-medium">{t(`landing.modules.${mod.key}.desc`)}</p>
                          <div className="pt-4 flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold uppercase tracking-widest text-xs cursor-pointer hover:opacity-75 transition-opacity">
                             Explore Module <ArrowRight className="rtl:-scale-x-100 w-4 h-4" />
                          </div>
                       </div>
                       <div className="flex-1 w-full">
                          <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] border border-[var(--color-border)] shadow-2xl relative overflow-hidden flex items-center justify-center p-8 group">
                             {/* Mock UI representation */}
                             <div className="absolute inset-4 md:inset-8 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-xl flex flex-col transform group-hover:scale-[1.02] transition-transform duration-500 overflow-hidden">
                               <div className="h-10 border-b border-[var(--color-border)] flex items-center justify-between px-4 gap-2 bg-[var(--color-bg-secondary)]">
                                  <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                                  </div>
                                  <div className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                                    {t(`landing.modules.${mod.key}.title`)}
                                  </div>
                               </div>
                               <div className="p-4 flex-1 flex flex-col gap-3 overflow-hidden bg-[var(--color-bg-primary)]">
                                 {mod.key === 'accounting' && (
                                   <>
                                     <div className="flex items-center justify-between mb-2">
                                       <div className="h-4 w-24 bg-primary-500/20 rounded"></div>
                                       <div className="h-4 w-12 bg-success-500/20 text-success-600 text-[8px] font-bold flex items-center justify-center rounded">+12%</div>
                                     </div>
                                     <div className="flex gap-2">
                                       <div className="flex-1 h-16 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] flex flex-col justify-center px-3">
                                          <div className="text-[8px] text-[var(--color-text-muted)] uppercase font-bold">{t('landing.mockups.revenue', { defaultValue: 'Revenue' })}</div>
                                          <div className="text-sm font-bold text-[var(--color-text-primary)]">$124,500</div>
                                       </div>
                                       <div className="flex-1 h-16 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] flex flex-col justify-center px-3">
                                          <div className="text-[8px] text-[var(--color-text-muted)] uppercase font-bold">{t('landing.mockups.expenses', { defaultValue: 'Expenses' })}</div>
                                          <div className="text-sm font-bold text-[var(--color-text-primary)]">$82,100</div>
                                       </div>
                                     </div>
                                     <div className="flex-1 mt-2 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)] p-3 flex flex-col gap-2">
                                        <div className="h-2 w-full bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden"><div className="h-full w-3/4 bg-primary-500"></div></div>
                                        <div className="h-2 w-full bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden"><div className="h-full w-1/2 bg-indigo-500"></div></div>
                                        <div className="h-2 w-full bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden"><div className="h-full w-5/6 bg-emerald-500"></div></div>
                                     </div>
                                   </>
                                 )}
                                 {mod.key === 'sales' && (
                                   <>
                                     <div className="flex justify-between items-center mb-2">
                                       <div className="text-[10px] font-bold text-[var(--color-text-primary)]">{t('landing.mockups.recentInvoices', { defaultValue: 'Recent Invoices' })}</div>
                                       <div className="px-2 py-0.5 bg-primary-500 text-white text-[8px] font-bold rounded">{t('landing.mockups.newInvoice', { defaultValue: 'New Invoice' })}</div>
                                     </div>
                                     {[1,2,3].map(i => (
                                       <div key={i} className="flex justify-between items-center p-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                                          <div>
                                            <div className="text-[9px] font-bold text-[var(--color-text-primary)]">INV-2026-00{i}</div>
                                            <div className="text-[8px] text-[var(--color-text-muted)]">Acme Corp</div>
                                          </div>
                                          <div className="text-end">
                                            <div className="text-[9px] font-bold text-[var(--color-text-primary)]">$1,250.00</div>
                                            <div className="text-[7px] text-success-500 font-bold uppercase">{t('landing.mockups.paid', { defaultValue: 'Paid' })}</div>
                                          </div>
                                       </div>
                                     ))}
                                   </>
                                 )}
                                 {mod.key === 'ai' && (
                                   <>
                                     <div className="flex-1 flex flex-col gap-2 p-1">
                                       <div className="flex justify-end">
                                          <div className="bg-primary-500 text-white text-[9px] p-2 rounded-s-lg rounded-ee-lg max-w-[80%] shadow-sm">
                                            {t('landing.mockups.aiPrompt', { defaultValue: 'Show me the net profit for Q2 compared to Q1.' })}
                                          </div>
                                       </div>
                                       <div className="flex justify-start items-end gap-1">
                                          <div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                                            <Bot className="w-3 h-3" />
                                          </div>
                                          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-[9px] p-2 rounded-e-lg rounded-es-lg max-w-[80%] shadow-sm flex flex-col gap-1.5">
                                            <span>{t('landing.mockups.aiResponse', { defaultValue: 'Net profit for Q2 was $42,400, which is a 15% increase from Q1.' })}</span>
                                            <div className="h-10 w-full bg-emerald-500/10 border border-emerald-500/20 rounded mt-1 flex items-end p-1 gap-1">
                                              <div className="w-1/2 bg-emerald-500/40 h-1/2 rounded-t"></div>
                                              <div className="w-1/2 bg-emerald-500 h-full rounded-t"></div>
                                            </div>
                                          </div>
                                       </div>
                                     </div>
                                     <div className="mt-auto relative">
                                        <div className="h-6 w-full bg-[var(--color-bg-secondary)] rounded border border-[var(--color-border)] flex items-center px-2">
                                          <div className="text-[8px] text-[var(--color-text-muted)]">{t('landing.mockups.aiPlaceholder', { defaultValue: 'Ask the AI assistant...' })}</div>
                                        </div>
                                     </div>
                                   </>
                                 )}
                                 {mod.key === 'inventory' && (
                                   <>
                                     <div className="flex justify-between items-center mb-2">
                                       <div className="text-[10px] font-bold text-[var(--color-text-primary)]">{t('landing.mockups.stockAlerts', { defaultValue: 'Stock Alerts' })}</div>
                                     </div>
                                     <div className="grid grid-cols-2 gap-2">
                                       {['Laptop Pro', 'Wireless Mouse', 'Keyboard', 'Monitor 24"'].map((item, i) => (
                                         <div key={i} className="p-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] flex flex-col gap-1">
                                            <div className="text-[9px] font-bold truncate text-[var(--color-text-primary)]">{item}</div>
                                            <div className="flex justify-between items-center">
                                              <div className="text-[8px] text-[var(--color-text-muted)]">{t('landing.mockups.qty', { defaultValue: 'Qty' })}: <span className={i === 1 ? 'text-red-500 font-bold' : 'text-[var(--color-text-primary)]'}>{i === 1 ? '2' : 45 + i * 12}</span></div>
                                              {i === 1 && <div className="text-[7px] bg-red-500/10 text-red-600 px-1 rounded font-bold uppercase">{t('landing.mockups.low', { defaultValue: 'Low' })}</div>}
                                            </div>
                                         </div>
                                       ))}
                                     </div>
                                   </>
                                 )}
                                 {mod.key !== 'accounting' && mod.key !== 'sales' && mod.key !== 'ai' && mod.key !== 'inventory' && (
                                    <>
                                     <div className="flex items-center justify-between mb-3">
                                        <div className="h-4 w-1/3 bg-[var(--color-bg-tertiary)] rounded"></div>
                                        <div className="h-6 w-16 bg-primary-500 text-white text-[8px] font-bold flex items-center justify-center rounded uppercase">{t('landing.mockups.action', { defaultValue: 'Action' })}</div>
                                     </div>
                                     <div className="space-y-2">
                                        {[1,2,3].map(i => (
                                          <div key={i} className="h-8 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded flex items-center px-3 gap-3">
                                            <div className="w-4 h-4 rounded bg-[var(--color-bg-tertiary)]"></div>
                                            <div className="flex-1 h-2 bg-[var(--color-bg-tertiary)] rounded-full"></div>
                                            <div className="w-8 h-2 bg-[var(--color-bg-tertiary)] rounded-full"></div>
                                          </div>
                                        ))}
                                     </div>
                                    </>
                                 )}
                               </div>
                             </div>
                          </div>
                       </div>
                    </div>
                  );
               })}
            </div>

            {/* Coming Soon */}
            <div className="pt-16 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-4 mb-12">
                <h3 className="text-2xl font-extrabold text-[var(--color-text-primary)] tracking-tight">{t('landing.modules.comingSoon', { defaultValue: 'Coming Soon' })}</h3>
                <div className="h-px bg-[var(--color-border)] flex-1"></div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 opacity-75">
                  {comingSoonModules.map((mod, idx) => (
                    <div key={idx} className="p-6 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30 hover:bg-[var(--color-bg-secondary)] transition-all duration-300">
                       <div className="h-12 w-12 rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-5 text-[var(--color-text-muted)]">
                          <mod.icon className="h-6 w-6" />
                       </div>
                       <h4 className="text-lg font-bold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
                         {t(`landing.modules.${mod.key}.title`)}
                         <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">Beta</span>
                       </h4>
                       <p className="text-[var(--color-text-secondary)] text-sm font-medium leading-relaxed">{t(`landing.modules.${mod.key}.desc`)}</p>
                    </div>
                  ))}
              </div>
            </div>

        </div>
      </div>
    </div>
  );
};
export default LandingPage;
