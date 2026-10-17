import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';

const DEFAULT_SHOP_NAME = 'OLIYARUVI PRINTERS';

interface ShopSettingsContextType {
  shopName: string;
  refreshShopSettings: () => Promise<void>;
}

const ShopSettingsContext = createContext<ShopSettingsContextType>({
  shopName: DEFAULT_SHOP_NAME,
  refreshShopSettings: async () => {},
});

export function ShopSettingsProvider({ children }: { children: ReactNode }) {
  const [shopName, setShopName] = useState(DEFAULT_SHOP_NAME);

  const refreshShopSettings = useCallback(async () => {
    try {
      const s = await api.settings.get();
      const name = (s.shop_name || '').trim() || DEFAULT_SHOP_NAME;
      setShopName(name);
      document.title = `${name} - Billing System`;
    } catch {
      // keep current / default
    }
  }, []);

  useEffect(() => {
    void refreshShopSettings();
  }, [refreshShopSettings]);

  return (
    <ShopSettingsContext.Provider value={{ shopName, refreshShopSettings }}>
      {children}
    </ShopSettingsContext.Provider>
  );
}

export function useShopSettings() {
  return useContext(ShopSettingsContext);
}

export { DEFAULT_SHOP_NAME };
