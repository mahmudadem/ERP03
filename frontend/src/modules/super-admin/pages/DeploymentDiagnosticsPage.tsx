import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Activity, Database, Flame, KeyRound, MonitorCheck, RefreshCw, Server } from 'lucide-react';
import { superAdminApi, DeploymentDiagnostics, DiagnosticStatus } from '../../../api/superAdmin';
import { env } from '../../../config/env';
import { Button } from '../../../components/ui/Button';
import {
  SuperAdminBadge,
  SuperAdminEmptyState,
  SuperAdminHeader,
  SuperAdminLoading,
  SuperAdminPage,
  SuperAdminPanel,
  SuperAdminStatCard,
} from '../components/SuperAdminPage';

const statusTone = (status: DiagnosticStatus): 'green' | 'amber' | 'red' => {
  if (status === 'ok') return 'green';
  if (status === 'warn') return 'amber';
  return 'red';
};

const InfoRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div className="grid grid-cols-1 gap-1 border-b border-[var(--sa-border)] px-4 py-3 last:border-0 sm:grid-cols-[220px_1fr]">
    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--sa-muted)]">{label}</div>
    <div className="min-w-0 break-words text-sm font-medium text-[var(--sa-text)]">{value || 'N/A'}</div>
  </div>
);

const SectionPanel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <SuperAdminPanel className="overflow-hidden">
    <div className="border-b border-[var(--sa-border)] px-4 py-3">
      <h2 className="text-sm font-semibold text-[var(--sa-text)]">{title}</h2>
    </div>
    <div>{children}</div>
  </SuperAdminPanel>
);

