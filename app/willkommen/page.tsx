export default function WillkommenPage() {
  return (
    <main className="page stack">
      <div>
        <h1>Lifestyle App</h1>
        <p>Dein ruhiger Lifestyle-Coach.</p>
      </div>
      <ul>
        <li>Training, das zu deinem Alltag passt</li>
        <li>Ernährung, Schlaf und Gewohnheiten im Blick</li>
        <li>Fortschritt ohne Druck</li>
      </ul>
      <p className="card">Geschlossene Beta: Funktionen kommen Schritt für Schritt.</p>
      <div className="stack">
        <a href="/registrieren" className="btn">
          Konto anlegen
        </a>
        <a href="/login" className="btn" data-variant="neutral">
          Anmelden
        </a>
      </div>
    </main>
  );
}
