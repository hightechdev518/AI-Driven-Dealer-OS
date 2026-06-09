const GRAPH_API = "https://graph.facebook.com/v21.0";

export class GraphApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly tokenExpired = false
  ) {
    super(message);
    this.name = "GraphApiError";
  }
}

function getPageToken(): string {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) {
    throw new GraphApiError("FB_PAGE_ACCESS_TOKEN is not configured");
  }
  return token;
}

function getPageId(): string {
  const pageId = process.env.FB_PAGE_ID;
  if (!pageId) {
    throw new GraphApiError("FB_PAGE_ID is not configured");
  }
  return pageId;
}

interface GraphErrorBody {
  error?: {
    message?: string;
    code?: number;
    type?: string;
    error_subcode?: number;
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & GraphErrorBody;

  if (!response.ok || body.error) {
    const err = body.error;
    const code = err?.code;
    const expired =
      code === 190 ||
      code === 102 ||
      err?.type === "OAuthException" ||
      /access token|expired|session/i.test(err?.message ?? "");

    throw new GraphApiError(
      err?.message ?? "Facebook Graph API request failed",
      code,
      expired
    );
  }

  return body;
}

export interface FbParticipant {
  id: string;
  name?: string;
  email?: string;
}

export interface FbConversation {
  id: string;
  updated_time?: string;
  link?: string;
  participants?: { data: FbParticipant[] };
}

export interface FbMessage {
  id: string;
  message?: string;
  created_time: string;
  from: { id: string; name?: string };
}

export async function fetchConversations(): Promise<FbConversation[]> {
  const pageId = getPageId();
  const token = getPageToken();
  const conversations: FbConversation[] = [];
  let url: string | null =
    `${GRAPH_API}/${pageId}/conversations?fields=id,updated_time,link,participants&limit=50&access_token=${token}`;

  while (url) {
    const response: Response = await fetch(url);
    const data = await handleResponse<{
      data?: FbConversation[];
      paging?: { next?: string };
    }>(response);

    if (data.data) conversations.push(...data.data);
    url = data.paging?.next ?? null;
  }

  return conversations;
}

export async function fetchConversationMessages(
  conversationId: string
): Promise<FbMessage[]> {
  const token = getPageToken();
  const messages: FbMessage[] = [];
  let url: string | null =
    `${GRAPH_API}/${conversationId}/messages?fields=id,message,created_time,from&limit=50&access_token=${token}`;

  while (url) {
    const response: Response = await fetch(url);
    const data = await handleResponse<{
      data?: FbMessage[];
      paging?: { next?: string };
    }>(response);

    if (data.data) messages.push(...data.data);
    url = data.paging?.next ?? null;
  }

  return messages.reverse();
}

export async function sendMessengerMessage(
  recipientPsid: string,
  text: string
): Promise<{ message_id?: string }> {
  const token = getPageToken();
  const response = await fetch(`${GRAPH_API}/me/messages?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message: { text },
    }),
  });

  return handleResponse<{ message_id?: string }>(response);
}

export function getCustomerParticipant(
  conversation: FbConversation,
  pageId: string
): FbParticipant | null {
  const participants = conversation.participants?.data ?? [];
  return participants.find((p) => p.id !== pageId) ?? participants[0] ?? null;
}
