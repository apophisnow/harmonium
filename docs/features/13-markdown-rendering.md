# 13 — Markdown Rendering

## Summary

Render Discord-style markdown in message content: bold, italic, underline, strikethrough, code, code blocks, spoilers, and block quotes. This is a frontend-only feature — no backend changes needed.

## No Backend Changes

Message content is stored as plain text. All markdown rendering happens client-side.

## Dependencies

Add to `client/package.json`:

Option A (recommended): **Build a custom parser** — Discord's markdown is a subset of standard markdown with some differences (underline, spoiler). A custom parser avoids pulling in a heavy library and gives exact control.

Option B: Use `react-markdown` with `remark-gfm` and custom plugins. However, Discord markdown differs from standard markdown (e.g., `__underline__` vs emphasis), so customization is needed anyway.

**Recommendation: Custom parser.** It's ~150 lines of code and avoids dependency bloat.

## Implementation

### Create `client/src/utils/markdown.tsx`

A function that takes a message content string and returns React elements:

```typescript
export function renderMarkdown(content: string): React.ReactNode
```

**Supported syntax (in processing order):**

1. **Code blocks** (triple backtick): ` ```lang\ncode\n``` `
   - Render in a `<pre><code>` with `bg-th-bg-secondary rounded p-3 text-sm font-mono`
   - Optional syntax highlighting (defer to a later enhancement)
   - Process FIRST to prevent other formatting inside code blocks

2. **Inline code** (single backtick): `` `code` ``
   - Render in `<code>` with `bg-th-bg-secondary rounded px-1.5 py-0.5 text-sm font-mono`

3. **Spoilers**: `||hidden text||`
   - Render as a blurred/hidden span that reveals on click
   - Hidden: `bg-th-text-primary/20 text-transparent rounded px-1 cursor-pointer select-none`
   - Revealed: `bg-th-bg-accent rounded px-1`

4. **Bold + Italic**: `***text***` → `<strong><em>text</em></strong>`

5. **Bold**: `**text**` → `<strong>` with `font-bold`

6. **Italic**: `*text*` or `_text_` → `<em>` with `italic`

7. **Underline**: `__text__` → `<u>` with `underline`
   - Note: Discord uses `__` for underline, NOT bold. This differs from standard markdown.

8. **Strikethrough**: `~~text~~` → `<s>` with `line-through`

9. **Block quotes**: `> text` or `>>> text` (multiline)
   - Render with a left border: `border-l-4 border-th-border pl-3 text-th-text-muted`

10. **Headings**: `# H1`, `## H2`, `### H3`
    - Render with appropriate sizing, but NOT in the typical markdown heading sizes — Discord uses slightly larger text

11. **Masked links**: `[text](url)` → clickable link
    - Open in new tab with `rel="noopener noreferrer"`
    - Style: `text-th-brand hover:underline`

12. **Unordered lists**: `- item` or `* item`

13. **Newlines**: `\n` → `<br />`

14. **URL auto-linking**: detect bare URLs and wrap in `<a>` tags

### Parse order matters

Process in this order to handle nesting correctly:
1. Extract code blocks (replace with placeholders)
2. Extract inline code (replace with placeholders)
3. Process remaining markdown syntax
4. Restore code blocks and inline code

### Create `client/src/components/chat/Spoiler.tsx`

A small component for spoiler text:

```tsx
function Spoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={() => setRevealed(!revealed)}
      className={revealed ? 'bg-th-bg-accent rounded px-1' : 'bg-th-text-primary/20 text-transparent rounded px-1 cursor-pointer select-none'}
    >
      {children}
    </span>
  );
}
```

### Modify `client/src/components/chat/MessageItem.tsx`

Replace raw content rendering with:

```tsx
// Before:
<p>{message.content}</p>

// After:
<div className="message-content">{renderMarkdown(message.content)}</div>
```

### Modify `client/src/components/chat/MessageInput.tsx`

No changes needed — users type raw markdown. Optionally, add toolbar buttons for formatting (bold, italic, code) that insert the markdown syntax around selected text.

## Testing

Create `client/src/utils/markdown.test.ts` with cases for:
- Each syntax individually
- Nested formatting (`***bold italic***`)
- Code blocks preventing inner formatting
- Spoiler text
- Edge cases: empty strings, unclosed tags, mismatched delimiters
- XSS prevention: ensure `<script>` and event handlers are not rendered

## Security

- **Critical**: Sanitize all HTML output. The markdown parser should ONLY produce the allowed elements (`strong`, `em`, `u`, `s`, `code`, `pre`, `a`, `br`, `span`, `blockquote`).
- Never use `dangerouslySetInnerHTML` — build React elements directly.
- URL validation: only allow `http://` and `https://` protocols in links.

## Edge Cases

- Unclosed formatting: treat as plain text (e.g., `**hello` renders as `**hello`)
- Formatting across newlines: each formatting token should be on the same line
- Empty code blocks: render an empty code block
- Extremely long messages: should perform well up to 4000 chars (the max message length)
- Emoji within formatted text: should render correctly
- Mentions within formatted text: mentions (`<@userId>`) should be parsed separately and still work
