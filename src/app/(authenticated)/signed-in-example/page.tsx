import { getUserId } from "@/server/server-only/getUserId";
import { auth, clerkClient } from "@clerk/nextjs/server";

export default function Page() {
  return (
    <div className="container flex flex-col gap-5 p-5">
      <SignedInContent />
    </div>
  );
}

const SignedInContent = async () => {
  const user = await auth();
  // We don't need to check for userId here since the layout already ensures authentication
  const clerkClientResult = await clerkClient();
  const fullUserData = await clerkClientResult.users.getUser(user.userId!);

  // Server only function called in a server component
  const userId = await getUserId();

  return (
    <div>
      Some signed in content: {fullUserData.firstName} {fullUserData.lastName}
      <br />
      Server only function: {userId}
    </div>
  );
};
