import { QuotePortal } from "@/modules/quotes/quote-portal";

export default async function Page(props: PageProps<"/q/[token]">) {
  const { token } = await props.params;
  return <QuotePortal token={token} />;
}
