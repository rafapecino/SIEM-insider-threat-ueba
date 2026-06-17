import { redirect } from "next/navigation";

// El middleware ya reconduce según rol; esto es un fallback.
export default function Home() {
  redirect("/login");
}
