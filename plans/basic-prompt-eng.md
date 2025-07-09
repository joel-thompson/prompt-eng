# Pragmatic Prompt Engineering Tool - Build & Learn

## Goal
Build a minimal but practical tool for learning prompt engineering through deliberate practice. Include only the features you'll definitely need, skip everything else.

## Realistic Timeline
- **45-60 minutes** to build
- **30 days** to learn prompt engineering through daily practice

## What You'll Actually Build

### Core Features (You'll Need These)
1. **Prompt Interface**: Textarea with keyboard shortcuts
2. **Response Display**: With token counts and copy functionality  
3. **Prompt History**: Because you WILL lose good prompts
4. **Simple Templates**: Because you WILL repeat patterns
5. **Basic Error Handling**: Because APIs fail

### What You'll Skip (Until Proven Necessary)
- Streaming responses
- Multiple models  
- Beautiful UI (well, shadcn makes it beautiful by default!)
- Response extraction
- Complex variables
- Test suites

## Setup Phase (15 minutes)

### Install Dependencies
```bash
# Core dependencies
pnpm add ai openai

# Install shadcn components we'll use
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add textarea
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add badge
pnpm dlx shadcn@latest add alert
pnpm dlx shadcn@latest add scroll-area
pnpm dlx shadcn@latest add separator
pnpm dlx shadcn@latest add tabs
```

### Environment Setup
Create `.env`:
```
OPENAI_API_KEY=sk-...your-key-here
```

### Quick Validation Script
Create `test-api.js` to verify your setup:
```javascript
// Quick test - run with: node test-api.js
const { openai } = require('@ai-sdk/openai');
const { generateText } = require('ai');

async function test() {
  const { text } = await generateText({
    model: openai('gpt-3.5-turbo'),
    prompt: 'Say "API is working!"',
  });
  console.log(text);
}

test().catch(console.error);
```

## Build Phase (35-50 minutes)

### Step 1: API Route with Error Handling (10 minutes)

Create `src/app/api/llm/route.ts`:
```typescript
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    
    if (!prompt || typeof prompt !== 'string') {
      return Response.json(
        { error: 'Invalid prompt' }, 
        { status: 400 }
      );
    }
    
    // Token estimation (rough but useful)
    const promptTokens = Math.ceil(prompt.length / 4);
    
    const { text } = await generateText({
      model: openai('gpt-3.5-turbo'),
      prompt,
      maxTokens: 2000, // Prevent runaway costs
    });
    
    const responseTokens = Math.ceil(text.length / 4);
    const totalTokens = promptTokens + responseTokens;
    const estimatedCost = (promptTokens * 0.0005 + responseTokens * 0.0015) / 1000;
    
    return Response.json({ 
      response: text,
      usage: {
        promptTokens,
        responseTokens,
        totalTokens,
        estimatedCost
      }
    });
    
  } catch (error: any) {
    console.error('LLM Error:', error);
    
    // User-friendly error messages
    if (error.status === 429) {
      return Response.json(
        { error: 'Rate limited. Please wait a minute and try again.' },
        { status: 429 }
      );
    }
    
    if (error.status === 401) {
      return Response.json(
        { error: 'Invalid API key. Check your .env file.' },
        { status: 401 }
      );
    }
    
    return Response.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

### Step 2: Main UI with History & Templates (25-35 minutes)

Create `src/app/(authenticated)/prompt/page.tsx`:
```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Loader2, AlertCircle, Clock, DollarSign } from 'lucide-react';

// Types
interface HistoryItem {
  id: string;
  prompt: string;
  response: string;
  tokens: number;
  cost: number;
  timestamp: string;
}

interface Template {
  name: string;
  prompt: string;
}

// Built-in templates for common patterns
const TEMPLATES: Template[] = [
  {
    name: 'Basic Question',
    prompt: 'Answer this question concisely: [YOUR QUESTION]'
  },
  {
    name: 'Step-by-Step',
    prompt: 'Explain [TOPIC] step by step in simple terms.'
  },
  {
    name: 'Pros and Cons',
    prompt: 'List the pros and cons of [TOPIC] in a balanced way.'
  },
  {
    name: 'ELI5',
    prompt: 'Explain [TOPIC] like I\'m 5 years old.'
  },
  {
    name: 'Code Review',
    prompt: 'Review this code and suggest improvements:\n\n[YOUR CODE]'
  }
];