export default function DeploymentDiagnosticsPage() {
  const { t } = useTranslation('common');
  const [diagnostics, setDiagnostics] = useState<DeploymentDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);

  const frontendInfo = useMemo(() => ({
    host: typeof window !== 'undefined' ? window.location.host : null,
    href: typeof window !== 'undefined' ? window.location.href : null,
    apiBaseUrl: env.apiBaseUrl,
    firebaseProjectId: env.firebase.projectId,
    firebaseAuthDomain: env.firebase.authDomain,
    mode: import.meta.env.MODE,
    prod: import.meta.env.PROD,
    build: __BUILD_INFO__,
  }), []);

  const loadDiagnostics = async (notify = false) => {
    setLoading(true);
    try {
      const data = await superAdminApi.getDeploymentDiagnostics();
      setDiagnostics(data);
      if (notify) {
        toast.success(t('superAdmin.deploymentDiagnostics.refreshSuccess'));
      }
    } catch (error) {
      if (notify) {
        toast.error(t('superAdmin.deploymentDiagnostics.refreshError'));
      }
      console.error('Failed to load deployment diagnostics', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiagnostics(false);
  }, []);

  const generatedAt = diagnostics?.generatedAt
    ? new Date(diagnostics.generatedAt).toLocaleString()
    : null;

  return (
    <SuperAdminPage>
      <SuperAdminHeader
        title={t('superAdmin.deploymentDiagnostics.title')}
        description={t('superAdmin.deploymentDiagnostics.subtitle')}
        meta={t('superAdmin.deploymentDiagnostics.meta')}
        actions={
          <Button variant="ghost" size="sm" onClick={() => loadDiagnostics(true)} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            {loading
              ? t('superAdmin.deploymentDiagnostics.refreshing')
              : t('superAdmin.deploymentDiagnostics.refresh')}
          </Button>
        }
      />

      {loading && !diagnostics && (
        <SuperAdminLoading label={t('superAdmin.deploymentDiagnostics.loading')} />
      )}

      {diagnostics && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SuperAdminStatCard
              label={t('superAdmin.deploymentDiagnostics.cards.overall')}
              value={<SuperAdminBadge tone={statusTone(diagnostics.overallStatus)}>{diagnostics.overallStatus.toUpperCase()}</SuperAdminBadge>}
              helper={generatedAt}
              icon={MonitorCheck}
            />
            <SuperAdminStatCard
              label={t('superAdmin.deploymentDiagnostics.cards.database')}
              value={diagnostics.database.type}
              helper={diagnostics.database.connection.toUpperCase()}
              icon={Database}
            />
            <SuperAdminStatCard
              label={t('superAdmin.deploymentDiagnostics.cards.backend')}
              value={diagnostics.backend.service}
              helper={diagnostics.backend.revision || diagnostics.backend.nodeEnv}
              icon={Server}
            />
            <SuperAdminStatCard
              label={t('superAdmin.deploymentDiagnostics.cards.auth')}
              value={diagnostics.auth.provider}
              helper={diagnostics.auth.connection.toUpperCase()}
              icon={KeyRound}
            />
            <SuperAdminStatCard
              label={t('superAdmin.deploymentDiagnostics.cards.firebase')}
              value={diagnostics.firebase.projectId}
              helper={`${diagnostics.firebase.adminApps} Admin app(s)`}
              icon={Flame}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionPanel title={t('superAdmin.deploymentDiagnostics.sections.healthChecks')}>
              {diagnostics.checks.map((check) => (
                <div key={check.label} className="border-b border-[var(--sa-border)] px-4 py-3 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-[var(--sa-text)]">{check.label}</div>
                    <SuperAdminBadge tone={statusTone(check.status)}>{check.status.toUpperCase()}</SuperAdminBadge>
                  </div>
                  <div className="mt-1 text-sm text-[var(--sa-muted)]">{check.detail}</div>
                  {check.latencyMs !== undefined && (
                    <div className="mt-1 text-xs text-[var(--sa-muted)]">{check.latencyMs} ms</div>
                  )}
                </div>
              ))}
            </SectionPanel>

            <SectionPanel title={t('superAdmin.deploymentDiagnostics.sections.frontend')}>
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.frontendHost')} value={frontendInfo.host} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.apiBaseUrl')} value={frontendInfo.apiBaseUrl} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.frontendFirebaseProject')} value={frontendInfo.firebaseProjectId} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.authDomain')} value={frontendInfo.firebaseAuthDomain} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.buildMode')} value={frontendInfo.mode} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.buildTime')} value={frontendInfo.build.buildTime} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.commit')} value={frontendInfo.build.commitShortSha || frontendInfo.build.commitSha} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.branch')} value={frontendInfo.build.branch} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.vercelEnv')} value={frontendInfo.build.vercel.env} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.vercelUrl')} value={frontendInfo.build.vercel.url} />
            </SectionPanel>

            <SectionPanel title={t('superAdmin.deploymentDiagnostics.sections.backend')}>
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.service')} value={diagnostics.backend.service} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.revision')} value={diagnostics.backend.revision} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.region')} value={diagnostics.backend.region} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.nodeEnv')} value={diagnostics.backend.nodeEnv} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.nodeVersion')} value={diagnostics.backend.nodeVersion} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.uptime')} value={`${diagnostics.backend.uptimeSeconds}s`} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.memory')} value={`${diagnostics.backend.memoryMb.heapUsed}/${diagnostics.backend.memoryMb.heapTotal} MB heap`} />
            </SectionPanel>

            <SectionPanel title={t('superAdmin.deploymentDiagnostics.sections.firebaseAuthDb')}>
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.dbType')} value={diagnostics.database.type} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.dbConnection')} value={diagnostics.database.connection.toUpperCase()} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.authProvider')} value={diagnostics.auth.provider} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.superAdminGuard')} value={diagnostics.auth.superAdminGuard ? t('superAdmin.deploymentDiagnostics.values.yes') : t('superAdmin.deploymentDiagnostics.values.no')} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.firebaseProject')} value={diagnostics.firebase.projectId} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.firestoreEmulator')} value={diagnostics.firebase.firestoreEmulator ? t('superAdmin.deploymentDiagnostics.values.yes') : t('superAdmin.deploymentDiagnostics.values.no')} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.authEmulator')} value={diagnostics.firebase.authEmulator ? t('superAdmin.deploymentDiagnostics.values.yes') : t('superAdmin.deploymentDiagnostics.values.no')} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.storageBucket')} value={diagnostics.firebase.storageBucketConfigured ? t('superAdmin.deploymentDiagnostics.values.configured') : t('superAdmin.deploymentDiagnostics.values.notConfigured')} />
              <InfoRow label={t('superAdmin.deploymentDiagnostics.fields.databaseUrl')} value={diagnostics.firebase.databaseUrlConfigured ? t('superAdmin.deploymentDiagnostics.values.configured') : t('superAdmin.deploymentDiagnostics.values.notConfigured')} />
            </SectionPanel>
          </div>

          <SuperAdminPanel className="p-4">
            <div className="flex items-start gap-3 text-sm text-[var(--sa-muted)]">
              <Activity className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t('superAdmin.deploymentDiagnostics.safeInfoNote')}</p>
            </div>
          </SuperAdminPanel>
        </>
      )}

      {!loading && !diagnostics && (
        <SuperAdminPanel>
          <SuperAdminEmptyState
            title={t('superAdmin.deploymentDiagnostics.emptyTitle')}
            description={t('superAdmin.deploymentDiagnostics.emptyDescription')}
          />
        </SuperAdminPanel>
      )}
    </SuperAdminPage>
  );
}
