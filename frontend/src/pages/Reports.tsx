import { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import RevenueChart from '../components/dashboard/RevenueChart';
import TopServicesChart from '../components/dashboard/TopServicesChart';
import { api } from '../api/client';
import type { RevenueTrendPoint, TopService } from '../types';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [dailyRevenue, setDailyRevenue] = useState(0);
  const [weeklyRevenue, setWeeklyRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendPoint[]>([]);
  const [topServices, setTopServices] = useState<TopService[]>([]);
  const [ordersToday, setOrdersToday] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.reports.revenue('daily'),
      api.reports.revenue('weekly'),
      api.reports.revenue('monthly'),
      api.reports.revenueTrend(30),
      api.reports.topServices(15),
      api.reports.ordersToday(),
    ])
      .then(([daily, weekly, monthly, trend, top, orders]) => {
        setDailyRevenue(daily.revenue);
        setWeeklyRevenue(weekly.revenue);
        setMonthlyRevenue(monthly.revenue);
        setRevenueTrend(trend);
        setTopServices(top);
        setOrdersToday(orders.count);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <Header title="Reports" />
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
      <Header title="Reports" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 border-l-4 border-l-red-600 p-5 shadow-xl">
            <p className="text-sm text-red-200/90 mb-1 font-medium">Today&apos;s Revenue</p>
            <p className="text-2xl font-bold text-white">
              Rs.{parseFloat(String(dailyRevenue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-red-300/70 mt-1">Daily income</p>
          </div>
          <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 border-l-4 border-l-red-500 p-5 shadow-xl">
            <p className="text-sm text-red-200/90 mb-1 font-medium">Weekly Revenue</p>
            <p className="text-2xl font-bold text-white">
              Rs.{parseFloat(String(weeklyRevenue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-red-300/70 mt-1">Last 7 days</p>
          </div>
          <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 border-l-4 border-l-red-600 p-5 shadow-xl">
            <p className="text-sm text-red-200/90 mb-1 font-medium">Monthly Revenue</p>
            <p className="text-2xl font-bold text-white">
              Rs.{parseFloat(String(monthlyRevenue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-red-300/70 mt-1">This month</p>
          </div>
          <div className="bg-black/90 backdrop-blur-sm rounded-xl border border-red-950/60 border-l-4 border-l-red-700 p-5 shadow-xl">
            <p className="text-sm text-red-200/90 mb-1 font-medium">Orders Today</p>
            <p className="text-2xl font-bold text-white">{ordersToday}</p>
            <p className="text-xs text-red-300/70 mt-1">Bills created today</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RevenueChart data={revenueTrend} />
          <TopServicesChart data={topServices} />
        </div>
      </div>
    </>
  );
}
