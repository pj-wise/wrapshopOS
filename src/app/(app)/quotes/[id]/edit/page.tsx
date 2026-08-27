import { QuoteBuilder } from "@/modules/quotes/quote-builder";

export default async function Page(props: PageProps<"/quotes/[id]/edit">) {
  const { id } = await props.params;
  return <QuoteBuilder editingQuoteId={id} />;
}
