import { redirect } from "next/navigation";

// Depositing collateral is step 1 of the guided Borrow flow. The standalone
// /deposit route is kept only as a stable redirect so old links don't 404.
export default function DepositPage() {
  redirect("/borrow");
}
