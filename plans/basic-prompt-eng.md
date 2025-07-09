# Basic Prompt Engineering Tool - Implementation Plan

## Overview

This plan outlines building a personal prompt engineering tool using your existing Next.js 15 app router structure. The tool will support the core prompt engineering workflow: defining prompts, sending them to LLMs, reviewing responses, and iterating quickly.

## Core Features

1. **Prompt Management**: Create and edit prompt templates with variables
2. **LLM Integration**: Send prompts to OpenAI GPT models
3. **Response Review**: Display raw and extracted outputs
4. **Quick Iteration**: Easy editing and re-running of prompts

## shadcn/ui Components Used

This implementation makes extensive use of shadcn/ui components for better UX:
- **Alert**: For error messages instead of basic styling
- **Button**: For consistent button styling and states
- **Card**: For better content organization
- **Skeleton**: For loading states instead of just text
- **ScrollArea**: For better scrolling of long responses
- **Separator**: For visual section dividers
- **Toast**: For better notifications instead of browser alerts
- **Textarea**: For multi-line input with proper styling
- **Input/Label**: For form inputs with proper accessibility
- **Tabs**: For organizing raw vs extracted responses
- **Select**: For model selection dropdown
- **Badge**: For status indicators and labels

## API Integration Strategy

This implementation uses a custom hook approach optimized for LLM interactions:
- **Custom Hook**: Simple `useLLMCall` hook for LLM-specific needs
- **No Caching**: LLM responses are unique and shouldn't be cached
- **Longer Timeouts**: Accounts for LLM response times (10-30 seconds)
- **No Automatic Retries**: Prevents costly repeated API calls
- **Toast Notifications**: User feedback without duplicate error displays
- **Request Deduplication**: Prevents multiple simultaneous requests

## Step-by-Step Implementation

### Prerequisites Check

Before starting, verify these are working in your project:

1. **TanStack Query Setup**: Check that `@tanstack/react-query` is in your `providers.tsx`
2. **Authentication**: Ensure you can access routes under `(authenticated)/`
3. **shadcn**: Verify shadcn components are working by importing a basic component like `Button`

### Step 1: Environment Setup & API Route

#### 1.1 Install Dependencies
```bash
pnpm add ai
```

#### 1.2 Environment Variables
Create `.env`:
```
OPENAI_API_KEY=your_api_key_here
```

Update `src/env.ts` to validate the API key:
```typescript
// Add to your environment validation
OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
```

#### 1.3 Create Basic API Route
Create `src/app/api/llm/route.ts`:
```typescript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
    }
    
    const { text } = await generateText({
      model: openai('gpt-3.5-turbo'),
      prompt,
      temperature: 0.7,
    });
    
    return NextResponse.json({ response: text });
  } catch (error) {
    console.error('LLM API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
```

#### 1.4 Test the API Route
Test your API route before building UI:

```bash
# Test with curl
curl -X POST http://localhost:3000/api/llm \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Say hello"}'
```

**Expected Response**: `{"response": "Hello! How can I help you today?"}`

**If it fails**: Check your OpenAI API key and ensure the server is running.

### Step 2: Create Minimal Working UI

#### 2.1 Add Basic shadcn Components
```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add textarea
pnpm dlx shadcn@latest add alert
```

Note: The `toast` component requires adding the `<Toaster />` component to your layout. Add this to your `app/layout.tsx`:

```tsx
import { Toaster } from '@/components/ui/toaster';

// Add <Toaster /> before the closing </body> tag
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

Test each component after adding:
```typescript
// Create a test component to verify components work
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function TestComponents() {
  return (
    <div>
      <Textarea placeholder="Test textarea" />
      <Button>Test button</Button>
    </div>
  );
}
```

#### 2.2 Create Custom Hook for LLM Calls
First, create `src/hooks/useLLMCall.ts`:
```typescript
import { useState, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface LLMCallState {
  isLoading: boolean;
  error: string | null;
  response: string | null;
}

export const useLLMCall = () => {
  const { toast } = useToast();
  const [state, setState] = useState<LLMCallState>({
    isLoading: false,
    error: null,
    response: null,
  });
  
  // Prevent duplicate requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendPrompt = async (prompt: string) => {
    if (!prompt.trim()) return;
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setState({ isLoading: true, error: null, response: null });
    
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: abortControllerRef.current.signal,
        // Longer timeout for LLM calls
        timeout: 60000, // 60 seconds
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response');
      }
      
      setState({ isLoading: false, error: null, response: data.response });
      
      toast({
        title: "Success",
        description: "Prompt processed successfully",
      });
      
    } catch (error) {
      // Don't show error for aborted requests
      if (error.name === 'AbortError') return;
      
      const errorMessage = error.message || 'Failed to process prompt';
      setState({ isLoading: false, error: errorMessage, response: null });
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };
  
  const reset = () => {
    setState({ isLoading: false, error: null, response: null });
  };

  return {
    ...state,
    sendPrompt,
    reset,
  };
};
```

#### 2.3 Create Minimal Prompt Tool
Create `src/app/(authenticated)/prompt-engineering/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useLLMCall } from '@/hooks/useLLMCall';

