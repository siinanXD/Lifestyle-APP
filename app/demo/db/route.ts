import { NextResponse } from "next/server";
import type { Anfrage } from "../../../lib/demo/client";
import { istDemo } from "../../../lib/demo/modus";
import { fuehreAus } from "../../../lib/demo/server";

// Nur im Demo-Modus vorhanden (SIN-1623): Der Browser-Client schickt seine Abfragen an den Speicher des Servers.
export async function POST(request: Request) {
  if (!istDemo()) return new NextResponse(null, { status: 404 });
  const anfrage = (await request.json().catch(() => null)) as Anfrage | null;
  const gueltig = anfrage && (("rpc" in anfrage && typeof anfrage.rpc === "string") || ("tabelle" in anfrage && typeof anfrage.tabelle === "string" && Array.isArray(anfrage.ops)));
  if (!gueltig) return new NextResponse(null, { status: 400 });
  return NextResponse.json(fuehreAus(anfrage));
}
