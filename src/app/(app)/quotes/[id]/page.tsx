import { QuoteDetail } from "@/modules/quotes/quote-detail";

export default async function Page(props: PageProps<"/quotes/[id]">) {
  const { id } = await props.params;
  return <QuoteDetail id={id} />;
}
