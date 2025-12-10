import React, { useState } from 'react';
import { 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Globe 
} from 'lucide-react';
import { cn } from '../../../utils';

interface LandingPageProps {
  onLoginSuccess: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-primary/20">
      
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900 tracking-tight">ERP03</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#" className="hover:text-primary transition-colors">Features</a>
            <a href="#" className="hover:text-primary transition-colors">Solutions</a>
            <a href="#" className="hover:text-primary transition-colors">Pricing</a>
            <a href="#" className="hover:text-primary transition-colors">Enterprise</a>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setAuthMode('login')}
              className="text-sm font-medium text-slate-600 hover:text-primary hidden md:block"
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

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {authMode === 'signup' && (
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase">First Name</label>
                            <input 
                              type="text" 
                              required 
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                              placeholder="John"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Last Name</label>
                            <input 
                              type="text" 
                              required 
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
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
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
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
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        placeholder="••••••••"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
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
                  
                  <div className="mt-6">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-slate-500">Or continue with</span>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <button className="w-full inline-flex justify-center py-2 px-4 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                         <span className="sr-only">Sign in with Google</span>
                         <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
                      </button>
                      <button className="w-full inline-flex justify-center py-2 px-4 border border-slate-200 rounded-lg shadow-sm bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                         <span className="sr-only">Sign in with GitHub</span>
                         <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                      </button>
                    </div>

                    <p className="mt-6 text-center text-xs text-slate-400">
                      By clicking continue, you agree to our <a href="#" className="underline hover:text-slate-600">Terms of Service</a> and <a href="#" className="underline hover:text-slate-600">Privacy Policy</a>.
                    </p>
                  </div>
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
                     <div className="h-12 w-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center mb-4 text-primary">
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