export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export const PLAYGROUND_URL = `${API_BASE_URL}/api/playground`;
export const HEALTH_URL = `${API_BASE_URL}/api/health`;

export const MODEL_NAME = "openai/gpt-oss-120b";

// Keep in sync with the backend's MAX_PROMPT_LENGTH / MAX_SYSTEM_PROMPT_LENGTH.
export const MAX_PROMPT_LENGTH = 8000;
export const MAX_SYSTEM_PROMPT_LENGTH = 4000;

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant.

Follow these guidelines:
1. Use clear Markdown headings and subheadings.
2. Write short paragraphs and use lists where appropriate.
3. Format code using fenced Markdown code blocks with language identifiers.
4. Use tables for comparisons when helpful.
5. Highlight important terms using bold text.
6. Be concise but explain concepts clearly.
7. Include practical examples when useful.
8. Avoid unnecessary repetition.
9. Use beginner-friendly language.`;

export const EXAMPLE_PROMPTS = [
  "Explain React hooks with a practical example.",
  "Compare REST and GraphQL in a table.",
  "Write a SQL query to find the top 5 customers by revenue.",
  "What is rate limiting and why do APIs need it?",
];
