import React, { useState } from 'react';
import { Check, ArrowRight, Star } from 'lucide-react';
import { cn } from '../../../utils';

interface Plan {
  id: string;
  name: string;
  price: string;
  description: string;
  maxUsers: number | string;
  maxCompanies: number | string;
  maxApps: number | string;
  trialDays?: number;
  support: string;
  recommended: boolean;
  workflows?: boolean;
  apiAccess?: boolean;
  sla?: string;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free Trial",
    price: "0$ for 14 days",
    description: "Full access to all features for 14 days.",
    maxUsers: 1,
    maxCompanies: 1,
    maxApps: 999,
    trialDays: 14,
    support: "Community Support",
    recommended: false
  },
  {
    id: "starter",
    name: "Starter",
    price: "$9 / month",
    description: "Great for individuals and small teams.",
    maxUsers: 1,
    maxCompanies: 1,
    maxApps: 2,
    support: "Email Support",
    recommended: false
  },
  {
    id: "advanced",
    name: "Advanced",
    price: "$39 / month",
    description: "For growing businesses needing more flexibility.",
    maxUsers: 5,
    maxCompanies: 3,
    maxApps: 5,
    support: "Priority Support",
    workflows: true,
    recommended: true
  },
  {
    id: "business",
    name: "Business",
    price: "$99 / month",
    description: "For established companies with larger teams.",
    maxUsers: 20,
    maxCompanies: 10,
    maxApps: "Unlimited",
    support: "Premium Support",
    workflows: true,
    apiAccess: true,
    recommended: false
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Contact Sales",
    description: "Custom SLA, dedicated infra, and full-scale deployment.",
    maxUsers: "Unlimited",
    maxCompanies: "Unlimited",
    maxApps: "Unlimited",
    support: "Dedicated Account Manager",
    workflows: true,
    apiAccess: true,
    sla: "Enterprise SLA",
    recommended: false
  }
];

interface ChoosePlanProps {
  onPlanSelected: (planId: string) => void;
}

const ChoosePlan: React.FC<ChoosePlanProps> = ({ onPlanSelected }) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelect = (id: string) => {
    setSelectedPlanId(id);
  };

  const handleContinue = () => {
    if (!selectedPlanId) return;
    setIsProcessing(true);
    // TODO: Connect to Payment/Subscription API
    setTimeout(() => {
      setIsProcessing(false);
      onPlanSelected(selectedPlanId);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-base font-semibold text-primary tracking-wide uppercase">Pricing</h2>
          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Choose the right plan for your business
          </p>
          <p className="mt-4 max-w-2xl text-xl text-slate-500 mx-auto">
            Start small and upgrade as you grow. All plans include core ERP features.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 xl:grid-cols-5 items-start">
          {PLANS.map((plan) => (
            <div 
              key={plan.id}
              onClick={() => handleSelect(plan.id)}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition-all duration-200 cursor-pointer h-full hover:shadow-lg",
                selectedPlanId === plan.id 
                  ? "border-primary ring-2 ring-primary ring-opacity-50 transform scale-105 z-10" 
                  : "border-slate-200 hover:border-slate-300",
                plan.recommended && selectedPlanId !== plan.id ? "border-amber-400 border-2" : ""
              )}
            >
              {plan.recommended && (
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
                <span className="text-2xl font-bold text-slate-900">{plan.price}</span>
              </div>

              <ul className="space-y-4 mb-6 flex-1">
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 shrink-0 mr-2" />
                  <span className="text-sm text-slate-600">Users: <strong>{plan.maxUsers}</strong></span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 shrink-0 mr-2" />
                  <span className="text-sm text-slate-600">Companies: <strong>{plan.maxCompanies}</strong></span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 shrink-0 mr-2" />
                  <span className="text-sm text-slate-600">Apps: <strong>{plan.maxApps}</strong></span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 shrink-0 mr-2" />
                  <span className="text-sm text-slate-600">{plan.support}</span>
                </li>
                {plan.workflows && (
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mr-2" />
                    <span className="text-sm text-slate-600">Custom Workflows</span>
                  </li>
                )}
                {plan.apiAccess && (
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mr-2" />
                    <span className="text-sm text-slate-600">API Access</span>
                  </li>
                )}
              </ul>
              
              <button
                className={cn(
                  "w-full rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
                  selectedPlanId === plan.id
                    ? "bg-primary text-white hover:bg-primary/90"
                    : "bg-slate-100 text-slate-900 hover:bg-slate-200"
                )}
              >
                {selectedPlanId === plan.id ? "Selected" : "Select Plan"}
              </button>
            </div>
          ))}
        </div>

        {/* Floating Action Bar if selection made */}
        {selectedPlanId && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg animate-in slide-in-from-bottom-10 z-50">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-500">Selected Plan:</p>
                <p className="font-bold text-slate-900">{PLANS.find(p => p.id === selectedPlanId)?.name}</p>
              </div>
              <button
                onClick={handleContinue}
                disabled={isProcessing}
                className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-white shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Continue to Dashboard'}
                {!isProcessing && <ArrowRight className="ml-2 h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChoosePlan;