interface ImportMetaEnv {
  readonly VITE_SPONSOR_BANNER_ENABLED?: string;
  readonly VITE_SPONSOR_URL?: string;
  readonly VITE_SPONSOR_LABEL?: string;
  readonly VITE_SPONSOR_COPY?: string;
  readonly VITE_ADSENSE_ENABLED?: string;
  readonly VITE_ADSENSE_PUBLISHER_ID?: string;
  readonly VITE_ADSENSE_SLOT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
