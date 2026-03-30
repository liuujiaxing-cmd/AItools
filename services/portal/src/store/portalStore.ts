import { create } from "zustand";

type PortalConfig = {
  gatewayBaseUrl: string;
  runtimeBaseUrl: string;
  registryBaseUrl: string;
  bearerToken: string;
};

const STORAGE_KEY = "toolset.portal.config.v1";

function normalizeBaseUrl(v: string) {
  const s = v.trim();
  if (!s) return s;
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

function readConfigFromStorage(): Partial<PortalConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PortalConfig>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function writeConfigToStorage(cfg: PortalConfig) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    return;
  }
}

const defaults: PortalConfig = {
  gatewayBaseUrl: normalizeBaseUrl(import.meta.env.VITE_GATEWAY_BASE_URL ?? "http://localhost:8080"),
  runtimeBaseUrl: normalizeBaseUrl(import.meta.env.VITE_RUNTIME_BASE_URL ?? "http://localhost:8081"),
  registryBaseUrl: normalizeBaseUrl(import.meta.env.VITE_REGISTRY_BASE_URL ?? "http://localhost:8082"),
  bearerToken: ""
};

const stored = readConfigFromStorage();
const initial: PortalConfig = {
  gatewayBaseUrl: normalizeBaseUrl(stored.gatewayBaseUrl ?? defaults.gatewayBaseUrl),
  runtimeBaseUrl: normalizeBaseUrl(stored.runtimeBaseUrl ?? defaults.runtimeBaseUrl),
  registryBaseUrl: normalizeBaseUrl(stored.registryBaseUrl ?? defaults.registryBaseUrl),
  bearerToken: String(stored.bearerToken ?? defaults.bearerToken)
};

type PortalStore = PortalConfig & {
  setGatewayBaseUrl: (v: string) => void;
  setRuntimeBaseUrl: (v: string) => void;
  setRegistryBaseUrl: (v: string) => void;
  setBearerToken: (v: string) => void;
  clearBearerToken: () => void;
};

export const usePortalStore = create<PortalStore>((set, get) => ({
  ...initial,
  setGatewayBaseUrl: (v) => {
    const next = { ...get(), gatewayBaseUrl: normalizeBaseUrl(v) };
    writeConfigToStorage(next);
    set({ gatewayBaseUrl: next.gatewayBaseUrl });
  },
  setRuntimeBaseUrl: (v) => {
    const next = { ...get(), runtimeBaseUrl: normalizeBaseUrl(v) };
    writeConfigToStorage(next);
    set({ runtimeBaseUrl: next.runtimeBaseUrl });
  },
  setRegistryBaseUrl: (v) => {
    const next = { ...get(), registryBaseUrl: normalizeBaseUrl(v) };
    writeConfigToStorage(next);
    set({ registryBaseUrl: next.registryBaseUrl });
  },
  setBearerToken: (v) => {
    const next = { ...get(), bearerToken: v.trim() };
    writeConfigToStorage(next);
    set({ bearerToken: next.bearerToken });
  },
  clearBearerToken: () => {
    const next = { ...get(), bearerToken: "" };
    writeConfigToStorage(next);
    set({ bearerToken: "" });
  }
}));

