import { Suspense } from "react";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
