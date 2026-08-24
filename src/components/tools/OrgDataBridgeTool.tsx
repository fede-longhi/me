"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { ToolChrome } from "@/components/tools/ToolChrome";
import type { Locale } from "@/lib/types";
import type { SfOrgSummary, SfSObjectSummary } from "@/lib/sf/types";

type AuthMode = "password" | "token";
type Slot = "source" | "target";

const copy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    lead: string;
    source: string;
    target: string;
    credentialsTab: string;
    tokenTab: string;
    loginHost: string;
    prod: string;
    sandbox: string;
    username: string;
    password: string;
    securityToken: string;
    instanceUrl: string;
    accessToken: string;
    connect: string;
    connecting: string;
    disconnect: string;
    connectedAs: string;
    notConnected: string;
    objects: string;
    searchObjects: string;
    soql: string;
    runQuery: string;
    running: string;
    results: string;
    downloadJson: string;
    downloadCsv: string;
    noResults: string;
    selectObject: string;
    safety:
      | string;
    configError: string;
    tokenHint: string;
  }
> = {
  en: {
    eyebrow: "Salesforce",
    title: "Org Data Bridge",
    lead: "Connect two Salesforce orgs, browse objects on the source, run SOQL, and export JSON or CSV. Credentials are used once for login and are not stored.",
    source: "Source org",
    target: "Target org",
    credentialsTab: "Username & password",
    tokenTab: "Paste token",
    loginHost: "Login host",
    prod: "Production",
    sandbox: "Sandbox",
    username: "Username",
    password: "Password",
    securityToken: "Security token",
    instanceUrl: "Instance URL",
    accessToken: "Access token",
    connect: "Connect",
    connecting: "Connecting…",
    disconnect: "Disconnect",
    connectedAs: "Connected",
    notConnected: "Not connected",
    objects: "Objects",
    searchObjects: "Search objects…",
    soql: "SOQL",
    runQuery: "Run query",
    running: "Running…",
    results: "Results",
    downloadJson: "Download JSON",
    downloadCsv: "Download CSV",
    noResults: "Run a query to see records.",
    selectObject: "Select an object to prefill SOQL.",
    safety:
      "Prefer sandboxes. Password and token are sent to this server only to obtain a session — they are not saved. Session cookies expire after 2 hours.",
    configError:
      "Server is missing SF_SESSION_ENCRYPT_KEY. Add it to .env.local and restart.",
    tokenHint: "From sf org display --json: instanceUrl + accessToken.",
  },
  es: {
    eyebrow: "Salesforce",
    title: "Org Data Bridge",
    lead: "Conectá dos orgs de Salesforce, explorá objetos en el source, ejecutá SOQL y exportá JSON o CSV. Las credenciales se usan una vez para login y no se guardan.",
    source: "Org origen",
    target: "Org destino",
    credentialsTab: "Usuario y contraseña",
    tokenTab: "Pegar token",
    loginHost: "Host de login",
    prod: "Producción",
    sandbox: "Sandbox",
    username: "Usuario",
    password: "Contraseña",
    securityToken: "Security token",
    instanceUrl: "Instance URL",
    accessToken: "Access token",
    connect: "Conectar",
    connecting: "Conectando…",
    disconnect: "Desconectar",
    connectedAs: "Conectado",
    notConnected: "Sin conexión",
    objects: "Objetos",
    searchObjects: "Buscar objetos…",
    soql: "SOQL",
    runQuery: "Ejecutar query",
    running: "Ejecutando…",
    results: "Resultados",
    downloadJson: "Descargar JSON",
    downloadCsv: "Descargar CSV",
    noResults: "Ejecutá una query para ver registros.",
    selectObject: "Elegí un objeto para prellenar el SOQL.",
    safety:
      "Preferí sandboxes. Usuario y token se envían al server solo para obtener sesión — no se guardan. Las cookies expiran a las 2 horas.",
    configError:
      "Falta SF_SESSION_ENCRYPT_KEY en el server. Agregalo en .env.local y reiniciá.",
    tokenHint: "Desde sf org display --json: instanceUrl + accessToken.",
  },
};

function stripAttributes(record: Record<string, unknown>) {
  const { attributes: _a, ...rest } = record;
  return rest;
}

