import { useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

export default function PageTransition() {
  const location = useLocation();

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="flex-1 flex flex-col min-h-0"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
