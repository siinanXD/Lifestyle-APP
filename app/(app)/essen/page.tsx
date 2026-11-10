import Link from "next/link";

export default function Page() {
  return (
    <main className="page stack">
      <h1>Essen</h1>
      <Link href="/essen/wasser" className="link">
        Wasser
      </Link>
      <p>Mahlzeiten: Bald hier.</p>
    </main>
  );
}
