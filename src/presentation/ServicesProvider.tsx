import type { ReactNode } from 'react';
import { type AppServices, ServicesContext } from './services';

export function ServicesProvider({
  services,
  children,
}: {
  services: AppServices;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}
