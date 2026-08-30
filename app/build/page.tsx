import { redirect } from "next/navigation";

/**
 * The builder used to live here. It is a view on `/` now, but the portfolio
 * site links to /build, so the URL is kept and forwarded rather than removed.
 */
export default function BuildPage() {
  redirect("/?tab=builder");
}
