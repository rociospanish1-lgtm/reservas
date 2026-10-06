import { redirect } from "next/navigation";

export default async function InicioClinica({ params }: PageProps<"/clinica/[slug]">) {
  const { slug } = await params;
  redirect(`/clinica/${slug}/agenda`);
}