export default function PromptEngineeringPage() {
  const [prompt, setPrompt] = useState('');
  const { isLoading, response, sendPrompt, reset } = useLLMCall();

  const handleSubmit = () => {
    sendPrompt(prompt);
  };

  const handleClear = () => {
    setPrompt('');
    reset();
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Prompt Engineering Tool</h1>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium mb-2">
            Enter your prompt:
          </label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="min-h-32"
          />
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={handleSubmit} 
            disabled={!prompt.trim() || isLoading}
            className="flex-1"
          >
            {isLoading ? 'Generating...' : 'Send to LLM'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleClear}
            disabled={isLoading}
          >
            Clear
          </Button>
        </div>
        
        <Separator />
        
        {isLoading && (
          <div>
            <label className="block text-sm font-medium mb-2">Response:</label>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        )}
        
        {response && (
          <div>
            <label className="block text-sm font-medium mb-2">Response:</label>
            <ScrollArea className="h-64 w-full rounded-md border bg-gray-50">
              <pre className="whitespace-pre-wrap p-4 text-sm">
                {response}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 2.4 Test the Basic Implementation
1. Start your dev server: `pnpm dev`
2. Navigate to `/prompt-engineering`
3. Enter a simple prompt like "Say hello"
4. Click "Send to LLM"
5. **Expected**: You should see a response appear below
6. Test the "Clear" button to reset everything

**If it doesn't work**: Check the browser console for errors and verify your API key is set correctly.

**Benefits of this approach**:
- **No caching**: Each LLM call is fresh (appropriate for unique prompts)
- **Request cancellation**: Previous requests are cancelled when new ones start
- **Single error source**: Only toast notifications, no duplicate error displays
- **LLM-optimized**: Longer timeout, no automatic retries (cost-conscious)

### Step 3: Add Variable Templating

#### 3.1 Add More Components
```bash
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add label
pnpm dlx shadcn@latest add skeleton
pnpm dlx shadcn@latest add separator
```

#### 3.2 Add Template Processing
Update your page to include template processing:

```typescript
// Add this function to your component
const extractVariables = (text: string): string[] => {
  const matches = text.match(/\{([^}]+)\}/g);
  return matches ? matches.map(match => match.slice(1, -1)) : [];
};

const processTemplate = (template: string, vars: Record<string, string>): string => {
  let processed = template;
  Object.entries(vars).forEach(([key, value]) => {
    processed = processed.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  });
  return processed;
};

// Add this state
const [variables, setVariables] = useState<Record<string, string>>({});

// Update your JSX to include variable inputs
const templateVariables = extractVariables(prompt);

// Add this after the textarea
{templateVariables.length > 0 && (
  <div className="space-y-2">
    <label className="block text-sm font-medium">Variables:</label>
    {templateVariables.map((variable) => (
      <div key={variable}>
        <Label htmlFor={variable}>{variable}</Label>
        <Input
          id={variable}
          placeholder={`Enter value for ${variable}`}
          value={variables[variable] || ''}
          onChange={(e) => 
            setVariables(prev => ({ ...prev, [variable]: e.target.value }))
          }
        />
      </div>
    ))}
  </div>
)}

// Update handleSubmit to use processTemplate
const handleSubmit = () => {
  const finalPrompt = processTemplate(prompt, variables);
  sendPrompt(finalPrompt);
};
```

#### 3.3 Test Variable Templating
1. Enter a template like: `"Write a {LENGTH} story about {TOPIC}"`
2. **Expected**: Two input fields should appear for LENGTH and TOPIC
3. Fill them in and submit
4. **Expected**: The variables should be replaced in the final prompt

### Step 4: Add Response Extraction

#### 4.1 Add Tabs and Enhancement Components
```bash
pnpm dlx shadcn@latest add tabs
pnpm dlx shadcn@latest add toast
pnpm dlx shadcn@latest add scroll-area
```

#### 4.2 Add Extraction Logic
Add an extractor regex input and tab-based response display:

```typescript
// Add this state
const [extractorRegex, setExtractorRegex] = useState('');

// Add this function
const extractAnswer = (text: string, regex: string): string | null => {
  if (!regex) return null;
  try {
    const match = text.match(new RegExp(regex, 'i'));
    return match ? match[1] || match[0] : null;
  } catch {
    return null;
  }
};

// Add regex input to your JSX
<div>
  <Label htmlFor="regex">Answer Extractor (Optional Regex)</Label>
  <Input
    id="regex"
    placeholder="e.g., Answer: (.+)"
    value={extractorRegex}
    onChange={(e) => setExtractorRegex(e.target.value)}
  />
</div>

// Replace the response display with tabs
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const extractedAnswer = response ? extractAnswer(response, extractorRegex) : null;

{response && (
  <Tabs defaultValue="raw" className="w-full">
    <TabsList className="grid w-full grid-cols-2">
      <TabsTrigger value="raw">Raw Response</TabsTrigger>
      <TabsTrigger value="extracted" disabled={!extractedAnswer}>
        Extracted Answer
      </TabsTrigger>
    </TabsList>
    
    <TabsContent value="raw" className="mt-4">
      <ScrollArea className="h-64 w-full rounded-md border bg-gray-50">
        <pre className="whitespace-pre-wrap p-4 text-sm">
          {response}
        </pre>
      </ScrollArea>
    </TabsContent>
    
    <TabsContent value="extracted" className="mt-4">
      {extractedAnswer ? (
        <div className="bg-blue-50 p-4 rounded-md border">
          <strong>Extracted Answer:</strong>
          <p className="mt-2">{extractedAnswer}</p>
        </div>
      ) : (
        <p className="text-gray-500">No answer extracted</p>
      )}
    </TabsContent>
  </Tabs>
)}
```

#### 4.3 Test Response Extraction
1. Use a prompt like: `"What is 2+2? Answer: [your answer]"`
2. Add regex: `Answer: (.+)`
3. **Expected**: The extracted answer tab should show just the answer

### Step 5: Add Polish and Persistence

#### 5.1 Add Remaining Components
```bash
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add select
pnpm dlx shadcn@latest add badge
pnpm add lucide-react
```

#### 5.2 Add Features Incrementally
Now you can add features one by one:

1. **Model Selection**: Add a select dropdown for different models
2. **Persistence**: Add localStorage to save/restore state
3. **Clear Function**: Add a button to clear all inputs
4. **Better Error Handling**: Improve error messages
5. **Loading States**: Add spinners and better loading feedback

#### 5.3 Optional: Enhance the Custom Hook
You can enhance the custom hook with additional features:

```typescript
// Enhanced version of useLLMCall with model selection
import { useState, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface LLMCallOptions {
  model?: string;
  temperature?: number;
}

export const useLLMCall = () => {
  const { toast } = useToast();
  const [state, setState] = useState<LLMCallState>({
    isLoading: false,
    error: null,
    response: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendPrompt = async (prompt: string, options?: LLMCallOptions) => {
    if (!prompt.trim()) return;
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setState({ isLoading: true, error: null, response: null });
    
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          model: options?.model || 'gpt-3.5-turbo',
          temperature: options?.temperature || 0.7,
        }),
        signal: abortControllerRef.current.signal,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response');
      }
      
      setState({ isLoading: false, error: null, response: data.response });
      
      toast({
        title: "Success",
        description: "Prompt processed successfully",
      });
      
    } catch (error) {
      if (error.name === 'AbortError') return;
      
      const errorMessage = error.message || 'Failed to process prompt';
      setState({ isLoading: false, error: errorMessage, response: null });
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };
  
  return { ...state, sendPrompt, reset };
};
```

#### 5.4 Test Each Feature
Test each feature individually before moving to the next.

### Step 6: Refactor to Clean Architecture (Optional)

Once everything is working, you can optionally refactor into the clean component architecture shown in the previous sections. But only do this after you have a working implementation.

## Troubleshooting Guide

### Common Issues and Solutions

#### API Route Problems
- **"OpenAI API key not found"**: Ensure your `.env` file is in the project root and the key is correct
- **CORS errors**: Make sure you're calling the API from the same domain (localhost:3000)
- **Network timeout**: Check your internet connection and OpenAI service status

#### Component Issues
- **shadcn components not working**: Run `npx shadcn-ui@latest init` to set up shadcn if not already done
- **Import errors**: Ensure all required dependencies are installed with `pnpm install`
- **Styling issues**: Check that Tailwind CSS is properly configured

#### Authentication Problems
- **Can't access `/prompt-engineering`**: Ensure you're signed in and the route is under `(authenticated)/`
- **Redirect loops**: Check your middleware configuration and Clerk setup

#### Custom Hook Issues
- **Hook not working**: Ensure the custom hook is properly imported and used
- **Toast notifications not appearing**: Check that `<Toaster />` is added to your layout
- **Request cancellation**: Previous requests should be cancelled automatically
- **Timeout errors**: LLM calls have a 60-second timeout, increase if needed

### Development Tips

1. **Start Simple**: Get the basic API call working before adding complexity
2. **Test Incrementally**: After each step, verify the feature works before moving on
3. **Use Browser DevTools**: Check the Network tab for API call issues
4. **Check Console**: Look for JavaScript errors that might break functionality
5. **Environment Variables**: Restart your dev server after changing environment variables

### Performance Considerations

- **API Rate Limits**: OpenAI has rate limits; don't make too many requests quickly
- **Large Responses**: Consider truncating very long responses in the UI
- **localStorage**: Be mindful of localStorage size limits (usually 5-10MB)

### Optional: Clean Architecture Refactoring

If you want to refactor to the clean component architecture after everything is working, you can split your single-page component into:

1. **Container Component**: Manages state and API calls
2. **Editor Component**: Handles prompt input and templating
3. **Viewer Component**: Displays responses and extraction
4. **Navigation**: Add links to your authenticated layout

But remember: **Only refactor after you have a working implementation**. The goal is to get something working quickly, then improve it iteratively.

## Usage Guide

### Basic Workflow

1. **Create a Template**: Enter your prompt in the template field using `{VARIABLE_NAME}` syntax
2. **Fill Variables**: Input values for any variables you defined
3. **Optional Regex**: Add a regex pattern to extract specific answers
4. **Send to LLM**: Click the button to process your prompt
5. **Review Response**: Check both raw and extracted responses
6. **Iterate**: Modify your template and re-run quickly

### Example Templates

#### Simple Question
```
Answer the following question: {QUESTION}
```

#### Summarization
```
Summarize the following text in {WORD_COUNT} words:

{TEXT}
```

#### Classification with Format
```
Classify the following text as positive, negative, or neutral:

Text: {TEXT}

Answer: [Your classification]
```

#### Few-Shot Example
```
Classify customer feedback sentiment:

Example 1: "Great product!" -> Positive
Example 2: "Terrible service" -> Negative
Example 3: "It's okay" -> Neutral

Now classify: {FEEDBACK}
Answer: 
```

## What You Can Skip Initially

- **Dataset Management**: Focus on single inputs
- **Advanced Metrics**: Manual review is sufficient
- **Complex Exemplar Selection**: Manually add examples
- **Automated Prompt Engineering**: Keep it manual for learning
- **Version Control**: Simple copy-paste for now

## Improvements Over Basic Implementation

This updated plan addresses several issues from the initial approach:

- **Custom Hook Pattern**: Clean separation of API logic from UI components
- **Request Cancellation**: Automatic cancellation of previous requests to prevent conflicts
- **LLM-Optimized**: Longer timeouts, no caching, single error source
- **Cost-Conscious**: No automatic retries to prevent unexpected API charges
- **Better UX**: Loading states, clear functionality, and toast notifications
- **Simplified State**: No duplicate error handling or complex state management
- **Input Validation**: Validates templates and regex patterns before submission
- **Enhanced API Route**: Better error handling and input validation
- **Component Architecture**: Clean separation of concerns for better maintainability

## Why Not React Query for This Use Case

While React Query is excellent for many scenarios, it's not optimal for LLM interactions because:

- **No Caching Needed**: Each LLM response is unique and shouldn't be cached
- **No Background Refetch**: LLM calls are expensive and intentional
- **No Optimistic Updates**: Can't predict LLM responses
- **Cost Sensitivity**: Need explicit control over when API calls happen
- **Simple Use Case**: Basic request/response pattern doesn't need complex state management

## Next Steps for Enhancement

1. **Prompt History**: Save and reload previous prompts using localStorage or database
2. **Model Selection**: Support different OpenAI models with enhanced custom hook
3. **Batch Processing**: Handle multiple inputs with Promise.all or sequential processing
4. **Export Results**: Save responses to files (JSON, CSV, etc.)
5. **Prompt Library**: Common templates collection with local storage or database
6. **A/B Testing**: Compare different prompt versions with side-by-side requests
7. **Streaming Responses**: Implement real-time streaming for better UX
8. **Cost Tracking**: Monitor API usage and costs per prompt
9. **Request Queuing**: Handle rate limits with proper queuing system
10. **Prompt Validation**: Add validation for prompt structure and variables

## Security Notes

- Keep your OpenAI API key secure in environment variables
- Consider rate limiting for API calls
- Monitor your API usage and costs
- Use authentication (already set up with Clerk)

This plan provides a solid foundation for your prompt engineering tool while keeping it simple and focused on the core iterative workflow.
