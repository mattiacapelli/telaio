import { redirect } from "next/navigation";

/** Il configuratore rapido è stato assorbito dall'editor del preventivo: stesso flusso, un solo posto. */
export default async function ConfiguratorePage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente } = await searchParams;
  redirect(
    cliente ? `/preventivi/nuovo?cliente=${encodeURIComponent(cliente)}` : "/preventivi/nuovo",
  );
}
