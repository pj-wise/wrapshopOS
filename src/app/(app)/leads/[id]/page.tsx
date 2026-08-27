import { LeadDetail } from "@/modules/crm/lead-detail";

export default async function Page(props: PageProps<"/leads/[id]">) {
  const { id } = await props.params;
  return <LeadDetail id={id} />;
}
