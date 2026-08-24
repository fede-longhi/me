import {
  SF_API_VERSION,
  type SfQueryResult,
  type SfSessionPayload,
  type SfSObjectSummary,
} from "@/lib/sf/types";

function restBase(session: SfSessionPayload): string {
  return `${session.instanceUrl.replace(/\/+$/, "")}/services/data/v${SF_API_VERSION}`;
}

async function sfFetch(
  session: SfSessionPayload,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${restBase(session)}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.sessionId}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function parseJsonError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as
      | { message?: string; errorCode?: string }[]
      | { message?: string; errorCode?: string };
    if (Array.isArray(data)) {
      return data.map((e) => e.message ?? e.errorCode).filter(Boolean).join("; ");
    }
    return data.message ?? data.errorCode ?? `Request failed (${response.status})`;
  } catch {
    const text = await response.text();
    return text.slice(0, 200) || `Request failed (${response.status})`;
  }
}

export async function listSObjects(
  session: SfSessionPayload,
): Promise<SfSObjectSummary[]> {
  const response = await sfFetch(session, "/sobjects/");
  if (response.status === 401) {
    throw new Error("Session expired — reconnect the org.");
  }
  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }

  const data = (await response.json()) as {
    sobjects?: Array<{
      name: string;
      label: string;
      queryable?: boolean;
      createable?: boolean;
      custom?: boolean;
    }>;
  };

  return (data.sobjects ?? [])
    .filter((obj) => obj.queryable !== false)
    .map((obj) => ({
      name: obj.name,
      label: obj.label,
      queryable: obj.queryable ?? true,
      createable: obj.createable ?? false,
      custom: obj.custom ?? false,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function describeSObject(
  session: SfSessionPayload,
  name: string,
): Promise<unknown> {
  const response = await sfFetch(session, `/sobjects/${encodeURIComponent(name)}/describe`);
  if (response.status === 401) {
    throw new Error("Session expired — reconnect the org.");
  }
  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }
  return response.json();
}

export async function runSoql(
  session: SfSessionPayload,
  soql: string,
): Promise<SfQueryResult> {
  const url = `${restBase(session)}/query?q=${encodeURIComponent(soql)}`;
  const response = await sfFetch(session, url);
  if (response.status === 401) {
    throw new Error("Session expired — reconnect the org.");
  }
  if (!response.ok) {
    throw new Error(await parseJsonError(response));
  }

  const data = (await response.json()) as SfQueryResult & {
    nextRecordsUrl?: string;
  };

  let records = [...(data.records ?? [])];
  let done = data.done;
  let nextUrl = data.nextRecordsUrl;

  while (!done && nextUrl) {
    const nextResponse = await sfFetch(session, nextUrl);
    if (!nextResponse.ok) {
      throw new Error(await parseJsonError(nextResponse));
    }
    const nextData = (await nextResponse.json()) as SfQueryResult & {
      nextRecordsUrl?: string;
    };
    records = records.concat(nextData.records ?? []);
    done = nextData.done;
    nextUrl = nextData.nextRecordsUrl;
  }

  return {
    totalSize: records.length,
    done: true,
    records,
  };
}
