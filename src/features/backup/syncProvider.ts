const GIS_SRC = "https://accounts.google.com/gsi/client";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const BACKUP_FILE_NAME = "ledge-backup.json";
const MIME = "application/json";

const TOKEN_KEY = "ledge:google-token";
const EXPIRES_KEY = "ledge:google-token-expires";

export interface SyncProvider {
  name: string;
  isConfigured(): boolean;
  requestToken(options?: { forcePrompt?: boolean }): Promise<string>;
  backup(data: any): Promise<{ id: string; modifiedTime?: string }>;
  restore(): Promise<any>;
  getBackupInfo(): Promise<{ id: string; modifiedTime?: string } | null>;
  clearAuth(): void;
}

export function getCachedToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiresAt = sessionStorage.getItem(EXPIRES_KEY);
  if (!token || !expiresAt) return null;
  if (Date.now() > Number(expiresAt)) {
    clearCachedToken();
    return null;
  }
  return token;
}

export function setCachedToken(token: string, expiresInSeconds: number = 3600) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRES_KEY, String(Date.now() + expiresInSeconds * 1000));
}

export function clearCachedToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
}

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

type GoogleOauth = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
  }) => TokenClient;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleOauth;
      };
    };
  }
}

export function getGoogleClientId(): string | undefined {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID;
}

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google sign-in script failed to load.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in script failed to load."));
    document.head.appendChild(script);
  });
}

async function driveFetch(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (response.status === 401) {
    clearCachedToken();
    window.dispatchEvent(new CustomEvent("ledge:sync_unauthorized"));
  }

  if (!response.ok) {
    let message = `Google Drive request failed (${response.status}).`;
    try {
      const error = await response.json();
      message = error.error?.message ?? message;
    } catch {
      // Keep status code message
    }
    throw new Error(message);
  }

  return response;
}

async function findBackupFile(token: string): Promise<{ id: string; modifiedTime?: string } | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    fields: "files(id,name,modifiedTime)",
    q: `name='${BACKUP_FILE_NAME}' and trashed=false`,
  });
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`, token);
  const result = (await response.json()) as {
    files?: Array<{ id: string; modifiedTime?: string }>;
  };
  return result.files?.[0] ?? null;
}

async function uploadMultipart(
  url: string,
  token: string,
  metadata: Record<string, unknown>,
  payload: string,
  method: "POST" | "PATCH"
): Promise<{ id: string; modifiedTime?: string }> {
  const boundary = `ledge_${Date.now()}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${MIME}; charset=UTF-8`,
    "",
    payload,
    `--${boundary}--`,
  ].join("\r\n");

  const response = await driveFetch(url, token, {
    method,
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return response.json();
}

export class GoogleDriveSyncProvider implements SyncProvider {
  name = "Google Drive";

  isConfigured(): boolean {
    return Boolean(getGoogleClientId());
  }

  async requestToken(options?: { forcePrompt?: boolean }): Promise<string> {
    const cached = getCachedToken();
    if (cached && !options?.forcePrompt) {
      return cached;
    }

    const clientId = getGoogleClientId();
    if (!clientId) {
      throw new Error("Missing VITE_GOOGLE_CLIENT_ID in your configuration.");
    }

    await loadGoogleIdentityScript();
    const oauth = window.google?.accounts?.oauth2;
    if (!oauth) {
      throw new Error("Google Identity services failed to load. Check ad blockers or connection.");
    }

    return new Promise((resolve, reject) => {
      const client = oauth.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (response) => {
          if (response.access_token) {
            setCachedToken(response.access_token, 3600);
            resolve(response.access_token);
          } else {
            reject(new Error(response.error_description || response.error || "Google authorization failed."));
          }
        },
      });

      client.requestAccessToken(options?.forcePrompt ? { prompt: "consent" } : { prompt: "" });
    });
  }

  async backup(data: any): Promise<{ id: string; modifiedTime?: string }> {
    const token = await this.requestToken();
    const existing = await findBackupFile(token);
    const payload = JSON.stringify(
      {
        app: "ledge",
        version: 2,
        exportedAt: new Date().toISOString(),
        ...data,
      },
      null,
      2
    );

    if (existing?.id) {
      return uploadMultipart(
        `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,modifiedTime`,
        token,
        { name: BACKUP_FILE_NAME },
        payload,
        "PATCH"
      );
    } else {
      return uploadMultipart(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime",
        token,
        { name: BACKUP_FILE_NAME, parents: ["appDataFolder"] },
        payload,
        "POST"
      );
    }
  }

  async restore(): Promise<any> {
    const token = await this.requestToken();
    const existing = await findBackupFile(token);
    if (!existing?.id) {
      throw new Error("No Google Drive backup file found.");
    }

    const response = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`,
      token
    );
    const backup = await response.json();
    if (backup.app !== "ledge") {
      throw new Error("File exists but is not a valid Ledge backup.");
    }
    return backup;
  }

  async getBackupInfo(): Promise<{ id: string; modifiedTime?: string } | null> {
    try {
      const token = await this.requestToken();
      return await findBackupFile(token);
    } catch {
      return null;
    }
  }

  clearAuth(): void {
    clearCachedToken();
  }
}
