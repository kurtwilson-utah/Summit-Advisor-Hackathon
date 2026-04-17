import { Client } from "@notionhq/client";
import type { BlockObjectRequest } from "@notionhq/client/build/src/api-endpoints";
import type { ExtractedIdeaCandidate } from "../../application/finalization/ideaExtractionService.js";
import { env } from "../../lib/config.js";
import type { ConversationExportPayload } from "../persistence/supabasePersistenceAdapter.js";

type NotionPropertyType =
  | "title"
  | "rich_text"
  | "date"
  | "email"
  | "number"
  | "select"
  | "status";

interface DatabasePropertyDescriptor {
  name: string;
  type: NotionPropertyType | string;
}

export interface NotionExportResult {
  transcriptPageId: string;
  ideaPageIds: string[];
}

export interface NotionProviderAdapter {
  exportConversation(args: {
    conversation: ConversationExportPayload;
    ideas: ExtractedIdeaCandidate[];
    closeReason: string;
  }): Promise<NotionExportResult>;
}

export function createNotionProviderAdapter(): NotionProviderAdapter {
  const missingConfig = [
    !env.NOTION_TOKEN ? "NOTION_TOKEN" : null,
    !env.NOTION_CHAT_LOG_DATABASE_ID ? "NOTION_CHAT_LOG_DATABASE_ID" : null,
    !env.NOTION_IDEA_CAPTURE_DATABASE_ID ? "NOTION_IDEA_CAPTURE_DATABASE_ID" : null
  ].filter(Boolean);

  if (missingConfig.length > 0 || !env.NOTION_TOKEN || !env.NOTION_CHAT_LOG_DATABASE_ID || !env.NOTION_IDEA_CAPTURE_DATABASE_ID) {
    return {
      async exportConversation({ conversation, closeReason }) {
        console.warn("Notion export missing configuration", {
          missingConfig,
          threadId: conversation.thread.id,
          closeReason
        });
        return {
          transcriptPageId: "",
          ideaPageIds: []
        };
      }
    };
  }

  const notion = new Client({ auth: env.NOTION_TOKEN });
  const chatDatabaseId = env.NOTION_CHAT_LOG_DATABASE_ID;
  const ideaDatabaseId = env.NOTION_IDEA_CAPTURE_DATABASE_ID;

  return {
    async exportConversation({ conversation, ideas, closeReason }) {
      const [chatProperties, ideaProperties] = await Promise.all([
        loadDatabaseProperties(notion, chatDatabaseId),
        loadDatabaseProperties(notion, ideaDatabaseId)
      ]);
      const transcriptProperties: Record<string, unknown> = {};

      setAssignedProperty(transcriptProperties, chatProperties, "Title", conversation.thread.title);
      setAssignedProperty(transcriptProperties, chatProperties, "Thread ID", conversation.thread.id);
      setAssignedProperty(transcriptProperties, chatProperties, "User Email", conversation.session.email);
      setAssignedProperty(transcriptProperties, chatProperties, "User Name", conversation.session.displayName);
      setAssignedProperty(transcriptProperties, chatProperties, "Opened At", inferOpenedAt(conversation));
      setAssignedProperty(transcriptProperties, chatProperties, "Closed At", new Date().toISOString());
      setAssignedProperty(transcriptProperties, chatProperties, "Status", humanizeCloseReason(closeReason));
      setAssignedProperty(transcriptProperties, chatProperties, "Summary", conversation.thread.summary);
      setAssignedProperty(transcriptProperties, chatProperties, "Idea Count", ideas.length);

      const transcriptPage = await notion.pages.create({
        parent: { database_id: chatDatabaseId },
        properties: transcriptProperties as never,
        children: buildTranscriptChildren(conversation, ideas, closeReason)
      });

      const ideaPageIds: string[] = [];

      for (const idea of ideas) {
        const ideaPropertiesPayload: Record<string, unknown> = {};

        setAssignedProperty(ideaPropertiesPayload, ideaProperties, "Title", idea.ideaStatement.slice(0, 120));
        setAssignedProperty(ideaPropertiesPayload, ideaProperties, "Thread ID", conversation.thread.id);
        setAssignedProperty(ideaPropertiesPayload, ideaProperties, "Conversation Date", new Date().toISOString());
        setAssignedProperty(ideaPropertiesPayload, ideaProperties, "Customer Name", idea.conversedWith);
        setAssignedProperty(ideaPropertiesPayload, ideaProperties, "Problem", idea.problemStatement);
        setAssignedProperty(ideaPropertiesPayload, ideaProperties, "Idea", idea.ideaStatement);
        setAssignedProperty(ideaPropertiesPayload, ideaProperties, "Evidence", idea.keyQuotes.join("\n\n"));
        setAssignedProperty(
          ideaPropertiesPayload,
          ideaProperties,
          "Recommended Next Step",
          idea.recommendedNextStep
        );
        setAssignedProperty(ideaPropertiesPayload, ideaProperties, "Confidence", idea.confidence);
        setAssignedProperty(ideaPropertiesPayload, ideaProperties, "Source Agent", idea.sourceAgent);
        setAssignedProperty(ideaPropertiesPayload, ideaProperties, "Category", idea.category);
        const page = await notion.pages.create({
          parent: { database_id: ideaDatabaseId },
          properties: ideaPropertiesPayload as never,
          children: buildIdeaChildren(idea)
        });

        ideaPageIds.push(page.id);
      }

      return {
        transcriptPageId: transcriptPage.id,
        ideaPageIds
      };
    }
  };
}

