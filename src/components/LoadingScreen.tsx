export function LoadingScreen() {
  return (
    <div role="status" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-950 text-white">
      <div aria-hidden="true" className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      <p>Abriendo DietForge…</p>
    </div>
  );
}
