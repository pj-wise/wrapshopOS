import { InvoiceDetail } from "@/modules/billing/invoice-detail";

export default async function Page(props: PageProps<"/invoices/[id]">) {
  const { id } = await props.params;
  return <InvoiceDetail id={id} />;
}
