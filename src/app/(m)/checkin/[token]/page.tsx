import { MobileCheckInView } from "@/modules/production/mobile-check-in-view";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <MobileCheckInView token={token} />;
}
