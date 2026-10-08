import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

export default function AuthLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/home-bg.png)',
          filter: 'brightness(1.25)',
        }}
      />
      <AnimatePresence initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-md px-4"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
