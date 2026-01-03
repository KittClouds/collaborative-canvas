import { useState, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { chatService } from '@/lib/agents/chatService';
import { SettingsManager } from '@/lib/settings/SettingsManager';
import { ModelRegistry } from '@/lib/llm/ModelRegistry';

export type AIEditAction = 'improve' | 'shorten' | 'lengthen' | 'fix' | 'continue' | 'custom';

interface AIInlineEditState {
    isLoading: boolean;
    streamingText: string;
    error: Error | null;
}

interface UseAIInlineEditOptions {
    editor: Editor | null;
    onComplete?: (result: string) => void;
    onError?: (error: Error) => void;
}

interface RunEditOptions {
    action: AIEditAction;
    customPrompt?: string;
}

const ACTION_PROMPTS: Record<AIEditAction, string> = {
    improve: 'Improve and polish this text while preserving its meaning. Make it clearer and more engaging:',
    shorten: 'Make this text more concise while preserving its key meaning:',
    lengthen: 'Expand and elaborate on this text with more detail:',
    fix: 'Fix any grammar, spelling, and punctuation errors in this text:',
    continue: 'Continue writing from where this text ends, maintaining the same style and tone:',
    custom: '', // Custom prompt provided by user
};

/**
 * Hook for AI-powered inline text editing in Tiptap.
 * Uses ProseMirror transactions to replace selected text in-place.
 */
export function useAIInlineEdit({ editor, onComplete, onError }: UseAIInlineEditOptions) {
    const [state, setState] = useState<AIInlineEditState>({
        isLoading: false,
        streamingText: '',
        error: null,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    /**
     * Execute an AI edit on the currently selected text.
     * The result will replace the selection using a proper ProseMirror transaction.
     */
    const runEdit = useCallback(async ({ action, customPrompt }: RunEditOptions) => {
        if (!editor) {
            const error = new Error('Editor not available');
            onError?.(error);
            return;
        }

        const { from, to, empty } = editor.state.selection;

        if (empty && action !== 'continue') {
            const error = new Error('No text selected');
            onError?.(error);
            return;
        }

        // Get the selected text
        const selectedText = editor.state.doc.textBetween(from, to, ' ');

        if (!selectedText.trim() && action !== 'continue') {
            const error = new Error('Selected text is empty');
            onError?.(error);
            return;
        }

        // Build the prompt
        const basePrompt = action === 'custom' ? customPrompt || '' : ACTION_PROMPTS[action];
        const fullPrompt = `${basePrompt}\n\n"${selectedText}"\n\nRespond only with the improved text, nothing else.`;

        setState({ isLoading: true, streamingText: '', error: null });
        abortControllerRef.current = new AbortController();

        try {
            // Get user's preferred model from settings
            const settings = SettingsManager.getLLMSettings();
            const modelId = settings.defaultModel;
            const modelDef = ModelRegistry.getModel(modelId);

            // Map registry provider to chat service provider
            // Registry uses 'gemini', ChatService uses 'google'
            const provider = modelDef?.provider === 'gemini' ? 'google' : 'openrouter';

            // Call the AI service
            const result = await chatService.generateInlineEdit({
                text: selectedText,
                prompt: fullPrompt,
                action,
                modelProvider: provider,
                modelName: modelId,
            });

            let finalText = '';

            // Stream the response
            for await (const part of result.fullStream) {
                if (abortControllerRef.current?.signal.aborted) {
                    break;
                }

                if (part.type === 'text-delta') {
                    const chunk = (part as any).text ?? '';
                    finalText += chunk;
                    setState(prev => ({ ...prev, streamingText: finalText }));
                }
            }

            // Don't apply if cancelled
            if (abortControllerRef.current?.signal.aborted) {
                setState({ isLoading: false, streamingText: '', error: null });
                return;
            }

            // Apply the result using a proper ProseMirror transaction
            if (finalText.trim()) {
                const { tr } = editor.state;

                // Replace the selected range with the AI result
                tr.insertText(finalText, from, to);

                // Set selection to the new text range
                const newTo = from + finalText.length;
                tr.setSelection(TextSelection.create(tr.doc, from, newTo));

                // Dispatch the transaction
                editor.view.dispatch(tr);

                onComplete?.(finalText);
            }

            setState({ isLoading: false, streamingText: '', error: null });

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            setState({ isLoading: false, streamingText: '', error: err });
            onError?.(err);
        }
    }, [editor, onComplete, onError]);

    /**
     * Cancel an in-progress AI edit.
     */
    const cancel = useCallback(() => {
        abortControllerRef.current?.abort();
        setState({ isLoading: false, streamingText: '', error: null });
    }, []);

    return {
        runEdit,
        cancel,
        isLoading: state.isLoading,
        streamingText: state.streamingText,
        error: state.error,
    };
}
