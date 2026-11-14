import { actualizarConAviso } from "@/lib/ux-feedback";
import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { datosSchema, type DatosDolibarr } from "@/lib/dolibarr-model";
import { Button } from "@/components/ui/button";

const Contexto = createContext<{
  datos: DatosDolibarr;
  actualizar: () => void;
  actualizarConMensaje: () => void;
  actualizando: boolean;
} | null>(null);
export function ProveedorDolibarr({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ["dolibarr", "snapshot"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/dolibarr", { signal, cache: "no-store" });
      if (!response.ok)
        throw new Error("No se pudo consultar Dolibarr. Comprueba que MySQL esté encendido.");
      return datosSchema.parse(await response.json());
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
  if (!query.data)
    return (
      <main
        className="grid min-h-screen place-content-center gap-4 p-8 text-center"
        aria-live="polite"
      >
        <h1 className="text-2xl font-bold">Bimbo · Dolibarr</h1>
        <p>
          {query.isError
            ? "No se pudo conectar con Dolibarr. Comprueba que MySQL esté encendido."
            : "Consultando productos, facturas y pedidos…"}
        </p>
        {query.isError && (
          <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
            Reintentar
          </Button>
        )}
      </main>
    );
  return (
    <Contexto.Provider
      value={{
        datos: query.data,
        actualizar: () => {
          void query.refetch();
        },
        actualizarConMensaje: () => {
          void actualizarConAviso(() => query.refetch());
        },
        actualizando: query.isFetching,
      }}
    >
      {query.isError && (
        <div role="alert" className="bg-amber-100 px-6 py-3 text-sm text-amber-950">
          No se pudo actualizar. Estás viendo la última consulta correcta.{" "}
          <button className="underline" onClick={() => void query.refetch()}>
            Reintentar
          </button>
        </div>
      )}
      {children}
    </Contexto.Provider>
  );
}
export function useDolibarr() {
  const value = useContext(Contexto);
  if (!value) throw new Error("ProveedorDolibarr requerido");
  return value;
}
