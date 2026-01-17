/**
 * PlanSelectionPage.tsx
 * 
 * Purpose: Plan selection page for new users during onboarding.
 * Fetches plans from backend and saves selection.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Star, Loader2, LogOut } from 'lucide-react';
import { onboardingApi, Plan } from '../api/onboardingApi';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../context/AuthContext';

const PlanSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const data = await onboardingApi.getPlans();
      setPlans(data);
    } catch (err: any) {
      setError('Failed to load plans. Please try again.');
      console.error('Failed to load plans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (e) {
      navigate('/auth');
    }
  };

  const handleSelect = (id: string) => {
    setSelectedPlanId(id);
  };

  const handleContinue = async () => {
    if (!selectedPlanId) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      await onboardingApi.selectPlan(selectedPlanId);
      // Navigate to company selector - use the route that doesn't re-check plan status
      // to avoid race condition with database propagation
      window.location.href = '/#/company-selector';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save plan selection');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // Determine which plan is recommended (highest price that's not enterprise-level)
  const recommendedPlanId = plans.find(p => p.price > 0 && p.price < 100)?.id;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-red-600 transition-colors bg-white/50 hover:bg-white px-3 py-2 rounded-lg"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-base font-semibold text-primary-500 tracking-wide uppercase">Pricing</h2>
          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Choose the right plan for your business
          </p>
          <p className="mt-4 max-w-2xl text-xl text-slate-500 mx-auto">
            Start small and upgrade as you grow. All plans include core ERP features.
          </p>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Plans Container with horizontal scroll on smaller screens */}
        <div className="relative">
          {/* Left fade */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none 2xl:hidden"></div>
          {/* Right fade */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none 2xl:hidden"></div>
          
          <div className="flex gap-6 overflow-x-auto pb-4 px-2 snap-x snap-mandatory scroll-smooth 2xl:justify-center 2xl:overflow-visible scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            {plans.map((plan) => {
              const isRecommended = plan.id === recommendedPlanId;
              const isSelected = selectedPlanId === plan.id;
              
              return (
                <div 
                  key={plan.id}
                  onClick={() => handleSelect(plan.id)}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-lg snap-center shrink-0",
                    "w-[280px] min-w-[280px]",
                    isSelected 
                      ? "border-primary-500 ring-2 ring-primary-500 ring-opacity-50 transform scale-105 z-10" 
                      : "border-slate-200 hover:border-slate-300",
                    isRecommended && !isSelected ? "border-amber-400 border-2" : ""
                  )}
                >
                  {isRecommended && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide flex items-center gap-1 shadow-sm">
                        <Star className="w-3 h-3 fill-white" />
                        Recommended
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                    <p className="mt-2 text-sm text-slate-500 h-10">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    <span className="text-2xl font-bold text-slate-900">
                      {plan.price === 0 ? 'Free' : `$${plan.price}/mo`}
                    </span>
                  </div>

                  <ul className="space-y-4 mb-6 flex-1">
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mr-2" />
                      <span className="text-sm text-slate-600">
                        Companies: <strong>{plan.limits.maxCompanies}</strong>
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mr-2" />
                      <span className="text-sm text-slate-600">
                        Users/Company: <strong>{plan.limits.maxUsersPerCompany}</strong>
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mr-2" />
                      <span className="text-sm text-slate-600">
                        Modules: <strong>{plan.limits.maxModulesAllowed}</strong>
                      </span>
                    </li>
                    <li className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mr-2" />
                      <span className="text-sm text-slate-600">
                        Storage: <strong>{plan.limits.maxStorageMB} MB</strong>
                      </span>
                    </li>
                  </ul>
                  
                  <button
                    className={cn(
                      "w-full rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
                      isSelected
                        ? "bg-primary-500 text-white hover:bg-primary-600"
                        : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                    )}
                  >
                    {isSelected ? "Selected" : "Select Plan"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Action Bar if selection made */}
        {selectedPlanId && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg animate-in slide-in-from-bottom-10 z-50">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-500">Selected Plan:</p>
                <p className="font-bold text-slate-900">
                  {plans.find(p => p.id === selectedPlanId)?.name}
                </p>
              </div>
              <button
                onClick={handleContinue}
                disabled={isProcessing}
                className="inline-flex items-center justify-center rounded-md bg-primary-500 px-8 py-3 text-sm font-medium text-white shadow transition-colors hover:bg-primary-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanSelectionPage;
