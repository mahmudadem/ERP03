import React from 'react';

const formatBold = (text: string) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, idx) => 
    idx % 2 === 1 ? <strong key={idx} className="font-semibold text-gray-900">{part}</strong> : part
  );
};

const renderMarkdown = (text: string) => {
  // Simple markdown parser for tables and bold text
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Check for table
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|--')) {
      const headers = line.split('|').filter(s => s.trim().length > 0 || line.includes('||')).map(s => s.trim());
      i += 2; // skip header and separator
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].split('|').filter(s => s.trim().length > 0 || lines[i].includes('||')).map(s => s.trim());
        rows.push(cells);
        i++;
      }
      
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-4 border border-gray-100 rounded-xl shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50/50">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 tracking-wider">
                    {formatBold(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-gray-50/50 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                      {formatBold(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    
    // Check for lists
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-2 mb-2 last:mb-0 leading-relaxed">
          <span className="text-indigo-400 mt-1.5 text-xs">●</span>
          <span>{formatBold(line.trim().substring(2))}</span>
        </div>
      );
      i++;
      continue;
    }

    if (line.trim().match(/^[0-9]+\.\s/)) {
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-2 mb-2 last:mb-0 leading-relaxed">
          <span className="text-gray-400 font-medium min-w-[1.25rem]">{line.trim().match(/^[0-9]+\./)?.[0]}</span>
          <span>{formatBold(line.trim().replace(/^[0-9]+\.\s/, ''))}</span>
        </div>
      );
      i++;
      continue;
    }
    
    // Regular paragraph
    if (line.trim() === '') {
       // Just a spacer
       elements.push(<div key={`space-${i}`} className="h-2"></div>);
    } else {
      elements.push(
        <div key={`p-${i}`} className="mb-1 last:mb-0 leading-relaxed">
          {formatBold(line)}
        </div>
      );
    }
    i++;
  }
  
  return <>{elements}</>;
};

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div dir="auto" className="markdown-body">
      {renderMarkdown(content)}
    </div>
  );
};
