"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/store/chat-store";

export default function NewChatPage() {
  const router = useRouter();
  const { setMessages, setCurrentConversation } = useChatStore();

  useEffect(() => {
    setMessages([]);
    setCurrentConversation(null);
    router.replace("/chat");
  }, [router, setMessages, setCurrentConversation]);

  return null;
}
