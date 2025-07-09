import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Match all routes except static files and api routes that are marked as public
    "/((?!.+\.[\w]+$|_next).*)",
    "/(api|trpc)(.*)",
  ],
};
