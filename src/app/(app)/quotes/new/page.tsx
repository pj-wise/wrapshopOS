import { Suspense } from "react";

import { QuoteBuilder } from "@/modules/quotes/quote-builder";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <QuoteBuilder />
    </Suspense>
  );
}
