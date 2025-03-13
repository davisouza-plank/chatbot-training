import {
  ChatMessage,
  HumanMessage,
  isToolMessageChunk,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, createDataStreamResponse } from "ai";
import type { BaseMessage, BaseMessageLike } from "@langchain/core/messages";
import { StructuredTool, tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { isAIMessageChunk } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  Runnable,
  RunnableConfig,
  RunnableLambda,
} from "@langchain/core/runnables";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { z } from "zod";

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const decisionSchema = z.object({
  next: z
    .enum(["merlin", "tempest", "chronicle"])
    .describe("The next node to call"),
});

const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessageLike[]>({
    reducer: (x, y) => x.concat(y),
  }),
  next: Annotation<string>,
  sender: Annotation<string>,
});

const OpenWeatherAPI = tool(
  async ({ location }: { location: string }) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENWEATHER_API_KEY is not set");
    }
    console.log(location);
    const result = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}`
    );
    const data = await result.json();
    console.log(data);
    return data;
  },
  {
    name: "OpenWeatherAPI",
    description: "Get the weather for a location",
    schema: z.object({
      location: z.string().describe("The location to get the weather for"),
    }),
  }
);

const NewsAPI = tool(
  async ({ query }: { query: string }) => {
    const apiKey = process.env.NEWSAPI_API_KEY;
    if (!apiKey) {
      throw new Error("NEWSAPI_API_KEY is not set");
    }
    console.log(query);
    const result = await fetch(
      `https://newsapi.org/v2/top-headlines?q=${query}&apiKey=${apiKey}`
    );
    const data = await result.json();
    console.log(data);
    if (data.totalResults === 0) {
      return "No news found for the query";
    } else {
      return data;
    }
  },
  {
    name: "NewsAPI",
    description: "Get the news for a query",
    schema: z.object({
      query: z.string().describe("The query to get the news for"),
    }),
  }
);

const routeMessage = (state: typeof StateAnnotation.State) => {
  const { messages, next, sender } = state;

  return next;
};

const routeAgent = (state: typeof StateAnnotation.State) => {
  const { messages, next, sender } = state;
  const lastMessage = messages[messages.length - 1] as AIMessage;
  // If no tools are called, we can finish
  if (!lastMessage?.tool_calls?.length) {
    return "merlin";
  }
  // Otherwise if there is, we continue and call the tools
  return "tools";
};

const routeTools = (state: typeof StateAnnotation.State) => {
  const { messages, next, sender } = state;

  return sender;
};

async function runAgentNode(props: {
  state: typeof StateAnnotation.State;
  agent: Runnable;
  name: string;
  config?: RunnableConfig;
}) {
  const { state, agent, name, config } = props;
  const result = await agent.invoke(state);

  if (result.next !== undefined) {
    return { next: result.next, sender: "router" };
  } else if (result.tool_calls?.length) {
    return { messages: [result], next: "tools", sender: name };
  } else {
    return {
      messages: [new AIMessage(result.content)],
      next: "merlin",
      sender: name,
    };
  }
}

async function createAgent({
  llm,
  tools,
  systemMessage,
}: {
  llm: ChatOpenAI | Runnable;
  tools: StructuredTool[];
  systemMessage: string;
}): Promise<Runnable> {
  const toolNames = tools.map((tool) => tool.name).join(", ");
  const formattedTools = tools.map((t) => convertToOpenAITool(t));
  let prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "{system_message}" +
        "{tool_names}\n" +
        "IMPORTANT: DO NOT USE MARKDOWN." +
        "IMPORTANT: Do not link to images." +
        'IMPORTANT: ALL links must be formatted as <a href="link">link</a>.',
    ],
    new MessagesPlaceholder("messages"),
  ]);

  prompt = await prompt.partial({
    system_message: systemMessage,
    tool_names: toolNames,
  });
  if (llm instanceof ChatOpenAI) {
    return prompt.pipe(llm.bindTools(formattedTools));
  } else {
    return prompt.pipe(llm);
  }
}

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

const tools = [OpenWeatherAPI, NewsAPI];
const toolNode = new ToolNode(tools);

