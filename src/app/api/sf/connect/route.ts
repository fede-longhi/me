import { NextResponse } from "next/server";
import { soapLogin, validateAccessToken } from "@/lib/sf/login";
import { sfConfigError, sfErrorResponse } from "@/lib/sf/api-utils";
import { parseSlot, writeSession } from "@/lib/sf/session";
import type { SfLoginHost } from "@/lib/sf/types";

type ConnectBody =
  | {
      slot: string;
      mode: "password";
      loginHost: SfLoginHost;
      username: string;
      password: string;
      token: string;
    }
  | {
      slot: string;
      mode: "token";
      instanceUrl: string;
      accessToken: string;
    };

function parseLoginHost(value: unknown): SfLoginHost | null {
  return value === "login" || value === "test" ? value : null;
}

export async function POST(req: Request) {
  const configErr = sfConfigError();
  if (configErr) return configErr;

  let body: ConnectBody;
  try {
    body = (await req.json()) as ConnectBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slot = parseSlot(body.slot);
  if (!slot) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  try {
    if (body.mode === "password") {
      const loginHost = parseLoginHost(body.loginHost);
      if (!loginHost) {
        return NextResponse.json({ error: "Invalid loginHost" }, { status: 400 });
      }
      if (!body.username?.trim() || !body.password) {
        return NextResponse.json(
          { error: "Username and password are required" },
          { status: 400 },
        );
      }
      const session = await soapLogin({
        loginHost,
        username: body.username.trim(),
        password: body.password,
        securityToken: body.token ?? "",
      });
      await writeSession(slot, session);
      return NextResponse.json({
        ok: true,
        org: {
          slot,
          instanceUrl: session.instanceUrl,
          username: session.username,
          orgId: session.orgId,
          loginHost: session.loginHost,
          connectedAt: session.connectedAt,
        },
      });
    }

    if (body.mode === "token") {
      if (!body.instanceUrl?.trim() || !body.accessToken?.trim()) {
        return NextResponse.json(
          { error: "Instance URL and access token are required" },
          { status: 400 },
        );
      }
      const session = await validateAccessToken({
        instanceUrl: body.instanceUrl.trim(),
        accessToken: body.accessToken.trim(),
      });
      await writeSession(slot, session);
      return NextResponse.json({
        ok: true,
        org: {
          slot,
          instanceUrl: session.instanceUrl,
          username: session.username,
          orgId: session.orgId,
          loginHost: session.loginHost,
          connectedAt: session.connectedAt,
        },
      });
    }

    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  } catch (err) {
    return sfErrorResponse(err, "Connect failed");
  }
}
