import React, { createRef } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollArea } from "./scroll-area";

describe("ScrollArea", () => {
  it("applies viewportStyle to the scrollable viewport", () => {
    const viewportRef = createRef<HTMLDivElement>();

    render(
      <ScrollArea viewportRef={viewportRef} viewportStyle={{ overflowAnchor: "none" }}>
        <div style={{ height: 200 }}>Content</div>
      </ScrollArea>
    );

    expect(viewportRef.current).not.toBeNull();
    expect(viewportRef.current?.style.overflowAnchor).toBe("none");
  });
});
