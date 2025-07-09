import "server-only";

import { auth } from "@clerk/nextjs/server";

/**
 * Server-Only modules prevent client-side usage of server-side code.
 * The "server-only" package ensures this file can only be imported by server components
 * or other server-only modules. This helps prevent exposing sensitive
 * server-side logic or credentials to the client.
 *
 * @example
 * // In a server component or server action:
 * import { getUserId } from "~/server/serverOnlyExample";
 *
 * // Get the authenticated user's ID
 * const userId = await getUserId();
 * console.log(userId);
 */
export async function getUserId(): Promise<string> {
  const user = await auth();

  if (!user?.userId) {
    throw new Error("User not authenticated");
  }

  return user.userId;
}
