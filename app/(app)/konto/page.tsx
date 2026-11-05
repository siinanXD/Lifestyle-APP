import Link from "next/link";
import { DeleteAccount } from "./delete-account";

export default function AccountPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "24rem", margin: "0 auto", display: "grid", gap: "1rem" }}>
      <h1>Konto</h1>
      <p>
        <a href="/passwort-neu">Passwort ändern</a>
      </p>
      <h2>Konto löschen</h2>
      <p>
        Entfernt alle deine Daten aus der Lifestyle App. Dein Login bleibt bestehen, falls du ihn in einer anderen App nutzt.
      </p>
      <DeleteAccount />
      <p>
        <Link href="/">Zurück</Link>
      </p>
    </main>
  );
}
