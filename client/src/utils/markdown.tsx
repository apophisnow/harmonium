import type { ReactNode } from 'react';
import { Spoiler } from '../components/chat/Spoiler.js';

let keyCounter = 0;
function nextKey(): string {
  return `md-${keyCounter++}`;
}

/**
 * Renders Discord-style markdown into React elements.
 * Never uses dangerouslySetInnerHTML. Only produces allowed elements.
 */
export function renderMarkdown(text: string): ReactNode {
  keyCounter = 0;

  // Step 1: Extract code blocks and inline code (protect from further parsing)
  const codeBlocks: { id: string; element: ReactNode }[] = [];

  function stashBlock(element: ReactNode): string {
    const id = `\x00CB${codeBlocks.length}\x00`;
    codeBlocks.push({ id, element });
    return id;
  }

  // Extract fenced code blocks: ```lang\ncode\n```
  let processed = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang: string, code: string) => {
    const trimmed = code.replace(/\n$/, '');
    const el = (
      <pre key={nextKey()} className="bg-th-bg-secondary rounded p-3 text-sm font-mono my-1 overflow-x-auto whitespace-pre-wrap">
        <code>{trimmed}</code>
      </pre>
    );
    return stashBlock(el);
  });

  // Extract inline code: `code`
  processed = processed.replace(/`([^`\n]+?)`/g, (_match, code: string) => {
    const el = (
      <code key={nextKey()} className="bg-th-bg-secondary rounded px-1.5 py-0.5 text-sm font-mono">
        {code}
      </code>
    );
    return stashBlock(el);
  });

  // Step 2: Split by lines to handle block-level syntax, then process inline
  const lines = processed.split('\n');
  const result: ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Block quotes: > text
    if (/^>\s/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      result.push(
        <blockquote key={nextKey()} className="border-l-4 border-th-border pl-3 my-1">
          {parseInlineContent(quoteLines.join('\n'), codeBlocks)}
        </blockquote>
      );
      continue;
    }

    // Headings: # H1, ## H2, ### H3
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const sizes = ['text-xl font-bold', 'text-lg font-bold', 'text-base font-semibold'];
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
      result.push(
        <Tag key={nextKey()} className={`${sizes[level - 1]} my-1`}>
          {parseInline(content, codeBlocks)}
        </Tag>
      );
      i++;
      continue;
    }

    // Unordered list items: - item or * item
    if (/^[\-\*]\s+/.test(line)) {
      const listItems: ReactNode[] = [];
      while (i < lines.length && /^[\-\*]\s+/.test(lines[i])) {
        const itemContent = lines[i].replace(/^[\-\*]\s+/, '');
        listItems.push(
          <li key={nextKey()}>{parseInline(itemContent, codeBlocks)}</li>
        );
        i++;
      }
      result.push(
        <ul key={nextKey()} className="list-disc list-inside my-1">
          {listItems}
        </ul>
      );
      continue;
    }

    // Regular line: parse inline and add
    if (line.trim() === '' && i > 0 && i < lines.length - 1) {
      result.push(<br key={nextKey()} />);
    } else {
      const inlineContent = parseInlineContent(line, codeBlocks);
      if (result.length > 0 && i > 0 && lines[i - 1] !== '') {
        result.push(<br key={nextKey()} />);
      }
      result.push(<span key={nextKey()}>{inlineContent}</span>);
    }
    i++;
  }

  return <>{result}</>;
}

/** Parse a line that may contain stashed code blocks interspersed with inline markdown */
function parseInlineContent(text: string, codeBlocks: { id: string; element: ReactNode }[]): ReactNode {
  return parseInline(text, codeBlocks);
}

/** Parse inline markdown, restoring stashed code blocks */
function parseInline(text: string, codeBlocks: { id: string; element: ReactNode }[]): ReactNode {
  // Split on code block placeholders first
  const parts = text.split(/(\x00CB\d+\x00)/);
  const nodes: ReactNode[] = [];

  for (const part of parts) {
    const block = codeBlocks.find((b) => b.id === part);
    if (block) {
      nodes.push(block.element);
    } else if (part.length > 0) {
      nodes.push(...parseInlineMarkdown(part));
    }
  }

  return nodes.length === 1 ? nodes[0] : <>{nodes}</>;
}

/** Parse inline markdown syntax into React elements */
function parseInlineMarkdown(text: string): ReactNode[] {
  const result: ReactNode[] = [];

  // Combined pattern for all inline syntax
  // Order matters: bold+italic before bold before italic, underline (__ before _), spoiler, strikethrough, masked links, bare URLs
  const pattern =
    /(\*\*\*(.+?)\*\*\*)|(\*\*(.+?)\*\*)|(\_\_(.+?)\_\_)|(\*(.+?)\*)|(_([^_\s][^_]*?)_(?!\w))|(~~(.+?)~~)|(\|\|(.+?)\|\|)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<>)\]]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // ***bold italic***
      result.push(
        <strong key={nextKey()}>
          <em>{parseInlineMarkdown(match[2])}</em>
        </strong>
      );
    } else if (match[3]) {
      // **bold**
      result.push(<strong key={nextKey()}>{parseInlineMarkdown(match[4])}</strong>);
    } else if (match[5]) {
      // __underline__
      result.push(<u key={nextKey()}>{parseInlineMarkdown(match[6])}</u>);
    } else if (match[7]) {
      // *italic*
      result.push(<em key={nextKey()}>{parseInlineMarkdown(match[8])}</em>);
    } else if (match[9]) {
      // _italic_
      result.push(<em key={nextKey()}>{parseInlineMarkdown(match[10])}</em>);
    } else if (match[11]) {
      // ~~strikethrough~~
      result.push(<s key={nextKey()}>{parseInlineMarkdown(match[12])}</s>);
    } else if (match[13]) {
      // ||spoiler||
      result.push(
        <Spoiler key={nextKey()}>{parseInlineMarkdown(match[14])}</Spoiler>
      );
    } else if (match[15]) {
      // [text](url) - masked link
      const url = match[17];
      if (/^https?:\/\//.test(url)) {
        result.push(
          <a
            key={nextKey()}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-th-brand hover:underline"
          >
            {match[16]}
          </a>
        );
      } else {
        result.push(match[0]);
      }
    } else if (match[18]) {
      // bare URL auto-link
      const url = match[18];
      result.push(
        <a
          key={nextKey()}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-th-brand hover:underline"
        >
          {url}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}
