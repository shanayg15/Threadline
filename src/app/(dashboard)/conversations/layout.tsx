import type { ReactNode } from "react";

import { ConsoleLayout } from "./console-layout";
import { ConversationList } from "./conversation-list";

/** Three-pane console: a persistent conversation list + the selected thread (children). */
export default function ConversationsLayout({ children }: { children: ReactNode }) {
  return <ConsoleLayout list={<ConversationList />}>{children}</ConsoleLayout>;
}
