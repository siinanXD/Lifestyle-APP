import { demoClient, type Anfrage } from "./client";
import { fuehreAbfrage, fuehreRpc } from "./db";

export const fuehreAus = (anfrage: Anfrage) => ("rpc" in anfrage ? fuehreRpc(anfrage.rpc) : fuehreAbfrage(anfrage.tabelle, anfrage.ops));
export const demoServerClient = () => demoClient(async (anfrage) => fuehreAus(anfrage));
