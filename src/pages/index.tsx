/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type NextPage } from "next";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import ContentUpload from "~/components/ContentUpload";
import { useRouter } from "next/router";

interface Message {
  id: number;
  sender: string;
  content: string;
}

const Home: NextPage = () => {
  const [isConfigured, setIsConfigured] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if API keys are configured
    const checkConfig = async () => {
      try {
        const response = await axios.get("/api/config-status");
        setIsConfigured(response.data.configured);
      } catch (error) {
        setIsConfigured(false);
      }
    };
    void checkConfig();
  }, []);

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Welcome to Chat with YouTube</h1>
          <p className="text-lg text-gray-600 mb-8">Get started by setting up your API keys</p>
          <button
            onClick={() => void router.push('/setup')}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Let's Begin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="lg:sticky lg:top-8">
          <ContentUpload />
        </div>
        <div>
          <Chat />
        </div>
      </div>
    </div>
  );
};

const Chat = () => {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState<[string, string][]>([]);
  const [isConfigured, setIsConfigured] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Check if API keys are configured
    const checkConfig = async () => {
      try {
        const response = await axios.get("/api/config-status");
        setIsConfigured(response.data.configured);
      } catch (error) {
        setIsConfigured(false);
      }
    };
    void checkConfig();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || !isConfigured) return;
    
    // Add user message to messages
    setMessages((oldMessages) => [
      ...oldMessages,
      { id: Date.now(), sender: "User", content: input },
    ]);

    const currentInput = input;
    setInput("");
    
    // Handle AI response
    setLoading(true);
    try {
      const resp = await axios.post("/api/langchain", {
        question: currentInput,
        chat_history: chatHistory,
      });
      const answer = resp.data.answer;
      
      // Update chat history with the new Q&A pair
      setChatHistory((old) => [...old, [currentInput, answer]]);
      
      // Add AI response to messages
      setMessages((oldMessages) => [
        ...oldMessages,
        { id: Date.now(), sender: "System", content: answer },
      ]);
    } catch (error) {
      toast.error("Something went wrong. Please try again", {
        position: "bottom-right",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="text-center p-4 bg-yellow-50 rounded-lg">
        <p className="text-yellow-700">Please complete the setup process before using the chat.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto my-10 flex h-full max-w-3xl flex-col">
      <div className="flex-grow space-y-4 overflow-y-auto border-2 border-solid p-4">
        {messages.length === 0 && (
          <div>No messages yet. Start chatting below!</div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex items-end ${
              message.sender === "User" ? "justify-end" : ""
            }`}
          >
            <div
              className={`rounded-lg px-4 py-2 ${
                message.sender === "User"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="my-4 flex">
        <input
          type="text"
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          className="flex-grow rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          placeholder="Type your message"
        />
        <button
          type="submit"
          className="ml-4 rounded-md bg-red-500 px-4 py-2 text-white"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
};

export default Home;