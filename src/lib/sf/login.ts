import { SF_API_VERSION, type SfLoginHost, type SfSessionPayload } from "@/lib/sf/types";

const LOGIN_HOSTS: Record<SfLoginHost, string> = {
  login: "https://login.salesforce.com",
  test: "https://test.salesforce.com",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function readXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`);
  const match = xml.match(re);
  return match?.[1] ?? null;
}

function readSoapFault(xml: string): string | null {
  const faultString = readXmlTag(xml, "faultstring");
  if (faultString) return faultString;
  const message = readXmlTag(xml, "message");
  return message;
}

function normalizeInstanceUrl(serverUrl: string): string {
  const url = new URL(serverUrl);
  return `${url.protocol}//${url.host}`;
}

export async function soapLogin(options: {
  loginHost: SfLoginHost;
  username: string;
  password: string;
  securityToken: string;
}): Promise<SfSessionPayload> {
  const base = LOGIN_HOSTS[options.loginHost];
  const endpoint = `${base}/services/Soap/u/${SF_API_VERSION}`;
  const password = `${options.password}${options.securityToken}`;

  const body = `<?xml version="1.0" encoding="utf-8"?>
<env:Envelope xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Body>
    <n1:login xmlns:n1="urn:partner.soap.sforce.com">
      <n1:username>${escapeXml(options.username)}</n1:username>
      <n1:password>${escapeXml(password)}</n1:password>
    </n1:login>
  </env:Body>
</env:Envelope>`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=UTF-8",
      SOAPAction: '""',
    },
    body,
  });

  const xml = await response.text();
  if (!response.ok) {
    const fault = readSoapFault(xml);
    throw new Error(fault ?? `Login failed (${response.status})`);
  }

  const sessionId = readXmlTag(xml, "sessionId");
  const serverUrl = readXmlTag(xml, "serverUrl");
  const userId = readXmlTag(xml, "userId");
  const orgId = readXmlTag(xml, "organizationId");

  if (!sessionId || !serverUrl) {
    const fault = readSoapFault(xml);
    throw new Error(fault ?? "Login response missing sessionId or serverUrl");
  }

  return {
    instanceUrl: normalizeInstanceUrl(serverUrl),
    sessionId,
    username: options.username,
    userId: userId ?? undefined,
    orgId: orgId ?? undefined,
    loginHost: options.loginHost,
    connectedAt: Date.now(),
  };
}

export async function validateAccessToken(options: {
  instanceUrl: string;
  accessToken: string;
}): Promise<SfSessionPayload> {
  const instanceUrl = options.instanceUrl.replace(/\/+$/, "");
  const url = `${instanceUrl}/services/data/v${SF_API_VERSION}/`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text.slice(0, 200) || `Token validation failed (${response.status})`,
    );
  }

  const data = (await response.json()) as {
    identity?: string;
  };

  let username: string | undefined;
  let userId: string | undefined;
  let orgId: string | undefined;

  if (data.identity) {
    try {
      const identityUrl = data.identity.startsWith("http")
        ? data.identity
        : `${instanceUrl}${data.identity}`;
      const identityRes = await fetch(identityUrl, {
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          Accept: "application/json",
        },
      });
      if (identityRes.ok) {
        const identity = (await identityRes.json()) as {
          username?: string;
          user_id?: string;
          organization_id?: string;
        };
        username = identity.username;
        userId = identity.user_id;
        orgId = identity.organization_id;
      }
    } catch {
      // identity is optional
    }
  }

  const loginHost: SfLoginHost = instanceUrl.includes("test.salesforce.com")
    ? "test"
    : "login";

  return {
    instanceUrl,
    sessionId: options.accessToken,
    username,
    userId,
    orgId,
    loginHost,
    connectedAt: Date.now(),
  };
}
