import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <p className="not-found__mark">404</p>
      <h1>Document not found</h1>
      <p>The page may have moved, or the address may be incomplete.</p>
      <Link href="/en/overview">Return to the overview</Link>
    </main>
  );
}
