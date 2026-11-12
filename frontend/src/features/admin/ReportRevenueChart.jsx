import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompactMoney, formatReportMoney, selectRevenueChartRows } from './reportUtils';

function RevenueTooltip({ active, payload }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <div role="status" className="max-w-64 rounded-xl border border-surfaceBorder bg-surface p-3 text-sm shadow-xl">
    <p className="break-words font-medium text-white">{row.fullLabel}</p>
    <p className="mt-2 font-semibold tabular-nums text-white">{formatReportMoney(row.value)}</p>
  </div>;
}

export default function ReportRevenueChart({ rows, groupBy }) {
  const chartRows = selectRevenueChartRows(rows);
  if (!chartRows.length) return null;
  return <figure aria-labelledby="admin-revenue-chart-title" aria-describedby="admin-revenue-chart-help" className="min-w-0 rounded-2xl border border-surfaceBorder bg-surface/30 p-4 sm:p-5">
    <figcaption id="admin-revenue-chart-title" className="mb-2 text-sm font-semibold text-white">Doanh thu theo {groupBy === 'cinema' ? 'rạp' : 'phim'}</figcaption>
    <p className="mb-4 text-xs leading-relaxed text-muted">{rows.length > 10 ? '10 nhóm doanh thu cao nhất; bảng bên dưới có đủ nhóm.' : 'Đơn vị trục ngang: VND. Mỗi thanh là một nhóm.'}</p>
    <div className="min-w-0" style={{ height: Math.max(220, chartRows.length * 46 + 40) }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={chartRows} layout="vertical" margin={{ top: 8, right: 16, bottom: 4, left: 0 }} accessibilityLayer>
          <CartesianGrid horizontal={false} stroke="var(--report-chart-grid)" strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={formatCompactMoney} tick={{ fill: 'var(--report-chart-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="axisLabel" width={140} tick={{ fill: 'var(--report-chart-text)', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <Bar dataKey="value" name="Doanh thu" fill="var(--report-chart-bar)" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
          <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'var(--report-chart-cursor)' }} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <p id="admin-revenue-chart-help" className="mt-3 text-xs leading-relaxed text-muted">Dùng Tab và phím mũi tên để xem giá trị. Bảng bên dưới có tên đầy đủ, số đơn và số vé.</p>
  </figure>;
}
