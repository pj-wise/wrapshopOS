import { CustomerDetail } from "@/modules/crm/customer-detail";

export default async function Page(props: PageProps<"/customers/[id]">) {
  const { id } = await props.params;
  return <CustomerDetail id={id} />;
}
