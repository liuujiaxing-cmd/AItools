export const tool = {
  metadata() {
    return {
      name: "echo",
      version: "1.0.0",
      description: "Echo input text",
      input_schema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"]
      },
      output_schema: { type: "object", properties: { text: { type: "string" } } },
      tags: ["demo"]
    };
  },
  async invoke(input) {
    return { text: String(input.text ?? "") };
  }
};

