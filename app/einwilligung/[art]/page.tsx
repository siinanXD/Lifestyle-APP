import { notFound } from "next/navigation";
import { ARTEN, EINWILLIGUNGSTEXTE, type Art } from "../../../lib/consent/texte";
import { ConsentForm } from "./consent-form";

export default async function ConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ art: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { art } = await params;
  const { next } = await searchParams;
  if (!ARTEN.includes(art as Art)) notFound();
  return (
    <main style={{ padding: "2rem", maxWidth: "24rem", margin: "0 auto" }}>
      <h1>{EINWILLIGUNGSTEXTE[art as Art].titel}</h1>
      <ConsentForm art={art as Art} next={next ?? "/"} />
    </main>
  );
}
