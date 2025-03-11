import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, createDataStreamResponse } from "ai";

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const runtime = "edge";

const OpenWeatherAPI = tool(async ({ location }: { location: string }) => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENWEATHER_API_KEY is not set");
  }
  console.log(location);
  const result = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}`);
  const data = await result.json();
  console.log(data);
  return data;
}, {
  name: "OpenWeatherAPI",
  description: "Get the weather for a location",
  schema: z.object({
    location: z.string().describe("The location to get the weather for"),
  }),
});

const NewsAPI = tool(async ({ query }: { query: string }) => {
  const apiKey = process.env.NEWSAPI_API_KEY;
  if (!apiKey) {
    throw new Error("NEWSAPI_API_KEY is not set");
  }
  console.log(query);
  const result = await fetch(`https://newsapi.org/v2/top-headlines?q=${query}&apiKey=${apiKey}`);
  const data = await result.json();
  console.log(data);
  if (data.totalResults === 0) {
    return "No news found for the query";
  }else{
    return data
  }
}, {
  name: "NewsAPI",
  description: "Get the news for a query",
  schema: z.object({
    query: z.string().describe("The query to get the news for"),
  }),
});

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
  if (message.getType() === "human") {
    return { content: message.content, role: "user" };
  } else if (message.getType() === "ai") {
    return {
      content: message.content,
      role: "assistant",
      tool_calls: (message as AIMessage).tool_calls,
    };
  } else {
    return { content: message.content, role: message.getType() };
  }
};

const AGENT_SYSTEM_TEMPLATE = `You are a wise old wizard named Merlin. You are very wise and can answer any question. However, you are also very old and use archaic language.
Your responses must have a bit of a mystical tone, and you must make sure to reference the previous messages in your response if relevant.

DO NOT USE MARKDOWN.
Do not link to images.
All links must be formatted as <a href="link">link</a>.`;

/**
 * This handler initializes and calls an tool caling ReAct agent.
 * See the docs for more information:
 *
 * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const returnIntermediateSteps = body.show_intermediate_steps;
    /**
     * We represent intermediate steps as system messages for display purposes,
     * but don't want them in the chat history.
     */
    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant",
      )
      .map(convertVercelMessageToLangChainMessage);

    const tools = [NewsAPI, OpenWeatherAPI];
    const chat = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
    });

    /**
     * Use a prebuilt LangGraph agent.
     */
    const agent = createReactAgent({
      llm: chat,
      tools,
      /**
       * Modify the stock prompt in the prebuilt agent. See docs
       * for how to customize your agent:
       *
       * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
       */
      messageModifier: new SystemMessage(AGENT_SYSTEM_TEMPLATE),
    });

    if (!returnIntermediateSteps) {
      /**
       * Stream back all generated tokens and steps from their runs.
       *
       * We do some filtering of the generated events and only stream back
       * the final response as a string.
       *
       * For this specific type of tool calling ReAct agents with OpenAI, we can tell when
       * the agent is ready to stream back final output when it no longer calls
       * a tool and instead streams back content.
       *
       * See: https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/
       */
      const eventStream = agent.streamEvents(
        { messages },
        { version: "v2" },
      );

      return createDataStreamResponse({
        async execute(dataStream) {
          for await (const { event, data } of eventStream) {
            if (event === "on_chat_model_stream") {
              // Intermediate chat model generations will contain tool calls and no content
              if (!!data.chunk.content) {
                dataStream.write(`0:${JSON.stringify({ role: "assistant", content: data.chunk.content })}\n`);
              }
            }
          }
        }
      });
    } else {
      /**
       * We could also pick intermediate steps out from `streamEvents` chunks, but
       * they are generated as JSON objects, so streaming and displaying them with
       * the AI SDK is more complicated.
       */
      const result = await agent.invoke({ messages });

      return NextResponse.json(
        {
          messages: result.messages.map(convertLangChainMessageToVercelMessage),
        },
        { status: 200 },
      );
    }
} catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
}
}