async function loadDatabaseProperties(notion: Client, databaseId: string) {
  const database = await notion.databases.retrieve({
    database_id: databaseId
  });

  return Object.fromEntries(
    Object.entries(database.properties).map(([name, property]) => [
      name,
      {
        name,
        type: property.type
      } satisfies DatabasePropertyDescriptor
    ])
  );
}

function assignProperty(
  properties: Record<string, DatabasePropertyDescriptor>,
  propertyName: string,
  value: string | number
) {
  const descriptor = properties[propertyName];

  if (!descriptor) {
    return {};
  }

  if (typeof value === "number") {
    if (descriptor.type === "number") {
      return {
        [propertyName]: {
          number: value
        }
      };
    }

    return assignProperty(properties, propertyName, String(value));
  }

  if (!value) {
    return {};
  }

  switch (descriptor.type) {
    case "title":
      return {
        [propertyName]: {
          title: toRichText(value)
        }
      };
    case "rich_text":
      return {
        [propertyName]: {
          rich_text: toRichText(value)
        }
      };
    case "date":
      return {
        [propertyName]: {
          date: {
            start: value
          }
        }
      };
    case "email":
      return {
        [propertyName]: {
          email: value
        }
      };
    case "select":
      return {
        [propertyName]: {
          select: {
            name: value
          }
        }
      };
    case "status":
      return {
        [propertyName]: {
          status: {
            name: value
          }
        }
      };
    case "number":
      return {
        [propertyName]: {
          number: Number(value)
        }
      };
    default:
      return {};
  }
}

function setAssignedProperty(
  target: Record<string, unknown>,
  properties: Record<string, DatabasePropertyDescriptor>,
  propertyName: string,
  value: string | number
) {
  Object.assign(target, assignProperty(properties, propertyName, value));
}

function buildTranscriptChildren(
  conversation: ConversationExportPayload,
  ideas: ExtractedIdeaCandidate[],
  closeReason: string
) {
  const blocks: BlockObjectRequest[] = [
    headingBlock("Conversation Summary"),
    paragraphBlock(conversation.thread.summary),
    paragraphBlock(`Close reason: ${humanizeCloseReason(closeReason)}`),
    paragraphBlock(`Exported by: ${conversation.session.displayName} (${conversation.session.email})`)
  ];

  if (ideas.length > 0) {
    blocks.push(headingBlock("Ideas Captured"));
    for (const idea of ideas) {
      blocks.push(bulletedBlock(`${idea.ideaStatement} [${idea.category}]`));
    }
  }

  blocks.push(headingBlock("Transcript"));

  for (const message of conversation.thread.messages) {
    for (const chunk of chunkText(`${message.authorLabel}: ${message.bodyDisplay}`, 1800)) {
      blocks.push(paragraphBlock(chunk));
    }
  }

  return blocks;
}

function buildIdeaChildren(idea: ExtractedIdeaCandidate) {
  const blocks: BlockObjectRequest[] = [
    headingBlock("Problem"),
    paragraphBlock(idea.problemStatement),
    headingBlock("Idea"),
    paragraphBlock(idea.ideaStatement),
    headingBlock("Key Quotes")
  ];

  if (idea.keyQuotes.length === 0) {
    blocks.push(paragraphBlock("No direct quotes captured."));
  } else {
    for (const quote of idea.keyQuotes) {
      blocks.push(quoteBlock(quote));
    }
  }

  blocks.push(headingBlock("Recommended Next Step"));
  blocks.push(paragraphBlock(idea.recommendedNextStep));
  return blocks;
}

function toRichText(content: string) {
  return chunkText(content, 1800).map((chunk) => ({
    type: "text" as const,
    text: {
      content: chunk
    }
  }));
}

function headingBlock(content: string): BlockObjectRequest {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: toRichText(content)
    }
  };
}

function paragraphBlock(content: string): BlockObjectRequest {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: toRichText(content)
    }
  };
}

function bulletedBlock(content: string): BlockObjectRequest {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: toRichText(content)
    }
  };
}

function quoteBlock(content: string): BlockObjectRequest {
  return {
    object: "block",
    type: "quote",
    quote: {
      rich_text: toRichText(content)
    }
  };
}

function chunkText(content: string, maxLength: number) {
  if (content.length <= maxLength) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > maxLength) {
    chunks.push(remaining.slice(0, maxLength));
    remaining = remaining.slice(maxLength);
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function inferOpenedAt(conversation: ConversationExportPayload) {
  return conversation.thread.messages[0]?.createdAt ?? conversation.thread.updatedAt;
}

function humanizeCloseReason(closeReason: string) {
  switch (closeReason) {
    case "manual-close":
      return "Manual close";
    case "browser-unload":
      return "Browser unload";
    case "idle-timeout":
      return "Idle timeout";
    default:
      return closeReason;
  }
}
