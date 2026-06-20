import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock Supabase zodat er geen netwerkoproepen zijn
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    channel: () => ({ on: function(){ return this; }, subscribe: () => ({}) }),
    removeChannel: () => {},
  }),
}));

import App from "./App.jsx";

describe("App smoke tests", () => {
  beforeEach(() => {
    window.localStorage?.clear();
    window.history.replaceState(null, "", "/");
  });

  it("toont LocationPicker op welkomstscherm", async () => {
    render(<App />);
    // LocationPicker rendert knoppen voor locatiekeuze
    const btns = await screen.findAllByRole("button", {}, { timeout: 3000 });
    expect(btns.length).toBeGreaterThan(0);
  });

  it("toont geen blanco root — React mount geslaagd", () => {
    const { container } = render(<App />);
    expect(container.innerHTML.length).toBeGreaterThan(50);
  });
});