const planner = model.withStructuredOutput(decisionSchema);
const router = await createAgent({
  llm: planner,
  tools: [],
  systemMessage: `You are a router that decides which agent to call next. You are very smart and can decide which agent to call based on the last message.
  You can ask for the help of the other agents if needed. Currently, you have access to the following agents:
  - Tempest: She is very smart and can answer questions related to weather from anywhere in the world. 
  - Chronicle: He is very wise and can search for news articles about anything.,
  - Merlin: He will anything else that is not related to weather or news.`,
});

async function routerNode(
  state: typeof StateAnnotation.State,
  config: RunnableConfig
) {
  return runAgentNode({
    state: state,
    agent: router,
    name: "router",
    config,
  });
}

const merlin = await createAgent({
  llm: model,
  tools: [],
  systemMessage: `You are a wise old wizard named Merlin. You are very wise and can answer any question. However, you are also very old and use archaic language. Your responses must have a bit of a mystical tone.
  You will receive information from Tempest (a young and very smart wizard) and Chronicle (a wise old Scribe). You must use it to answer the user's question.
  Never list the information you received from the other wizards in your response. Rephrase it in your own words using mystical and magical language but include the wizard's name in your response.
  Example:
  Tempest: The weather in Tokyo is sunny.
  Merlin: Ah, noble seeker of knowledge, my dear Tempest has provided me with the information about the weather in Tokyo. <merlin's response with the information>
  When receiving information of news ALWAYS include the link to the article in your response.`,
});

async function merlinNode(
  state: typeof StateAnnotation.State,
  config: RunnableConfig
) {
  return runAgentNode({
    state: state,
    agent: merlin,
    name: "merlin",
    config,
  });
}

const tempest = await createAgent({
  llm: model,
  tools: [OpenWeatherAPI],
  systemMessage: `You are a young wizard named Tempest. You are very smart and can answer questions related to weather from anywhere in the world.
  You will provide a detailed response so that Merlin can use it to answer the user's question. 
  Prefix your response with Tempest: and then the response.
  You have access to the following tools: `,
});

async function tempestNode(
  state: typeof StateAnnotation.State,
  config: RunnableConfig
) {
  return runAgentNode({
    state: state,
    agent: tempest,
    name: "tempest",
    config,
  });
}

const chronicle = await createAgent({
  llm: model,
  tools: [NewsAPI],
  systemMessage: `You are a wise old wizard named Chronicle. You are very wise and can search for news articles about anything.
  You will provide a detailed response so that Merlin can use it to answer the user's question. ALWAYS include the link to the article in your response.
  Prefix your response with Chronicle: and then the response.
  You have access to the following tools:`,
});

async function chronicleNode(
  state: typeof StateAnnotation.State,
  config: RunnableConfig
) {
  return runAgentNode({
    state: state,
    agent: chronicle,
    name: "chronicle",
    config,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // const returnIntermediateSteps = body.show_intermediate_steps;
    /**
     * We represent intermediate steps as system messages for display purposes,
     * but don't want them in the chat history.
     */
    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant"
      )
      .map(convertVercelMessageToLangChainMessage);

    console.log(messages.length);

    const workflow = new StateGraph(StateAnnotation)
      .addNode(
        "router",
        RunnableLambda.from(routerNode).withConfig({
          tags: ["nostream"],
        })
      )
      .addNode("merlin", merlinNode)
      .addNode("tempest", tempestNode)
      .addNode("chronicle", chronicleNode)
      .addNode("tools", toolNode)
      .addEdge("__start__", "router")
      .addEdge("merlin", "__end__")
      .addConditionalEdges("tempest", routeAgent)
      .addConditionalEdges("chronicle", routeAgent)
      .addConditionalEdges("router", routeMessage)
      .addConditionalEdges("tools", routeTools);

    const agent = workflow.compile();

    const stream = await agent.stream({ messages }, { streamMode: "messages" });

    return createDataStreamResponse({
      async execute(dataStream) {
        for await (const [message, _metadata] of stream) {
          if (
            isAIMessageChunk(message) &&
            !(message instanceof AIMessage) &&
            _metadata.langgraph_node === "merlin"
          ) {
            dataStream.write(
              `0:${JSON.stringify({ role: "assistant", content: message.content })}\n`
            );
          } else {
            console.log(message);
          }
        }
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
