/**
 * RequireOnboarding.tsx
 * 
 * Purpose: Ensures user has completed onboarding (has a plan).
 * Wraps around RequireAuth and adds onboarding status check.
 */

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { onboardingApi, OnboardingStatus } from '../../modules/onboarding';

interface RequireOnboardingProps {
  children: React.ReactNode;
  skipOnboardingCheck?: boolean; // For pages that should skip the check (like plan selection itself)
}

export const RequireOnboarding: React.FC<RequireOnboardingProps> = ({ 
  children, 
  skipOnboardingCheck = false 
}) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    if (!user || skipOnboardingCheck) {
      setStatusLoading(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const status = await onboardingApi.getOnboardingStatus();
        setOnboardingStatus(status);
      } catch (err) {
        console.error('Failed to get onboarding status:', err);
        setStatusError(true);
      } finally {
        setStatusLoading(false);
      }
    };

    checkStatus();
  }, [user, skipOnboardingCheck]);

  // Still loading auth
  if (authLoading) {
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

  // Skip onboarding check (for pages like plan selection)
  if (skipOnboardingCheck) {
    return <>{children}</>;
  }

  // Still loading onboarding status
  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  // Error getting status - redirect to plan selection (assume they need onboarding)
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
