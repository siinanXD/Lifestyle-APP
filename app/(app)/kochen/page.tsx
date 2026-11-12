import Link from "next/link";

// Übersicht Kochen (SIN-1625). Die Rezeptvorschläge kommen mit SIN-1626 auf diese Seite.
export default function KochenPage() {
  return (
    <main className="page stack" data-narrow>
      <h1>Kochen</h1>
      <p className="muted">Sag der App, welche Geräte du hast und was da ist. Daraus entstehen die Rezeptvorschläge.</p>
      <Link href="/kochen/vorrat" className="btn">
        Mein Vorrat
      </Link>
      <Link href="/kochen/geraete" className="btn" data-variant="neutral">
        Meine Küchengeräte
      </Link>
      <Link href="/essen" className="link">
        Zurück
      </Link>
    </main>
  );
}
