export default function Page() {
  return (
    <main className="page">
      <h1>Lifestyle App</h1>
      <p>Dein ruhiger Lifestyle-Coach. Bald hier.</p>
      <form action="/auth/logout" method="post">
        <button type="submit" className="btn" data-variant="neutral">
          Abmelden
        </button>
      </form>
    </main>
  );
}