export default function PromptPage() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<any>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('prompt-history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // Save to history
  const saveToHistory = (prompt: string, response: string, usage: any) => {
    const item: HistoryItem = {
      id: Date.now().toString(),
      prompt,
      response,
      tokens: usage.totalTokens,
      cost: usage.estimatedCost,
      timestamp: new Date().toISOString()
    };
    
    const newHistory = [item, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem('prompt-history', JSON.stringify(newHistory));
  };

  const submit = async () => {
    if (!prompt.trim() || loading) return;
    
    setLoading(true);
    setError('');
    setResponse('');
    setUsage(null);
    
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }
      
      setResponse(data.response);
      setUsage(data.usage);
      saveToHistory(prompt, data.response, data.usage);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    setPrompt(item.prompt);
    setResponse(item.response);
    setUsage({
      totalTokens: item.tokens,
      estimatedCost: item.cost
    });
  };

  const loadTemplate = (template: Template) => {
    setPrompt(template.prompt);
    textareaRef.current?.focus();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clearAll = () => {
    setPrompt('');
    setResponse('');
    setError('');
    setUsage(null);
  };

  // Keyboard shortcut
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Prompt Engineering Tool</CardTitle>
          <CardDescription>
            Practice and refine your prompts with instant feedback
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="prompt" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="prompt" className="space-y-4">
          {/* Templates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((template) => (
                  <Button
                    key={template.name}
                    variant="secondary"
                    size="sm"
                    onClick={() => loadTemplate(template)}
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main Input */}
          <Card>
            <CardContent className="pt-6">
              <Textarea
                ref={textareaRef}
                className="min-h-[200px] font-mono text-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your prompt here... (Cmd/Ctrl + Enter to submit)"
                disabled={loading}
              />
              
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={submit}
                  disabled={loading || !prompt.trim()}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Thinking...' : 'Submit (⌘↵)'}
                </Button>
                <Button
                  variant="outline"
                  onClick={clearAll}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Response */}
          {response && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">Response</CardTitle>
                  <div className="flex items-center gap-2">
                    {usage && (
                      <>
                        <Badge variant="secondary" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {usage.totalTokens} tokens
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${usage.estimatedCost.toFixed(4)}
                        </Badge>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(response)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {response}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prompt History</CardTitle>
              <CardDescription>
                Click any item to load it
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No history yet. Start by submitting a prompt!
                </p>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {history.map((item, index) => (
                      <div key={item.id}>
                        <Card
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => loadFromHistory(item)}
                        >
                          <CardContent className="pt-4">
                            <p className="font-mono text-sm line-clamp-2 mb-2">
                              {item.prompt}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{new Date(item.timestamp).toLocaleString()}</span>
                              <Badge variant="outline" className="text-xs">
                                {item.tokens} tokens
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                ${item.cost.toFixed(4)}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                        {index < history.length - 1 && <Separator className="my-2" />}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Step 3: Test & Iterate (10 minutes)

1. Run `pnpm dev`
2. Navigate to `/prompt`
3. Test these scenarios:
   - Basic prompt
   - Template usage
   - History save/load
   - Error handling (try a massive prompt)
   - Keyboard shortcut
   - Tab switching
   - Copy functionality

## Learning Curriculum: 30 Days of Prompt Engineering

### Week 1: Foundation Patterns
**Day 1 - Instruction Following**
- Morning: "Write a haiku about [topic]"
- Afternoon: "Write a haiku about [topic] without using the letter 'e'"
- Evening: Compare how constraints affect output

**Day 2 - Role Playing**
- Test: "Explain quantum physics" vs "As a kindergarten teacher, explain quantum physics"
- Track which roles produce better explanations

**Day 3 - Output Formatting**
- Try same prompt with: "Reply in JSON", "Reply as a list", "Reply in one sentence"
- Learn how format instructions affect content

**Day 4 - Examples (Few-Shot)**
```
Good review: "The product works great!" → Positive
Bad review: "Completely broken" → Negative
Classify: "It's okay I guess" → ?
```

**Day 5 - Chain of Thought**
- Compare: "What's 17 * 23?" vs "What's 17 * 23? Show your work step by step"

**Day 6 - Constraints & Creativity**
- "Write a story about a robot" with different constraints:
  - In 50 words
  - Without using 'robot', 'machine', or 'AI'
  - As a news report

**Day 7 - Review & Combine**
- Combine patterns: Role + Format + Constraints
- Example: "As a pirate, explain cloud computing in exactly 3 bullet points"

### Week 2: Advanced Patterns

**Day 8 - Meta Prompting**
- "Generate 5 different ways to ask about [topic]"
- Use the best generated prompt

**Day 9 - Self-Critique**
- "Explain [topic]. Then critique your explanation and provide an improved version."

**Day 10 - Structured Extraction**
- Give the model messy text and extract structured data
- Practice with emails, articles, conversations

**Day 11 - Prompt Chaining**
- Use output from one prompt as input to another
- Build multi-step workflows

**Day 12 - Adversarial Prompting**
- Try to make the model fail productively
- Learn its limitations

**Day 13 - Temperature Experiments**
- (Add temperature control to your tool first)
- Same prompt at 0, 0.5, 1.0 temperature

**Day 14 - Weekly Challenge**
- Build a complex prompt that uses 5+ techniques

### Week 3: Domain-Specific Practice

**Day 15-16 - Code Generation**
- Function from description
- Code review and improvement
- Bug fixing prompts

**Day 17-18 - Creative Writing**
- Story continuation
- Style transfer
- Character dialogue

**Day 19-20 - Data Analysis**
- Explain data patterns
- Generate analysis code
- Create visualizations

**Day 21 - Personal Domain**
- Focus on your specific use case

### Week 4: Optimization & Mastery

**Day 22-23 - Prompt Optimization**
- Take your best prompts and make them 50% shorter
- Test if quality maintains

**Day 24-25 - Failure Analysis**
- Collect your worst outputs
- Understand why they failed
- Fix the prompts

**Day 26-27 - Speed Running**
- How fast can you write effective prompts?
- Build muscle memory

**Day 28-29 - Teaching Others**
- Explain your best techniques
- Create a prompt template library

**Day 30 - Reflection**
- Review your history
- Identify your most effective patterns
- Plan next steps

## Daily Practice Structure

1. **Morning (15 min)**: Try the daily challenge
2. **Afternoon (15 min)**: Experiment with variations
3. **Evening (10 min)**: Review and save best prompts

## Tracking Progress

Add this simple tracking to your tool:

```typescript
// Add to your history items
interface HistoryItem {
  // ... existing fields
  rating?: number; // 1-5 stars
  notes?: string;  // What worked/didn't
}

// After each session, rate your prompts
const ratePrompt = (id: string, rating: number, notes: string) => {
  const updated = history.map(item => 
    item.id === id ? { ...item, rating, notes } : item
  );
  setHistory(updated);
  localStorage.setItem('prompt-history', JSON.stringify(updated));
};
```

## When to Add Features

Only add these if you hit the need repeatedly:

1. **Model Selection** - When GPT-3.5 consistently fails your use case
2. **Temperature Control** - When you need more creativity/consistency
3. **System Prompts** - When you repeat the same instructions
4. **Import/Export** - When you want to share prompt libraries
5. **Token Limit Warnings** - When you hit context limits

## Anti-Patterns to Recognize

1. **Overloading** - Trying to do too much in one prompt
2. **Underspecifying** - Being too vague about desired output
3. **Anthropomorphizing** - "Please" and "Thank you" don't help
4. **Fighting the Model** - If it consistently fails, change approach

## Resources for Deeper Learning

1. **Practice Grounds**
   - [OpenAI Playground](https://platform.openai.com/playground) - For comparison
   - Your tool - For focused practice

2. **References**
   - [OpenAI Cookbook](https://cookbook.openai.com/) - Official examples
   - [Anthropic's Prompt Engineering](https://docs.anthropic.com/claude/docs/prompt-engineering) - Different perspective

3. **Community**
   - Share your best prompts
   - Learn from others' patterns

## Success Metrics

You're improving when:
- Prompts work on first try more often
- You need fewer tokens for same quality
- You can predict how changes affect output
- You recognize which pattern to use instantly

## Final Tips

1. **Start Simple** - Master basic patterns before combining
2. **Save Everything** - Your history is your textbook
3. **Experiment Daily** - Consistency beats intensity
4. **Focus on Understanding** - Why did that prompt work?
5. **Build Your Style** - Develop personal prompt patterns

Remember: The tool is just a bicycle. The real learning happens through deliberate practice and reflection.
