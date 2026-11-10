import { redirect } from "next/navigation";

// Now a tab on the Reports page
export default function Redirect() {
  redirect("/reports?tab=merchants");
}
