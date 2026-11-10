import { redirect } from "next/navigation";

// Subscriptions now live on the Recurring page
export default function SubscriptionsRedirect() {
  redirect("/recurring?tab=subscriptions");
}
