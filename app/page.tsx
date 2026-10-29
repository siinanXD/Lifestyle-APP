export default function Page() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Lifestyle App</h1>
      <p>Dein ruhiger Lifestyle-Coach. Bald hier.</p>
      <p>
        <a href="/konto">Konto</a>
      </p>
      <form action="/auth/logout" method="post">
        <button type="submit" style={{ padding: "0.75rem", fontSize: "1rem" }}>
          Abmelden
        </button>
      </form>
    </main>
  );
}
