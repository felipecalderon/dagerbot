export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CompletionRequest = {
  system: string;
  history: ConversationMessage[];
  userContent: string;
};

export type LLMProvider = {
  complete(request: CompletionRequest): Promise<string>;
};
