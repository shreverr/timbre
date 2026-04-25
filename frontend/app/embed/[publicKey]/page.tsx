import { EmbedWidget } from "@/components/embed-widget";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ publicKey: string }>;
}) {
  const { publicKey } = await params;
  return <EmbedWidget publicKey={publicKey} />;
}
