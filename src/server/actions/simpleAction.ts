"use server";

/**
 * Server Actions allow you to run async server functions directly from your components.
 * They provide a secure way to mutate data or perform server operations without
 * creating API endpoints. The "use server" directive at the top of this file
 * marks all exports as server actions.
 *
 * @example
 * // In a client component:
 * import { simpleAction } from "~/server/actions/simpleAction";
 *
 * // Using with onClick
 * const handleClick = async () => {
 *   const result = await simpleAction("Hello from client component");
 *   console.log(result);
 *   // Handle result...
 * };
 *
 * return (
 *   <button onClick={handleClick}>Process Data</button>
 * );
 */
export async function simpleAction(input: string): Promise<{
  success: boolean;
  message: string;
  timestamp?: string;
}> {
  // Simple validation
  if (!input.trim()) {
    return {
      success: false,
      message: "Input cannot be empty",
    };
  }

  // Process data (this is just a mock response)
  return {
    success: true,
    message: `Processed: ${input}`,
    timestamp: new Date().toISOString(),
  };
}
