import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function PublicExamplePage() {
  return (
    <div className="container flex flex-col gap-5 p-5">
      <h1 className="text-2xl font-bold">Public Example Page</h1>
      <p>This page is accessible to everyone, whether signed in or not.</p>
      
      <SignedOut>
        <div className="p-4 border rounded bg-yellow-50">
          <p className="mb-2">You are currently not signed in.</p>
          <Link 
            href="/sign-in" 
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Sign In
          </Link>
        </div>
      </SignedOut>
      
      <SignedIn>
        <div className="p-4 border rounded bg-green-50">
          <p>You are signed in! You can access both public and authenticated content.</p>
          <div className="mt-4">
            <Link 
              href="/signed-in-example" 
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Go to Authenticated Example
            </Link>
          </div>
        </div>
      </SignedIn>
    </div>
  );
}
