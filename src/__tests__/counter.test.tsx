import { expect, test } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Counter } from "@/components/Counter";

test("Counter component", () => {
  render(<Counter />);

  // Check initial state
  expect(screen.getByText("Count: 0")).toBeDefined();

  // Test increment
  const incrementButton = screen.getByText("Increment");
  fireEvent.click(incrementButton);
  expect(screen.getByText("Count: 1")).toBeDefined();

  // Test increment again
  fireEvent.click(incrementButton);
  expect(screen.getByText("Count: 2")).toBeDefined();

  // Test decrement
  const decrementButton = screen.getByText("Decrement");
  fireEvent.click(decrementButton);
  expect(screen.getByText("Count: 1")).toBeDefined();

  // Test that count doesn't go below 0
  fireEvent.click(decrementButton);
  fireEvent.click(decrementButton);
  expect(screen.getByText("Count: 0")).toBeDefined();
});
