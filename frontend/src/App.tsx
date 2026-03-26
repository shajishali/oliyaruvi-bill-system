import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import AuthLayout from './components/auth/AuthLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Forgot from './pages/Forgot';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import StockManagement from './pages/StockManagement';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
        <Route path="/forgot" element={<Forgot />} />
      </Route>
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="billing" element={<Billing />} />
        <Route path="stock" element={<StockManagement />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
