"use client";

import { useState } from "react";

// SIN-1159: nur Demo für das PR-Video, wird nicht gemerged.
export default function Demo() {
  const [n, setN] = useState(0);
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Demo</h1>
      <button onClick={() => setN(n + 1)}>Wasser getrunken</button>
      <p>Gläser heute: {n}</p>
    </main>
  );
}
