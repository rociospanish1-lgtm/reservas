import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-xl font-semibold">No encontrado</h1>
      <p className="mt-2 text-sm text-stone-600">
        Esta página no existe o no tienes acceso a ella.
      </p>
      <Link href="/" className="boton-secundario mt-6">
        Volver al inicio
      </Link>
    </div>
  );
}
