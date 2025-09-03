"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { Input, Button } from "antd";
import { SendOutlined, SmileOutlined, PaperClipOutlined } from "@ant-design/icons";
import MessageBubble from "./MessageBubble";
import { Lead } from "@/utils/supabase/leads-helper";
import Image from "next/image";

interface MessagesPanelProps {
  lead: Lead | null;
   
  onSendMessage: (content: string) => void;
}

const MessagesPanel = ({ lead, onSendMessage }: MessagesPanelProps) => {
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [lead?.messages]);

  const handleSend = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput);
      setMessageInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!lead) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-medium">No lead selected</p>
          <p className="text-sm">Select a lead from the list to view messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Image
            src={lead?.avatar || "/placeholder.svg"}
            alt={lead?.name || "Lead Avatar"}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <h3 className="font-medium text-gray-900">{lead.name}</h3>
            <p className="text-sm text-gray-500">{lead.email}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
        {lead && lead.messages && lead?.messages?.length > 0 ? (
          <>
            {lead.messages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet</p>
            <p className="text-sm">Start a conversation with this lead</p>
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input.TextArea
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter message"
              autoSize={{ minRows: 1, maxRows: 4 }}
              className="resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="text" icon={<SmileOutlined />} className="text-gray-400" />
            <Button type="text" icon={<PaperClipOutlined />} className="text-gray-400" />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={!messageInput.trim()}
              className="bg-brand-primary hover:bg-brand-secondary"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesPanel;
