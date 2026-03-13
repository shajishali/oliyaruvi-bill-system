import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import RevenueCards from '../components/dashboard/RevenueCards';
import RevenueChart from '../components/dashboard/RevenueChart';
import TopServicesChart from '../components/dashboard/TopServicesChart';
import RecentOrders from '../components/dashboard/RecentOrders';
import LowStockAlerts from '../components/stock/LowStockAlerts';
import NotificationsPanel from '../components/dashboard/NotificationsPanel';
import { api } from '../api/client';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [weeklyRevenue, setWeeklyRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [topServices, setTopServices] = useState([]);
  const [ordersToday, setOrdersToday] = useState(0);
  const [recentBills, setRecentBills] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.reports.revenue('daily'),
      api.reports.revenue('weekly'),
      api.reports.revenue('monthly'),
      api.reports.revenueTrend(30),
      api.reports.topServices(10),
      api.reports.ordersToday(),
      api.bills.list(),
      api.reports.lowStock(),
    ])
      .then(([daily, weekly, monthly, trend, top, orders, bills, low]) => {
        setDailyRevenue(daily.revenue);
        setWeeklyRevenue(weekly.revenue);
        setMonthlyRevenue(monthly.revenue);
        setRevenueTrend(trend);
        setTopServices(top);
        setOrdersToday(orders.count);
        setRecentBills(bills.slice(0, 8));
        setLowStock(low);
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
            <div className="animate-pulse text-gray-400">Loading...</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">
        <LowStockAlerts items={lowStock} />

        <RevenueCards
          daily={dailyRevenue}
          weekly={weeklyRevenue}
          monthly={monthlyRevenue}
          ordersToday={ordersToday}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart data={revenueTrend} />
          <TopServicesChart data={topServices} />
        </div>

        <RecentOrders bills={recentBills} />

        <NotificationsPanel />
      </div>
    </>
  );
}
