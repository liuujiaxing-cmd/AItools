import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SchemaForm from "@/components/SchemaForm";

const schema = {
  type: "object",
  properties: {
    text: { type: "string", title: "Text" },
    count: { type: "integer", title: "Count" },
    flag: { type: "boolean", title: "Flag" }
  },
  required: ["text"]
};

function Wrapper() {
  const [value, setValue] = useState<Record<string, unknown>>({});
  return (
    <div>
      <SchemaForm schema={schema} value={value} onChange={setValue} />
      <pre data-testid="value">{JSON.stringify(value)}</pre>
    </div>
  );
}

describe("SchemaForm", () => {
  it("updates values from form inputs", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const textInput = screen.getByRole("textbox", { name: "Text" });
    await user.type(textInput, "hello");
    expect(screen.getByTestId("value").textContent).toContain('"text":"hello"');

    const numberInput = screen.getByRole("spinbutton", { name: "Count" });
    await user.clear(numberInput);
    await user.type(numberInput, "12");
    expect(screen.getByTestId("value").textContent).toContain('"count":12');

    const checkbox = screen.getByRole("checkbox", { name: "flag" });
    await user.click(checkbox);
    expect(screen.getByTestId("value").textContent).toContain('"flag":true');
  });
});

