/**
 * RequireOnboarding.tsx
 * 
 * Purpose: Ensures user has completed onboarding (has a plan).
 * Wraps around RequireAuth and adds onboarding status check.
 */

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCompanyAccess } from '../../context/CompanyAccessContext';
import { onboardingApi, OnboardingStatus } from '../../modules/onboarding';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

interface RequireOnboardingProps {
  children: React.ReactNode;
  skipOnboardingCheck?: boolean; // For pages that should skip the check (like plan selection itself)
}

export const RequireOnboarding: React.FC<RequireOnboardingProps> = ({ 
  children, 
  skipOnboardingCheck = false 
}) => {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: accessLoading } = useCompanyAccess();
  const location = useLocation();
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);
  const [backendConnecting, setBackendConnecting] = useState(false);

  useEffect(() => {
    // Super Admins bypass all onboarding checks
    if (isSuperAdmin) {
      setStatusLoading(false);
      return;
    }
    
    if (!user || skipOnboardingCheck) {
      setStatusLoading(false);
      return;
    }

    const checkStatusWithRetry = async () => {
      setBackendConnecting(true);
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const status = await onboardingApi.getOnboardingStatus();
          setOnboardingStatus(status);
          setBackendConnecting(false);
          setStatusLoading(false);
          return;
        } catch (err: any) {
          // 401 means not authenticated — let the auth guard handle it
          if (err.response?.status === 401) {
            setStatusLoading(false);
            setBackendConnecting(false);
            return;
          }

          // Network errors (connection refused, 502, timeout) — retry
          const isNetworkError = !err.response || err.response.status >= 500;
          if (isNetworkError && attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
            continue;
          }

          // Exhausted retries or non-retryable error
          console.error(`Failed to get onboarding status after ${attempt} attempt(s):`, err);
          setStatusError(true);
          setBackendConnecting(false);
          setStatusLoading(false);
          return;
        }
      }
    };

    checkStatusWithRetry();
  }, [user, skipOnboardingCheck, isSuperAdmin]);

  // Still loading auth
  if (authLoading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Super Admins bypass onboarding - they don't need plans or companies
  if (isSuperAdmin || skipOnboardingCheck) {
    return <>{children}</>;
  }

  // Still checking onboarding status or retrying connection
  if (statusLoading || backendConnecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        {backendConnecting && (
          <p className="mt-4 text-sm text-slate-500">Connecting to server...</p>
        )}
      </div>
    );
  }

  // Error getting status after retries — redirect to plan selection
  if (statusError) {
    if (location.pathname !== '/onboarding/plan') {
      return <Navigate to="/onboarding/plan" replace />;
    }
  }

  // Check onboarding status
  if (onboardingStatus) {
    // Legacy mode: if user has companies but no plan, let them through
    // Only new users (no companies AND no plan) need to select a plan first
    if (!onboardingStatus.hasPlan && !onboardingStatus.hasCompanies) {
      // New user with no plan and no companies - force plan selection
      if (location.pathname !== '/onboarding/plan') {
        return <Navigate to="/onboarding/plan" replace />;
      }
    }
    // Users with companies (even without plan) are allowed through
  }

  return <>{children}</>;
};
