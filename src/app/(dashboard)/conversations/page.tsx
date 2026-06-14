import { MessageSquareText } from "lucide-react";

export const metadata = { title: "Conversations — Threadline" };

/** The right pane when no thread is selected (desktop). On mobile the list fills the
 * screen and this isn't shown until a conversation is opened. */
export default function ConversationsIndexPage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <MessageSquareText className="mb-3 size-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Select a conversation to view the thread.</p>
    </div>
  );
}
