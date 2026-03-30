import { useEffect } from 'react';
import { getCompanySettings } from '@/lib/claims-api';

function setFavicon(href: string) {
  let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;

  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }

  favicon.href = href;
}

export default function BrandingSync() {
  useEffect(() => {
    getCompanySettings()
      .then((settings) => {
        const companyName = settings?.company_name || 'ClaimFlow Pro';
        const subtitle = settings?.company_subtitle || 'Claims Management System';
        const logoUrl = settings?.logo_url || '/ipi-logo.jpg';

        document.title = `${companyName} | ${subtitle}`;
        setFavicon(logoUrl);
      })
      .catch(() => {
        document.title = 'ClaimFlow Pro | Claims Management System';
        setFavicon('/ipi-logo.jpg');
      });
  }, []);

  return null;
}
