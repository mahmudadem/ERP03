import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { superAdminApi } from '../../../api/superAdmin';
import { Bot, Server, Wrench, Globe, CheckCircle2, AlertTriangle, ShieldCheck, Rocket, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export const AiManagementOverviewPage: React.FC = () => {
  const { t } = useTranslation('common');

  const { data: providers = [] } = useQuery({
    queryKey: ['ai-providers'],
    queryFn: () => superAdminApi.getAiProviders()
  });

  const { data: models = [] } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => superAdminApi.getAiModelProfiles()
  });

  const { data: runtimes = [] } = useQuery({
    queryKey: ['ai-runtime-profiles'],
    queryFn: () => superAdminApi.getAiRuntimeProfiles()
  });

  const { data: toolsRes = { data: [] } } = useQuery({
    queryKey: ['ai-tools'],
    queryFn: () => superAdminApi.getAiTools()
  });

  const modelList = Array.isArray(models) ? models : (models as any).data || [];
  const toolsList = Array.isArray(toolsRes) ? toolsRes : (toolsRes as any).data || [];

  const activeProviders = providers.filter(p => p.enabled).length;
  const activeModels = modelList.filter((m: any) => m.enabled).length;
  const activeRuntimes = runtimes.filter(r => r.status === 'active').length;
  const activeTools = toolsList.filter((t: any) => t.status === 'active').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[var(--sa-text)] flex items-center gap-2">
          <Bot className="w-6 h-6 text-[var(--sa-accent)]" />
          AI Management Overview
        </h1>
        <p className="text-[var(--sa-muted)] text-sm">
          System-wide AI infrastructure, governance, and availability metrics.
        </p>
      </div>

      {/* Primary CTA: Setup Wizard — replaces "bounce between 4 pages" with a linear flow */}
      <Link
        to="/super-admin/ai-setup"
        className="block rounded-xl border border-indigo-300 bg-gradient-to-r from-indigo-50 to-blue-50 p-5 hover:from-indigo-100 hover:to-blue-100 transition group"
      >
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-indigo-100 p-3 flex-shrink-0">
            <Rocket className="w-6 h-6 text-indigo-700" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-indigo-900">Set up a new AI model</h2>
            <p className="mt-1 text-sm text-indigo-800">
              Guided 5-step wizard: pick a provider → choose a model → save the platform key → run live tests → certify for ERP categories. Each step saves immediately — leave anytime.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-indigo-700 mt-2 group-hover:translate-x-1 transition flex-shrink-0" />
        </div>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Providers */}
        <div className="bg-[var(--sa-surface)] rounded-[var(--sa-radius)] border border-[var(--sa-border)] p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Server className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-2xl font-bold text-[var(--sa-text)]">{providers.length}</span>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--sa-text)]">Providers</h3>
            <p className="text-xs text-[var(--sa-muted)]">{activeProviders} active connections</p>
          </div>
        </div>

        {/* Model Profiles */}
        <div className="bg-[var(--sa-surface)] rounded-[var(--sa-radius)] border border-[var(--sa-border)] p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-500" />
            </div>
            <span className="text-2xl font-bold text-[var(--sa-text)]">{modelList.length}</span>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--sa-text)]">Model Profiles</h3>
            <p className="text-xs text-[var(--sa-muted)]">{activeModels} enabled system-wide</p>
          </div>
        </div>

        {/* Runtime Profiles */}
        <div className="bg-[var(--sa-surface)] rounded-[var(--sa-radius)] border border-[var(--sa-border)] p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-2xl font-bold text-[var(--sa-text)]">{runtimes.length}</span>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--sa-text)]">Runtime Profiles</h3>
            <p className="text-xs text-[var(--sa-muted)]">{activeRuntimes} actively serving</p>
          </div>
        </div>

        {/* Tools */}
        <div className="bg-[var(--sa-surface)] rounded-[var(--sa-radius)] border border-[var(--sa-border)] p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-2xl font-bold text-[var(--sa-text)]">{toolsList.length}</span>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--sa-text)]">Tools & Skills</h3>
            <p className="text-xs text-[var(--sa-muted)]">{activeTools} active tools</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--sa-surface)] rounded-[var(--sa-radius)] border border-[var(--sa-border)] p-5">
          <h2 className="font-semibold text-[var(--sa-text)] mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Governance Status
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[var(--sa-surface-muted)] rounded-lg border border-[var(--sa-border)]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="font-medium text-[var(--sa-text)] text-sm">Proposal Engine</p>
                  <p className="text-xs text-[var(--sa-muted)]">Active</p>
                </div>
              </div>
              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-medium rounded-full">Healthy</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[var(--sa-surface-muted)] rounded-lg border border-[var(--sa-border)]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="font-medium text-[var(--sa-text)] text-sm">Tool Certifications</p>
                  <p className="text-xs text-[var(--sa-muted)]">Up to date</p>
                </div>
              </div>
              <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-medium rounded-full">Healthy</span>
            </div>
          </div>
        </div>

        <div className="bg-[var(--sa-surface)] rounded-[var(--sa-radius)] border border-[var(--sa-border)] p-5">
          <h2 className="font-semibold text-[var(--sa-text)] mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/super-admin/ai-providers" className="block p-3 text-left bg-[var(--sa-surface-muted)] hover:bg-[var(--sa-sidebar-hover)] rounded-lg border border-[var(--sa-border)] transition-colors">
              <p className="font-medium text-[var(--sa-text)] text-sm">Manage Providers</p>
              <p className="text-xs text-[var(--sa-muted)]">Configure API connections</p>
            </Link>
            <Link to="/super-admin/ai-models" className="block p-3 text-left bg-[var(--sa-surface-muted)] hover:bg-[var(--sa-sidebar-hover)] rounded-lg border border-[var(--sa-border)] transition-colors">
              <p className="font-medium text-[var(--sa-text)] text-sm">Manage Models</p>
              <p className="text-xs text-[var(--sa-muted)]">Enable or sync models</p>
            </Link>
            <Link to="/super-admin/ai-tools" className="block p-3 text-left bg-[var(--sa-surface-muted)] hover:bg-[var(--sa-sidebar-hover)] rounded-lg border border-[var(--sa-border)] transition-colors">
              <p className="font-medium text-[var(--sa-text)] text-sm">Tool Catalog</p>
              <p className="text-xs text-[var(--sa-muted)]">View all AI tools</p>
            </Link>
            <Link to="/super-admin/ai-proposal-policies" className="block p-3 text-left bg-[var(--sa-surface-muted)] hover:bg-[var(--sa-sidebar-hover)] rounded-lg border border-[var(--sa-border)] transition-colors">
              <p className="font-medium text-[var(--sa-text)] text-sm">Proposal Policies</p>
              <p className="text-xs text-[var(--sa-muted)]">Manage AI write rules</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
