import { Message } from "@/utils/supabase/leads-helper";
import { format } from "date-fns";

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble = ({ message }: MessageBubbleProps) => {
  return (
    <div className={`flex ${message.isFromLead ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[70%]">
        <div className={`px-4 py-2 rounded-lg ${message.isFromLead ? "bg-gray-100 text-gray-900" : "bg-brand-primary text-white"}`}>
          <p className="text-sm">{message.content}</p>
        </div>
        <div className={`mt-1 text-xs text-gray-500 ${message.isFromLead ? "text-left" : "text-right"}`}>
          {format(message.timestamp, "MMM d, h:mm a")}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
