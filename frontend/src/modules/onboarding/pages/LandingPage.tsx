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
    <div className="min-h-screen bg-white font-sans selection:bg-primary/20">
      
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary-500 p-1.5 rounded-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">ERP03</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-primary-500 transition-colors">Features</a>
            <a href="#" className="hover:text-primary-500 transition-colors">Solutions</a>
            <a href="#" className="hover:text-primary-500 transition-colors">Pricing</a>
            <a href="#" className="hover:text-primary-500 transition-colors">Enterprise</a>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setAuthMode('login')}
              className="text-sm font-medium text-slate-600 hover:text-primary-500 hidden md:block"
            >
              Log in
            </button>
            <button 
              onClick={() => setAuthMode('signup')}
              className="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800 transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-24 pb-16 md:pt-32 md:pb-24 lg:pt-40 lg:pb-32 overflow-hidden">
        
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
           <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-100/50 blur-3xl opacity-60 mix-blend-multiply filter"></div>
           <div className="absolute top-[10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-100/50 blur-3xl opacity-60 mix-blend-multiply filter"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-6 text-center lg:text-left mb-12 lg:mb-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wide mb-6">
                <span className="flex h-2 w-2 rounded-full bg-blue-600"></span>
                New v3.0 Released
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-[1.1]">
                Manage your entire <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">business</span> in one place.
              </h1>
              <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                The all-in-one ERP platform designed for modern companies. 
                Streamline operations, finance, and HR with our modular bundles.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
                 <div className="flex items-center gap-2 text-sm text-slate-500">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>No credit card required</span>
                 </div>
                 <div className="hidden sm:block h-4 w-px bg-slate-300"></div>
                 <div className="flex items-center gap-2 text-sm text-slate-500">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>14-day free trial</span>
                 </div>
              </div>

              <div className="flex items-center justify-center lg:justify-start gap-8 grayscale opacity-60 hover:opacity-100 transition-opacity duration-300">
                 {/* Mock Logos */}
                 <div className="h-8 w-20 bg-slate-200 rounded animate-pulse"></div>
                 <div className="h-8 w-24 bg-slate-200 rounded animate-pulse delay-75"></div>
                 <div className="h-8 w-20 bg-slate-200 rounded animate-pulse delay-150"></div>
              </div>
            </div>

            {/* Right Auth Card */}
            <div className="lg:col-span-5 lg:col-start-8">
              <div className="relative">
                {/* Decorator behind card */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20"></div>
                
                <div className="relative bg-white rounded-xl shadow-2xl border border-slate-100 p-6 md:p-8">
                  
                  {/* Auth Tabs */}
                  <div className="flex p-1 bg-slate-100 rounded-lg mb-8">
                    <button
                      onClick={() => setAuthMode('signup')}
                      className={cn(
                        "flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200",
                        authMode === 'signup' 
                          ? "bg-white text-slate-900 shadow-sm" 
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Sign Up
                    </button>
                    <button
                      onClick={() => setAuthMode('login')}
                      className={cn(
                        "flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200",
                        authMode === 'login' 
                          ? "bg-white text-slate-900 shadow-sm" 
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      Log In
                    </button>
                  </div>

                  <div className="mb-6 text-center">
                    <h2 className="text-2xl font-bold text-slate-900">
                      {authMode === 'signup' ? 'Get started for free' : 'Welcome back'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-2">
                      {authMode === 'signup' ? 'Create your account to start building.' : 'Enter your details to access your dashboard.'}
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
                            <label className="text-xs font-semibold text-slate-500 uppercase">First Name</label>
                            <input 
                              type="text" 
                              required 
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                              placeholder="John"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Last Name</label>
                            <input 
                              type="text" 
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                              placeholder="Doe"
                            />
                          </div>
                       </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase">Email Address</label>
                      <input 
                        type="email" 
                        required 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                        placeholder="name@company.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase">Password</label>
                      <input 
                        type="password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                        placeholder="••••••••"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
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
                  <div className="mt-4 text-center">
                    <a 
                      href="/#/admin/login" 
                      className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      System Administrator? <span className="underline">Access Admin Portal</span>
                    </a>
                  </div>
                  
                  <p className="mt-6 text-center text-xs text-slate-400">
                    By clicking continue, you agree to our <a href="#" className="underline hover:text-slate-600">Terms of Service</a> and <a href="#" className="underline hover:text-slate-600">Privacy Policy</a>.
                  </p>
                </div>
              </div>
            </div>
            {/* End Right Auth Card */}

          </div>
        </div>
      </div>

      {/* Feature Strip */}
      <div className="bg-slate-50 border-y border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                <div>
                   <h4 className="text-3xl font-bold text-slate-900">20+</h4>
                   <p className="text-sm text-slate-500 mt-1">Industry Bundles</p>
                </div>
                <div>
                   <h4 className="text-3xl font-bold text-slate-900">10k+</h4>
                   <p className="text-sm text-slate-500 mt-1">Active Companies</p>
                </div>
                <div>
                   <h4 className="text-3xl font-bold text-slate-900">99.9%</h4>
                   <p className="text-sm text-slate-500 mt-1">Uptime SLA</p>
                </div>
                <div>
                   <h4 className="text-3xl font-bold text-slate-900">24/7</h4>
                   <p className="text-sm text-slate-500 mt-1">Global Support</p>
                </div>
            </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
               <h2 className="text-3xl font-bold text-slate-900">Everything you need to run your business</h2>
               <p className="text-lg text-slate-500 mt-4">Modular, scalable, and easy to use. Choose the apps you need and add more as you grow.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {[
                  { title: "Financial Management", desc: "Automate accounting, invoicing, and expenses.", icon: ShieldCheck },
                  { title: "HR & People", desc: "Manage payroll, attendance, and recruitment.", icon: Building2 },
                  { title: "Global Operations", desc: "Multi-currency, multi-language, and multi-company.", icon: Globe },
                ].map((feature, idx) => (
                  <div key={idx} className="p-6 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                     <div className="h-12 w-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center mb-4 text-primary-500">
                        <feature.icon className="h-6 w-6" />
                     </div>
                     <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                     <p className="text-slate-600">{feature.desc}</p>
                  </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
