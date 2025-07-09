import React from "react";
import { Counter } from "@/components/Counter";
import { SignedIn } from "@clerk/nextjs";
import { SignedOut } from "@clerk/nextjs";
import { ServerActionExample } from "@/components/ServerActionExample";
import { Posts } from "@/components/Posts";

// this page has a mix of examples using the features in this template

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-3xl font-bold">Hello World</h1>
      <SignedOut>You are not signed in</SignedOut>
      <SignedIn>You are signed in</SignedIn>
      <Counter />
      <ServerActionExample />
      <Posts />
    </div>
  );
}
