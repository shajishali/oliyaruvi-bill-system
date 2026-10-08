import { useEffect, useState } from 'react';
import { shopLogoUrl } from '../api/client';

const FALLBACK = `${import.meta.env.BASE_URL}logo.jpeg`;

export default function ShopLogo({ className }: { className?: string }) {
  const [version, setVersion] = useState(() => localStorage.getItem('shop-logo-v') || '0');
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    const onUpdate = () => {
      setUseFallback(false);
      setVersion(localStorage.getItem('shop-logo-v') || String(Date.now()));
    };
    window.addEventListener('shop-logo-updated', onUpdate);
    return () => window.removeEventListener('shop-logo-updated', onUpdate);
  }, []);

  return (
    <img
      src={useFallback ? FALLBACK : shopLogoUrl(version)}
      alt="Shop logo"
      className={className}
      onError={() => setUseFallback(true)}
    />
  );
}
