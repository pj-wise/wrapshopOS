import { JobDetail } from "@/modules/production/job-detail";

export default async function Page(props: PageProps<"/jobs/[id]">) {
  const { id } = await props.params;
  return <JobDetail id={id} />;
}