function recordsToCsv(records: Record<string, unknown>[]): string {
  if (records.length === 0) return "";
  const rows = records.map((r) => stripAttributes(r));
  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row))),
  ).sort();
  const escape = (value: unknown) => {
    if (value == null) return "";
    const text =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const header = columns.map(escape).join(",");
  const body = rows
    .map((row) => columns.map((col) => escape(row[col])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ConnectFormProps = {
  slot: Slot;
  label: string;
  org: SfOrgSummary | undefined;
  t: (typeof copy)[Locale];
  onConnected: () => void;
};

function ConnectForm({ slot, label, org, t, onConnected }: ConnectFormProps) {
  const [mode, setMode] = useState<AuthMode>("password");
  const [loginHost, setLoginHost] = useState<"login" | "test">("test");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const body =
        mode === "password"
          ? { slot, mode, loginHost, username, password, token }
          : { slot, mode, instanceUrl, accessToken };
      const res = await fetch("/api/sf/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Connect failed");
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sf/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Disconnect failed");
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-2 w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue";

  return (
    <div className="space-y-4 border border-line bg-surface/50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-green">
          {label}
        </h2>
        {org ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="text-xs font-semibold text-blue-deep hover:text-blue disabled:opacity-50"
          >
            {t.disconnect}
          </button>
        ) : null}
      </div>

      {org ? (
        <div className="rounded border border-line bg-white/60 p-3 text-sm text-ink">
          <p className="font-semibold">{t.connectedAs}</p>
          <p className="mt-1 break-all text-ink-muted">{org.username ?? org.instanceUrl}</p>
          <p className="mt-1 break-all text-xs text-ink-muted">{org.instanceUrl}</p>
          {org.orgId ? (
            <p className="mt-1 text-xs text-ink-muted">Org {org.orgId}</p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`px-3 py-1.5 text-xs font-bold ${mode === "password" ? "bg-blue-deep text-white" : "border border-line bg-white/70 text-ink"}`}
            >
              {t.credentialsTab}
            </button>
            <button
              type="button"
              onClick={() => setMode("token")}
              className={`px-3 py-1.5 text-xs font-bold ${mode === "token" ? "bg-blue-deep text-white" : "border border-line bg-white/70 text-ink"}`}
            >
              {t.tokenTab}
            </button>
          </div>

          {mode === "password" ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.loginHost}
                </span>
                <select
                  value={loginHost}
                  onChange={(e) =>
                    setLoginHost(e.target.value as "login" | "test")
                  }
                  className={inputClass}
                >
                  <option value="test">{t.sandbox}</option>
                  <option value="login">{t.prod}</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.username}
                </span>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.password}
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.securityToken}
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-ink-muted">{t.tokenHint}</p>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.instanceUrl}
                </span>
                <input
                  type="url"
                  value={instanceUrl}
                  onChange={(e) => setInstanceUrl(e.target.value)}
                  placeholder="https://yourorg.my.salesforce.com"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
                  {t.accessToken}
                </span>
                <textarea
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="bg-blue-deep px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t.connecting : t.connect}
          </button>
        </>
      )}

      {error ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function OrgDataBridgeTool() {
  const { locale } = useLanguage();
  const t = copy[locale];

  const [orgs, setOrgs] = useState<SfOrgSummary[]>([]);
  const [configError, setConfigError] = useState(false);
  const [objects, setObjects] = useState<SfSObjectSummary[]>([]);
  const [objectFilter, setObjectFilter] = useState("");
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [soql, setSoql] = useState("SELECT Id FROM Account LIMIT 200");
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [queryBusy, setQueryBusy] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sourceOrg = orgs.find((o) => o.slot === "source");
  const targetOrg = orgs.find((o) => o.slot === "target");

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sf/session");
      if (res.status === 503) {
        setConfigError(true);
        return;
      }
      const data = (await res.json()) as { orgs?: SfOrgSummary[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Session load failed");
      setOrgs(data.orgs ?? []);
      setConfigError(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Session load failed");
    }
  }, []);

  const loadObjects = useCallback(async () => {
    if (!sourceOrg) {
      setObjects([]);
      return;
    }
    try {
      const res = await fetch("/api/sf/objects?slot=source");
      const data = (await res.json()) as {
        objects?: SfSObjectSummary[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load objects");
      setObjects(data.objects ?? []);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load objects");
      setObjects([]);
    }
  }, [sourceOrg]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    void loadObjects();
  }, [loadObjects]);

  const filteredObjects = useMemo(() => {
    const q = objectFilter.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter(
      (obj) =>
        obj.name.toLowerCase().includes(q) ||
        obj.label.toLowerCase().includes(q),
    );
  }, [objects, objectFilter]);

  function pickObject(name: string) {
    setSelectedObject(name);
    setSoql(`SELECT Id FROM ${name} LIMIT 200`);
  }

  async function runQuery() {
    if (!sourceOrg) return;
    setQueryBusy(true);
    setQueryError(null);
    try {
      const res = await fetch("/api/sf/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: "source", soql }),
      });
      const data = (await res.json()) as {
        records?: Record<string, unknown>[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Query failed");
      setRecords(data.records ?? []);
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : "Query failed");
      setRecords([]);
    } finally {
      setQueryBusy(false);
    }
  }

  function downloadJson() {
    const clean = records.map((r) => stripAttributes(r));
    downloadText(
      JSON.stringify(clean, null, 2),
      `${selectedObject ?? "export"}.json`,
      "application/json",
    );
  }

  function downloadCsv() {
    downloadText(
      recordsToCsv(records),
      `${selectedObject ?? "export"}.csv`,
      "text/csv",
    );
  }

  const previewColumns = useMemo(() => {
    if (records.length === 0) return [] as string[];
    const first = stripAttributes(records[0]!);
    return Object.keys(first).slice(0, 6);
  }, [records]);

  return (
    <ToolChrome eyebrow={t.eyebrow} title={t.title} lead={t.lead} wide>
      <p className="mb-6 text-sm leading-relaxed text-ink-muted">{t.safety}</p>

      {configError ? (
        <p className="mb-6 text-sm font-medium text-red-700" role="alert">
          {t.configError}
        </p>
      ) : null}

      {loadError ? (
        <p className="mb-6 text-sm font-medium text-red-700" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ConnectForm
          slot="source"
          label={t.source}
          org={sourceOrg}
          t={t}
          onConnected={() => void refreshSession()}
        />
        <ConnectForm
          slot="target"
          label={t.target}
          org={targetOrg}
          t={t}
          onConnected={() => void refreshSession()}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-4 border border-line bg-surface/50 p-4 sm:p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-green">
            {t.objects}
          </h2>
          {!sourceOrg ? (
            <p className="text-sm text-ink-muted">{t.notConnected}</p>
          ) : (
            <>
              <input
                type="search"
                value={objectFilter}
                onChange={(e) => setObjectFilter(e.target.value)}
                placeholder={t.searchObjects}
                className="w-full border border-line bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-blue"
              />
              <p className="text-xs text-ink-muted">{t.selectObject}</p>
              <ul className="max-h-80 overflow-y-auto border border-line bg-white/60">
                {filteredObjects.slice(0, 200).map((obj) => (
                  <li key={obj.name}>
                    <button
                      type="button"
                      onClick={() => pickObject(obj.name)}
                      className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface/80 ${selectedObject === obj.name ? "bg-blue-deep/10 font-semibold text-blue-deep" : "text-ink"}`}
                    >
                      {obj.label}
                      <span className="ml-2 text-xs text-ink-muted">{obj.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="space-y-4 border border-line bg-surface/50 p-4 sm:p-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-green">
              {t.soql}
            </span>
            <textarea
              value={soql}
              onChange={(e) => setSoql(e.target.value)}
              rows={5}
              disabled={!sourceOrg}
              className="mt-2 w-full border border-line bg-white/70 px-3 py-2 font-mono text-sm text-ink outline-none focus:border-blue disabled:opacity-50"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runQuery}
              disabled={!sourceOrg || queryBusy}
              className="bg-blue-deep px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              {queryBusy ? t.running : t.runQuery}
            </button>
            <button
              type="button"
              onClick={downloadJson}
              disabled={records.length === 0}
              className="border border-line bg-white/70 px-4 py-2.5 text-sm font-bold text-ink transition hover:border-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.downloadJson}
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={records.length === 0}
              className="border border-line bg-white/70 px-4 py-2.5 text-sm font-bold text-ink transition hover:border-blue disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.downloadCsv}
            </button>
          </div>

          {queryError ? (
            <p className="text-sm font-medium text-red-700" role="alert">
              {queryError}
            </p>
          ) : null}

          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-green">
              {t.results}
              {records.length > 0 ? ` (${records.length})` : ""}
            </h2>
            {records.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">{t.noResults}</p>
            ) : (
              <div className="mt-3 overflow-x-auto border border-line bg-white/60">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-line bg-surface/60">
                    <tr>
                      {previewColumns.map((col) => (
                        <th key={col} className="px-3 py-2 font-semibold text-ink">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 50).map((record, idx) => {
                      const row = stripAttributes(record);
                      return (
                        <tr key={idx} className="border-b border-line/60">
                          {previewColumns.map((col) => (
                            <td key={col} className="max-w-[12rem] truncate px-3 py-2 text-ink-muted">
                              {row[col] == null ? "" : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {records.length > 50 ? (
                  <p className="px-3 py-2 text-xs text-ink-muted">
                    … {records.length - 50} more rows in export
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolChrome>
  );
}
