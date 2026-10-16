import Link from "next/link";
import { ErrorState } from "@/components/ui/ErrorState";

export default function NotFound() {
  return (
    <ErrorState
      title="Not found"
      message="This field or page does not exist."
      action={
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">
          Back to dashboard
        </Link>
      }
    />
  );
}
