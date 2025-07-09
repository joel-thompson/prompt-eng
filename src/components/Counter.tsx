"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xl">Count: {count}</p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setCount((prev) => Math.max(0, prev - 1))}
        >
          Decrement
        </Button>
        <Button onClick={() => setCount((prev) => prev + 1)}>Increment</Button>
      </div>
    </div>
  );
}
