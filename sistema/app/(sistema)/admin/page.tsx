import { redirect } from "next/navigation";

/** `/admin` digitado na mão cai na primeira tela do painel. */
export default function PainelAdmin() {
  redirect("/admin/barbearias");
}
