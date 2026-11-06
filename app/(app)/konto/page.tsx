import Link from "next/link";
import { DeleteAccount } from "./delete-account";

export default function AccountPage() {
  return (
    <main className="page stack" data-narrow>
      <h1>Konto</h1>
      <a href="/passwort-neu" className="link">
        Passwort ändern
      </a>
      <section className="danger-zone stack">
        <h2>Konto löschen</h2>
        <p>
          Entfernt alle deine Daten aus der Lifestyle App. Dein Login bleibt bestehen, falls du ihn in einer anderen App nutzt.
        </p>
        <DeleteAccount />
      </section>
      <Link href="/" className="link">
        Zurück
      </Link>
    </main>
  );
}
