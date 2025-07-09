# Basic Prompt Engineering Tool - Implementation Plan

## Overview

This plan outlines building a personal prompt engineering tool using your existing Next.js 15 app router structure. The tool will support the core prompt engineering workflow: defining prompts, sending them to LLMs, reviewing responses, and iterating quickly.

## Core Features

1. **Prompt Management**: Create and edit prompt templates with variables
2. **LLM Integration**: Send prompts to OpenAI GPT models with streaming support
3. **Response Review**: Display responses with multiple format options
4. **Prompt History**: Track and reuse previous prompts
5. **Cost Tracking**: Monitor token usage and API costs
6. **Quick Iteration**: Easy editing and re-running of prompts

## Implementation Phases

### Phase 1: Core Loop (1-2 hours)
- Simple textarea → API → streaming response display
- Just one model (gpt-3.5-turbo)
- No variables, no extraction
- Basic keyboard shortcuts (Cmd/Ctrl + Enter)

### Phase 2: Essential Features (2-3 hours)
- Add prompt history with localStorage
- Add variable substitution with `{{VARIABLE}}` syntax
- Add "Run Again" and "Fork Prompt" features
- Token counting and cost tracking

### Phase 3: Power Features (2-3 hours)
- Model selection (GPT-3.5, GPT-4, etc.)
- Response extraction (regex, JSON path, LLM-based)
- Side-by-side prompt comparison
- Response format handling (JSON, Markdown, code)

### Phase 4: Polish (optional)
- Prompt library with categories
- Import/export functionality
- Test suite functionality
- Prompt chaining

## Prerequisites Check

Before starting, verify these are working in your project:

1. **TanStack Query Setup**: Check that `@tanstack/react-query` is in your `providers.tsx`
2. **Authentication**: Ensure you can access routes under `(authenticated)/`
3. **shadcn**: Verify shadcn components are working by importing a basic component like `Button`

## Phase 1: Core Loop Implementation

### Step 1.1: Environment Setup

#### Install Dependencies
```bash
pnpm add ai openai
```

#### Environment Variables
Create `.env`:
```
OPENAI_API_KEY=your_api_key_here
```

Create `.env.example`:
```
OPENAI_API_KEY=sk-proj-EXAMPLE_KEY_REPLACE_WITH_YOUR_OWN
```

Update `src/env.ts`:
```typescript
// Add to your environment validation
OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
```

### Step 1.2: Create Streaming API Route

Create `src/app/api/llm/route.ts`:
```typescript
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { NextRequest } from 'next/server';

// Allow streaming responses
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const { prompt, model = 'gpt-3.5-turbo' } = await request.json();
    
    if (!prompt || typeof prompt !== 'string') {
      return new Response('Invalid prompt', { status: 400 });
    }
    
    // Count tokens (rough estimate)
    const promptTokens = Math.ceil(prompt.length / 4);
    
    const result = await streamText({
      model: openai(model),
      prompt,
      temperature: 0.7,
    });
    
    // Return streaming response with custom headers for token info
    return result.toAIStreamResponse({
      headers: {
        'X-Prompt-Tokens': promptTokens.toString(),
        'X-Model': model,
      }
    });
  } catch (error) {
    console.error('LLM API error:', error);
    return new Response('Failed to process request', { status: 500 });
  }
}
```

### Step 1.3: Create Minimal UI with Streaming

Add essential shadcn components:
```bash
pnpm dlx shadcn@latest add button textarea
pnpm dlx shadcn@latest add toaster
```

Add Toaster to your layout (`app/layout.tsx`):
```tsx
import { Toaster } from '@/components/ui/toaster';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

Create `src/app/(authenticated)/prompt-engineering/page.tsx`:
```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChat } from 'ai/react';
import { useToast } from '@/components/ui/use-toast';

