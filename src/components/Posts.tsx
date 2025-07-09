"use client";

import { useQuery } from "@tanstack/react-query";

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

async function fetchPosts(): Promise<Post[]> {
  const response = await fetch("https://jsonplaceholder.typicode.com/posts");
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  return response.json();
}

export function Posts() {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
    // Optional: refetch every 30 seconds
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">Loading posts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Error: {error instanceof Error ? error.message : "Something went wrong"}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-2xl font-bold">Posts</h2>
        {isFetching && (
          <span className="text-sm text-gray-500 animate-pulse">
            Updating...
          </span>
        )}
      </div>
      <div className="grid gap-4">
        {data?.slice(0, 5).map((post) => (
          <div
            key={post.id}
            className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
            <p className="text-gray-600 text-sm">{post.body}</p>
            <p className="text-xs text-gray-400 mt-2">User ID: {post.userId}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
