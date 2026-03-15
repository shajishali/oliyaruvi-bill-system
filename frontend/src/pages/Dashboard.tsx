import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import RevenueCards from '../components/dashboard/RevenueCards';
import RevenueChart from '../components/dashboard/RevenueChart';
import TopServicesChart from '../components/dashboard/TopServicesChart';
import RecentOrders from '../components/dashboard/RecentOrders';
import { api } from '../api/client';
import type { Bill, RevenueTrendPoint, TopService } from '../types';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [weeklyRevenue, setWeeklyRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [actualReceivedToday, setActualReceivedToday] = useState<number | undefined>(undefined);
  const [actualByCash, setActualByCash] = useState<number | undefined>(undefined);
  const [actualByBank, setActualByBank] = useState<number | undefined>(undefined);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendPoint[]>([]);
  const [topServices, setTopServices] = useState<TopService[]>([]);
  const [ordersToday, setOrdersToday] = useState(0);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.reports.revenue('daily'),
      api.reports.revenue('weekly'),
      api.reports.revenue('monthly'),
      api.reports.actualReceivedToday(),
      api.reports.revenueTrend(30),
      api.reports.topServices(10),
      api.reports.ordersToday(),
      api.bills.list(),
    ])
      .then(([daily, weekly, monthly, actual, trend, top, orders, bills]) => {
        setDailyRevenue(daily.revenue);
        setWeeklyRevenue(weekly.revenue);
        setMonthlyRevenue(monthly.revenue);
        setActualReceivedToday(actual.total);
        setActualByCash(actual.byCash);
        setActualByBank(actual.byBank);
        setRevenueTrend(trend);
        setTopServices(top);
        setOrdersToday(orders.count);
        setRecentBills(bills.slice(0, 8));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <Header title="Dashboard" />
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-red-300/70">Loading...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">
        <RevenueCards
          daily={dailyRevenue}
          weekly={weeklyRevenue}
          monthly={monthlyRevenue}
          ordersToday={ordersToday}
          actualReceivedToday={actualReceivedToday}
          actualByCash={actualByCash}
          actualByBank={actualByBank}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart data={revenueTrend} />
          <TopServicesChart data={topServices} />
        </div>

        <RecentOrders bills={recentBills} />
      </div>
    </>
  );
}