// Simple token/cost estimation
const COSTS = {
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }, // per 1K tokens
  'gpt-4': { input: 0.03, output: 0.06 },
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export default function PromptEngineeringPage() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokens, setTokens] = useState({ input: 0, output: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle Cmd/Ctrl + Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isLoading) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prompt, isLoading]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return;
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setResponse('');
    const inputTokens = estimateTokens(prompt);
    setTokens({ input: inputTokens, output: 0 });
    
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: abortControllerRef.current.signal,
      });
      
      if (!res.ok) {
        throw new Error('Failed to get response');
      }
      
      // Get token info from headers
      const promptTokens = parseInt(res.headers.get('X-Prompt-Tokens') || '0');
      
      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        fullResponse += chunk;
        setResponse(fullResponse);
        
        // Update output token count
        setTokens({
          input: promptTokens,
          output: estimateTokens(fullResponse)
        });
      }
      
      toast({
        title: "Success",
        description: `Response generated (${estimateTokens(fullResponse)} tokens)`,
      });
      
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      
      toast({
        title: "Error",
        description: error.message || 'Failed to process prompt',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setPrompt('');
    setResponse('');
    setTokens({ input: 0, output: 0 });
  };

  const estimatedCost = 
    (tokens.input * COSTS['gpt-3.5-turbo'].input / 1000) +
    (tokens.output * COSTS['gpt-3.5-turbo'].output / 1000);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Prompt Engineering Tool</h1>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium mb-2">
            Prompt (Cmd/Ctrl + Enter to submit)
          </label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="min-h-32 font-mono"
            disabled={isLoading}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button 
              onClick={handleSubmit} 
              disabled={!prompt.trim() || isLoading}
            >
              {isLoading ? 'Generating...' : 'Send'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleClear}
              disabled={isLoading}
            >
              Clear
            </Button>
          </div>
          
          <div className="text-sm text-gray-500">
            Tokens: {tokens.input} + {tokens.output} = {tokens.input + tokens.output}
            {' '}(~${estimatedCost.toFixed(4)})
          </div>
        </div>
        
        {(response || isLoading) && (
          <div>
            <label className="block text-sm font-medium mb-2">Response:</label>
            <div className="bg-gray-50 rounded-md border p-4 min-h-32 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {response || (isLoading && '▊')}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 1.4: Test Phase 1
1. Start dev server: `pnpm dev`
2. Navigate to `/prompt-engineering`
3. Try a simple prompt: "What is 2+2?"
4. Test Cmd/Ctrl + Enter shortcut
5. Verify streaming response and token counting

## Phase 2: Essential Features

### Step 2.1: Add More Components
```bash
pnpm dlx shadcn@latest add input label card
pnpm dlx shadcn@latest add scroll-area separator
```

### Step 2.2: Add Prompt History

Create `src/types/prompt.ts`:
```typescript
export interface PromptHistoryItem {
  id: string;
  prompt: string;
  processedPrompt: string;
  variables: Record<string, string>;
  response: string;
  model: string;
  tokens: { input: number; output: number };
  cost: number;
  timestamp: Date;
}

export interface SavedPrompt {
  id: string;
  name: string;
  template: string;
  defaultVariables: Record<string, string>;
  category?: string;
}
```

### Step 2.3: Add Variable Support and History

Create `src/hooks/usePromptHistory.ts`:
```typescript
import { useState, useEffect } from 'react';
import { PromptHistoryItem } from '@/types/prompt';

const HISTORY_KEY = 'prompt-engineering-history';
const MAX_HISTORY = 50;

export function usePromptHistory() {
  const [history, setHistory] = useState<PromptHistoryItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Convert date strings back to Date objects
      parsed.forEach((item: any) => {
        item.timestamp = new Date(item.timestamp);
      });
      setHistory(parsed);
    }
  }, []);

  const addToHistory = (item: Omit<PromptHistoryItem, 'id'>) => {
    const newItem: PromptHistoryItem = {
      ...item,
      id: Date.now().toString(),
    };
    
    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    
    return newItem;
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  return { history, addToHistory, clearHistory };
}
```

### Step 2.4: Update Main Component with Variables

Create enhanced version with variable support:
```typescript
// Add these utility functions
const extractVariables = (text: string): string[] => {
  const matches = text.match(/\{\{([^}]+)\}\}/g);
  return matches ? 
    [...new Set(matches.map(match => match.slice(2, -2)))] : 
    [];
};

const processTemplate = (template: string, vars: Record<string, string>): string => {
  let processed = template;
  Object.entries(vars).forEach(([key, value]) => {
    processed = processed.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, 'g'), 
      value
    );
  });
  return processed;
};

// Update your component to include:
const [variables, setVariables] = useState<Record<string, string>>({});
const { history, addToHistory } = usePromptHistory();
const [showHistory, setShowHistory] = useState(false);

// Extract variables when prompt changes
useEffect(() => {
  const vars = extractVariables(prompt);
  setVariables(prev => {
    const newVars: Record<string, string> = {};
    vars.forEach(v => {
      newVars[v] = prev[v] || '';
    });
    return newVars;
  });
}, [prompt]);

// Add variable inputs UI
const templateVariables = extractVariables(prompt);
{templateVariables.length > 0 && (
  <Card className="p-4">
    <h3 className="font-medium mb-2">Variables:</h3>
    <div className="space-y-2">
      {templateVariables.map((variable) => (
        <div key={variable} className="grid grid-cols-3 gap-2 items-center">
          <Label htmlFor={variable} className="text-right">
            {variable}:
          </Label>
          <Input
            id={variable}
            className="col-span-2"
            placeholder={`Enter ${variable}`}
            value={variables[variable] || ''}
            onChange={(e) => 
              setVariables(prev => ({ ...prev, [variable]: e.target.value }))
            }
          />
        </div>
      ))}
    </div>
  </Card>
)}
```

## Phase 3: Power Features

### Step 3.1: Add Response Format Handling

```bash
pnpm dlx shadcn@latest add tabs select badge
pnpm add react-markdown remark-gfm
```

### Step 3.2: Create Enhanced API Route

Update `src/app/api/llm/route.ts` to support different models and response formats:
```typescript
import { openai } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const MODELS = {
  'gpt-3.5-turbo': openai('gpt-3.5-turbo'),
  'gpt-4': openai('gpt-4'),
  'gpt-4-turbo': openai('gpt-4-turbo-preview'),
};

export async function POST(request: NextRequest) {
  try {
    const { 
      prompt, 
      model = 'gpt-3.5-turbo',
      temperature = 0.7,
      stream = true,
      responseFormat
    } = await request.json();
    
    if (!prompt || typeof prompt !== 'string') {
      return new Response('Invalid prompt', { status: 400 });
    }
    
    const selectedModel = MODELS[model as keyof typeof MODELS] || MODELS['gpt-3.5-turbo'];
    const promptTokens = Math.ceil(prompt.length / 4);
    
    // For JSON responses, use generateText instead of streamText
    if (responseFormat === 'json') {
      const result = await generateText({
        model: selectedModel,
        prompt: prompt + '\n\nRespond with valid JSON only.',
        temperature,
      });
      
      return new Response(JSON.stringify({
        response: result.text,
        tokens: { input: promptTokens, output: Math.ceil(result.text.length / 4) },
        model,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Stream for regular text
    const result = await streamText({
      model: selectedModel,
      prompt,
      temperature,
    });
    
    return result.toAIStreamResponse({
      headers: {
        'X-Prompt-Tokens': promptTokens.toString(),
        'X-Model': model,
      }
    });
  } catch (error) {
    console.error('LLM API error:', error);
    return new Response('Failed to process request', { status: 500 });
  }
}
```

### Step 3.3: Add Response Extraction

Create `src/components/ResponseViewer.tsx`:
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResponseViewerProps {
  response: string;
  extractorPattern?: string;
  extractorType?: 'regex' | 'jsonpath' | 'llm';
}

export function ResponseViewer({ 
  response, 
  extractorPattern, 
  extractorType = 'regex' 
}: ResponseViewerProps) {
  
  const extractContent = () => {
    if (!extractorPattern) return null;
    
    try {
      switch (extractorType) {
        case 'regex':
          const match = response.match(new RegExp(extractorPattern, 'i'));
          return match ? match[1] || match[0] : null;
          
        case 'jsonpath':
          // Simple JSON extraction
          try {
            const json = JSON.parse(response);
            // Basic path like "result.answer"
            const path = extractorPattern.split('.');
            let value = json;
            for (const key of path) {
              value = value[key];
            }
            return value?.toString() || null;
          } catch {
            return null;
          }
          
        default:
          return null;
      }
    } catch {
      return null;
    }
  };
  
  const extracted = extractContent();
  const isJSON = response.trim().startsWith('{') || response.trim().startsWith('[');
  
  return (
    <Tabs defaultValue="formatted" className="w-full">
      <TabsList>
        <TabsTrigger value="formatted">Formatted</TabsTrigger>
        <TabsTrigger value="raw">Raw</TabsTrigger>
        {extracted && <TabsTrigger value="extracted">Extracted</TabsTrigger>}
      </TabsList>
      
      <TabsContent value="formatted" className="mt-4">
        <div className="bg-gray-50 rounded-md border p-4 max-h-96 overflow-y-auto">
          {isJSON ? (
            <pre className="text-sm">
              {JSON.stringify(JSON.parse(response), null, 2)}
            </pre>
          ) : (
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              className="prose prose-sm max-w-none"
            >
              {response}
            </ReactMarkdown>
          )}
        </div>
      </TabsContent>
      
      <TabsContent value="raw" className="mt-4">
        <div className="bg-gray-50 rounded-md border p-4 max-h-96 overflow-y-auto">
          <pre className="whitespace-pre-wrap font-mono text-sm">
            {response}
          </pre>
        </div>
      </TabsContent>
      
      {extracted && (
        <TabsContent value="extracted" className="mt-4">
          <div className="bg-blue-50 rounded-md border border-blue-200 p-4">
            <div className="font-medium text-blue-900 mb-2">Extracted Content:</div>
            <div className="text-blue-800">{extracted}</div>
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
```

### Step 3.4: Add Prompt Comparison

Create `src/components/PromptComparison.tsx`:
```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ComparisonProps {
  basePrompt: string;
  onCompare: (prompts: string[]) => void;
}

export function PromptComparison({ basePrompt, onCompare }: ComparisonProps) {
  const [variants, setVariants] = useState<string[]>([basePrompt]);
  
  const addVariant = () => {
    setVariants([...variants, basePrompt]);
  };
  
  const updateVariant = (index: number, value: string) => {
    const updated = [...variants];
    updated[index] = value;
    setVariants(updated);
  };
  
  const runComparison = () => {
    onCompare(variants);
  };
  
  return (
    <Card className="p-4">
      <h3 className="font-medium mb-4">A/B Test Prompts</h3>
      <div className="space-y-2">
        {variants.map((variant, index) => (
          <textarea
            key={index}
            value={variant}
            onChange={(e) => updateVariant(index, e.target.value)}
            className="w-full p-2 border rounded-md min-h-24"
            placeholder={`Variant ${index + 1}`}
          />
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <Button onClick={addVariant} variant="outline" size="sm">
          Add Variant
        </Button>
        <Button onClick={runComparison} size="sm">
          Compare All
        </Button>
      </div>
    </Card>
  );
}
```

## Phase 4: Additional Enhancements

### Prompt Library
Store commonly used prompts in localStorage or database:
```typescript
const PROMPT_LIBRARY = [
  {
    name: "Summarize Text",
    template: "Summarize the following text in {{WORDS}} words:\n\n{{TEXT}}",
    category: "summarization"
  },
  {
    name: "Extract JSON",
    template: "Extract the following information from the text and return as JSON:\n{{FIELDS}}\n\nText: {{TEXT}}",
    category: "extraction"
  },
  // Add more templates
];
```

### Test Suite Functionality
Run the same prompt with multiple test cases:
```typescript
interface TestCase {
  name: string;
  variables: Record<string, string>;
  expectedPattern?: string;
}

const runTestSuite = async (
  template: string, 
  testCases: TestCase[]
) => {
  const results = await Promise.all(
    testCases.map(async (testCase) => {
      const prompt = processTemplate(template, testCase.variables);
      // Run the prompt and check against expected pattern
      return { testCase, result: await callLLM(prompt) };
    })
  );
  return results;
};
```

### Prompt Chaining
Use output from one prompt as input to another:
```typescript
const chainPrompts = async (chains: Array<{
  template: string;
  variables?: Record<string, string>;
  outputVariable: string;
}>) => {
  let context: Record<string, string> = {};
  
  for (const chain of chains) {
    const vars = { ...context, ...chain.variables };
    const prompt = processTemplate(chain.template, vars);
    const result = await callLLM(prompt);
    context[chain.outputVariable] = result;
  }
  
  return context;
};
```

## Troubleshooting Guide

### Common Issues

1. **Streaming not working**: 
   - Ensure you're using `export const runtime = 'edge'` in your API route
   - Check that your response handling properly reads the stream

2. **Token counting inaccurate**:
   - The `/4` estimation is rough; consider using `tiktoken` for accurate counts
   - Different models have different tokenization

3. **Variable syntax conflicts**:
   - If `{{VAR}}` conflicts with your prompts, use `<|VAR|>` or `[[VAR]]`

4. **Cost calculations wrong**:
   - Update the COSTS object when OpenAI changes pricing
   - Consider adding a settings page for custom pricing

5. **History not persisting**:
   - Check localStorage limits (usually 5-10MB)
   - Implement cleanup of old history items

## Security Considerations

1. **API Key Security**:
   - Never expose your API key in client-side code
   - Use environment variables and server-side API routes
   - Consider implementing rate limiting

2. **Input Validation**:
   - Sanitize user inputs before sending to LLM
   - Implement prompt size limits
   - Validate JSON responses before parsing

3. **Cost Control**:
   - Add spending limits
   - Track usage per session
   - Implement user-level quotas if sharing

## Next Steps

1. **Enhance the UI**: Add syntax highlighting for code in responses
2. **Add Export Options**: Save prompts and responses to files
3. **Implement Sharing**: Share prompts with unique URLs
4. **Add Analytics**: Track which prompts work best
5. **Build Prompt Templates**: Create a library of proven prompts
6. **Add Evaluation Metrics**: Automatically score responses
7. **Implement Caching**: Cache identical prompts (with TTL)
8. **Add Batch Processing**: Process multiple inputs in parallel

This improved plan provides a more focused, phased approach that gets you to a useful tool quickly while building in essential features like streaming, history, and cost tracking from the start.
