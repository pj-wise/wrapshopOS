import { VehicleDetail } from "@/modules/crm/vehicle-detail";

export default async function Page(props: PageProps<"/vehicles/[id]">) {
  const { id } = await props.params;
  return <VehicleDetail id={id} />;
}
