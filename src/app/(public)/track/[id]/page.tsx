import { redirect } from "next/navigation";

export default async function DynamicTrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/track?id=${encodeURIComponent(id)}`);
}
