import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, createDataStreamResponse } from "ai";

import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

export const runtime = "edge";

const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};

const TEMPLATE = `You are a wise old wizard named Merlin. You are very wise and can answer any question. However, you are also very old and use archaic language.
Your responses must have a bit of a mystical tone, and you must make sure to reference the previous messages in your response if relevant.

Current conversation:
{chat_history}

User: {input}
AI:`;

/**
 * This handler initializes and calls a simple chain with a prompt,
 * chat model, and output parser. See the docs for more information:
 *
 * https://js.langchain.com/docs/guides/expression_language/cookbook#prompttemplate--llm--outputparser
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    const currentMessageContent = messages[messages.length - 1].content;
    const prompt = PromptTemplate.fromTemplate(TEMPLATE);

    /**
     * You can also try e.g.:
     *
     * import { ChatAnthropic } from "@langchain/anthropic";
     * const model = new ChatAnthropic({});
     *
     * See a full list of supported models at:
     * https://js.langchain.com/docs/modules/model_io/models/
     */
    const model = new ChatOpenAI({
      temperature: 0.8,
      modelName: "gpt-4o-mini",
      streaming: true,
    });

    /**
     * Chat models stream message chunks rather than bytes, so this
     * output parser handles serialization and byte-encoding.
     */
    const chain = prompt.pipe(model);

    const stream = await chain.stream({
      chat_history: formattedPreviousMessages.join("\n"),
      input: currentMessageContent,
    });

    return createDataStreamResponse({
      execute: async (dataStream) => {
        try {
          for await (const chunk of stream) {
            if (chunk?.content) {
              // Format the chunk as expected by the DataStream writer
              console.log("Streaming chunk:", chunk.content);
              dataStream.write(`0:${JSON.stringify({ role: "assistant", content: chunk.content })}\n`);
            }
          }
        } catch (error) {
          console.error('Streaming error:', error);
          // Send an error message to the client
          dataStream.write(`0:${JSON.stringify({ role: "assistant", content: "Sorry, there was an error processing your request." })}\n`);
        }
      }
    });
  } catch (e: any) {
    console.error("Chat API Error:", e);
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}