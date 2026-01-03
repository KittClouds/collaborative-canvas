import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, Trash2, Settings2 } from 'lucide-react';
import { chatService } from '@/lib/agents/chatService';
import { availableModels, ModelProvider } from '@/lib/agents/mastra.config';
import { AgentInput } from './AgentInput';
import { ToolExecutionLog } from './ToolExecutionLog';
import { CitationCard } from './CitationCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTemporalHighlight } from '@/contexts/TemporalHighlightContext';

// Local message types for UI state (simpler than AI SDK types)
interface ToolInvocationState {
  toolCallId: string;
  toolName: string;
  args: unknown;
  state: 'call' | 'result';
  result?: unknown;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolInvocationState[];
}

// Helper to extract citations from markdown [Title](id)
const extractCitations = (text: string) => {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const citations = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    citations.push({
      title: match[1],
      noteId: match[2],
      index: match.index
    });
  }
  return citations;
};

export function AgentSidebar() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>('google');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Contexts
  const { setOnActivateTimeline } = useTemporalHighlight();

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Create a placeholder for the assistant message
      const assistantMessageId = (Date.now() + 1).toString();
      let currentAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        toolInvocations: []
      };

      setMessages(prev => [...prev, currentAssistantMessage]);

      // Build messages for the API (convert to CoreMessage format)
      const apiMessages = [...messages, userMessage].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Call Chat Service
      const result = await chatService.streamResponse({
        messages: apiMessages,
        modelProvider: selectedProvider,
        modelName: selectedModel
      });

      // Consume the stream
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          // AI SDK v5 uses 'text' instead of 'textDelta'
          currentAssistantMessage.content += (part as any).text ?? '';
        } else if (part.type === 'tool-call') {
          const toolInvocation: ToolInvocationState = {
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            args: (part as any).input ?? {},
            state: 'call',
          };

          currentAssistantMessage.toolInvocations = [
            ...(currentAssistantMessage.toolInvocations || []),
            toolInvocation
          ];
        } else if (part.type === 'tool-result') {
          // Update the matching tool invocation with result
          currentAssistantMessage.toolInvocations = currentAssistantMessage.toolInvocations?.map(inv =>
            inv.toolCallId === part.toolCallId
              ? { ...inv, state: 'result' as const, result: (part as any).output }
              : inv
          );
        }

        // Update state
        setMessages(prev =>
          prev.map(m => m.id === assistantMessageId ? { ...currentAssistantMessage } : m)
        );
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  const handleModelChange = (value: string) => {
    const model = availableModels.find(m => m.modelId === value);
    if (model) {
      setSelectedModel(value);
      setSelectedProvider(model.provider);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header / Settings */}
      <div className="flex items-center justify-between p-2 border-b text-xs">
        <div className="flex items-center gap-2 flex-1">
          <Settings2 className="h-3 w-3 text-muted-foreground" />
          <Select value={selectedModel} onValueChange={handleModelChange}>
            <SelectTrigger className="h-7 w-[180px] text-xs">
              <SelectValue placeholder="Select Model" />
            </SelectTrigger>
            <SelectContent>
              {/* Gemini Models */}
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">Gemini</div>
              {availableModels.filter(m => m.provider === 'google').map(m => (
                <SelectItem key={m.modelId} value={m.modelId} className="text-xs">
                  {m.displayName}
                </SelectItem>
              ))}
              {/* OpenRouter Models */}
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase mt-1">OpenRouter</div>
              {availableModels.filter(m => m.provider === 'openrouter').map(m => (
                <SelectItem key={m.modelId} value={m.modelId} className="text-xs">
                  <div className="flex items-center gap-1">
                    {m.displayName}
                    {m.isFree && <span className="text-[9px] bg-green-500/20 text-green-500 px-1 rounded">FREE</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear} title="Clear Chat">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Bot className="h-8 w-8 opacity-50" />
              <p className="text-sm">How can I help you analyze your notes?</p>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-1", m.role === 'user' ? "items-end" : "items-start")}>
              <div className="flex items-center gap-2 px-1">
                {m.role === 'user' ? (
                  <User className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <Bot className="h-3 w-3 text-primary" />
                )}
                <span className="text-[10px] uppercase font-bold text-muted-foreground">
                  {m.role}
                </span>
              </div>

              <div
                className={cn(
                  "rounded-lg p-3 text-sm max-w-[90%]",
                  m.role === 'user'
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted border"
                )}
              >
                {/* Tool Logs */}
                {m.toolInvocations && m.toolInvocations.length > 0 && (
                  <ToolExecutionLog toolInvocations={m.toolInvocations} />
                )}

                {/* Content */}
                <div className="whitespace-pre-wrap">{m.content}</div>

                {/* Citations */}
                {m.role === 'assistant' && extractCitations(m.content).length > 0 && (
                  <div className="mt-3 flex flex-col gap-2 pt-2 border-t border-border/50">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Sources
                    </span>
                    {extractCitations(m.content).map((cit, idx) => (
                      <CitationCard
                        key={idx}
                        title={cit.title}
                        noteId={cit.noteId}
                        className="bg-background/50"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <AgentInput
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={() => { }}
        className="pb-8"
      />
    </div>
  );
}
