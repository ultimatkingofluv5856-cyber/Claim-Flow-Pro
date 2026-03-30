import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardChartData, getDashboardSummary, getManagerAssignedUsersWithBalances } from '@/lib/claims-api';
import {
  BadgeCheck,
  ChartPie,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  WalletCards,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import RupeeIcon from '@/components/icons/RupeeIcon';

type IconComponent = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;

interface DashboardSummary {
  role: string;
  totalClaims?: number;
  totalUsers?: number;
  totalAmount?: number;
  pendingClaims?: number;
  pendingManagerClaims?: number;
  pendingAdminClaims?: number;
  myClaims?: number;
  myAmount?: number;
  myBalance?: number;
}

interface MonthlyChartItem {
  month: string;
  withBill: number;
  withoutBill: number;
  total: number;
  count: number;
}

interface PieChartItem {
  name: string;
  value: number;
}

interface DashboardChartData {
  monthly: MonthlyChartItem[];
  byCategory: PieChartItem[];
  byStatus: PieChartItem[];
}

interface ManagerAssignedUser {
  name: string;
  email: string;
  balance: number;
  lastTransactionDate: string | null;
}

interface MetricCardProps {
  icon: IconComponent;
  label: string;
  value: string | number;
  subtitle: string;
  accentClass?: string;
}

const COLORS = ['#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

const STATUS_COLORS: Record<string, string> = {
  Approved: '#22c55e',
  Rejected: '#ef4444',
  'Pending Manager Approval': '#f59e0b',
  'Pending Admin Approval': '#0ea5e9',
};

function formatCurrency(num: number) {
  return `Rs. ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompactCurrency(num: number) {
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
}

function formatLastUpdated(date: Date) {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MetricCard({ icon: Icon, label, value, subtitle, accentClass = 'text-primary' }: MetricCardProps) {
  return (
    <div className="metric-card py-4">
      <div className="relative z-10 flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted ${accentClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold tracking-tight sm:text-2xl ${accentClass}`}>{value}</p>
          <p className="text-xs leading-5 text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function DashboardHero({
  data,
  isUserRole,
  isManager,
  onRefresh,
  lastUpdated,
}: {
  data: DashboardSummary | null;
  isUserRole: boolean;
  isManager: boolean;
  onRefresh: () => void;
  lastUpdated: Date | null;
}) {
  const statPills = isUserRole
    ? [
        { label: 'Claims filed', value: data?.myClaims ?? 0 },
        { label: 'Claimed', value: formatCurrency(data?.myAmount ?? 0) },
        { label: 'Available balance', value: formatCurrency(data?.myBalance ?? 0) },
      ]
    : [
        { label: 'System claims', value: data?.totalClaims ?? 0 },
        { label: 'Pending reviews', value: data?.pendingClaims ?? 0 },
        { label: isManager ? 'Assigned approvals' : 'Registered users', value: isManager ? (data?.pendingManagerClaims ?? 0) : (data?.totalUsers ?? 0) },
      ];

  return (
    <section className="page-hero !p-4 sm:!p-5 lg:!p-6">
      <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Claims command center
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isUserRole ? 'Track claims and balance quickly.' : 'Monitor approvals and claim movement from one screen.'}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              {isUserRole
                ? 'The most important numbers stay visible together: claims filed, claimed amount, and current balance.'
                : 'A denser overview of claim volume, pending work, and team activity without wasting screen space.'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {statPills.map((item) => (
              <div key={item.label} className="rounded-xl border border-border/70 bg-card/88 px-3 py-2.5 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-base font-semibold text-foreground sm:text-lg">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-border/70 bg-card/85 p-4 shadow-sm sm:grid-cols-[1fr_auto] xl:min-w-[320px] xl:grid-cols-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Dashboard sync</p>
              <p className="text-xs leading-5 text-muted-foreground">
                {lastUpdated ? `Updated on ${formatLastUpdated(lastUpdated)}` : 'Ready to fetch latest data'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} className="rounded-xl px-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh now
          </Button>
        </div>
      </div>
    </section>
  );
}

function ManagerAssignedUsersTable({ managerUsers }: { managerUsers: ManagerAssignedUser[] }) {
  if (managerUsers.length === 0) return null;

  return (
    <section className="panel-card">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Users className="h-5 w-5 text-primary" />
            Assigned employees
          </h3>
          <p className="text-sm text-muted-foreground">Current balances and recent activity for employees mapped to this manager.</p>
        </div>
        <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {managerUsers.length} employee{managerUsers.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Employee</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Current balance</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Last transaction</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70 bg-card/90">
            {managerUsers.map((employee) => (
              <tr key={employee.email} className="transition-colors hover:bg-muted/20">
                <td className="px-4 py-4">
                  <div>
                    <p className="font-semibold text-foreground">{employee.name}</p>
                    <p className="text-xs text-muted-foreground">{employee.email}</p>
                  </div>
                </td>
                <td className="px-4 py-4 text-right font-semibold text-primary">{formatCurrency(employee.balance)}</td>
                <td className="px-4 py-4 text-right text-muted-foreground">
                  {employee.lastTransactionDate ? new Date(employee.lastTransactionDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No transactions yet'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UserDashboard({ data }: { data: DashboardSummary | null }) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <MetricCard
        icon={FileText}
        label="My claims"
        value={data?.myClaims ?? 0}
        subtitle="All claim submissions created by you so far."
        accentClass="text-primary"
      />
      <MetricCard
        icon={WalletCards}
        label="Claimed amount"
        value={formatCurrency(data?.myAmount ?? 0)}
        subtitle="Cumulative value of all submitted claims."
        accentClass="text-success"
      />
      <MetricCard
        icon={RupeeIcon}
        label="Available balance"
        value={formatCurrency(data?.myBalance ?? 0)}
        subtitle="Balance remaining before your next request."
        accentClass="text-info"
      />
    </section>
  );
}

function AdminDashboard({
  data,
  isManager,
  managerUsers,
}: {
  data: DashboardSummary | null;
  isManager: boolean;
  managerUsers: ManagerAssignedUser[];
}) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={FileText}
          label="Total claims"
          value={data?.totalClaims ?? 0}
          subtitle="Overall claims currently recorded in the system."
        />
        <MetricCard
          icon={Users}
          label="Registered users"
          value={data?.totalUsers ?? 0}
          subtitle="People with access to the claims workflow."
          accentClass="text-info"
        />
        <MetricCard
          icon={RupeeIcon}
          label="Claimed value"
          value={formatCurrency(data?.totalAmount ?? 0)}
          subtitle="Total amount represented across claims."
          accentClass="text-success"
        />
        <MetricCard
          icon={BadgeCheck}
          label="Pending claims"
          value={data?.pendingClaims ?? 0}
          subtitle="Claims still waiting somewhere in the approval chain."
          accentClass="text-warning"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel-card flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warning/10 text-warning">
            <UserCheck className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Pending manager approvals</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">{data?.pendingManagerClaims ?? 0}</p>
            <p className="text-sm leading-6 text-muted-foreground">Claims that still need managerial review before progressing.</p>
          </div>
        </div>

        <div className="panel-card flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Pending admin approvals</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">{data?.pendingAdminClaims ?? 0}</p>
            <p className="text-sm leading-6 text-muted-foreground">Claims waiting on admin verification or downstream action.</p>
          </div>
        </div>
      </section>

      {isManager ? <ManagerAssignedUsersTable managerUsers={managerUsers} /> : null}
    </div>
  );
}

function EmptyChartState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 text-center">
      <ChartPie className="mb-3 h-10 w-10 text-muted-foreground/70" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function ChartsSection({ chartData, data }: { chartData: DashboardChartData; data: DashboardSummary | null }) {
  const totalStatusCount = useMemo(
    () => chartData.byStatus.reduce((sum, item) => sum + item.value, 0),
    [chartData.byStatus],
  );
  const totalCategoryAmount = useMemo(
    () => chartData.byCategory.reduce((sum, item) => sum + item.value, 0),
    [chartData.byCategory],
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold tracking-tight text-foreground">Trends and distribution</h3>
        <p className="text-sm text-muted-foreground">
          Monthly movement, category mix, and status distribution based on the current data in the claims system.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.8fr]">
        <div className="panel-card">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h4 className="text-lg font-semibold text-foreground">Monthly claims trend</h4>
              <p className="text-sm text-muted-foreground">With-bill and without-bill amounts across the last six months.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-2 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total value</p>
              <p className="text-lg font-semibold text-foreground">{formatCompactCurrency(data?.totalAmount ?? 0)}</p>
            </div>
          </div>

          {chartData.monthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData.monthly} barGap={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => `Rs.${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(14, 165, 233, 0.06)' }}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '16px',
                    color: 'hsl(var(--foreground))',
                    boxShadow: '0 20px 40px -28px rgba(15, 23, 42, 0.55)',
                  }}
                  formatter={(value: number, name: string) => [`Rs. ${value.toLocaleString('en-IN')}`, name]}
                />
                <Legend />
                <Bar dataKey="withBill" name="With Bill" fill="#0ea5e9" radius={[10, 10, 0, 0]} maxBarSize={36} />
                <Bar dataKey="withoutBill" name="Without Bill" fill="#22c55e" radius={[10, 10, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartState
              title="No trend data yet"
              description="Monthly charts will appear once claims start flowing into the system."
            />
          )}
        </div>

        <div className="panel-card">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h4 className="text-lg font-semibold text-foreground">Claims by status</h4>
              <p className="text-sm text-muted-foreground">Distribution of claim states in the current dataset.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-2 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tracked claims</p>
              <p className="text-lg font-semibold text-foreground">{totalStatusCount}</p>
            </div>
          </div>

          {chartData.byStatus.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(230px,0.8fr)]">
              <ResponsiveContainer width="100%" height={280}>
                <RechartsPieChart>
                  <Pie
                    data={chartData.byStatus}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="76%"
                    innerRadius="58%"
                    paddingAngle={2}
                    label={false}
                    labelLine={false}
                  >
                    {chartData.byStatus.map((entry, index) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '16px',
                      color: 'hsl(var(--foreground))',
                      boxShadow: '0 20px 40px -28px rgba(15, 23, 42, 0.55)',
                    }}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>

              <div className="space-y-2">
                {chartData.byStatus.map((entry, index) => {
                  const percent = totalStatusCount > 0 ? (entry.value / totalStatusCount) * 100 : 0;
                  return (
                    <div key={entry.name} className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.name] || COLORS[index % COLORS.length] }} />
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium leading-5 text-foreground">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">{percent.toFixed(0)}% of tracked claims</p>
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-foreground">{entry.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyChartState
              title="No status distribution yet"
              description="Once claims are submitted and processed, this chart will show the overall status split."
            />
          )}
        </div>
      </div>

      <div className="panel-card">
        <div className="mb-5">
          <h4 className="text-lg font-semibold text-foreground">Spend by category</h4>
          <p className="text-sm text-muted-foreground">Top categories contributing to overall claim value.</p>
        </div>

        {chartData.byCategory.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={chartData.byCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  label={false}
                  labelLine={false}
                >
                  {chartData.byCategory.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '16px',
                    color: 'hsl(var(--foreground))',
                    boxShadow: '0 20px 40px -28px rgba(15, 23, 42, 0.55)',
                  }}
                  formatter={(value: number) => [`Rs. ${value.toLocaleString('en-IN')}`, 'Amount']}
                />
              </RechartsPieChart>
            </ResponsiveContainer>

            <div className="space-y-3">
              {chartData.byCategory.map((entry, index) => (
                <div key={entry.name} className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <div className="min-w-0">
                      <p className="break-words font-medium leading-5 text-foreground">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {totalCategoryAmount > 0 ? `${((entry.value / totalCategoryAmount) * 100).toFixed(0)}% of visible spend` : 'Claim value contribution'}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 font-semibold text-foreground">{formatCurrency(entry.value)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyChartState
            title="No category spend yet"
            description="Category-based spend charts will populate once expense line items are available."
          />
        )}
      </div>
    </section>
  );
}

export default function DashboardView() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [chartData, setChartData] = useState<DashboardChartData | null>(null);
  const [managerUsers, setManagerUsers] = useState<ManagerAssignedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [result, charts] = await Promise.all([
        getDashboardSummary(user.email, user.role) as Promise<DashboardSummary>,
        getDashboardChartData(user.email, user.role) as Promise<DashboardChartData>,
      ]);

      setData(result);
      setChartData(charts);

      if (user.role === 'Manager') {
        const assignedUsers = await getManagerAssignedUsersWithBalances(user.email) as ManagerAssignedUser[];
        setManagerUsers(assignedUsers);
      } else {
        setManagerUsers([]);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadDashboard();
  }, [user]);

  if (loading) {
    return (
      <div className="page-shell animate-pulse">
        <div className="page-hero h-[220px]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-44 rounded-[24px] bg-muted/70" />)}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="h-[360px] rounded-[24px] bg-muted/70" />
          <div className="h-[360px] rounded-[24px] bg-muted/70" />
        </div>
      </div>
    );
  }

  const isUserRole = data?.role === 'User';

  return (
    <div className="page-shell animate-in fade-in slide-in-from-bottom-4 duration-500">
      <DashboardHero
        data={data}
        isUserRole={isUserRole}
        isManager={user?.role === 'Manager'}
        onRefresh={() => void loadDashboard()}
        lastUpdated={lastUpdated}
      />

      {isUserRole ? (
        <UserDashboard data={data} />
      ) : (
        <AdminDashboard data={data} isManager={user?.role === 'Manager'} managerUsers={managerUsers} />
      )}

      {chartData ? <ChartsSection chartData={chartData} data={data} /> : null}
    </div>
  );
}
