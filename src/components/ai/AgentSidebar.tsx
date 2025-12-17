import React, { useState, useRef, useEffect } from 'react';
import { Bot, User, Trash2, Settings2 } from 'lucide-react';
import { Message, ToolInvocation } from 'ai';
import { chatService, ModelProvider } from '@/lib/agents/chatService';
import { AgentInput } from './AgentInput';
import { ToolExecutionLog } from './ToolExecutionLog';
import { CitationCard } from './CitationCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTemporalHighlight } from '@/contexts/TemporalHighlightContext';

// Helper to extract citations from markdown [Title](id)
const extractCitations = (text: string) => {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const citations = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    // Basic check if it looks like a note ID (e.g. UUID or specific format, or just assume valid)
    citations.push({
      title: match[1],
      noteId: match[2],
      index: match.index
    });
  }
  return citations;
};

export function AgentSidebar() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o');
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>('openai');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Contexts
  const { setOnActivateTimeline } = useTemporalHighlight(); // Just to have access to nav if needed

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

    const userMessage: Message = {
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
      let currentAssistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        toolInvocations: []
      };

      setMessages(prev => [...prev, currentAssistantMessage]);

      // Call Chat Service
      const result = await chatService.streamResponse({
        messages: [...messages, userMessage], // Pass full history
        modelProvider: selectedProvider,
        modelName: selectedModel
      });

      // Consume the stream
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          currentAssistantMessage.content += part.textDelta;
        } else if (part.type === 'tool-call') {
          const toolInvocation: ToolInvocation = {
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            args: part.args,
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
               ? { ...inv, state: 'result', result: part.result } 
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
      // Add error message?
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  // Model options (simplified)
  const models = [
    { provider: 'openai', name: 'gpt-4o', label: 'GPT-4o' },
    { provider: 'openai', name: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { provider: 'google', name: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
    { provider: 'anthropic', name: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  ];

  const handleModelChange = (value: string) => {
    const model = models.find(m => m.name === value);
    if (model) {
      setSelectedModel(value);
      setSelectedProvider(model.provider as ModelProvider);
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
              {models.map(m => (
                <SelectItem key={m.name} value={m.name} className="text-xs">
                  {m.label}
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
                        // We could find the snippet from tool results if we parsed them deep, 
                        // but for now we just link
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
        stop={() => {}} // TODO: Implement stop
        className="pb-8"
      />
    </div>
  );
}
