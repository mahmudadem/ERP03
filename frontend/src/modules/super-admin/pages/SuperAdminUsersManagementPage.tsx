import { useEffect, useState } from 'react';
import { superAdminApi, SuperAdminUser, SuperAdminCompany } from '../../../api/superAdmin';
import { Button } from '../../../components/ui/Button';
import { Users, Building2, Shield, Crown, Search, Filter, ChevronRight, Mail, Calendar } from 'lucide-react';
import { errorHandler } from '../../../services/errorHandler';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { useTranslation } from 'react-i18next';

interface UserWithCompanies extends SuperAdminUser {
  companies?: SuperAdminCompany[];
  companiesCount?: number;
}

export default function SuperAdminUsersManagementPage() {
  const { t } = useTranslation('common');
  const [users, setUsers] = useState<UserWithCompanies[]>([]);
  const [companies, setCompanies] = useState<SuperAdminCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | 'USER' | 'SUPER_ADMIN'>('ALL');
  const [selectedUser, setSelectedUser] = useState<UserWithCompanies | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, companiesData] = await Promise.all([
        superAdminApi.getAllUsers(),
        superAdminApi.getAllCompanies(),
      ]);

      // Map users with their companies
      const usersWithCompanies: UserWithCompanies[] = usersData.map(user => {
        const userCompanies = companiesData.filter(c => c.ownerUid === user.id);
        return {
          ...user,
          companies: userCompanies,
          companiesCount: userCompanies.length,
        };
      });

      setUsers(usersWithCompanies);
      setCompanies(companiesData);
    } catch (error: any) {
      errorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async (userId: string) => {
    if (!window.confirm(t('superAdmin.usersManagement.confirm.promote'))) return;
    try {
      await superAdminApi.promoteUser(userId);
      errorHandler.showSuccess(t('superAdmin.usersManagement.messages.promoted'));
      loadData();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleDemote = async (userId: string) => {
    if (!window.confirm(t('superAdmin.usersManagement.confirm.demote'))) return;
    try {
      await superAdminApi.demoteUser(userId);
      errorHandler.showSuccess(t('superAdmin.usersManagement.messages.demoted'));
      loadData();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  const handleImpersonate = async (companyId: string) => {
    if (!window.confirm(t('superAdmin.usersManagement.confirm.startImpersonation'))) return;
    try {
      const { impersonationToken } = await superAdminApi.startImpersonation(companyId);
      // Store the impersonation token
      sessionStorage.setItem('impersonationToken', impersonationToken);
      errorHandler.showSuccess(t('superAdmin.usersManagement.messages.impersonationStarted'));
      window.location.reload();
    } catch (error: any) {
      errorHandler.showError(error);
    }
  };

  // Filter users based on search and role filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = filterRole === 'ALL' || user.globalRole === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const statsCards = [
    {
      title: t('superAdmin.usersManagement.stats.totalUsers'),
      value: users.length,
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: t('superAdmin.usersManagement.stats.superAdmins'),
      value: users.filter(u => u.globalRole === 'SUPER_ADMIN').length,
      icon: Crown,
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      title: t('superAdmin.usersManagement.stats.regularUsers'),
      value: users.filter(u => u.globalRole === 'USER').length,
      icon: Shield,
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      title: t('superAdmin.usersManagement.stats.totalCompanies'),
      value: companies.length,
      icon: Building2,
      gradient: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              {t('superAdmin.usersManagement.title')}
            </h1>
            <p className="text-slate-600 mt-1">{t('superAdmin.usersManagement.subtitle')}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={loadData} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
                {t('superAdmin.usersManagement.refreshing')}
              </>
            ) : (
              t('superAdmin.usersManagement.refresh')
            )}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative overflow-hidden group hover:shadow-md transition-all duration-300"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 text-sm font-medium">{stat.title}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder={t('superAdmin.usersManagement.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-500" />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
              >
                <option value="ALL">{t('superAdmin.usersManagement.filters.allRoles')}</option>
                <option value="USER">{t('superAdmin.usersManagement.filters.usersOnly')}</option>
                <option value="SUPER_ADMIN">{t('superAdmin.usersManagement.filters.superAdminsOnly')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loading && users.length === 0 ? (
            <div className="col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <div className="flex items-center justify-center gap-3 text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-500 border-t-transparent" />
                <span className="text-lg">{t('superAdmin.usersManagement.loadingUsers')}</span>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">{t('superAdmin.usersManagement.noUsers')}</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-slate-900 truncate">
                        {user.name || t('superAdmin.usersManagement.unnamedUser')}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      {user.createdAt && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>{t('superAdmin.usersManagement.joinedOn', { date: formatCompanyDate(user.createdAt, null) })}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div>
                    {user.globalRole === 'SUPER_ADMIN' ? (
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        {t('superAdmin.usersManagement.role.superAdmin')}
                      </div>
                    ) : (
                      <div className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {t('superAdmin.usersManagement.role.user')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Companies */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                    <Building2 className="w-4 h-4" />
                    <span>{t('superAdmin.usersManagement.companiesCount', { count: user.companiesCount || 0 })}</span>
                  </div>
                  {user.companies && user.companies.length > 0 ? (
                    <div className="space-y-2">
                      {user.companies.slice(0, 2).map((company) => (
                        <div
                          key={company.id}
                          className="flex items-center justify-between bg-slate-50 rounded-lg p-3 group/company hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm truncate">{company.name}</p>
                            <p className="text-xs text-slate-500 truncate">ID: {company.id}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleImpersonate(company.id)}
                            className="opacity-0 group-hover/company:opacity-100 transition-opacity"
                          >
                            {t('superAdmin.usersManagement.actions.impersonate')}
                          </Button>
                        </div>
                      ))}
                      {user.companies.length > 2 && (
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          {t('superAdmin.usersManagement.actions.viewAllCompanies', { count: user.companies.length })}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">{t('superAdmin.usersManagement.noCompaniesOwned')}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-slate-100">
                  {user.globalRole === 'SUPER_ADMIN' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDemote(user.id)}
                      className="flex-1"
                    >
                      {t('superAdmin.usersManagement.actions.demoteToUser')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handlePromote(user.id)}
                      className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      {t('superAdmin.usersManagement.actions.promoteToSuperAdmin')}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10">
              <h2 className="text-2xl font-bold text-slate-900">
                {t('superAdmin.usersManagement.userCompaniesTitle', { name: selectedUser.name || t('superAdmin.usersManagement.userFallback') })}
              </h2>
              <p className="text-slate-600 text-sm mt-1">{selectedUser.email}</p>
            </div>

            <div className="p-6 space-y-3">
              {selectedUser.companies?.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{company.name}</p>
                    <p className="text-sm text-slate-500 truncate">ID: {company.id}</p>
                    {company.baseCurrency && (
                      <p className="text-xs text-slate-500 mt-1">{t('superAdmin.usersManagement.currencyLabel', { currency: company.baseCurrency })}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      handleImpersonate(company.id);
                      setSelectedUser(null);
                    }}
                  >
                    {t('superAdmin.usersManagement.actions.impersonate')}
                  </Button>
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6">
              <Button
                variant="secondary"
                onClick={() => setSelectedUser(null)}
                className="w-full"
              >
                {t('superAdmin.usersManagement.actions.close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
