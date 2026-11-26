import Navegacion from "@/components/Navegacion";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col md:h-svh md:flex-row md:overflow-hidden">
      <Navegacion />
      <main className="min-w-0 flex-1 md:overflow-y-auto">{children}</main>
    </div>
  );
}
