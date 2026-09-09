import Link from "next/link";

export default function NotFound() {
  return <div className="min-h-screen grid place-content-center gap-4 bg-gray-950 text-white p-6">
    <h1 className="text-2xl font-bold">Página no encontrada</h1>
    <p>Revisa la dirección o vuelve al inicio.</p>
    <Link href="/" className="text-brand-400 underline">Volver a DietForge</Link>
  </div>;
}
