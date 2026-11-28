import Navegacion from "@/components/Navegacion";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <Navegacion />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
