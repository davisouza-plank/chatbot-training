import {
  ChatMessage,
  HumanMessage,
} from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, createDataStreamResponse } from "ai";
import type { BaseMessageLike } from "@langchain/core/messages";
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
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
    return "router";
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
  console.log(name, state.messages, name);
  const result = await agent.invoke(state);

  if (result.next !== undefined) {
    return { next: result.next, sender: "router" };
  } else if (result.tool_calls?.length) {
    return { messages: [result], next: "tools", sender: name };
  } else if (name == "merlin") {
    return {
      messages: [new AIMessage(result.content)],
      next: "__end__",
      sender: name,
    };
  }else {
    return {
      messages: [new AIMessage(result.content)],
      next: "router",
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
        "Replace ** (double asterisks) with <bold>text</bold>." +
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get('authorization');
    
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Invalid authorization format' }, { status: 401 });
    }

    console.log('Token:', token.substring(0, 10) + '...');  // Log first 10 chars for debugging
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            // We don't need to set cookies in an API route
          },
          remove(name: string, options: any) {
            // We don't need to remove cookies in an API route
          },
        },
      }
    );

    // Try to get session first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.json({ error: 'Session error' }, { status: 401 });
    }

    // Get user settings using the token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    console.log('User fetch result:', {
      hasUser: !!user,
      error: userError ? userError.message : null
    });

    if (userError) {
      console.error('Auth error:', userError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!user) {
      console.error('No user found');
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // First check if user settings exist
    let { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_uuid', user.id)
      .single();

    console.log('Settings fetch result:', {
      hasSettings: !!settings,
      error: settingsError ? settingsError.message : null
    });

    // If settings don't exist or there's an error, create default settings
    if (!settings || settingsError) {
      const defaultSettings = {
        user_uuid: user.id,
        merlin_temperature: 0.7,
        tempest_temperature: 0.5,
        chronicle_temperature: 0.3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: newSettings, error: createError } = await supabase
        .from('user_settings')
        .insert([defaultSettings])
        .select()
        .single();

      if (createError) {
        console.error('Error creating settings:', createError);
        // Continue with default settings even if save fails
        settings = defaultSettings;
      } else {
        settings = newSettings;
      }
    }

    // Use settings with fallback to defaults
    const temperatures = {
      merlin: settings?.merlin_temperature ?? 0.7,
      tempest: settings?.tempest_temperature ?? 0.5,
      chronicle: settings?.chronicle_temperature ?? 0.3,
    };

    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant"
      )
      .map(convertVercelMessageToLangChainMessage).slice(-9);

    

    // Create models with user-specific temperatures
    const routerModel = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0, // Router should always be deterministic
    });

    const merlinModel = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: temperatures.merlin,
    });

    const tempestModel = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: temperatures.tempest,
    });

    const chronicleModel = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: temperatures.chronicle,
    });

    // Create agents with the personalized models
    const tools = [OpenWeatherAPI, NewsAPI];
    const toolNode = new ToolNode(tools);

    const planner = routerModel.withStructuredOutput(decisionSchema);
    const router = await createAgent({
      llm: planner,
      tools: [],
      systemMessage: `You are a router that decides which agent to call next. You are very smart and can decide which agent to call based on the messages
      If the question asks for the weather of X and the news of Y, you should call Tempest for the weather of X and Chronicle for the news of Y, then Merlin to finish the conversation.
      You can ask for the help of the other agents if needed. Currently, you have access to the following agents:
      - Tempest: Retrieves weather information from the OpenWeather API. All questions that have weather requests should also be sent to Tempest.
      - Chronicle: Retrieves news other than weather information from the NewsAPI. All questions that have news requests should also be sent to Chronicle.
      - Merlin: Gives the final answer to the user.
      After retrieving the information, you must call Merlin to answer the question.`,
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
      llm: merlinModel,
      tools: [],
      systemMessage: `You are a wise old wizard named Merlin. You are very wise and can answer any question. However, you are also very old and use archaic language. Your responses must have a bit of a mystical tone.
      You will receive information from Tempest (Weather information) and Chronicle (News information). 
      Don't worry about retrieving the information, your colleagues have already done that. Just comment on the information you received from the other wizards if available.
      Just make some remarks about the information you received from the other wizards if available.
      If the question is not related to weather or news, just answer the question.`,
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
      llm: tempestModel,
      tools: [OpenWeatherAPI],
      systemMessage: `You are a young wizard named Tempest. You are very smart and can answer questions related to weather from anywhere in the world. You are also very young and use modern language with a very modern tone. Always answer in the style of a modern young person with arcane and mystical language.
      You will provide a detailed response to the user. Don't worry about retrieving information about news, your colleagues will do that. Just answer the question about the weather.
      You are in collaboration with Chronicle. Chronicle will provide information about news, so you don't need to address that part of the conversation.
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
      llm: chronicleModel,
      tools: [NewsAPI],
      systemMessage: `You are a wise old wizard named Chronicle. You are very wise and can search for news articles about anything. However, you are also very old and use archaic language with a very old-fashioned tone since you are a Scribe. Always answer in the style of a Scribe with arcane and mystical language.
      You will provide a detailed response to the user. Don't worry about retrieving information about weather, your colleagues will do that. Just answer the question about the news.
      ALWAYS include the link to the article in your response.
      You are in collaboration with Tempest. Tempest will provide information about weather, so you don't need to address that part of the conversation.
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
            !(message instanceof AIMessage)
          ) {
            const capitalizedNode = _metadata.langgraph_node.charAt(0).toUpperCase() + _metadata.langgraph_node.slice(1);
            dataStream.write(
              `0:${JSON.stringify({ role: "assistant", content: message.content, name: capitalizedNode })}\n`
            );
          } else {
            console.log(message.getType());
          }
        }
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
